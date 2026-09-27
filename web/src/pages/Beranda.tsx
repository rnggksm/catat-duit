import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BudgetCard } from '../components/BudgetCard';
import { Donut, topWithOthers } from '../components/Donut';
import { HematCard } from '../components/HematCard';
import { Icon } from '../components/Icon';
import { TxRow } from '../components/TxRow';
import type { Flash } from './TransactionForm';
import { useAuth } from '../lib/auth';
import { formatRupiah, formatShort, formatToday, periodOf } from '../lib/format';
import { pendingTransactions, useOutbox } from '../lib/offline';
import { useSummary } from '../lib/queries';

/** Beranda (PRD 5.3, mockup layar 03 & 11). */
export function BerandaPage() {
  const { me } = useAuth();
  const location = useLocation();
  const [flash, setFlash] = useState<Flash | undefined>((location.state as { flash?: Flash } | null)?.flash);
  const summary = useSummary();
  const outbox = useOutbox();
  const pending = pendingTransactions(outbox, me?.user.name ?? '');
  const local = periodOf(me?.household.periodStartDay ?? 25);

  const s = summary.data;
  const periodName = s?.period.name ?? local.name;
  const dayIndex = s?.period.dayIndex ?? local.dayIndex;
  const totalDays = s?.period.totalDays ?? local.totalDays;
  const progress = Math.min(100, Math.round((dayIndex / totalDays) * 100));
  const isEmpty = s && s.count === 0 && pending.length === 0;
  const recent = [...pending, ...(s?.recent ?? []).filter((t) => !outbox.some((o) => o.id === t.id))]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 5);
  const legend = s ? topWithOthers(s.categories) : [];

  return (
    <main className="flex flex-col gap-[18px] px-5 pb-32 pt-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-muted">{formatToday()}</span>
          <span className="font-display text-[26px] font-bold tracking-tight">
            {isEmpty && dayIndex <= 3 ? 'Periode baru dimulai' : `Halo, ${me?.user.name ?? ''}`}
          </span>
        </div>
        <Link to="/riwayat" className="flex h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink">
          {periodName}
        </Link>
      </header>

      <section aria-label="Ringkasan periode" className="relative flex flex-col gap-3.5 overflow-hidden rounded-[28px] bg-night p-[22px] text-white">
        <div aria-hidden className="absolute -right-12 -top-14 h-[150px] w-[150px] rounded-full bg-coral" />
        <div aria-hidden className="absolute right-[70px] top-7 h-[58px] w-[58px] rounded-full bg-amber" />
        <div className="relative flex flex-col gap-1">
          <span className="text-xs font-medium text-night-muted">
            Periode {periodName} · {local.rangeLabel}
          </span>
          <span className="text-sm text-[#E6E1FF]">Total pengeluaran</span>
          <span className="font-display text-[40px] font-extrabold leading-tight tracking-tight">
            {s ? formatRupiah(s.total) : summary.isError || summary.fetchStatus === 'paused' ? '—' : '…'}
          </span>
        </div>
        {s?.changeVsPrev != null && (
          <div
            className={`relative flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[13px] font-semibold ${
              s.changeVsPrev <= 0 ? 'bg-[rgba(123,224,176,0.16)] text-[#8FF0C0]' : 'bg-[rgba(255,160,140,0.18)] text-[#FFB4A3]'
            }`}
          >
            <Icon name={s.changeVsPrev <= 0 ? 'arrowDown' : 'arrowUp'} size={16} strokeWidth={2} />
            {s.changeVsPrev <= 0
              ? `${Math.abs(s.changeVsPrev).toLocaleString('id-ID')}% lebih hemat dari periode lalu`
              : `${s.changeVsPrev.toLocaleString('id-ID')}% lebih boros dari periode lalu`}
          </div>
        )}
        <div className="relative flex flex-col gap-2">
          <div className="flex justify-between text-xs text-night-muted">
            <span>
              Hari ke-{dayIndex} dari {totalDays}
            </span>
            <span>Sisa {totalDays - dayIndex} hari</span>
          </div>
          <div className="h-2 rounded-full bg-white/15">
            <div className="h-2 rounded-full bg-amber" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {s && s.count > 0 && (
          <div className="relative grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-0.5 rounded-[18px] bg-white/[0.08] px-3.5 py-3">
              <span className="text-xs text-night-muted">Rata-rata / hari</span>
              <span className="whitespace-nowrap font-display text-[17px] font-bold">{formatRupiah(s.avgPerDay)}</span>
              {s.largeTotal > 0 && <span className="text-[10px] leading-tight text-night-muted">tanpa transaksi ≥ {formatShort(s.largeTxMin)}</span>}
            </div>
            <div className="flex flex-col gap-0.5 rounded-[18px] bg-white/[0.08] px-3.5 py-3">
              <span className="text-xs text-night-muted">Proyeksi akhir periode</span>
              <span className="whitespace-nowrap font-display text-[17px] font-bold">{formatRupiah(s.projection)}</span>
            </div>
          </div>
        )}
      </section>

      {flash && (
        <div
          role="alert"
          className={`flex items-start gap-3 rounded-[18px] px-4 py-3 text-[13px] leading-relaxed ${
            flash.level === 'over' ? 'bg-[#FDE6E4] text-[#8A2A24]' : 'bg-[#FDF1D8] text-[#5C4306]'
          }`}
        >
          <Icon name="wallet" size={18} className="mt-0.5 shrink-0" />
          <span className="grow">{flash.text}</span>
          <button type="button" aria-label="Tutup peringatan" onClick={() => setFlash(undefined)} className="-m-2 flex h-9 w-9 shrink-0 items-center justify-center">
            <Icon name="close" size={16} strokeWidth={2} />
          </button>
        </div>
      )}

      {!isEmpty && <BudgetCard />}
      {!isEmpty && <HematCard />}

      {pending.length > 0 && (
        <p className="rounded-[18px] bg-[#FDF1D8] px-4 py-3 text-[13px] text-[#5C4306]">
          {pending.length} catatan menunggu sinkron dan belum masuk ke total di atas.
        </p>
      )}

      {!s && (summary.isError || summary.fetchStatus === 'paused') && (
        <p role="alert" className="rounded-[18px] bg-[#FDE6E4] px-4 py-3 text-[13px] text-[#8A2A24]">
          Ringkasan tidak bisa dimuat. Catatan baru tetap bisa disimpan dan akan tersinkron otomatis.
        </p>
      )}

      {isEmpty ? (
        <section className="flex flex-col items-center gap-3.5 rounded-[28px] border border-line-soft bg-card px-6 py-7 text-center">
          <div aria-hidden className="relative h-[110px] w-[150px]">
            <div className="absolute left-6 top-2 h-[96px] w-[96px] rounded-full bg-[#FFE9E1]" />
            <div className="absolute left-8 top-9 h-14 w-20 -rotate-8 rounded-[18px] bg-primary" />
            <div className="absolute left-12 top-7 flex h-14 w-20 rotate-6 items-center justify-center rounded-[18px] border-2 border-ink bg-card font-display text-xl font-extrabold">
              Rp
            </div>
            <div className="absolute left-[118px] top-1 h-6 w-6 rounded-full bg-amber" />
          </div>
          <h2 className="font-display text-[21px] font-bold">Belum ada catatan di periode ini</h2>
          <p className="text-sm leading-relaxed text-muted">Catat pengeluaran pertamamu. Laporan dan persentase kategori muncul otomatis.</p>
          <Link to="/tambah" className="flex h-[52px] items-center gap-2 rounded-[18px] bg-primary px-6 text-[15px] font-bold text-white">
            <Icon name="plus" size={20} strokeWidth={2.2} />
            Catat pengeluaran pertama
          </Link>
        </section>
      ) : (
        s &&
        s.count > 0 && (
          <section aria-label="Kategori terbesar" className="flex flex-col gap-4 rounded-card border border-line-soft bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Kategori terbesar</h2>
              <Link to="/laporan" className="py-2.5 text-sm font-semibold text-primary">
                Laporan lengkap
              </Link>
            </div>
            <div className="flex items-center gap-[18px]">
              <div className="relative h-32 w-32 shrink-0">
                <Donut segments={legend} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-[17px] font-extrabold">{formatShort(s.total)}</span>
                  <span className="text-[11px] text-muted">{s.categories.length} kategori</span>
                </div>
              </div>
              <ul className="flex min-w-0 grow flex-col gap-2">
                {legend.map((c) => (
                  <li key={c.name} className="flex items-center gap-2 text-[13px]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded" style={{ background: c.color }} />
                    <span className="min-w-0 grow truncate">{c.name}</span>
                    <span className="font-bold">{c.pct.toLocaleString('id-ID')}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )
      )}

      {recent.length > 0 && (
        <section aria-label="Transaksi terakhir" className="flex flex-col rounded-card border border-line-soft bg-card px-5 pb-2 pt-2">
          <div className="flex items-center justify-between pt-2">
            <h2 className="font-display text-lg font-bold">Transaksi terakhir</h2>
            <Link to="/riwayat" className="py-2.5 text-sm font-semibold text-primary">
              Lihat semua
            </Link>
          </div>
          {recent.map((t) => (
            <TxRow key={t.id} tx={t} showDate />
          ))}
        </section>
      )}

      {isEmpty && (
        <p className="rounded-[18px] bg-[#FDF1D8] px-4 py-3.5 text-[13px] leading-relaxed text-[#5C4306]">
          Tip: ketik 20000+5000 di keypad untuk menjumlah beberapa nota sekaligus.
        </p>
      )}
    </main>
  );
}
