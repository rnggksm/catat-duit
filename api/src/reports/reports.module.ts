import { Controller, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { AuthModule } from '../auth/auth.module';
import { LARGE_TX_MIN } from '../common/constants';
import { offsetHours, periodFor, PeriodRange, previousPeriod } from '../common/period';
import { PrismaService } from '../prisma/prisma.service';
import { TX_SELECT } from '../transactions/transactions.service';

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAY_MS = 24 * 60 * 60 * 1000;

type CatMeta = { id: string; parentId: string | null; name: string; icon: string; color: string; isEssential: boolean };

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/** Laporan per periode gajian (PRD 5.5, mockup layar 07 & 08). */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async context(householdId: string, offset: number) {
    const household = await this.prisma.household.findUniqueOrThrow({ where: { id: householdId } });
    const { periodStartDay: sd, timezone: tz } = household;
    const now = new Date();
    let period = periodFor(now, sd, tz);
    for (let i = 0; i < Math.min(Math.abs(offset), 36); i++) period = previousPeriod(period, sd, tz);
    const isCurrent = offset === 0;
    const prev = previousPeriod(period, sd, tz);
    // Periode berjalan dibandingkan dengan periode lalu sampai hari yang sama, supaya adil.
    const elapsedEnd = isCurrent ? now : period.end;
    const prevEnd = isCurrent ? new Date(prev.start.getTime() + (now.getTime() - period.start.getTime())) : prev.end;
    const daysElapsed = isCurrent ? period.dayIndex : period.totalDays;
    const categories = await this.prisma.category.findMany({
      where: { householdId, type: 'EXPENSE' },
      select: { id: true, parentId: true, name: true, icon: true, color: true, isEssential: true },
    });
    const byId = new Map<string, CatMeta>(categories.map((c) => [c.id, c]));
    const rootOf = (id: string) => {
      const c = byId.get(id);
      if (!c) return undefined;
      return c.parentId ? byId.get(c.parentId) ?? c : c;
    };
    return { sd, tz, period, prev, isCurrent, elapsedEnd, prevEnd, daysElapsed, byId, rootOf };
  }

  private base(householdId: string) {
    return { householdId, type: 'EXPENSE' as const, deletedAt: null };
  }

  private async sumByCategory(householdId: string, start: Date, end: Date) {
    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { ...this.base(householdId), occurredAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    return rows.map((r) => ({ categoryId: r.categoryId, amount: Number(r._sum.amount ?? 0), count: r._count._all }));
  }

  private async total(householdId: string, start: Date, end: Date, categoryIds?: string[]) {
    const agg = await this.prisma.transaction.aggregate({
      where: {
        ...this.base(householdId),
        occurredAt: { gte: start, lt: end },
        ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  /** Total 6 periode terakhir (lama → baru) yang berakhir di `period`. */
  private async trend(householdId: string, period: PeriodRange, sd: number, tz: string, categoryIds?: string[]) {
    const periods: PeriodRange[] = [period];
    while (periods.length < 6) periods.unshift(previousPeriod(periods[0], sd, tz));
    const totals = await Promise.all(periods.map((p) => this.total(householdId, p.start, p.end, categoryIds)));
    // Periode sebelum ada catatan sama sekali tidak ditampilkan (bukan "0").
    const first = totals.findIndex((t) => t > 0);
    const from = first === -1 ? periods.length - 1 : first;
    return periods.slice(from).map((p, i) => ({ name: p.name, start: p.start, total: totals[from + i] }));
  }

  private periodOut(p: PeriodRange, daysElapsed: number, isCurrent: boolean) {
    return { name: p.name, start: p.start, end: p.end, totalDays: p.totalDays, daysElapsed, isCurrent };
  }

  async period(householdId: string, offset: number) {
    const ctx = await this.context(householdId, offset);
    const { period, prev, sd, tz, rootOf } = ctx;

    const [current, previous, trend, txTimes] = await Promise.all([
      this.sumByCategory(householdId, period.start, ctx.elapsedEnd),
      this.sumByCategory(householdId, prev.start, ctx.prevEnd),
      this.trend(householdId, period, sd, tz),
      this.prisma.transaction.findMany({
        where: { ...this.base(householdId), occurredAt: { gte: period.start, lt: ctx.elapsedEnd } },
        select: { occurredAt: true, amount: true },
      }),
    ]);

    // Gabungkan sub-kategori ke induk.
    type Agg = { id: string; name: string; icon: string; color: string; isEssential: boolean; amount: number; count: number; prevAmount: number };
    const roots = new Map<string, Agg>();
    const bucket = (id: string) => {
      const r = rootOf(id);
      if (!r) return undefined;
      let a = roots.get(r.id);
      if (!a) {
        a = { id: r.id, name: r.name, icon: r.icon, color: r.color, isEssential: r.isEssential, amount: 0, count: 0, prevAmount: 0 };
        roots.set(r.id, a);
      }
      return a;
    };
    for (const row of current) {
      const a = bucket(row.categoryId);
      if (a) {
        a.amount += row.amount;
        a.count += row.count;
      }
    }
    for (const row of previous) {
      const a = bucket(row.categoryId);
      if (a) a.prevAmount += row.amount;
    }

    const total = current.reduce((s, r) => s + r.amount, 0);
    const count = current.reduce((s, r) => s + r.count, 0);
    const prevTotal = previous.reduce((s, r) => s + r.amount, 0);

    const categories = [...roots.values()]
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, isEssential: c.isEssential, amount: c.amount, count: c.count, pct: pct(c.amount, total) }));

    const changes = [...roots.values()]
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        amount: c.amount,
        prevAmount: c.prevAmount,
        delta: c.amount - c.prevAmount,
        deltaPct: c.prevAmount > 0 ? pct(c.amount - c.prevAmount, c.prevAmount) : null,
      }))
      .filter((c) => c.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 6);

    const essential = categories.filter((c) => c.isEssential).reduce((s, c) => s + c.amount, 0);

    // Rata-rata per hari dalam seminggu = total hari itu ÷ berapa kali hari itu muncul di periode.
    const off = offsetHours(tz) * 60 * 60 * 1000;
    const sums = Array(7).fill(0) as number[];
    // Transaksi besar (kos, cicilan) dikecualikan agar pola harian mencerminkan kebiasaan, bukan jadwal tagihan.
    for (const t of txTimes) {
      if (Number(t.amount) >= LARGE_TX_MIN) continue;
      sums[new Date(t.occurredAt.getTime() + off).getUTCDay()] += Number(t.amount);
    }
    const occurrences = Array(7).fill(0) as number[];
    for (let i = 0; i < ctx.daysElapsed; i++) occurrences[new Date(period.start.getTime() + off + i * DAY_MS).getUTCDay()] += 1;
    const order = [1, 2, 3, 4, 5, 6, 0]; // Senin dulu
    const weekday = order.map((d) => ({ day: HARI[d], avg: occurrences[d] ? Math.round(sums[d] / occurrences[d]) : 0 }));

    return {
      period: this.periodOut(period, ctx.daysElapsed, ctx.isCurrent),
      previous: { name: prev.name, total: prevTotal, comparedToSameDay: ctx.isCurrent },
      total,
      count,
      avgPerDay: Math.round(total / Math.max(ctx.daysElapsed, 1)),
      change: { delta: total - prevTotal, pct: prevTotal > 0 ? pct(total - prevTotal, prevTotal) : null },
      categories,
      changes,
      essential: { amount: essential, pct: pct(essential, total) },
      nonEssential: { amount: total - essential, pct: total > 0 ? Math.round((100 - pct(essential, total)) * 10) / 10 : 0 },
      trend,
      weekday,
      weekdayExcludesAbove: LARGE_TX_MIN,
    };
  }

  async category(householdId: string, categoryId: string, offset: number) {
    const ctx = await this.context(householdId, offset);
    const root = ctx.byId.get(categoryId);
    if (!root || root.parentId) throw new NotFoundException('Kategori tidak ditemukan');
    const children = [...ctx.byId.values()].filter((c) => c.parentId === root.id);
    const ids = [root.id, ...children.map((c) => c.id)];
    const { period, prev } = ctx;
    const range = { gte: period.start, lt: ctx.elapsedEnd };

    const [rows, allTotal, trend, prev3, transactions] = await Promise.all([
      this.sumByCategory(householdId, period.start, ctx.elapsedEnd),
      this.total(householdId, period.start, ctx.elapsedEnd),
      this.trend(householdId, period, ctx.sd, ctx.tz, ids),
      (async () => {
        let p = prev;
        const totals: number[] = [];
        for (let i = 0; i < 3; i++) {
          totals.push(await this.total(householdId, p.start, p.end, ids));
          p = previousPeriod(p, ctx.sd, ctx.tz);
        }
        return totals;
      })(),
      this.prisma.transaction.findMany({
        where: { ...this.base(householdId), categoryId: { in: ids }, occurredAt: range },
        select: TX_SELECT,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 20,
      }),
    ]);

    const mine = rows.filter((r) => ids.includes(r.categoryId));
    const amount = mine.reduce((s, r) => s + r.amount, 0);
    const count = mine.reduce((s, r) => s + r.count, 0);
    const subs = [
      ...children.map((c) => ({ id: c.id, name: c.name, amount: mine.find((r) => r.categoryId === c.id)?.amount ?? 0 })),
      { id: root.id, name: 'Tanpa sub-kategori', amount: mine.find((r) => r.categoryId === root.id)?.amount ?? 0 },
    ]
      .filter((s) => s.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((s) => ({ ...s, pct: pct(s.amount, amount) }));
    const withData = prev3.filter((t) => t > 0);
    const avgPrev3 = withData.length ? Math.round(withData.reduce((s, t) => s + t, 0) / withData.length) : null;

    return {
      category: { id: root.id, name: root.name, icon: root.icon, color: root.color, isEssential: root.isEssential },
      period: this.periodOut(period, ctx.daysElapsed, ctx.isCurrent),
      amount,
      count,
      pctOfTotal: pct(amount, allTotal),
      avgPerTransaction: count ? Math.round(amount / count) : 0,
      avgPrev3,
      /** Berapa periode sebelumnya yang benar-benar punya data untuk rata-rata itu. */
      avgPrevCount: withData.length,
      vsAvgPrev3Pct: avgPrev3 ? pct(amount - avgPrev3, avgPrev3) : null,
      subs,
      trend,
      transactions,
    };
  }
}

function parseOffset(raw?: string) {
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? Math.min(0, Math.trunc(n)) : 0;
}

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** ?offset=0 periode berjalan, -1 periode lalu, dst. */
  @Get('period')
  period(@CurrentUser() user: AuthUser, @Query('offset') offset?: string) {
    return this.reports.period(user.householdId, parseOffset(offset));
  }

  @Get('category/:id')
  category(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('offset') offset?: string) {
    return this.reports.category(user.householdId, id, parseOffset(offset));
  }
}

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
