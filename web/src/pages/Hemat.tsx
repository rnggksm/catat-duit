import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { formatRupiah, rangeLabelFromIso } from '../lib/format';
import { useInsights, useSetInsightStatus } from '../lib/queries';
import type { Insight } from '../lib/types';

/** Ikon & warna per jenis aturan. Warna hanya penanda tambahan; judul selalu tertulis. */
const RULE_STYLE: Record<Insight['ruleCode'], { icon: string; bg: string; fg: string; label: string }> = {
  OVER_BUDGET: { icon: 'wallet', bg: '#FDE6E4', fg: '#B42E27', label: 'Anggaran' },
  SPIKE: { icon: 'arrowUp', bg: '#FFE9E1', fg: '#B8411F', label: 'Lonjakan' },
  SMALL_TX: { icon: 'coffee', bg: '#FDF1D8', fg: '#8A6206', label: 'Transaksi kecil' },
  NON_ESSENTIAL: { icon: 'ticket', bg: '#F0EAFF', fg: '#5A3CC4', label: 'Non-esensial' },
  FEES: { icon: 'bag', bg: '#E3ECFF', fg: '#2F5FCC', label: 'Biaya layanan' },
  EXPENSIVE_DAY: { icon: 'calendar', bg: '#DDF5F1', fg: '#177F73', label: 'Pola harian' },
  SUBSCRIPTIONS: { icon: 'play', bg: '#EFECE6', fg: '#5E594F', label: 'Langganan' },
};

