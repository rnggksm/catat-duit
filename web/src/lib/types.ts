export type MemberRole = 'OWNER' | 'MEMBER';

export interface Me {
  user: { id: string; email: string; name: string };
  household: { id: string; name: string; periodStartDay: number; timezone: string };
  /** Semua rumah tangga yang diikuti. Lebih dari satu bila pernah menerima undangan pasangan. */
  households: { id: string; name: string; role: MemberRole }[];
}

export interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  joinedAt: string;
}

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface HouseholdInvite {
  id: string;
  email: string;
  role: MemberRole;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedByName: string | null;
}

/** Balikan pembuatan undangan: `url` hanya muncul sekali, karena yang disimpan hanya hash token. */
export interface CreatedInvite {
  id: string;
  email: string;
  role: MemberRole;
  status: InviteStatus;
  url: string;
  expiresAt: string;
  createdAt: string;
}

/** Pratinjau publik untuk halaman /undang/:token. Email sengaja disamarkan oleh server. */
export interface InvitePreview {
  status: InviteStatus;
  householdName: string;
  invitedByName: string;
  email: string;
  expiresAt: string;
}

/** Balikan accept & switch: sesi harus diganti karena `hid` di token lama menunjuk rumah tangga lain. */
export interface JoinedHousehold {
  householdId: string;
  householdName: string;
  role: MemberRole;
  accessToken: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  isEssential: boolean;
  sortOrder: number;
  usage: number;
  children: { id: string; name: string; sortOrder: number }[];
}

export interface Wallet {
  id: string;
  name: string;
  type: 'CASH' | 'BANK' | 'EWALLET';
  isShared: boolean;
  sortOrder: number;
}

export interface CategoryRef {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent: { id: string; name: string; icon: string; color: string } | null;
}

export interface Transaction {
  id: string;
  /** Rupiah utuh */
  amount: number;
  occurredAt: string;
  note: string | null;
  category: CategoryRef;
  wallet: { id: string; name: string };
  createdBy: { id: string; name: string };
  /** Hanya di klien: belum terkirim ke server. */
  pending?: boolean;
  syncError?: string;
}

export interface TransactionPage {
  items: Transaction[];
  nextCursor: string | null;
  total: number;
  count: number;
}

export interface Summary {
  period: { name: string; start: string; end: string; dayIndex: number; totalDays: number };
  total: number;
  count: number;
  /** Rata-rata per hari tanpa transaksi ≥ largeTxMin */
  avgPerDay: number;
  largeTxMin: number;
  largeTotal: number;
  projection: number;
  changeVsPrev: number | null;
  categories: { id: string; name: string; icon: string; color: string; isEssential: boolean; amount: number; count: number; pct: number }[];
  recent: Transaction[];
}

export interface NoteSuggestion {
  note: string;
  categoryId: string;
  count: number;
}

/** Data yang dikirim saat membuat/mengubah transaksi. */
export interface TransactionInput {
  amount: number;
  categoryId: string;
  walletId: string;
  occurredAt: string;
  note?: string;
}

export interface ReportPeriod {
  name: string;
  start: string;
  end: string;
  totalDays: number;
  daysElapsed: number;
  isCurrent: boolean;
}

export interface TrendPoint {
  name: string;
  start: string;
  total: number;
}

export interface PeriodReport {
  period: ReportPeriod;
  previous: { name: string; total: number; comparedToSameDay: boolean };
  total: number;
  count: number;
  avgPerDay: number;
  change: { delta: number; pct: number | null };
  categories: { id: string; name: string; icon: string; color: string; isEssential: boolean; amount: number; count: number; pct: number }[];
  changes: { id: string; name: string; color: string; amount: number; prevAmount: number; delta: number; deltaPct: number | null }[];
  essential: { amount: number; pct: number };
  nonEssential: { amount: number; pct: number };
  trend: TrendPoint[];
  weekday: { day: string; avg: number }[];
  weekdayExcludesAbove: number;
}

export interface CategoryReport {
  category: { id: string; name: string; icon: string; color: string; isEssential: boolean };
  period: ReportPeriod;
  amount: number;
  count: number;
  pctOfTotal: number;
  avgPerTransaction: number;
  avgPrev3: number | null;
  avgPrevCount: number;
  vsAvgPrev3Pct: number | null;
  subs: { id: string; name: string; amount: number; pct: number }[];
  trend: TrendPoint[];
  transactions: Transaction[];
}

export type InsightStatus = 'NEW' | 'DISMISSED' | 'TRYING';

export interface Insight {
  id: string;
  ruleCode: 'OVER_BUDGET' | 'SPIKE' | 'SMALL_TX' | 'NON_ESSENTIAL' | 'FEES' | 'EXPENSIVE_DAY' | 'SUBSCRIPTIONS';
  title: string;
  message: string;
  potentialSaving: number;
  status: InsightStatus;
  categoryId: string | null;
}

export interface InsightsResponse {
  period: { name: string; start: string; end: string; isCurrent: boolean; dayIndex: number; totalDays: number };
  totalSaving: number;
  insights: Insight[];
  followUps: { id: string; title: string; categoryId?: string; before: number | null; after: number | null; saved: number | null; message: string }[];
  thresholds: Record<string, number>;
}

export type BudgetStatus = 'ok' | 'warn' | 'over';

export interface BudgetRow {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  isEssential: boolean;
  sortOrder: number;
  /** null = tidak dipasang anggaran */
  amount: number | null;
  spent: number;
  pct: number | null;
  remaining: number | null;
  status: BudgetStatus | null;
  /** Saran nilai awal dari rata-rata 3 periode sebelumnya */
  suggested: number | null;
}

export interface BudgetOverview {
  period: { name: string; start: string; end: string; isCurrent: boolean; dayIndex: number; totalDays: number };
  warnPct: number;
  total: { amount: number | null; spent: number; pct: number | null; remaining: number | null; status: BudgetStatus | null; suggested: number | null };
  categories: BudgetRow[];
}
