import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, iconColor, tint } from '../components/Icon';
import { NewCategorySheet } from '../components/NewCategorySheet';
import { useAuth } from '../lib/auth';
import { formatNumber, toLocalInput } from '../lib/format';
import { queueDelete, queueUpsert, settle } from '../lib/offline';
import { byUsage, useBudgets, useCategories, useNoteSuggestions, useWallets } from '../lib/queries';
import type { Category, CategoryRef } from '../lib/types';
import { uuid } from '../lib/uuid';

const LAST_WALLET = 'cd:lastWallet';
const MAX_AMOUNT = 1_000_000_000;
const KEYS = ['1', '2', '3', 'back', '4', '5', '6', '+', '7', '8', '9', '-', '000', '0'] as const;

/** Pesan peringatan anggaran yang ditampilkan di Beranda setelah simpan. */
export interface Flash {
  level: 'warn' | 'over';
  text: string;
}

export interface TransactionFormInitial {
  id: string;
  amount: number;
  categoryId: string;
  walletId: string;
  occurredAt: string;
  note: string | null;
  /** Siapa yang mencatat; hanya terisi saat mengubah transaksi yang sudah tersimpan. */
  createdBy?: { id: string; name: string };
}

/** Hitung ekspresi keypad sederhana: "20000+5000-1000" → 24000. */
function evaluate(expr: string) {
  const tokens = expr.match(/[+-]|\d+/g) ?? [];
  let total = 0;
  let sign = 1;
  for (const t of tokens) {
    if (t === '+') sign = 1;
    else if (t === '-') sign = -1;
    else total += sign * parseInt(t, 10);
  }
  return total;
}

function pressKey(expr: string, key: (typeof KEYS)[number]) {
  const isOp = (c: string) => c === '+' || c === '-';
  if (key === 'back') return expr.slice(0, -1);
  if (key === '+' || key === '-') {
    if (expr === '') return expr;
    return (isOp(expr[expr.length - 1]) ? expr.slice(0, -1) : expr) + key;
  }
  const parts = expr.split(/[+-]/);
  const last = parts[parts.length - 1];
  if (last.length >= 10) return expr;
  if (last === '' && key === '000') return expr;
  if (last === '0') return expr.slice(0, -1) + key;
  return expr + key;
}

function findRoot(categories: Category[], categoryId: string) {
  return categories.find((c) => c.id === categoryId || c.children.some((ch) => ch.id === categoryId));
}

