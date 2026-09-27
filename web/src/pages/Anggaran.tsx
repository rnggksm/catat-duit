import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BudgetBar, BudgetSheet, StatusChip } from '../components/Budget';
import { Icon, iconColor, tint } from '../components/Icon';
import { formatRupiah, rangeLabelFromIso } from '../lib/format';
import { useBudgets } from '../lib/queries';
import type { BudgetRow } from '../lib/types';

type Editing = { kind: 'total' } | { kind: 'category'; row: BudgetRow } | null;

/** Anggaran per kategori (PRD 5.6). Sepenuhnya opsional: pasang hanya di kategori yang ingin dikontrol. */
export function AnggaranPage() {
  const budgets = useBudgets(0);
  const [editing, setEditing] = useState<Editing>(null);
  const b = budgets.data;

  const withBudget = b?.categories.filter((c) => c.amount != null) ?? [];
  const without = b?.categories.filter((c) => c.amount == null) ?? [];
  const daysLeft = b ? b.period.totalDays - b.period.dayIndex : 0;

  return (
    <main className="flex flex-col gap-[18px] px-5 pb-32 pt-5">
      <header className="flex items-center gap-3">
        <Link to="/lainnya" aria-label="Kembali" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink">
          <Icon name="chevronLeft" size={20} strokeWidth={2} />
        </Link>
        <div className="flex flex-col">
          <h1 className="font-display text-2xl font-bold">Anggaran</h1>
          <span className="text-xs text-muted">
            {b ? `Periode ${b.period.name} · ${rangeLabelFromIso(b.period.start, b.period.end)} · sisa ${daysLeft} hari` : ' '}
          </span>
        </div>
      </header>

      {budgets.isLoading && <p className="py-10 text-center text-sm text-muted">Memuat anggaran…</p>}
      {budgets.isError && (
        <p role="alert" className="rounded-[18px] bg-[#FDE6E4] px-4 py-3 text-sm text-[#8A2A24]">
          Anggaran tidak bisa dimuat. Periksa koneksi internet.
        </p>
      )}

      {b && (
        <>
          <button
            type="button"
            onClick={() => setEditing({ kind: 'total' })}
            className="relative flex flex-col gap-3 overflow-hidden rounded-[28px] bg-night p-[22px] text-left text-white"
          >
            <div aria-hidden className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-coral" />
            <span className="relative text-sm text-[#E6E1FF]">Anggaran total periode</span>
            {b.total.amount != null ? (
              <>
                <span className="relative font-display text-[34px] font-extrabold leading-tight tracking-tight">
                  {formatRupiah(b.total.spent)}
                  <span className="font-sans text-base font-semibold text-night-muted"> / {formatRupiah(b.total.amount)}</span>
                </span>
                <span className="relative block h-2.5 overflow-hidden rounded-full bg-white/15">
                  <span
                    className="block h-2.5 rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(2, b.total.pct ?? 0))}%`,
                      background: b.total.status === 'over' ? '#FF8A7A' : b.total.status === 'warn' ? '#F4B63F' : '#7BE0B0',
                    }}
                  />
                </span>
                <span className="relative text-[13px] text-night-muted">
                  {(b.total.remaining ?? 0) >= 0
                    ? `Sisa ${formatRupiah(b.total.remaining ?? 0)}${daysLeft > 0 ? ` · ${formatRupiah(Math.floor((b.total.remaining ?? 0) / daysLeft))}/hari` : ''}`
                    : `Lewat ${formatRupiah(Math.abs(b.total.remaining ?? 0))}`}
                  {' · ketuk untuk ubah'}
                </span>
              </>
            ) : (
              <>
                <span className="relative font-display text-2xl font-bold">Belum dipasang</span>
                <span className="relative text-[13px] text-night-muted">
                  Opsional. Terpakai {formatRupiah(b.total.spent)}.
                  {b.total.suggested ? ` Rata-rata 3 periode ${formatRupiah(b.total.suggested)}.` : ''} Ketuk untuk memasang.
                </span>
              </>
            )}
          </button>

          <section className="flex flex-col gap-2.5">
            <h2 className="px-1 text-sm font-bold">Kategori ber-anggaran ({withBudget.length})</h2>
            {withBudget.length === 0 && (
              <p className="rounded-[22px] border border-line-soft bg-card px-5 py-6 text-center text-sm leading-relaxed text-muted">
                Belum ada. Pilih kategori di bawah yang ingin kamu batasi, misalnya Makan & Minum atau Hiburan.
              </p>
            )}
            {withBudget.map((c) => (
              <button
                key={c.categoryId}
                type="button"
                onClick={() => setEditing({ kind: 'category', row: c })}
                className="flex flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]" style={{ background: tint(c.color), color: iconColor(c.color) }}>
                    <Icon name={c.icon} size={20} />
                  </span>
                  <span className="flex min-w-0 grow flex-col">
                    <span className="truncate text-[15px] font-semibold">{c.name}</span>
                    <span className="text-xs text-muted">
                      {formatRupiah(c.spent)} dari {formatRupiah(c.amount ?? 0)}
                    </span>
                  </span>
                  {c.status && <StatusChip status={c.status} />}
                </span>
                {c.status && <BudgetBar pct={c.pct ?? 0} status={c.status} />}
                <span className="text-xs text-muted">
                  {(c.remaining ?? 0) >= 0 ? `Sisa ${formatRupiah(c.remaining ?? 0)}` : `Lewat ${formatRupiah(Math.abs(c.remaining ?? 0))}`} ·{' '}
                  {(c.pct ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}% terpakai
                </span>
              </button>
            ))}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="px-1 text-sm font-bold">Tanpa anggaran</h2>
            <div className="rounded-[22px] border border-line-soft bg-card px-4">
              {without.map((c) => (
                <button
                  key={c.categoryId}
                  type="button"
                  onClick={() => setEditing({ kind: 'category', row: c })}
                  className="flex min-h-[60px] w-full items-center gap-3 border-t border-[#F1EDE6] py-2 text-left first:border-t-0"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: tint(c.color), color: iconColor(c.color) }}>
                    <Icon name={c.icon} size={18} />
                  </span>
                  <span className="flex min-w-0 grow flex-col">
                    <span className="truncate text-sm font-semibold">{c.name}</span>
                    <span className="text-xs text-muted">
                      Terpakai {formatRupiah(c.spent)}
                      {c.suggested ? ` · rata-rata ${formatRupiah(c.suggested)}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-primary">+ Pasang</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {editing && b && (
        <BudgetSheet
          categoryId={editing.kind === 'category' ? editing.row.categoryId : undefined}
          title={editing.kind === 'category' ? editing.row.name : 'total'}
          icon={editing.kind === 'category' ? editing.row.icon : 'wallet'}
          color={editing.kind === 'category' ? editing.row.color : '#5B3FD6'}
          current={editing.kind === 'category' ? editing.row.amount : b.total.amount}
          suggested={editing.kind === 'category' ? editing.row.suggested : b.total.suggested}
          spent={editing.kind === 'category' ? editing.row.spent : b.total.spent}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}
