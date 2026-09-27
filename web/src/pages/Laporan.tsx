import { Link, useSearchParams } from 'react-router-dom';
import { ColumnChart } from '../components/ColumnChart';
import { Donut, topWithOthers } from '../components/Donut';
import { HematCard } from '../components/HematCard';
import { Icon } from '../components/Icon';
import { formatJuta, formatNumber, formatPct, formatRupiah, rangeLabelFromIso } from '../lib/format';
import { usePeriodReport } from '../lib/queries';

const HARI_PANJANG: Record<string, string> = { Sen: 'Senin', Sel: 'Selasa', Rab: 'Rabu', Kam: 'Kamis', Jum: 'Jumat', Sab: 'Sabtu', Min: 'Minggu' };
const card = 'flex flex-col gap-4 rounded-card border border-line-soft bg-card p-5';
const h2 = 'font-display text-[19px] font-bold';

/** Laporan per periode gajian (PRD 5.5, mockup layar 07). */
export function LaporanPage() {
  const [params, setParams] = useSearchParams();
  const offset = Math.min(0, Number(params.get('periode') ?? 0) || 0);
  const report = usePeriodReport(offset);
  const r = report.data;

  const go = (next: number) => setParams(next === 0 ? {} : { periode: String(next) }, { replace: true });

  const legend = r ? topWithOthers(r.categories) : [];
  const maxPct = r?.categories[0]?.pct ?? 100;
  const increases = r?.changes.filter((c) => c.delta > 0) ?? [];
  const biggestUp = increases[0];
  const weekdayMax = r ? r.weekday.reduce((best, d, i, arr) => (d.avg > arr[best].avg ? i : best), 0) : 0;
  const otherDaysAvg =
    r && r.weekday.length > 1
      ? r.weekday.filter((_, i) => i !== weekdayMax).reduce((s, d) => s + d.avg, 0) / (r.weekday.length - 1)
      : 0;
  const ratio = otherDaysAvg > 0 && r ? r.weekday[weekdayMax].avg / otherDaysAvg : 0;

  return (
    <main className="flex flex-col gap-[18px] px-5 pb-32 pt-6">
      <header className="flex flex-col gap-3.5">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Laporan</h1>
        <div className="flex items-center justify-between rounded-[18px] border border-line-soft bg-card p-1">
          <button
            type="button"
            aria-label="Periode sebelumnya"
            onClick={() => go(offset - 1)}
            className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-chip"
          >
            <Icon name="chevronLeft" size={20} strokeWidth={2} />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-base font-bold">Periode {r?.period.name ?? '…'}</span>
            <span className="text-xs text-muted">
              {r ? `${rangeLabelFromIso(r.period.start, r.period.end)} · ${r.period.isCurrent ? `hari ke-${r.period.daysElapsed} dari ${r.period.totalDays}` : `${r.period.totalDays} hari`}` : ' '}
            </span>
          </div>
          <button
            type="button"
            aria-label="Periode berikutnya"
            onClick={() => go(offset + 1)}
            disabled={offset === 0}
            className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-chip disabled:opacity-35"
          >
            <Icon name="chevronRight" size={20} strokeWidth={2} />
          </button>
        </div>
      </header>

      {report.isLoading && <p className="py-10 text-center text-sm text-muted">Menyusun laporan…</p>}
      {report.isError && (
        <p role="alert" className="rounded-[18px] bg-[#FDE6E4] px-4 py-3 text-sm text-[#8A2A24]">
          Laporan tidak bisa dimuat. Periksa koneksi internet lalu coba lagi.
        </p>
      )}

      {r && (
        <section aria-label="Ringkasan" className="relative flex flex-col gap-3.5 overflow-hidden rounded-[28px] bg-night p-[22px] text-white">
          <div aria-hidden className="absolute -right-10 -top-12 h-[104px] w-[104px] rotate-[18deg] rounded-[30px] bg-teal" />
          <div aria-hidden className="absolute right-[76px] top-3 h-7 w-7 rounded-full bg-coral" />
          <div className="relative flex flex-col gap-1">
            <span className="text-sm text-[#E6E1FF]">Total pengeluaran</span>
            <span className="font-display text-[40px] font-extrabold leading-tight tracking-tight">{formatRupiah(r.total)}</span>
          </div>
          {r.change.pct != null && r.change.delta !== 0 && (
            <div
              className={`relative flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                r.change.delta < 0 ? 'bg-[rgba(123,224,176,0.16)] text-[#8FF0C0]' : 'bg-[rgba(255,160,140,0.18)] text-[#FFB4A3]'
              }`}
            >
              <Icon name={r.change.delta < 0 ? 'arrowDown' : 'arrowUp'} size={16} strokeWidth={2} />
              {r.change.delta < 0 ? 'Turun' : 'Naik'} {formatPct(Math.abs(r.change.pct))} ({formatRupiah(Math.abs(r.change.delta))}) dari {r.previous.name}
              {r.previous.comparedToSameDay ? ' di hari yang sama' : ''}
            </div>
          )}
          <div className="relative grid grid-cols-3 gap-2">
            {[
              ['Per hari', formatRupiah(r.avgPerDay)],
              ['Transaksi', String(r.count)],
              ['Non-esensial', formatPct(r.nonEssential.pct)],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 rounded-2xl bg-white/[0.08] px-3 py-2.5">
                <span className="text-[11px] text-night-muted">{label}</span>
                <span className="whitespace-nowrap font-display text-[15px] font-bold">{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {r && r.total === 0 && (
        <p className="rounded-[22px] border border-line-soft bg-card px-5 py-10 text-center text-sm text-muted">
          Belum ada pengeluaran di periode {r.period.name}.
        </p>
      )}

      {r && r.total > 0 && (
        <>
          <HematCard offset={offset} />

          <nav aria-label="Bagian laporan" className="sticky top-0 z-10 grid grid-cols-4 gap-1 rounded-2xl bg-[#ECE7DE] p-1">
            {[
              ['#komposisi', 'Komposisi'],
              ['#banding', 'Banding'],
              ['#tren', 'Tren'],
              ['#pola', 'Pola'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="flex h-10 items-center justify-center rounded-xl text-[13px] font-semibold text-[#4F4A5C] hover:bg-card">
                {label}
              </a>
            ))}
          </nav>

          <section id="komposisi" className={`${card} scroll-mt-16`}>
            <h2 className={h2}>Komposisi per kategori</h2>
            <div className="relative self-center">
              <Donut segments={legend} size={210} thickness={5.5} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <span className="text-xs text-muted">Terbesar</span>
                <span className="font-display text-[26px] font-extrabold">{formatPct(r.categories[0].pct)}</span>
                <span className="max-w-[120px] truncate text-xs font-semibold">{r.categories[0].name}</span>
              </div>
            </div>
            <ul className="flex flex-col">
              {r.categories.map((c) => (
                <li key={c.id} className="border-t border-[#F1EDE6] first:border-t-0">
                  <Link to={`/laporan/kategori/${c.id}${offset ? `?periode=${offset}` : ''}`} className="flex flex-col gap-1.5 py-3 text-ink">
                    <span className="flex items-center gap-2.5">
                      <span className="h-3 w-3 shrink-0 rounded" style={{ background: c.color }} />
                      <span className="flex min-w-0 grow flex-col">
                        <span className="truncate text-sm font-semibold">{c.name}</span>
                        <span className="text-xs text-muted">{c.count} transaksi</span>
                      </span>
                      <span className="flex flex-col items-end">
                        <span className="font-display text-[15px] font-bold">{formatPct(c.pct)}</span>
                        <span className="text-xs text-muted">Rp {formatNumber(c.amount)}</span>
                      </span>
                      <Icon name="chevronRight" size={16} className="shrink-0 text-[#B3AC9F]" />
                    </span>
                    <span className="ml-[22px] mr-6 h-1.5 rounded-full bg-[#F1EDE6]">
                      <span className="block h-1.5 rounded-full" style={{ width: `${Math.max(2, (c.pct / maxPct) * 100)}%`, background: c.color }} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section id="banding" className={`${card} scroll-mt-16 gap-3`}>
            <h2 className={h2}>
              Dibanding periode {r.previous.name}
              {r.previous.comparedToSameDay && <span className="block font-sans text-xs font-normal text-muted">sampai hari yang sama</span>}
            </h2>
            {biggestUp && (
              <div className="flex items-start gap-3 rounded-[18px] bg-[#FFF4EC] p-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coral text-white">
                  <Icon name="arrowUp" size={18} strokeWidth={2} />
                </span>
                <span className="text-sm leading-relaxed">
                  Kenaikan terbesar di <b>{biggestUp.name}</b>: naik {formatRupiah(biggestUp.delta)} dari {r.previous.name}.
                </span>
              </div>
            )}
            {r.changes.length === 0 && <p className="text-sm text-muted">Belum ada data periode {r.previous.name} untuk dibandingkan.</p>}
            {r.changes.map((c) => {
              const up = c.delta > 0;
              return (
                <div key={c.id} className="flex items-center gap-2.5 py-1">
                  <span className="h-2.5 w-2.5 shrink-0 rounded" style={{ background: c.color }} />
                  <span className="min-w-0 grow truncate text-sm font-semibold">{c.name}</span>
                  <span className="text-[13px] text-[#4F4A5C]">
                    {up ? '+' : '−'}Rp {formatNumber(Math.abs(c.delta))}
                  </span>
                  <span
                    className={`flex h-7 min-w-[76px] items-center justify-center gap-1 rounded-full text-xs font-bold ${
                      up ? 'bg-[#FDE6E4] text-[#B42E27]' : 'bg-[#DFF3EA] text-[#17704A]'
                    }`}
                  >
                    <Icon name={up ? 'arrowUp' : 'arrowDown'} size={14} strokeWidth={2.2} />
                    {c.deltaPct != null ? formatPct(Math.abs(c.deltaPct)) : 'baru'}
                  </span>
                </div>
              );
            })}
          </section>

          <section id="tren" className={`${card} scroll-mt-16 gap-2`}>
            <div className="flex flex-col gap-0.5">
              <h2 className={h2}>Tren {r.trend.length} periode terakhir</h2>
              <span className="text-xs text-muted">Total pengeluaran, juta rupiah</span>
            </div>
            <ColumnChart
              highlight={r.trend.length - 1}
              columns={r.trend.map((t) => ({
                label: t.name.slice(0, 3),
                value: t.total,
                valueLabel: formatJuta(t.total),
                detail: `Periode ${t.name}: ${formatRupiah(t.total)}`,
              }))}
            />
          </section>

          <section className={card}>
            <h2 className={h2}>Esensial vs non-esensial</h2>
            <div className="flex h-[18px] gap-[2px] overflow-hidden rounded-full" aria-hidden>
              {r.essential.amount > 0 && <span style={{ width: `${r.essential.pct}%`, background: '#5B3FD6' }} />}
              {r.nonEssential.amount > 0 && <span className="grow" style={{ background: '#FF7A59' }} />}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                ['Esensial', '#5B3FD6', r.essential],
                ['Non-esensial', '#FF7A59', r.nonEssential],
              ].map(([label, color, v]) => {
                const val = v as { amount: number; pct: number };
                return (
                  <div key={label as string} className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-[13px] text-[#4F4A5C]">
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color as string }} />
                      {label as string}
                    </span>
                    <span className="font-display text-lg font-bold">{formatPct(val.pct)}</span>
                    <span className="text-xs text-muted">{formatRupiah(val.amount)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section id="pola" className={`${card} scroll-mt-16 gap-2`}>
            <div className="flex flex-col gap-0.5">
              <h2 className={h2}>Pola harian</h2>
              <span className="text-xs text-muted">
                Rata-rata per hari dalam seminggu, ribu rupiah. Transaksi ≥ {formatRupiah(r.weekdayExcludesAbove)} (kos, cicilan) tidak dihitung.
              </span>
            </div>
            <ColumnChart
              highlight={weekdayMax}
              color="#C98A12"
              soft="#E9E4DB"
              height={110}
              columns={r.weekday.map((d) => ({
                label: d.day,
                value: d.avg,
                valueLabel: formatNumber(Math.round(d.avg / 1000)),
                detail: `${d.day}: rata-rata ${formatRupiah(d.avg)}`,
              }))}
            />
            {ratio >= 1.3 && (
              <p className="rounded-2xl bg-[#FDF1D8] px-3.5 py-3 text-[13px] leading-relaxed text-[#5C4306]">
                {HARI_PANJANG[r.weekday[weekdayMax].day] ?? r.weekday[weekdayMax].day} rata-rata{' '}
                {formatRupiah(r.weekday[weekdayMax].avg)}, hari paling boros: {ratio.toLocaleString('id-ID', { maximumFractionDigits: 1 })}× hari lain.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
