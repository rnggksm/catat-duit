import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { toNameKey } from '../common/defaults';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './categories.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kategori induk beserta sub-kategori, diurutkan sesuai sortOrder.
   * `usage` = jumlah transaksi 90 hari terakhir (termasuk sub-kategori), dipakai layar input
   * untuk menaruh kategori yang paling sering dipakai di depan (PRD 5.1).
   */
  async list(householdId: string, type: 'EXPENSE' | 'INCOME' = 'EXPENSE') {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [categories, usage] = await Promise.all([
      this.prisma.category.findMany({
        where: { householdId, type, parentId: null, archived: false },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true, name: true, icon: true, color: true, isEssential: true, sortOrder: true,
          children: {
            where: { archived: false },
            orderBy: { sortOrder: 'asc' },
            select: { id: true, name: true, sortOrder: true },
          },
        },
      }),
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { householdId, deletedAt: null, occurredAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);
    const counts = new Map(usage.map((u) => [u.categoryId, u._count._all]));
    return categories.map((c) => ({
      ...c,
      usage: (counts.get(c.id) ?? 0) + c.children.reduce((sum, ch) => sum + (counts.get(ch.id) ?? 0), 0),
    }));
  }

  /** Tambah kategori langsung dari layar input (PRD 5.2). Nama unik tanpa peduli huruf besar/kecil. */
  async create(householdId: string, dto: CreateCategoryDto) {
    const type = dto.type ?? 'EXPENSE';
    const name = dto.name.trim().replace(/\s+/g, ' ');
    const nameKey = toNameKey(name);

    const dup = await this.prisma.category.findUnique({
      where: { householdId_type_nameKey: { householdId, type, nameKey } },
    });
    if (dup) {
      throw new ConflictException(
        dup.archived
          ? `Kategori "${dup.name}" sudah ada di arsip. Pulihkan dari pengaturan kategori.`
          : `Kategori "${dup.name}" sudah ada`,
      );
    }

    if (dto.parentId) {
      const parent = await this.prisma.category.findFirst({ where: { id: dto.parentId, householdId, type } });
      if (!parent) throw new NotFoundException('Kategori induk tidak ditemukan');
    }

    const last = await this.prisma.category.aggregate({
      where: { householdId, type, parentId: dto.parentId ?? null },
      _max: { sortOrder: true },
    });

    return this.prisma.category.create({
      data: {
        householdId,
        type,
        parentId: dto.parentId ?? null,
        name,
        nameKey,
        icon: dto.icon,
        color: dto.color.toUpperCase(),
        isEssential: dto.isEssential,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
      select: { id: true, name: true, icon: true, color: true, isEssential: true, sortOrder: true },
    });
  }
}
