import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ListTransactionsQuery, SyncOpDto, TransactionInputDto, UpdateTransactionDto } from './transactions.dto';

/** Bentuk transaksi yang dikirim ke klien. */
export const TX_SELECT = {
  id: true,
  amount: true,
  occurredAt: true,
  note: true,
  clientUpdatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
      parent: { select: { id: true, name: true, icon: true, color: true } },
    },
  },
  wallet: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.TransactionSelect;

type TxInput = Omit<TransactionInputDto, 'id'>;

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(householdId: string, query: ListTransactionsQuery) {
    const limit = query.limit ?? 50;
    const where: Prisma.TransactionWhereInput = {
      householdId,
      type: 'EXPENSE',
      deletedAt: null,
      occurredAt: {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lt: new Date(query.to) } : {}),
      },
      ...(query.walletId ? { walletId: query.walletId } : {}),
      ...(query.q ? { note: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };
    if (query.categoryId) {
      // Kategori induk ikut menyertakan sub-kategorinya.
      const children = await this.prisma.category.findMany({
        where: { householdId, parentId: query.categoryId },
        select: { id: true },
      });
      where.categoryId = { in: [query.categoryId, ...children.map((c) => c.id)] };
    }

    const [items, totals] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        select: TX_SELECT,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.transaction.aggregate({ where, _sum: { amount: true }, _count: { _all: true } }),
    ]);

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
      total: Number(totals._sum.amount ?? 0),
      count: totals._count._all,
    };
  }

  async get(householdId: string, id: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id, householdId, deletedAt: null },
      select: TX_SELECT,
    });
    if (!tx) throw new NotFoundException('Transaksi tidak ditemukan');
    return tx;
  }

  create(householdId: string, userId: string, dto: TransactionInputDto) {
    const id = dto.id ?? randomUUID();
    return this.upsert(householdId, userId, id, dto, new Date());
  }

  async update(householdId: string, userId: string, id: string, dto: UpdateTransactionDto) {
    const current = await this.prisma.transaction.findFirst({ where: { id, householdId, deletedAt: null } });
    if (!current) throw new NotFoundException('Transaksi tidak ditemukan');
    return this.upsert(
      householdId,
      userId,
      id,
      {
        amount: dto.amount ?? Number(current.amount),
        categoryId: dto.categoryId ?? current.categoryId,
        walletId: dto.walletId ?? current.walletId,
        occurredAt: dto.occurredAt ?? current.occurredAt.toISOString(),
        note: dto.note ?? current.note ?? undefined,
      },
      new Date(),
    );
  }

  async remove(householdId: string, id: string) {
    const current = await this.prisma.transaction.findFirst({ where: { id, householdId, deletedAt: null } });
    if (!current) throw new NotFoundException('Transaksi tidak ditemukan');
    await this.softDelete(householdId, id, new Date());
  }

  /** Terapkan antrean dari klien offline. Last-write-wins berdasarkan `clientUpdatedAt`. */
  async sync(householdId: string, userId: string, ops: SyncOpDto[]) {
    const results: { id: string; status: 'applied' | 'stale' | 'error'; message?: string }[] = [];
    for (const op of ops) {
      try {
        const at = new Date(op.clientUpdatedAt);
        if (op.kind === 'delete') {
          const applied = await this.softDelete(householdId, op.id, at);
          results.push({ id: op.id, status: applied ? 'applied' : 'stale' });
        } else {
          if (!op.data) throw new BadRequestException('Data transaksi kosong');
          const res = await this.upsert(householdId, userId, op.id, op.data, at);
          results.push({ id: op.id, status: res.stale ? 'stale' : 'applied' });
        }
      } catch (e) {
        results.push({ id: op.id, status: 'error', message: e instanceof Error ? e.message : 'Gagal' });
      }
    }
    return { results };
  }

  /** Saran catatan + kategorinya dari riwayat 120 hari terakhir (PRD 5.1). */
  async noteSuggestions(householdId: string, q?: string) {
    const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.transaction.groupBy({
      by: ['note', 'categoryId'],
      where: {
        householdId,
        deletedAt: null,
        occurredAt: { gte: since },
        note: q ? { contains: q.trim(), mode: 'insensitive' as const } : { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { note: 'desc' } },
      take: 8,
    });
    return rows
      .filter((r) => r.note && r.note.trim() !== '')
      .map((r) => ({ note: r.note as string, categoryId: r.categoryId, count: r._count._all }));
  }

  // --- internal ---

  private async assertRefs(householdId: string, categoryId: string, walletId: string) {
    const [category, wallet] = await Promise.all([
      this.prisma.category.findFirst({ where: { id: categoryId, householdId, type: 'EXPENSE' }, select: { id: true } }),
      this.prisma.wallet.findFirst({ where: { id: walletId, householdId }, select: { id: true } }),
    ]);
    if (!category) throw new BadRequestException('Kategori tidak ditemukan');
    if (!wallet) throw new BadRequestException('Dompet tidak ditemukan');
  }

  private async upsert(householdId: string, userId: string, id: string, data: TxInput, clientUpdatedAt: Date) {
    await this.assertRefs(householdId, data.categoryId, data.walletId);
    const existing = await this.prisma.transaction.findUnique({ where: { id } });
    if (existing && existing.householdId !== householdId) throw new NotFoundException('Transaksi tidak ditemukan');

    if (existing && existing.clientUpdatedAt > clientUpdatedAt) {
      // Versi di server lebih baru: abaikan perubahan lama ini.
      const tx = await this.prisma.transaction.findUniqueOrThrow({ where: { id }, select: TX_SELECT });
      return { ...tx, stale: true };
    }

    const fields = {
      amount: BigInt(data.amount),
      categoryId: data.categoryId,
      walletId: data.walletId,
      occurredAt: new Date(data.occurredAt),
      note: data.note?.trim() || null,
      clientUpdatedAt,
    };

    const tx = existing
      ? await this.prisma.transaction.update({ where: { id }, data: { ...fields, deletedAt: null }, select: TX_SELECT })
      : await this.prisma.transaction.create({
          data: { id, householdId, createdById: userId, type: 'EXPENSE', ...fields },
          select: TX_SELECT,
        });
    return { ...tx, stale: false };
  }

  private async softDelete(householdId: string, id: string, clientUpdatedAt: Date) {
    const existing = await this.prisma.transaction.findUnique({ where: { id } });
    if (!existing || existing.householdId !== householdId) return false;
    if (existing.clientUpdatedAt > clientUpdatedAt) return false;
    await this.prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date(), clientUpdatedAt },
    });
    return true;
  }
}
