const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** 3874000 → "Rp 3.874.000" */
export function formatRupiah(amount: number) {
  return `Rp ${rupiah.format(amount)}`;
}

/** 3874000 → "3.874.000" */
export function formatNumber(amount: number) {
  return rupiah.format(amount);
}

/** 3874000 → "3,87 jt"; 850000 → "850 rb" */
export function formatShort(amount: number) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} rb`;
  return String(amount);
}

export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export interface Period {
  start: Date;
  /** Awal periode berikutnya (eksklusif). */
  endExclusive: Date;
  /** Hari terakhir periode (inklusif). */
  end: Date;
  /** Nama periode = bulan tempat periode berakhir, mis. 25 Sep – 24 Okt = "Oktober". */
  name: string;
  rangeLabel: string;
  dayIndex: number;
  totalDays: number;
}

/**
 * Periode gajian yang memuat `ref` (PRD 5.5), dalam zona waktu perangkat.
 * startDay 25 → 25 Sep – 24 Okt. startDay 1 → bulan kalender biasa.
 */
export function periodOf(startDay: number, ref = new Date()): Period {
  const today = startOfDay(ref);
  const start =
    today.getDate() >= startDay
      ? new Date(today.getFullYear(), today.getMonth(), startDay)
      : new Date(today.getFullYear(), today.getMonth() - 1, startDay);
  const endExclusive = new Date(start.getFullYear(), start.getMonth() + 1, startDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, startDay - 1);
  const day = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((endExclusive.getTime() - start.getTime()) / day);
  const dayIndex = Math.min(totalDays, Math.round((today.getTime() - start.getTime()) / day) + 1);
  const fmt = (d: Date) => `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`;
  return { start, endExclusive, end, name: BULAN[end.getMonth()], rangeLabel: `${fmt(start)} – ${fmt(end)}`, dayIndex, totalDays };
}

/** Periode ke-n sebelum/sesudah periode `p` (n negatif = mundur). */
export function shiftPeriod(startDay: number, p: Period, n: number): Period {
  return periodOf(startDay, new Date(p.start.getFullYear(), p.start.getMonth() + n, startDay));
}

/** Kompatibel dengan kode Tahap 1. */
export const currentPeriod = periodOf;

/** "Senin, 12 Okt" */
export function formatToday(d = new Date()) {
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`;
}

/** Label kelompok hari di riwayat: "Hari ini · Sen, 12 Okt", "Kemarin · …", "Sab, 10 Okt". */
export function dayLabel(d: Date, now = new Date()) {
  const base = `${HARI_PENDEK[d.getDay()]}, ${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`;
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return `Hari ini · ${base}`;
  if (diff === 1) return `Kemarin · ${base}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "12:30" */
export function formatTime(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Kunci pengelompokan per hari lokal: "2026-10-12" */
export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Nilai untuk <input type="datetime-local">: "2026-10-12T12:30" */
export function toLocalInput(d: Date) {
  return `${dayKey(d)}T${formatTime(d)}`;
}

/** Label rentang periode dari ISO start (inklusif) & end (eksklusif): "25 Agu – 24 Sep 2026". */
export function rangeLabelFromIso(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(new Date(endIso).getTime() - 24 * 60 * 60 * 1000);
  return `${s.getDate()} ${BULAN_PENDEK[s.getMonth()]} – ${e.getDate()} ${BULAN_PENDEK[e.getMonth()]} ${e.getFullYear()}`;
}

/** Angka juta dengan 2 desimal untuk label grafik: 6450000 → "6,45". */
export function formatJuta(amount: number) {
  return (amount / 1_000_000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Persen dengan koma desimal: 24.6 → "24,6%". */
export function formatPct(value: number) {
  return `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;
}

/** "Kam, 24 Sep" */
export function shortDate(d: Date) {
  return `${HARI_PENDEK[d.getDay()]}, ${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`;
}
