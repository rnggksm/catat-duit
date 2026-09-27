import { Body, Controller, Get, Injectable, Module, NotFoundException, Put, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { AuthModule } from '../auth/auth.module';
import { periodFor, PeriodRange, previousPeriod } from '../common/period';
import { PrismaService } from '../prisma/prisma.service';

export const TOTAL_KEY = 'TOTAL';
/** Batas peringatan (PRD 5.6): kuning mulai 80%, merah mulai 100%. */
export const WARN_PCT = 80;

export type BudgetStatus = 'ok' | 'warn' | 'over';

export function budgetStatus(spent: number, amount: number): BudgetStatus {
  const pct = (spent / amount) * 100;
  if (pct >= 100) return 'over';
  if (pct >= WARN_PCT) return 'warn';
  return 'ok';
}

export class SetBudgetDto {
  /** Kosong = anggaran total periode. */
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** 0 = hapus anggaran mulai periode ini. */
  @IsInt({ message: 'Nominal harus bilangan bulat' })
  @Min(0)
  @Max(1_000_000_000, { message: 'Nominal maksimal Rp 1.000.000.000' })
  amount: number;
}

/**
 * Nilai anggaran yang berlaku di periode yang dimulai `periodStart`:
 * baris terbaru per subjek dengan effectiveFrom ≤ periodStart. Anggaran 0 (dihapus) tidak dikembalikan.
 */
export async function budgetsAt(prisma: PrismaService, householdId: string, periodStart: Date) {
  const rows = await prisma.budget.findMany({
    where: { householdId, effectiveFrom: { lte: periodStart } },
    orderBy: { effectiveFrom: 'desc' },
    select: { subjectKey: true, amount: true },
  });
  const map = new Map<string, number>();
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.subjectKey)) continue;
    seen.add(r.subjectKey);
    if (r.amount > 0n) map.set(r.subjectKey, Number(r.amount));
  }
  return map;
}

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  private async currentPeriod(householdId: string, offset = 0) {
    const h = await this.prisma.household.findUniqueOrThrow({ where: { id: householdId } });
    let period = periodFor(new Date(), h.periodStartDay, h.timezone);
    for (let i = 0; i < Math.min(Math.abs(offset), 36); i++) period = previousPeriod(period, h.periodStartDay, h.timezone);
    return { period, sd: h.periodStartDay, tz: h.timezone };
  }

  /** Anggaran + realisasi semua kategori induk untuk satu periode. */
  async overview(householdId: string, offset: number) {
    const { period, sd, tz } = await this.currentPeriod(householdId, offset);
    const isCurrent = offset === 0;
    const end = isCurrent ? new Date() : period.end;

    const prevs: PeriodRange[] = [];
    let p = period;
    for (let i = 0; i < 3; i++) {
      p = previousPeriod(p, sd, tz);
      prevs.push(p);
    }

    const [budgets, categories, spentRows, ...prevRows] = await Promise.all([
      budgetsAt(this.prisma, householdId, period.start),
      this.prisma.category.findMany({
        where: { householdId, type: 'EXPENSE' },
        select: { id: true, parentId: true, name: true, icon: true, color: true, isEssential: true, sortOrder: true, archived: true },
      }),
      this.sumByCategory(householdId, period.start, end),
      ...prevs.map((pp) => this.sumByCategory(householdId, pp.start, pp.end)),
    ]);

    const byId = new Map(categories.map((c) => [c.id, c]));
    const rootId = (id: string) => byId.get(id)?.parentId ?? id;
    const roll = (rows: { categoryId: string; amount: number }[]) => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(rootId(r.categoryId), (m.get(rootId(r.categoryId)) ?? 0) + r.amount);
      return m;
    };
    const spent = roll(spentRows);
    const prevMaps = prevRows.map(roll);
    const totalSpent = [...spent.values()].reduce((s, v) => s + v, 0);

    /** Saran nilai awal = rata-rata periode lalu yang ada datanya, dibulatkan ke atas ke Rp 10.000. */
    const suggest = (values: number[]) => {
      const data = values.filter((v) => v > 0);
      if (!data.length) return null;
      const avg = data.reduce((s, v) => s + v, 0) / data.length;
      return Math.ceil(avg / 10_000) * 10_000;
    };

    const rows = categories
      .filter((c) => !c.parentId && (!c.archived || budgets.has(c.id)))
      .map((c) => {
        const amount = budgets.get(c.id) ?? null;
        const s = spent.get(c.id) ?? 0;
        return {
          categoryId: c.id,
          name: c.name,
          icon: c.icon,
          color: c.color,
          isEssential: c.isEssential,
          sortOrder: c.sortOrder,
          amount,
          spent: s,
          pct: amount ? Math.round((s / amount) * 1000) / 10 : null,
          remaining: amount ? amount - s : null,
          status: amount ? budgetStatus(s, amount) : null,
          suggested: suggest(prevMaps.map((m) => m.get(c.id) ?? 0)),
        };
      })
      // Yang ber-anggaran dulu (paling kritis di atas), lalu sisanya menurut pengeluaran.
      .sort((a, b) => {
        if ((a.amount != null) !== (b.amount != null)) return a.amount != null ? -1 : 1;
        if (a.amount != null && b.amount != null) return (b.pct ?? 0) - (a.pct ?? 0);
        return b.spent - a.spent || a.sortOrder - b.sortOrder;
      });

    const totalAmount = budgets.get(TOTAL_KEY) ?? null;
    return {
      period: { name: period.name, start: period.start, end: period.end, isCurrent, dayIndex: period.dayIndex, totalDays: period.totalDays },
      warnPct: WARN_PCT,
      total: {
        amount: totalAmount,
        spent: totalSpent,
        pct: totalAmount ? Math.round((totalSpent / totalAmount) * 1000) / 10 : null,
        remaining: totalAmount ? totalAmount - totalSpent : null,
        status: totalAmount ? budgetStatus(totalSpent, totalAmount) : null,
        suggested: suggest(prevMaps.map((m) => [...m.values()].reduce((s, v) => s + v, 0))),
      },
      categories: rows,
    };
  }

  /** Pasang/ubah/hapus anggaran mulai periode berjalan; berlaku terus ke periode berikutnya. */
  async set(householdId: string, dto: SetBudgetDto) {
    if (dto.categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, householdId, type: 'EXPENSE', parentId: null },
      });
      if (!cat) throw new NotFoundException('Kategori tidak ditemukan');
    }
    const { period } = await this.currentPeriod(householdId);
    const subjectKey = dto.categoryId ?? TOTAL_KEY;
    await this.prisma.budget.upsert({
      where: { householdId_subjectKey_effectiveFrom: { householdId, subjectKey, effectiveFrom: period.start } },
      create: { householdId, subjectKey, categoryId: dto.categoryId ?? null, amount: BigInt(dto.amount), effectiveFrom: period.start },
      update: { amount: BigInt(dto.amount) },
    });
    return { subjectKey, amount: dto.amount || null };
  }

  private async sumByCategory(householdId: string, start: Date, end: Date) {
    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { householdId, type: 'EXPENSE', deletedAt: null, occurredAt: { gte: start, lt: end } },
      _sum: { amount: true },
    });
    return rows.map((r) => ({ categoryId: r.categoryId, amount: Number(r._sum.amount ?? 0) }));
  }
}

function parseOffset(raw?: string) {
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? Math.min(0, Math.trunc(n)) : 0;
}

@Controller('budgets')
@UseGuards(AuthGuard)
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser, @Query('offset') offset?: string) {
    return this.budgets.overview(user.householdId, parseOffset(offset));
  }

  @Put()
  set(@CurrentUser() user: AuthUser, @Body() dto: SetBudgetDto) {
    return this.budgets.set(user.householdId, dto);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
})
export class BudgetsModule {}
