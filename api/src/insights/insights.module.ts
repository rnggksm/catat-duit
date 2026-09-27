import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsIn } from 'class-validator';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { AuthModule } from '../auth/auth.module';
import { offsetHours, periodFor, PeriodRange, previousPeriod } from '../common/period';
import { budgetsAt, TOTAL_KEY } from '../budgets/budgets.module';
import { LARGE_TX_MIN } from '../common/constants';
import { PrismaService } from '../prisma/prisma.service';
import { Candidate, evaluateRules, FEE_PATTERN, rp, RuleInput, THRESHOLDS, totalSaving } from './rules';

const DAY_MS = 24 * 60 * 60 * 1000;
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export class UpdateInsightDto {
  @IsIn(['NEW', 'DISMISSED', 'TRYING'])
  status: 'NEW' | 'DISMISSED' | 'TRYING';
}

type CatMeta = { id: string; parentId: string | null; name: string; nameKey: string; isEssential: boolean };

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Saran untuk satu periode (0 = berjalan, -1 = lalu, ...). Hasil disimpan agar status pilihan pengguna tetap. */
  async list(householdId: string, offset: number) {
    const household = await this.prisma.household.findUniqueOrThrow({ where: { id: householdId } });
    const { periodStartDay: sd, timezone: tz } = household;
    const now = new Date();
    let period = periodFor(now, sd, tz);
    for (let i = 0; i < Math.min(Math.abs(offset), 36); i++) period = previousPeriod(period, sd, tz);
    const isCurrent = offset === 0;
    // Periode berjalan dibandingkan dengan periode lalu sampai hari yang sama.
    const elapsedMs = isCurrent ? now.getTime() - period.start.getTime() : period.end.getTime() - period.start.getTime();
    const end = new Date(period.start.getTime() + elapsedMs);

    const previous: PeriodRange[] = [];
    let p = period;
    for (let i = 0; i < 3; i++) {
      p = previousPeriod(p, sd, tz);
      previous.push(p);
    }

    const [categories, txs, ...prevSums] = await Promise.all([
      this.prisma.category.findMany({
        where: { householdId, type: 'EXPENSE' },
        select: { id: true, parentId: true, name: true, nameKey: true, isEssential: true },
      }),
      this.prisma.transaction.findMany({
        where: { householdId, type: 'EXPENSE', deletedAt: null, occurredAt: { gte: period.start, lt: end } },
        select: { amount: true, occurredAt: true, categoryId: true, note: true },
      }),
      ...previous.map((pp) =>
        this.prisma.transaction.groupBy({
          by: ['categoryId'],
          where: {
            householdId,
            type: 'EXPENSE',
            deletedAt: null,
            occurredAt: { gte: pp.start, lt: new Date(Math.min(pp.start.getTime() + elapsedMs, pp.end.getTime())) },
          },
          _sum: { amount: true },
        }),
      ),
    ]);

    const byId = new Map<string, CatMeta>(categories.map((c) => [c.id, c]));
    const rootOf = (id: string) => {
      const c = byId.get(id);
      return c?.parentId ? byId.get(c.parentId) ?? c : c;
    };

    const input = this.buildInput(period, elapsedMs, tz, txs, prevSums, byId, rootOf);
    const budgets = await budgetsAt(this.prisma, householdId, period.start);
    input.budgets = [...budgets.entries()].map(([key, amount]) => {
      if (key === TOTAL_KEY) return { categoryId: null, name: 'Total', amount, spent: input.total };
      const root = input.roots.find((r) => r.id === key);
      return { categoryId: key, name: root?.name ?? byId.get(key)?.name ?? 'Kategori', amount, spent: root?.amount ?? 0 };
    });
    const candidates = evaluateRules(input);
    await this.persist(householdId, period.start, candidates);

    const rows = await this.prisma.insight.findMany({
      where: { householdId, periodStart: period.start },
      orderBy: [{ potentialSaving: 'desc' }, { createdAt: 'asc' }],
    });

    const followUps = await this.followUps(householdId, previous[0], input, rootOf);
    const active = rows.filter((r) => r.status !== 'DISMISSED');

    return {
      period: { name: period.name, start: period.start, end: period.end, isCurrent, dayIndex: period.dayIndex, totalDays: period.totalDays },
      totalSaving: totalSaving(active.map((r) => ({ ruleCode: r.ruleCode, saving: Number(r.potentialSaving), data: r.data as Record<string, unknown> }))),
      insights: rows.map((r) => ({
        id: r.id,
        ruleCode: r.ruleCode,
        title: r.title,
        message: r.message,
        potentialSaving: Number(r.potentialSaving),
        status: r.status,
        categoryId: typeof (r.data as Record<string, unknown>).categoryId === 'string' ? ((r.data as Record<string, unknown>).categoryId as string) : null,
      })),
      followUps,
      thresholds: THRESHOLDS,
    };
  }

  async update(householdId: string, id: string, status: UpdateInsightDto['status']) {
    const row = await this.prisma.insight.findFirst({ where: { id, householdId } });
    if (!row) throw new NotFoundException('Saran tidak ditemukan');
    const updated = await this.prisma.insight.update({ where: { id }, data: { status } });
    return { id: updated.id, status: updated.status };
  }

  // --- internal ---

  private buildInput(
    period: PeriodRange,
    elapsedMs: number,
    tz: string,
    txs: { amount: bigint; occurredAt: Date; categoryId: string; note: string | null }[],
    prevSums: { categoryId: string; _sum: { amount: bigint | null } }[][],
    byId: Map<string, CatMeta>,
    rootOf: (id: string) => CatMeta | undefined,
  ): RuleInput {
    const rootAmounts = new Map<string, number>();
    const small = new Map<string, { count: number; amount: number }>();
    let total = 0;
    let feeAmount = 0;
    let feeCount = 0;
    const off = offsetHours(tz) * 60 * 60 * 1000;
    const daySums = Array(7).fill(0) as number[];
    const subItems = new Map<string, number>();
    let subRoot: CatMeta | undefined;

    for (const t of txs) {
      const amount = Number(t.amount);
      const root = rootOf(t.categoryId);
      if (!root) continue;
      total += amount;
      rootAmounts.set(root.id, (rootAmounts.get(root.id) ?? 0) + amount);
      if (amount < THRESHOLDS.smallTxMax) {
        const s = small.get(t.categoryId) ?? { count: 0, amount: 0 };
        s.count += 1;
        s.amount += amount;
        small.set(t.categoryId, s);
      }
      if (t.note && FEE_PATTERN.test(t.note)) {
        feeAmount += amount;
        feeCount += 1;
      }
      // Pola harian mengabaikan transaksi besar (kos, cicilan) supaya tidak menuduh hari tertentu boros.
      if (amount < LARGE_TX_MIN) daySums[new Date(t.occurredAt.getTime() + off).getUTCDay()] += amount;
      if (root.nameKey === 'langganan') {
        subRoot = root;
        const key = (t.note?.trim() || byId.get(t.categoryId)?.name || root.name).slice(0, 40);
        subItems.set(key, (subItems.get(key) ?? 0) + amount);
      }
    }

    // Kemunculan tiap hari: sejauh ini (untuk rata-rata) & dalam satu periode penuh (untuk potensi hemat).
    const elapsedDays = Math.max(1, Math.ceil(elapsedMs / DAY_MS));
    const seen = Array(7).fill(0) as number[];
    const full = Array(7).fill(0) as number[];
    for (let i = 0; i < period.totalDays; i++) {
      const d = new Date(period.start.getTime() + off + i * DAY_MS).getUTCDay();
      full[d] += 1;
      if (i < elapsedDays) seen[d] += 1;
    }

    const roots = [...byId.values()]
      .filter((c) => !c.parentId)
      .map((c) => ({
        id: c.id,
        name: c.name,
        nameKey: c.nameKey,
        isEssential: c.isEssential,
        amount: rootAmounts.get(c.id) ?? 0,
        previous: prevSums.map((rows) =>
          rows.reduce((s, r) => (rootOf(r.categoryId)?.id === c.id ? s + Number(r._sum.amount ?? 0) : s), 0),
        ),
      }));

    const subAmount = [...subItems.values()].reduce((s, v) => s + v, 0);

    return {
      total,
      roots,
      smallByLeaf: [...small.entries()].map(([categoryId, s]) => ({
        categoryId,
        name: byId.get(categoryId)?.name ?? 'Kategori',
        rootId: rootOf(categoryId)?.id ?? categoryId,
        ...s,
      })),
      fees: { amount: feeAmount, count: feeCount },
      // Hari yang belum pernah lewat di periode ini tidak dinilai.
      weekday: WEEK_ORDER.map((d) => ({ day: HARI[d], avg: seen[d] ? Math.round(daySums[d] / seen[d]) : 0, occurrences: seen[d] ? full[d] : 0 })),
      subscriptions: subRoot
        ? {
            rootId: subRoot.id,
            name: subRoot.name,
            amount: subAmount,
            items: [...subItems.entries()].map(([note, amount]) => ({ note, amount })).sort((a, b) => b.amount - a.amount),
          }
        : null,
    };
  }

  /** Simpan saran periode ini. Status pengguna dipertahankan; saran NEW yang tak lagi berlaku dihapus. */
  private async persist(householdId: string, periodStart: Date, candidates: Candidate[]) {
    const keys = new Set(candidates.map((c) => `${c.ruleCode}|${c.subjectKey}`));
    await this.prisma.$transaction([
      ...candidates.map((c) =>
        this.prisma.insight.upsert({
          where: {
            householdId_periodStart_ruleCode_subjectKey: { householdId, periodStart, ruleCode: c.ruleCode, subjectKey: c.subjectKey },
          },
          create: {
            householdId,
            periodStart,
            ruleCode: c.ruleCode,
            subjectKey: c.subjectKey,
            title: c.title,
            message: c.message,
            potentialSaving: BigInt(c.saving),
            data: c.data as unknown as Prisma.InputJsonValue,
          },
          update: { title: c.title, message: c.message, potentialSaving: BigInt(c.saving), data: c.data as unknown as Prisma.InputJsonValue },
        }),
      ),
    ]);
    const existing = await this.prisma.insight.findMany({
      where: { householdId, periodStart, status: 'NEW' },
      select: { id: true, ruleCode: true, subjectKey: true },
    });
    const stale = existing.filter((e) => !keys.has(`${e.ruleCode}|${e.subjectKey}`)).map((e) => e.id);
    if (stale.length) await this.prisma.insight.deleteMany({ where: { id: { in: stale } } });
  }

  /**
   * Hasil saran yang ditandai "Akan saya coba" di periode lalu (PRD 5.7):
   * bandingkan kategori terkait di periode lalu vs periode ini (sampai hari yang sama).
   */
  private async followUps(
    householdId: string,
    prevPeriod: PeriodRange,
    input: RuleInput,
    rootOf: (id: string) => CatMeta | undefined,
  ) {
    const trying = await this.prisma.insight.findMany({
      where: { householdId, periodStart: prevPeriod.start, status: 'TRYING' },
    });
    return trying.map((t) => {
      const data = t.data as Record<string, unknown>;
      const categoryId = typeof data.categoryId === 'string' ? data.categoryId : null;
      const root = categoryId ? rootOf(categoryId) : undefined;
      if (!root) {
        return { id: t.id, title: t.title, before: null, after: null, saved: null, message: 'Lanjutkan kebiasaan baiknya. Hasilnya terlihat di total periode ini.' };
      }
      const now = input.roots.find((r) => r.id === root.id);
      const after = now?.amount ?? 0;
      const before = now?.previous[0] ?? 0;
      const saved = before - after;
      return {
        id: t.id,
        title: t.title,
        categoryId: root.id,
        before,
        after,
        saved,
        message:
          saved > 0
            ? `${root.name} turun ${rp(saved)} dibanding periode lalu di hari yang sama. Mantap!`
            : `${root.name} belum turun (${rp(after)} vs ${rp(before)} di hari yang sama periode lalu).`,
      };
    });
  }
}

function parseOffset(raw?: string) {
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? Math.min(0, Math.trunc(n)) : 0;
}

@Controller('insights')
@UseGuards(AuthGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('offset') offset?: string) {
    return this.insights.list(user.householdId, parseOffset(offset));
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInsightDto) {
    return this.insights.update(user.householdId, id, dto.status);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
