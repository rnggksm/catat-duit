import { useDeferredValue, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { TxRow } from '../components/TxRow';
import { useAuth } from '../lib/auth';
import { dayKey, dayLabel, formatNumber, periodOf, shiftPeriod } from '../lib/format';
import { pendingTransactions, useOutbox } from '../lib/offline';
import { useCategories, useTransactions, useWallets } from '../lib/queries';
import type { Transaction } from '../lib/types';

const selectCls =
  'h-9 shrink-0 appearance-none rounded-full border border-line bg-card pl-3 pr-8 text-[13px] font-semibold text-ink bg-[length:14px] bg-[right_10px_center] bg-no-repeat';
const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231B1830' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")";

/** Filter yang sedang aktif tampil gelap, supaya jelas apa yang sedang menyaring daftar. */
const activeCls = 'border-night bg-night text-white';
const chevronLight = chevron.replace('%231B1830', '%23FFFFFF');

/** Riwayat per hari dengan filter (PRD 5.4, mockup layar 05). */
export function RiwayatPage() {
  const { me } = useAuth();
  const startDay = me?.household.periodStartDay ?? 25;
  const [params] = useSearchParams();
  // Bisa dibuka dari Detail kategori: /riwayat?kategori=<id>&periode=-1
  const [offset, setOffset] = useState(() => Math.max(-5, Math.min(0, Number(params.get('periode') ?? 0) || 0)));
  const [categoryId, setCategoryId] = useState(() => params.get('kategori') ?? '');
  const [walletId, setWalletId] = useState('');
  const [q, setQ] = useState('');
  const query = useDeferredValue(q.trim());

  const current = periodOf(startDay);
  const period = shiftPeriod(startDay, current, offset);
  const periods = Array.from({ length: 6 }, (_, i) => shiftPeriod(startDay, current, -i));

  const categories = useCategories();
  const wallets = useWallets();
  const txs = useTransactions({
    from: period.start.toISOString(),
    to: period.endExclusive.toISOString(),
    categoryId: categoryId || undefined,
    walletId: walletId || undefined,
    q: query || undefined,
  });
  const outbox = useOutbox();

  const groups = useMemo(() => {
    const queued = new Set(outbox.map((o) => o.id));
    const server = (txs.data?.pages ?? []).flatMap((p) => p.items).filter((t) => !queued.has(t.id));
    const unfiltered = !categoryId && !walletId && !query;
    const pending = unfiltered
      ? pendingTransactions(outbox, me?.user.name ?? '').filter((t) => {
          const at = new Date(t.occurredAt);
          return at >= period.start && at < period.endExclusive;
        })
      : [];
    const all = [...pending, ...server].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const map = new Map<string, { label: string; subtotal: number; items: Transaction[] }>();
    for (const t of all) {
      const d = new Date(t.occurredAt);
      const k = dayKey(d);
      const g = map.get(k) ?? { label: dayLabel(d), subtotal: 0, items: [] };
      g.subtotal += t.amount;
      g.items.push(t);
      map.set(k, g);
    }
    return [...map.values()];
  }, [txs.data, outbox, categoryId, walletId, query, me, period.start, period.endExclusive]);

  const first = txs.data?.pages[0];

  return (
    <main className="flex flex-col gap-4 px-5 pb-32 pt-6">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Riwayat</h1>
        {first && (
          <span className="text-right text-[13px] text-muted">
            {first.count} transaksi · Rp {formatNumber(first.total)}
          </span>
        )}
      </header>

      <div className="flex flex-col gap-2.5">
        <label className="flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-card px-3.5">
          <Icon name="search" size={20} className="text-muted" />
          <span className="sr-only">Cari transaksi</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari catatan, mis. laundry"
            className="grow bg-transparent text-sm outline-none"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <select
            aria-label="Periode"
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value))}
            className={`${selectCls} ${activeCls}`}
            style={{ backgroundImage: chevronLight }}
          >
            {periods.map((p, i) => (
              <option key={p.rangeLabel} value={-i}>
                {p.name} ({p.rangeLabel})
              </option>
            ))}
          </select>
          <select
            aria-label="Kategori"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={`${selectCls} ${categoryId ? activeCls : ''}`}
            style={{ backgroundImage: categoryId ? chevronLight : chevron }}
          >
            <option value="">Semua kategori</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Dompet"
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            className={`${selectCls} ${walletId ? activeCls : ''}`}
            style={{ backgroundImage: walletId ? chevronLight : chevron }}
          >
            <option value="">Semua dompet</option>
            {wallets.data?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {txs.isLoading && <p className="py-6 text-center text-sm text-muted">Memuat transaksi…</p>}
      {txs.isError && groups.length === 0 && (
        <p role="alert" className="py-6 text-center text-sm text-[#B42E27]">
          Riwayat tidak bisa dimuat. Periksa koneksi internet.
        </p>
      )}
      {!txs.isLoading && groups.length === 0 && !txs.isError && (
        <p className="rounded-[22px] border border-line-soft bg-card px-5 py-10 text-center text-sm text-muted">
          {query || categoryId || walletId ? 'Tidak ada transaksi yang cocok dengan filter.' : `Belum ada catatan di periode ${period.name}.`}
        </p>
      )}

      {groups.map((g) => (
        <section key={g.label} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between px-1 pt-1">
            <h2 className="text-sm font-bold">{g.label}</h2>
            <span className="text-[13px] font-semibold text-muted">−Rp {formatNumber(g.subtotal)}</span>
          </div>
          <div className="rounded-[22px] border border-line-soft bg-card px-4">
            {g.items.map((t) => (
              <TxRow key={t.id} tx={t} />
            ))}
          </div>
        </section>
      ))}

      {txs.hasNextPage && (
        <button
          type="button"
          onClick={() => txs.fetchNextPage()}
          disabled={txs.isFetchingNextPage}
          className="h-12 rounded-2xl border border-line bg-card text-sm font-semibold"
        >
          {txs.isFetchingNextPage ? 'Memuat…' : 'Muat lebih banyak'}
        </button>
      )}
      {groups.length > 0 && <p className="text-center text-xs text-muted">Ketuk transaksi untuk mengubah atau menghapus.</p>}
    </main>
  );
}
