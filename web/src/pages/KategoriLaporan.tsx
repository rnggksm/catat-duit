import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ColumnChart } from '../components/ColumnChart';
import { Icon, iconColor, tint } from '../components/Icon';
import { TxRow } from '../components/TxRow';
import { formatNumber, formatPct, formatRupiah, rangeLabelFromIso } from '../lib/format';
import { useCategoryReport } from '../lib/queries';

/** Detail satu kategori dalam satu periode (mockup layar 08). */
export function KategoriLaporanPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const offset = Math.min(0, Number(params.get('periode') ?? 0) || 0);
  const report = useCategoryReport(id, offset);
  const r = report.data;
  const back = `/laporan${offset ? `?periode=${offset}` : ''}`;
  const maxSub = r?.subs[0]?.amount ?? 1;

  return (
    <main className="flex flex-col gap-[18px] px-5 pb-32 pt-5">
      <header className="flex items-center gap-3">
        <Link to={back} aria-label="Kembali ke laporan" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink">
          <Icon name="chevronLeft" size={20} strokeWidth={2} />
        </Link>
        <span className="text-sm text-muted">
          {r ? `Periode ${r.period.name} · ${rangeLabelFromIso(r.period.start, r.period.end)}` : ' '}
        </span>
      </header>

      {report.isLoading && <p className="py-10 text-center text-sm text-muted">Memuat…</p>}
      {report.isError && (
        <p role="alert" className="rounded-[18px] bg-[#FDE6E4] px-4 py-3 text-sm text-[#8A2A24]">
          Detail kategori tidak bisa dimuat.
        </p>
      )}

      {r && (
        <>
          <section className="relative flex flex-col gap-3 overflow-hidden rounded-[28px] p-[22px]" style={{ background: tint(r.category.color, 0.2) }}>
            <div aria-hidden className="absolute -right-12 -top-14 h-40 w-40 rounded-full" style={{ background: tint(r.category.color, 0.25) }} />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-[18px] text-white" style={{ background: iconColor(r.category.color) }}>
              <Icon name={r.category.icon} size={26} />
            </span>
            <h1 className="relative font-display text-[26px] font-bold">{r.category.name}</h1>
            <span className="relative font-display text-[38px] font-extrabold leading-tight tracking-tight">{formatRupiah(r.amount)}</span>
            <span className="relative text-sm font-semibold">
              {formatPct(r.pctOfTotal)} dari total · {r.count} transaksi
              {r.count ? ` · rata-rata ${formatRupiah(r.avgPerTransaction)}` : ''}
            </span>
          </section>

          {r.subs.length > 1 && (
            <section className="flex flex-col gap-3.5 rounded-card border border-line-soft bg-card p-5">
              <h2 className="font-display text-lg font-bold">Sub-kategori</h2>
              {r.subs.map((s) => (
                <div key={s.id} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-semibold">{s.name}</span>
                    <span>
                      <b>{formatPct(s.pct)}</b> <span className="text-muted">· Rp {formatNumber(s.amount)}</span>
                    </span>
                  </div>
                  <span className="h-2.5 rounded-full" style={{ background: tint(r.category.color, 0.14) }}>
                    <span className="block h-2.5 rounded-full" style={{ width: `${Math.max(2, (s.amount / maxSub) * 100)}%`, background: r.category.color }} />
                  </span>
                </div>
              ))}
            </section>
          )}

          <section className="flex flex-col gap-2 rounded-card border border-line-soft bg-card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold">{r.trend.length} periode terakhir</h2>
              <span className="text-xs text-muted">ribu rupiah</span>
            </div>
            <ColumnChart
              highlight={r.trend.length - 1}
              color={r.category.color}
              soft={tint(r.category.color, 0.3)}
              height={110}
              columns={r.trend.map((t) => ({
                label: t.name.slice(0, 3),
                value: t.total,
                valueLabel: formatNumber(Math.round(t.total / 1000)),
                detail: `Periode ${t.name}: ${formatRupiah(t.total)}`,
              }))}
            />
            {r.avgPrev3 != null && r.vsAvgPrev3Pct != null && (
              <p className="text-[13px] text-[#4F4A5C]">
                Rata-rata {r.avgPrevCount} periode sebelumnya {formatRupiah(r.avgPrev3)}; periode {r.period.name}
                {r.period.isCurrent ? ' (sejauh ini)' : ''} {formatPct(Math.abs(r.vsAvgPrev3Pct))}{' '}
                {r.vsAvgPrev3Pct >= 0 ? 'di atasnya' : 'di bawahnya'}.
              </p>
            )}
          </section>

          <section className="flex flex-col rounded-card border border-line-soft bg-card px-5 pb-2 pt-2">
            <div className="flex items-center justify-between pt-2">
              <h2 className="font-display text-lg font-bold">Transaksi</h2>
              <Link to={`/riwayat?kategori=${r.category.id}${offset ? `&periode=${offset}` : ''}`} className="py-2.5 text-sm font-semibold text-primary">
                Lihat {r.count}
              </Link>
            </div>
            {r.transactions.length === 0 && <p className="py-4 text-sm text-muted">Tidak ada transaksi di periode ini.</p>}
            {r.transactions.map((t) => (
              <TxRow key={t.id} tx={t} showDate />
            ))}
          </section>
        </>
      )}
    </main>
  );
}