function InsightCard({ insight, offset }: { insight: Insight; offset: number }) {
  const setStatus = useSetInsightStatus();
  const style = RULE_STYLE[insight.ruleCode];
  const trying = insight.status === 'TRYING';
  const busy = setStatus.isPending;

  return (
    <article className={`flex flex-col gap-3 rounded-[22px] border bg-card p-4 ${trying ? 'border-primary' : 'border-line-soft'}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ background: style.bg, color: style.fg }}>
          <Icon name={style.icon} size={22} />
        </span>
        <div className="flex min-w-0 grow flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{style.label}</span>
          <h3 className="text-[15px] font-bold leading-snug">{insight.title}</h3>
        </div>
        {trying && <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary-strong">Sedang dicoba</span>}
      </div>
      <p className="text-sm leading-relaxed text-[#4F4A5C]">{insight.message}</p>
      {insight.potentialSaving > 0 && (
        <span className="flex items-center gap-1.5 self-start rounded-full bg-[#DFF3EA] px-3 py-1.5 text-[13px] font-bold text-[#17704A]">
          <Icon name="piggy" size={16} />
          Potensi hemat {formatRupiah(insight.potentialSaving)}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => setStatus.mutate({ id: insight.id, status: trying ? 'NEW' : 'TRYING' })}
          className={`h-11 rounded-[14px] px-4 text-sm font-bold disabled:opacity-60 ${trying ? 'border-[1.5px] border-line text-ink' : 'bg-primary text-white'}`}
        >
          {trying ? 'Batal coba' : 'Akan saya coba'}
        </button>
        {!trying && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStatus.mutate({ id: insight.id, status: 'DISMISSED' })}
            className="h-11 rounded-[14px] px-3 text-sm font-semibold text-muted disabled:opacity-60"
          >
            Abaikan
          </button>
        )}
        {insight.categoryId && (
          <Link
            to={`/laporan/kategori/${insight.categoryId}${offset ? `?periode=${offset}` : ''}`}
            className="ml-auto flex h-11 items-center gap-1 text-sm font-semibold text-primary"
          >
            Lihat kategori <Icon name="chevronRight" size={16} />
          </Link>
        )}
      </div>
      {setStatus.isError && (
        <p role="alert" className="text-xs font-semibold text-[#B42E27]">
          Gagal menyimpan pilihan. Periksa koneksi internet.
        </p>
      )}
    </article>
  );
}

/** Insight & saran penghematan (PRD 5.7). Dihitung dengan aturan tetap di server, tanpa AI. */
export function HematPage() {
  const [params, setParams] = useSearchParams();
  const offset = Math.min(0, Number(params.get('periode') ?? 0) || 0);
  const insights = useInsights(offset);
  const restore = useSetInsightStatus();
  const [showDismissed, setShowDismissed] = useState(false);
  const d = insights.data;

  const active = d?.insights.filter((i) => i.status !== 'DISMISSED') ?? [];
  const dismissed = d?.insights.filter((i) => i.status === 'DISMISSED') ?? [];
  const go = (next: number) => setParams(next === 0 ? {} : { periode: String(next) }, { replace: true });

  return (
    <main className="flex flex-col gap-[18px] px-5 pb-32 pt-6">
      <header className="flex flex-col gap-3.5">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Saran hemat</h1>
        <div className="flex items-center justify-between rounded-[18px] border border-line-soft bg-card p-1">
          <button type="button" aria-label="Periode sebelumnya" onClick={() => go(offset - 1)} className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-chip">
            <Icon name="chevronLeft" size={20} strokeWidth={2} />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-base font-bold">Periode {d?.period.name ?? '…'}</span>
            <span className="text-xs text-muted">{d ? rangeLabelFromIso(d.period.start, d.period.end) : ' '}</span>
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

      {insights.isLoading && <p className="py-10 text-center text-sm text-muted">Menghitung saran…</p>}
      {insights.isError && (
        <p role="alert" className="rounded-[18px] bg-[#FDE6E4] px-4 py-3 text-sm text-[#8A2A24]">
          Saran tidak bisa dimuat. Periksa koneksi internet.
        </p>
      )}

      {d && (
        <section className="relative flex flex-col gap-1.5 overflow-hidden rounded-[28px] bg-night p-[22px] text-white">
          <div aria-hidden className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-teal" />
          <div aria-hidden className="absolute right-20 top-12 h-10 w-10 rounded-[12px] rotate-12 bg-amber" />
          <span className="relative text-sm text-[#E6E1FF]">Potensi hemat hingga</span>
          <span className="relative font-display text-[40px] font-extrabold leading-tight tracking-tight">{formatRupiah(d.totalSaving)}</span>
          <span className="relative text-xs text-night-muted">
            dari {active.length} saran
            {d.period.isCurrent ? ` · dihitung dari data hari ke-${d.period.dayIndex} dari ${d.period.totalDays}` : ''}
          </span>
        </section>
      )}

      {d && d.followUps.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="px-1 text-sm font-bold">Hasil yang kamu coba periode lalu</h2>
          {d.followUps.map((f) => {
            const good = (f.saved ?? 0) > 0;
            return (
              <div key={f.id} className={`flex items-start gap-3 rounded-[18px] p-4 ${good ? 'bg-[#DFF3EA]' : 'bg-card border border-line-soft'}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${good ? 'bg-save text-white' : 'bg-chip text-muted'}`}>
                  <Icon name={good ? 'check' : 'arrowUp'} size={18} strokeWidth={2.2} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold">{f.title}</span>
                  <span className="text-[13px] leading-relaxed text-[#4F4A5C]">{f.message}</span>
                </span>
              </div>
            );
          })}
        </section>
      )}

      {d && active.length === 0 && (
        <section className="flex flex-col items-center gap-2 rounded-[22px] border border-line-soft bg-card px-6 py-9 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DFF3EA] text-save">
            <Icon name="check" strokeWidth={2.2} />
          </span>
          <h2 className="font-display text-lg font-bold">Belum ada yang perlu dihemat</h2>
          <p className="text-sm leading-relaxed text-muted">
            Tidak ada pola boros yang terdeteksi di periode {d.period.name}. Saran muncul otomatis saat ada kategori yang melonjak atau transaksi kecil yang menumpuk.
          </p>
        </section>
      )}

      {active.map((i) => (
        <InsightCard key={i.id} insight={i} offset={offset} />
      ))}

      {dismissed.length > 0 && (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowDismissed((v) => !v)}
            aria-expanded={showDismissed}
            className="flex h-11 items-center justify-center gap-1 text-sm font-semibold text-muted"
          >
            Diabaikan ({dismissed.length})
            <Icon name="chevronDown" size={16} className={showDismissed ? 'rotate-180' : ''} />
          </button>
          {showDismissed &&
            dismissed.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-[18px] border border-line-soft bg-card px-4 py-3">
                <span className="min-w-0 grow truncate text-sm text-muted">{i.title}</span>
                <button
                  type="button"
                  onClick={() => restore.mutate({ id: i.id, status: 'NEW' })}
                  className="h-10 shrink-0 rounded-xl px-3 text-sm font-semibold text-primary"
                >
                  Tampilkan lagi
                </button>
              </div>
            ))}
        </section>
      )}

      {d && (
        <p className="px-2 text-center text-xs leading-relaxed text-muted">
          Saran dihitung dari aturan tetap di server kamu sendiri, tanpa layanan AI pihak ketiga. Potensi hemat total tidak menghitung dua kali kategori yang sama.
        </p>
      )}
    </main>
  );
}
