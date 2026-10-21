import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Anggota satu rumah tangga, urut waktu bergabung sehingga OWNER (yang mendaftar pertama)
   * selalu di atas. Bisa dibaca semua anggota: pasangan perlu tahu siapa saja di rumah tangganya.
   */
  async list(householdId: string) {
    const rows = await this.prisma.householdMember.findMany({
      where: { householdId },
      orderBy: { joinedAt: 'asc' },
      select: {
        role: true,
        joinedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return rows.map((row) => ({
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      role: row.role,
      joinedAt: row.joinedAt,
    }));
  }

  /**
   * Keluarkan anggota dari rumah tangga. Transaksi yang pernah ia catat tetap ada — yang dicabut
   * hanya keanggotaan dan sesinya — sehingga `createdById` pada transaksi lama tetap sah.
   */
  async remove(householdId: string, actorId: string, targetUserId: string) {
    if (actorId === targetUserId) {
      throw new ConflictException('Tidak bisa mengeluarkan diri sendiri. Gunakan "keluar rumah tangga".');
    }

    const target = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId: targetUserId } },
      select: { role: true, user: { select: { name: true } } },
    });
    if (!target) throw new NotFoundException('Anggota tidak ditemukan');

    if (target.role === 'OWNER') {
      const owners = await this.prisma.householdMember.count({ where: { householdId, role: 'OWNER' } });
      if (owners <= 1) throw new ConflictException('Pemilik terakhir tidak bisa dikeluarkan');
    }

    await this.prisma.$transaction([
      this.prisma.householdMember.delete({
        where: { householdId_userId: { householdId, userId: targetUserId } },
      }),
      // Access token yang masih hidup berlaku sampai 15 menit; refresh token dicabut sekarang
      // supaya tidak bisa memperpanjang akses setelah dikeluarkan.
      this.prisma.refreshToken.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { id: targetUserId, name: target.user.name, removed: true };
  }

  /**
   * Pindahkan household aktif user. Hanya menyimpan pilihan; token akses yang baru diterbitkan
   * oleh controller sesudahnya, karena `hid` di dalam token ikut menentukan data mana yang
   * dibaca semua endpoint lain.
   */
  async switchActive(userId: string, householdId: string) {
    const membership = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId } },
      select: { role: true, household: { select: { id: true, name: true } } },
    });
    if (!membership) throw new NotFoundException('Kamu bukan anggota rumah tangga itu');

    await this.prisma.user.update({ where: { id: userId }, data: { activeHouseholdId: householdId } });

    return { householdId, householdName: membership.household.name, role: membership.role };
  }
}
