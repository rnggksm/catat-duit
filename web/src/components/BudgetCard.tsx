import { Link } from 'react-router-dom';
import { formatRupiah } from '../lib/format';
import { useBudgets } from '../lib/queries';
import { BudgetBar, StatusChip } from './Budget';

/** Ringkasan anggaran di Beranda. Tidak tampil sama sekali bila belum ada anggaran (fitur opsional). */
export function BudgetCard() {
  const budgets = useBudgets(0);
  const b = budgets.data;
  if (!b) return null;
  const rows = b.categories.filter((c) => c.amount != null);
  if (rows.length === 0 && b.total.amount == null) return null;
  const top = [...rows].sort((a, x) => (x.pct ?? 0) - (a.pct ?? 0)).slice(0, 3);

  return (
    <section aria-label="Anggaran" className="flex flex-col gap-3.5 rounded-card border border-line-soft bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Anggaran</h2>
        <Link to="/anggaran" className="py-2 text-sm font-semibold text-primary">
          Atur
        </Link>
      </div>
      {b.total.amount != null && b.total.status && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-semibold">Total</span>
            <span className="text-muted">
              {formatRupiah(b.total.spent)} / {formatRupiah(b.total.amount)}
            </span>
          </div>
          <BudgetBar pct={b.total.pct ?? 0} status={b.total.status} />
        </div>
      )}
      {top.map((c) => (
        <Link key={c.categoryId} to="/anggaran" className="flex flex-col gap-1.5 text-ink">
          <div className="flex items-center gap-2 text-sm">
            <span className="min-w-0 grow truncate font-semibold">{c.name}</span>
            {c.status && <StatusChip status={c.status} />}
          </div>
          {c.status && <BudgetBar pct={c.pct ?? 0} status={c.status} />}
          <span className="text-xs text-muted">
            {(c.remaining ?? 0) >= 0 ? `Sisa ${formatRupiah(c.remaining ?? 0)}` : `Lewat ${formatRupiah(Math.abs(c.remaining ?? 0))}`} dari{' '}
            {formatRupiah(c.amount ?? 0)}
          </span>
        </Link>
      ))}
      {rows.length > 3 && (
        <Link to="/anggaran" className="text-center text-[13px] font-semibold text-primary">
          Lihat {rows.length - 3} anggaran lainnya
        </Link>
      )}
    </section>
  );
}
