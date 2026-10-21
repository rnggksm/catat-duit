import { Injectable } from '@nestjs/common';
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
}
