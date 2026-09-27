/**
 * Mesin aturan penghematan (PRD 5.7). Fungsi murni: menerima angka yang sudah dihitung,
 * mengembalikan daftar saran. Tidak memakai layanan pihak ketiga.
 * Ubah ambang batas di THRESHOLDS bila terlalu sensitif / kurang sensitif.
 */
export const THRESHOLDS = {
  /** Kategori dianggap melonjak jika > 120% rata-rata 3 periode sebelumnya. */
  spikeRatio: 1.2,
  /** Abaikan lonjakan kategori yang rata-ratanya kecil (di bawah Rp 100.000). */
  spikeMinAverage: 100_000,
  /** Transaksi "kecil" = di bawah Rp 30.000. */
  smallTxMax: 30_000,
  /** Minimal 15 transaksi kecil di satu kategori per periode. */
  smallTxMinCount: 15,
  /** Porsi non-esensial ideal maksimal 30% dari total. */
  nonEssentialMaxPct: 30,
  /** Biaya layanan (ongkir, admin, parkir) di atas Rp 150.000 per periode. */
  feesMin: 150_000,
  /** Hari termahal ≥ 1,5× rata-rata hari lain. */
  expensiveDayRatio: 1.5,
  /** Saran "kurangi separuh" untuk transaksi kecil & biaya layanan. */
  cutShare: 0.5,
};

/** Kata kunci catatan yang dihitung sebagai biaya layanan. */
export const FEE_PATTERN = /(ongkir|ongkos kirim|biaya admin|\badmin\b|parkir|biaya layanan|service fee|biaya penanganan)/i;

export type RuleCode = 'OVER_BUDGET' | 'SPIKE' | 'SMALL_TX' | 'NON_ESSENTIAL' | 'FEES' | 'EXPENSIVE_DAY' | 'SUBSCRIPTIONS';

export interface RootSummary {
  id: string;
  name: string;
  nameKey: string;
  isEssential: boolean;
  amount: number;
  /** Jumlah kategori ini di 3 periode sebelumnya (sampai hari yang sama bila periode berjalan). */
  previous: number[];
}

export interface RuleInput {
  total: number;
  roots: RootSummary[];
  smallByLeaf: { categoryId: string; name: string; rootId: string; count: number; amount: number }[];
  fees: { amount: number; count: number };
  /** Senin..Minggu. `occurrences` = berapa kali hari itu muncul dalam satu periode penuh. */
  weekday: { day: string; avg: number; occurrences: number }[];
  subscriptions: { rootId: string; name: string; amount: number; items: { note: string; amount: number }[] } | null;
  /** Anggaran yang berlaku (PRD 5.6). `categoryId` null = anggaran total periode. */
  budgets?: { categoryId: string | null; name: string; amount: number; spent: number }[];
}

export interface Candidate {
  ruleCode: RuleCode;
  subjectKey: string;
  title: string;
  message: string;
  saving: number;
  data: Record<string, unknown>;
}

const HARI: Record<string, string> = { Sen: 'Senin', Sel: 'Selasa', Rab: 'Rabu', Kam: 'Kamis', Jum: 'Jumat', Sab: 'Sabtu', Min: 'Minggu' };