/** Layar catat & ubah pengeluaran (PRD 5.1, mockup layar 04 & 06). */
export function TransactionForm({ initial, onDeleted }: { initial?: TransactionFormInitial; onDeleted?: () => void }) {
  const navigate = useNavigate();
  const { me } = useAuth();
  const isEdit = !!initial;
  const categories = useCategories();
  const wallets = useWallets();
  const budgets = useBudgets(0);

  const [expr, setExpr] = useState(initial ? String(initial.amount) : '');
  const [rootId, setRootId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [catTouched, setCatTouched] = useState(isEdit);
  const [walletId, setWalletId] = useState<string | null>(initial?.walletId ?? null);
  const [when, setWhen] = useState(toLocalInput(initial ? new Date(initial.occurredAt) : new Date()));
  const [note, setNote] = useState(initial?.note ?? '');
  const [showAll, setShowAll] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => byUsage(categories.data ?? []), [categories.data]);
  const deferredNote = useDeferredValue(note);
  const suggestions = useNoteSuggestions(deferredNote);

  // Isi kategori dari data awal (mode ubah).
  useEffect(() => {
    if (!initial || !categories.data || rootId) return;
    const root = findRoot(categories.data, initial.categoryId);
    if (root) {
      setRootId(root.id);
      setSubId(root.id === initial.categoryId ? null : initial.categoryId);
    }
  }, [initial, categories.data, rootId]);

  // Dompet default = terakhir dipakai.
  useEffect(() => {
    if (walletId || !wallets.data?.length) return;
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_WALLET);
    } catch {
      /* abaikan */
    }
    setWalletId(wallets.data.find((w) => w.id === last)?.id ?? wallets.data[0].id);
  }, [wallets.data, walletId]);

  // Catatan yang pernah dipakai langsung memilih kategorinya, selama kategori belum dipilih manual.
  useEffect(() => {
    if (catTouched || !categories.data) return;
    const match = suggestions.data?.find((s) => s.note.toLowerCase() === deferredNote.trim().toLowerCase());
    if (!match) return;
    const root = findRoot(categories.data, match.categoryId);
    if (root) {
      setRootId(root.id);
      setSubId(root.id === match.categoryId ? null : match.categoryId);
    }
  }, [suggestions.data, deferredNote, catTouched, categories.data]);

  const total = evaluate(expr);
  const hasOp = /[+-]/.test(expr);
  const root = sorted.find((c) => c.id === rootId) ?? null;
  const visible = showAll ? sorted : sorted.slice(0, 4);
  const grid = root && !visible.includes(root) ? [...visible.slice(0, 3), root] : visible;
  const chips = (suggestions.data ?? []).filter((s) => s.note.toLowerCase() !== note.trim().toLowerCase()).slice(0, 4);

  function pickCategory(c: Category) {
    setRootId(c.id);
    setSubId(null);
    setCatTouched(true);
    setError(null);
  }

  /** Peringatan anggaran (PRD 5.6) bila catatan baru ini melewati 80% atau 100% anggaran. */
  function budgetWarning(rootId: string, rootName: string, amount: number): Flash | undefined {
    const b = budgets.data;
    if (!b || !b.period.isCurrent) return undefined;
    // Hanya untuk catatan yang tanggalnya masuk periode berjalan.
    const at = new Date(when);
    if (at < new Date(b.period.start) || at >= new Date(b.period.end)) return undefined;
    const check = (label: string, budget: number | null, spent: number) => {
      if (!budget) return undefined;
      const before = (spent / budget) * 100;
      const after = ((spent + amount) / budget) * 100;
      if (before < 100 && after >= 100)
        return { level: 'over' as const, text: `${label} melewati anggaran: Rp ${formatNumber(spent + amount)} dari Rp ${formatNumber(budget)}.` };
      if (before < b.warnPct && after >= b.warnPct)
        return { level: 'warn' as const, text: `${label} sudah ${Math.round(after)}% dari anggaran. Sisa Rp ${formatNumber(budget - spent - amount)}.` };
      return undefined;
    };
    const row = b.categories.find((c) => c.categoryId === rootId);
    return check(rootName, row?.amount ?? null, row?.spent ?? 0) ?? check('Total pengeluaran', b.total.amount, b.total.spent);
  }

  async function save() {
    if (total <= 0) return setError('Masukkan nominal pengeluaran.');
    if (total > MAX_AMOUNT) return setError('Nominal maksimal Rp 1.000.000.000.');
    if (!root) return setError('Pilih kategori dulu.');
    const wallet = wallets.data?.find((w) => w.id === walletId);
    if (!wallet) return setError('Pilih dompet dulu.');

    const sub = root.children.find((ch) => ch.id === subId);
    const categoryId = sub?.id ?? root.id;
    const displayCategory: CategoryRef = sub
      ? { id: sub.id, name: sub.name, icon: root.icon, color: root.color, parent: { id: root.id, name: root.name, icon: root.icon, color: root.color } }
      : { id: root.id, name: root.name, icon: root.icon, color: root.color, parent: null };

    // Hitung peringatan anggaran dari data sebelum catatan ini masuk.
    const flash = isEdit ? undefined : budgetWarning(root.id, root.name, total);
    setSaving(true);
    // Tunggu sinkron (maks. 2,5 detik) agar Beranda langsung menampilkan angka terbaru.
    await settle(
      queueUpsert(
        initial?.id ?? uuid(),
        { amount: total, categoryId, walletId: wallet.id, occurredAt: new Date(when).toISOString(), note: note.trim() || undefined },
        { category: displayCategory, walletName: wallet.name },
      ),
    );
    try {
      localStorage.setItem(LAST_WALLET, wallet.id);
    } catch {
      /* abaikan */
    }
    if (isEdit) navigate(-1);
    else navigate('/', { replace: true, state: { flash } });
  }

  async function remove() {
    if (!initial) return;
    setSaving(true);
    await settle(queueDelete(initial.id));
    onDeleted?.();
    navigate('/riwayat', { replace: true });
  }

  return (
    <main className="relative flex h-screen-safe flex-col bg-card px-5 pt-4">
      {/* Latar putih ikut naik ke area status bar supaya tidak ada pita warna halaman di atas form. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bg-card"
        style={{ top: 'calc(var(--safe-top) * -1)', height: 'var(--safe-top)' }}
      />
      {/* Area gulir terpisah: form di sini boleh menggulir, numpad di bawah tidak ikut dan
          tidak pernah menutupi isi form. */}
      <div className="flex grow flex-col gap-3.5 overflow-y-auto overscroll-contain pb-1">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Tutup"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-chip"
        >
          <Icon name={isEdit ? 'chevronLeft' : 'close'} size={20} strokeWidth={2} />
        </button>
        <h1 className="font-display text-xl font-bold">{isEdit ? 'Ubah pengeluaran' : 'Catat pengeluaran'}</h1>
        {isEdit ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Hapus transaksi"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FDE6E4] text-[#B42E27]"
          >
            <Icon name="trash" size={20} />
          </button>
        ) : (
          <span className="w-11" />
        )}
      </header>

      {isEdit && initial?.createdBy && (
        <p className="-mt-1 text-center text-xs text-muted">
          Dicatat oleh{' '}
          <span className="font-semibold text-ink">
            {initial.createdBy.id === me?.user.id ? 'kamu' : initial.createdBy.name}
          </span>
        </p>
      )}

      <div className="flex flex-col items-center gap-0.5 py-1">
        <span className="text-[13px] text-muted">Nominal</span>
        <span aria-live="polite" className={`font-display text-[42px] font-extrabold tracking-tight ${total > 0 ? 'text-ink' : 'text-muted'}`}>
          Rp {formatNumber(Math.max(total, 0))}
        </span>
        <span className="min-h-[18px] text-[13px] text-muted">
          {hasOp ? expr.replace(/\d+/g, (n) => formatNumber(Number(n))).replace(/\+/g, ' + ').replace(/-/g, ' − ') : 'Bisa hitung, mis. 20000 + 5000'}
        </span>
      </div>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-muted">Kategori</span>
          {sorted.length > 4 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="py-1 text-[13px] font-semibold text-primary">
              {showAll ? 'Lebih sedikit' : `Semua kategori (${sorted.length})`}
            </button>
          )}
        </div>
        {categories.isLoading && <p className="text-sm text-muted">Memuat kategori…</p>}
        {categories.isError && <p className="text-sm text-[#B42E27]">Kategori tidak bisa dimuat. Periksa koneksi.</p>}
        <div className="grid grid-cols-4 gap-2">
          {grid.map((c) => {
            const on = c.id === rootId;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={c.name}
                aria-pressed={on}
                onClick={() => pickCategory(c)}
                className="flex flex-col items-center gap-1.5 py-1"
              >
                <span
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px]"
                  style={
                    on
                      ? { background: iconColor(c.color), color: '#fff', boxShadow: `0 0 0 3px #fff, 0 0 0 5px ${iconColor(c.color)}` }
                      : { background: tint(c.color), color: iconColor(c.color) }
                  }
                >
                  <Icon name={c.icon} />
                </span>
                <span className={`max-w-full truncate text-xs ${on ? 'font-bold' : 'font-medium'}`}>{c.name}</span>
              </button>
            );
          })}
          {showAll && (
            <button type="button" aria-label="Tambah kategori baru" onClick={() => setSheetOpen(true)} className="flex flex-col items-center gap-1.5 py-1 text-primary-strong">
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border-2 border-dashed border-[#B9ADEF] bg-[#F4F1FF]">
                <Icon name="plus" strokeWidth={2.2} />
              </span>
              <span className="text-xs font-bold">Baru</span>
            </button>
          )}
        </div>
        {root && root.children.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={`Sub-kategori ${root.name}`}>
            {root.children.map((ch) => {
              const on = ch.id === subId;
              return (
                <button
                  key={ch.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSubId(on ? null : ch.id)}
                  className="h-8 shrink-0 rounded-full px-3 text-xs font-semibold"
                  style={
                    on
                      ? { background: tint(root.color, 0.32), color: '#1B1830', boxShadow: `inset 0 0 0 1.5px ${iconColor(root.color)}` }
                      : { background: tint(root.color), color: '#1B1830' }
                  }
                >
                  {ch.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2 pb-1" role="group" aria-label="Dompet">
        {wallets.data?.map((w) => (
          <button
            key={w.id}
            type="button"
            aria-pressed={w.id === walletId}
            onClick={() => setWalletId(w.id)}
            className={`flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-[14px] border px-2.5 text-[13px] font-semibold ${
              w.id === walletId ? 'border-primary bg-primary-soft text-primary-strong' : 'border-line bg-card'
            }`}
          >
            <Icon name="wallet" size={16} />
            {w.name}
          </button>
        ))}
      </div>

      <label className="flex h-11 items-center gap-2 rounded-[14px] border border-line px-3 text-[13px] font-semibold">
        <Icon name="calendar" size={18} className="text-primary" />
        <span className="sr-only">Tanggal dan jam</span>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="grow bg-transparent font-sans text-[13px] outline-none"
        />
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor="catatan" className="sr-only">Catatan</label>
        <input
          id="catatan"
          value={note}
          maxLength={120}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Tulis catatan (opsional)"
          className="h-[46px] rounded-[14px] border-[1.5px] border-line bg-[#FAF8F4] px-3.5 text-sm outline-none focus:border-primary"
        />
        {chips.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {chips.map((s) => (
              <button
                key={`${s.note}-${s.categoryId}`}
                type="button"
                onClick={() => {
                  setNote(s.note);
                  const r = categories.data && findRoot(categories.data, s.categoryId);
                  if (r) {
                    setRootId(r.id);
                    setSubId(r.id === s.categoryId ? null : s.categoryId);
                    setCatTouched(true);
                  }
                }}
                className="h-8 shrink-0 rounded-full bg-primary-soft px-3 text-xs font-semibold text-primary-strong"
              >
                {s.note}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-[#FDE6E4] px-4 py-2.5 text-sm font-semibold text-[#B42E27]">
          {error}
        </p>
      )}
      </div>

      {/* Numpad selalu terlihat di bawah, tidak ikut menggulir bersama form. Padding bawah
          memakai safe area supaya baris terakhir tidak tertimpa home indicator. */}
      <div
        className="grid shrink-0 grid-cols-4 gap-2 pt-2"
        style={{ paddingBottom: 'max(16px, var(--safe-bottom))' }}
      >
        {KEYS.map((k) => {
          const op = k === '+' || k === '-';
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setExpr((e) => pressKey(e, k));
                setError(null);
              }}
              aria-label={k === 'back' ? 'Hapus angka' : k === '+' ? 'Tambah' : k === '-' ? 'Kurang' : k}
              className={`flex h-[52px] items-center justify-center rounded-[14px] font-display text-[22px] font-semibold active:scale-95 ${
                op ? 'bg-primary-soft text-primary-strong' : 'bg-chip text-ink'
              }`}
            >
              {k === 'back' ? <Icon name="backspace" /> : k === '-' ? '−' : k}
            </button>
          );
        })}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="col-span-2 flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-primary text-base font-bold text-white active:scale-[0.98] disabled:opacity-70"
        >
          <Icon name="check" size={20} strokeWidth={2.2} />
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>

      {sheetOpen && (
        <NewCategorySheet
          existing={categories.data ?? []}
          onClose={() => setSheetOpen(false)}
          onCreated={(c) => {
            setSheetOpen(false);
            setRootId(c.id);
            setSubId(null);
            setCatTouched(true);
          }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-40 mx-auto flex max-w-[480px] items-end">
          <button type="button" aria-label="Batal hapus" onClick={() => setConfirmDelete(false)} className="absolute inset-0 bg-ink/45" />
          <section role="alertdialog" aria-label="Hapus transaksi" className="relative flex w-full flex-col gap-3 rounded-t-[28px] bg-card p-5 pb-8">
            <h2 className="font-display text-xl font-bold">Hapus transaksi ini?</h2>
            <p className="text-sm text-muted">Rp {formatNumber(initial?.amount ?? 0)}{initial?.note ? ` · ${initial.note}` : ''}. Tindakan ini tidak bisa dibatalkan.</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-[52px] rounded-2xl border-[1.5px] border-line font-bold">
                Batal
              </button>
              <button type="button" onClick={remove} disabled={saving} className="h-[52px] rounded-2xl bg-[#C7362F] font-bold text-white disabled:opacity-70">
                Hapus
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
