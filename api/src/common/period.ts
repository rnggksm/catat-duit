/**
 * Periode gajian (PRD 5.5): mulai `startDay` sampai sehari sebelum `startDay` bulan berikutnya,
 * dihitung dalam zona waktu household. Zona waktu Indonesia tidak memakai daylight saving,
 * jadi cukup offset tetap.
 */
const OFFSET_HOURS: Record<string, number> = {
  'Asia/Jakarta': 7,
  'Asia/Pontianak': 7,
  'Asia/Makassar': 8,
  'Asia/Jayapura': 9,
};

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAY_MS = 24 * 60 * 60 * 1000;

export function offsetHours(timezone: string) {
  return OFFSET_HOURS[timezone] ?? 7;
}

export interface PeriodRange {
  /** Awal periode (UTC), inklusif. */
  start: Date;
  /** Akhir periode (UTC), eksklusif. */
  end: Date;
  /** Nama periode = bulan tempat periode berakhir. 25 Sep – 24 Okt = "Oktober". */
  name: string;
  totalDays: number;
  /** Hari ke berapa `ref` di dalam periode (1-based, dibatasi 1..totalDays). */
  dayIndex: number;
}

export function periodFor(ref: Date, startDay: number, timezone: string): PeriodRange {
  const off = offsetHours(timezone) * 60 * 60 * 1000;
  const local = new Date(ref.getTime() + off); // baca komponen lewat getUTC* = waktu lokal household
  const y = local.getUTCFullYear();
  let m = local.getUTCMonth();
  if (local.getUTCDate() < startDay) m -= 1;
  const start = new Date(Date.UTC(y, m, startDay) - off);
  const end = new Date(Date.UTC(y, m + 1, startDay) - off);
  const lastDay = new Date(end.getTime() + off - DAY_MS);
  const totalDays = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const dayIndex = Math.min(totalDays, Math.max(1, Math.floor((ref.getTime() - start.getTime()) / DAY_MS) + 1));
  return { start, end, name: BULAN[lastDay.getUTCMonth()], totalDays, dayIndex };
}

export function previousPeriod(p: PeriodRange, startDay: number, timezone: string): PeriodRange {
  return periodFor(new Date(p.start.getTime() - 1), startDay, timezone);
}