export const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const pct = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString('id-ID')}%`;
/** Bulatkan ke ribuan terdekat. */
const k = (n: number) => Math.max(0, Math.round(n / 1000) * 1000);

export function evaluateRules(input: RuleInput): Candidate[] {
  const out: Candidate[] = [];
  if (input.total <= 0) return out;

  // 0. Melewati anggaran (hanya kategori yang dipasang anggaran).
  for (const b of input.budgets ?? []) {
    if (b.amount <= 0 || b.spent < b.amount) continue;
    const over = k(b.spent - b.amount);
    out.push({
      ruleCode: 'OVER_BUDGET',
      subjectKey: b.categoryId ?? 'TOTAL',
      title: b.categoryId ? `${b.name} melewati anggaran` : 'Total pengeluaran melewati anggaran',
      message: `${b.categoryId ? b.name : 'Pengeluaran periode ini'} ${rp(b.spent)} dari anggaran ${rp(b.amount)}, lebih ${rp(b.spent - b.amount)}. Tahan dulu pengeluaran ${b.categoryId ? 'kategori ini' : 'yang tidak mendesak'} sampai periode berikutnya.`,
      // Kelebihan total sudah tercermin di saran per kategori, jadi tidak dijumlahkan lagi.
      saving: b.categoryId ? over : 0,
      data: { ...(b.categoryId ? { categoryId: b.categoryId } : {}), amount: b.spent, budget: b.amount },
    });
  }

  // 1. Kategori melonjak dibanding rata-rata 3 periode sebelumnya.
  for (const r of input.roots) {
    const prev = r.previous.filter((v) => v > 0);
    if (prev.length === 0) continue;
    const avg = prev.reduce((s, v) => s + v, 0) / prev.length;
    if (avg < THRESHOLDS.spikeMinAverage) continue;
    if (r.amount <= avg * THRESHOLDS.spikeRatio) continue;
    const saving = k(r.amount - avg);
    out.push({
      ruleCode: 'SPIKE',
      subjectKey: r.id,
      title: `${r.name} naik ${pct(((r.amount - avg) / avg) * 100)}`,
      message: `${r.name} ${rp(r.amount)}, di atas rata-rata ${prev.length} periode sebelumnya (${rp(avg)}). Kembali ke rata-rata menghemat ${rp(saving)}.`,
      saving,
      data: { categoryId: r.id, amount: r.amount, average: Math.round(avg) },
    });
  }

  // 2. Transaksi kecil yang menumpuk (per kategori/sub-kategori).
  for (const s of input.smallByLeaf) {
    if (s.count < THRESHOLDS.smallTxMinCount) continue;
    const saving = k(s.amount * THRESHOLDS.cutShare);
    out.push({
      ruleCode: 'SMALL_TX',
      subjectKey: s.categoryId,
      title: `${s.name}: ${s.count}× transaksi kecil`,
      message: `${s.count} transaksi di bawah ${rp(THRESHOLDS.smallTxMax)} untuk ${s.name}, total ${rp(s.amount)}. Kurangi separuhnya, hemat ${rp(saving)}.`,
      saving,
      data: { categoryId: s.rootId, leafId: s.categoryId, count: s.count, amount: s.amount },
    });
  }

  // 3. Porsi non-esensial terlalu besar.
  const nonEss = input.roots.filter((r) => !r.isEssential && r.amount > 0);
  const nonEssAmount = nonEss.reduce((s, r) => s + r.amount, 0);
  const nonEssPct = (nonEssAmount / input.total) * 100;
  if (nonEssPct > THRESHOLDS.nonEssentialMaxPct) {
    const target = (input.total * THRESHOLDS.nonEssentialMaxPct) / 100;
    const saving = k(nonEssAmount - target);
    const top = [...nonEss].sort((a, b) => b.amount - a.amount).slice(0, 3).map((r) => r.name);
    out.push({
      ruleCode: 'NON_ESSENTIAL',
      subjectKey: '',
      title: `Non-esensial ${pct(nonEssPct)} dari pengeluaran`,
      message: `${top.join(', ')} dan pos non-esensial lain menghabiskan ${rp(nonEssAmount)}. Menekannya ke ${THRESHOLDS.nonEssentialMaxPct}% dari total menghemat ${rp(saving)}.`,
      saving,
      data: { amount: nonEssAmount, pct: Math.round(nonEssPct * 10) / 10 },
    });
  }

  // 4. Biaya layanan: ongkir, admin, parkir.
  if (input.fees.amount > THRESHOLDS.feesMin) {
    const saving = k(input.fees.amount * THRESHOLDS.cutShare);
    out.push({
      ruleCode: 'FEES',
      subjectKey: '',
      title: `Biaya layanan ${rp(input.fees.amount)}`,
      message: `${input.fees.count} catatan ongkir, biaya admin, atau parkir berjumlah ${rp(input.fees.amount)}. Gabungkan pesanan dan pilih opsi tanpa biaya untuk hemat sekitar ${rp(saving)}.`,
      saving,
      data: { amount: input.fees.amount, count: input.fees.count },
    });
  }

  // 5. Hari paling boros dalam seminggu.
  const days = input.weekday.filter((d) => d.occurrences > 0);
  if (days.length >= 7) {
    const max = days.reduce((a, b) => (b.avg > a.avg ? b : a));
    const others = days.filter((d) => d !== max);
    const othersAvg = others.reduce((s, d) => s + d.avg, 0) / others.length;
    if (othersAvg > 0 && max.avg >= othersAvg * THRESHOLDS.expensiveDayRatio) {
      const saving = k((max.avg - othersAvg) * max.occurrences);
      const name = HARI[max.day] ?? max.day;
      out.push({
        ruleCode: 'EXPENSIVE_DAY',
        subjectKey: max.day,
        title: `${name} hari paling boros`,
        message: `Rata-rata ${name} ${rp(max.avg)}, ${(max.avg / othersAvg).toLocaleString('id-ID', { maximumFractionDigits: 1 })}× hari lain (${rp(k(othersAvg))}). Menyamakannya dengan hari lain menghemat ${rp(saving)} per periode.`,
        saving,
        data: { day: max.day, average: max.avg, othersAverage: Math.round(othersAvg) },
      });
    }
  }

  // 6. Daftar langganan untuk ditinjau.
  const sub = input.subscriptions;
  if (sub && sub.items.length > 0) {
    const names = sub.items.slice(0, 4).map((i) => i.note).join(', ');
    out.push({
      ruleCode: 'SUBSCRIPTIONS',
      subjectKey: sub.rootId,
      title: `${sub.items.length} langganan aktif`,
      message: `${names}${sub.items.length > 4 ? ', dan lainnya' : ''}: total ${rp(sub.amount)} per periode. Tinjau mana yang jarang dipakai.`,
      saving: 0,
      data: { categoryId: sub.rootId, amount: sub.amount, items: sub.items },
    });
  }

  return out.sort((a, b) => b.saving - a.saving);
}

/**
 * Total potensi hemat tanpa menghitung ganda: saran yang menyangkut kategori sama
 * (mis. lonjakan Makan & transaksi kecil Kopi di dalamnya) hanya diambil yang terbesar.
 */
export function totalSaving(cands: { ruleCode: string; saving: number; data: Record<string, unknown> }[]) {
  const best = new Map<string, number>();
  for (const c of cands) {
    const key = typeof c.data.categoryId === 'string' ? `cat:${c.data.categoryId}` : `rule:${c.ruleCode}`;
    best.set(key, Math.max(best.get(key) ?? 0, c.saving));
  }
  return [...best.values()].reduce((s, v) => s + v, 0);
}
