import { Controller, Get, Injectable, Module, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { AuthModule } from '../auth/auth.module';
import { LARGE_TX_MIN } from '../common/constants';
import { periodFor, previousPeriod } from '../common/period';
import { PrismaService } from '../prisma/prisma.service';
import { TX_SELECT } from '../transactions/transactions.service';

/** Ringkasan beranda untuk periode berjalan (PRD 5.3). */
@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async current(householdId: string) {
    const household = await this.prisma.household.findUniqueOrThrow({ where: { id: householdId } });
    const now = new Date();
    const period = periodFor(now, household.periodStartDay, household.timezone);
    const prev = previousPeriod(period, household.periodStartDay, household.timezone);
    const elapsedMs = now.getTime() - period.start.getTime();
    const base = { householdId, type: 'EXPENSE' as const, deletedAt: null };

    const [byCategory, prevSameDay, categories, recent, large] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { ...base, occurredAt: { gte: period.start, lt: period.end } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...base, occurredAt: { gte: prev.start, lt: new Date(prev.start.getTime() + elapsedMs) } },
        _sum: { amount: true },
      }),
      this.prisma.category.findMany({
        where: { householdId, type: 'EXPENSE' },
        select: { id: true, parentId: true, name: true, icon: true, color: true, isEssential: true },
      }),
      this.prisma.transaction.findMany({
        where: base,
        select: TX_SELECT,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
      this.prisma.transaction.aggregate({
        where: { ...base, occurredAt: { gte: period.start, lt: period.end }, amount: { gte: BigInt(LARGE_TX_MIN) } },
        _sum: { amount: true },
      }),
    ]);

    // Gabungkan sub-kategori ke induknya.
    const byId = new Map(categories.map((c) => [c.id, c]));
    const roots = new Map<string, { id: string; name: string; icon: string; color: string; isEssential: boolean; amount: number; count: number }>();
    let total = 0;
    let count = 0;
    for (const row of byCategory) {
      const cat = byId.get(row.categoryId);
      if (!cat) continue;
      const root = cat.parentId ? byId.get(cat.parentId) ?? cat : cat;
      const amount = Number(row._sum.amount ?? 0);
      total += amount;
      count += row._count._all;
      const entry = roots.get(root.id) ?? { id: root.id, name: root.name, icon: root.icon, color: root.color, isEssential: root.isEssential, amount: 0, count: 0 };
      entry.amount += amount;
      entry.count += row._count._all;
      roots.set(root.id, entry);
    }

    const categoriesOut = [...roots.values()]
      .sort((a, b) => b.amount - a.amount)
      .map((c) => ({ ...c, pct: total > 0 ? Math.round((c.amount / total) * 1000) / 10 : 0 }));

    const prevTotal = Number(prevSameDay._sum.amount ?? 0);
    // Laju harian tanpa transaksi besar (kos, cicilan) supaya proyeksi tidak melonjak di awal periode.
    const largeTotal = Number(large._sum.amount ?? 0);
    const avgPerDay = Math.round((total - largeTotal) / period.dayIndex);
    const remainingDays = Math.max(0, period.totalDays - period.dayIndex);

    return {
      period: {
        name: period.name,
        start: period.start,
        end: period.end,
        dayIndex: period.dayIndex,
        totalDays: period.totalDays,
      },
      total,
      count,
      /** Rata-rata per hari, tanpa transaksi ≥ largeTxMin. */
      avgPerDay,
      largeTxMin: LARGE_TX_MIN,
      largeTotal,
      /** Total sejauh ini + laju harian × sisa hari. */
      // Proyeksi hanya perkiraan: bulatkan ke Rp 10.000 agar tidak terkesan presisi palsu.
      projection: Math.round((total + avgPerDay * remainingDays) / 10_000) * 10_000,
      /** Perbandingan dengan periode lalu pada hari yang sama. Negatif = lebih hemat. */
      changeVsPrev: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 10 : null,
      categories: categoriesOut,
      recent,
    };
  }
}

@Controller('summary')
@UseGuards(AuthGuard)
export class SummaryController {
  constructor(private readonly summary: SummaryService) {}

  @Get('current')
  current(@CurrentUser() user: AuthUser) {
    return this.summary.current(user.householdId);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
