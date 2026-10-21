import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { createHouseholdWithDefaults } from '../common/household-defaults';
import { InvitesService } from '../household/invites.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS ?? 30);
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL ?? '15m';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly invites: InvitesService,
  ) {}

  async register(dto: RegisterDto): Promise<Session> {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email sudah terdaftar');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { user, householdId } = await this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({ data: { email, passwordHash, name: dto.name.trim() } });

        // Dengan token undangan: bergabung ke rumah tangga pengundang dan TIDAK membuat rumah
        // tangga sendiri. Validasi token berjalan di dalam transaksi ini, jadi token yang tidak
        // sah membatalkan pembuatan user sekaligus — tidak ada akun yatim tanpa rumah tangga.
        const householdId = dto.inviteToken
          ? (await this.invites.consume(tx, { token: dto.inviteToken, email, userId: user.id })).householdId
          : (await createHouseholdWithDefaults(tx, { userId: user.id, name: `Rumah ${user.name}` })).id;

        await tx.user.update({ where: { id: user.id }, data: { activeHouseholdId: householdId } });
        return { user, householdId };
      },
      { timeout: 20000 },
    );
    return this.issueSession(user.id, householdId);
  }

  async login(dto: LoginDto): Promise<Session> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !ok) throw new UnauthorizedException('Email atau password salah');

    // Household aktif dibaca setelah kredensial terbukti, supaya akun tanpa keanggotaan
    // tidak membocorkan keberadaannya lewat pesan error yang berbeda.
    const householdId = await this.resolveActiveHouseholdId(user.id);
    return this.issueSession(user.id, householdId);
  }

  /** Menukar refresh token lama dengan sesi baru (rotasi). */
  async refresh(refreshToken: string | undefined): Promise<Session> {
    if (!refreshToken) throw new UnauthorizedException('Belum masuk');
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Sesi kedaluwarsa, silakan masuk lagi');
    }
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const householdId = await this.resolveActiveHouseholdId(stored.userId);
    return this.issueSession(stored.userId, householdId);
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string, householdId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    const household = await this.prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { id: true, name: true, periodStartDay: true, timezone: true },
    });
    // Daftar keanggotaan dipakai klien untuk menampilkan pilihan rumah tangga saat user
    // tergabung di lebih dari satu tempat (mis. ikut undangan pasangan).
    const memberships = await this.prisma.householdMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      select: { role: true, household: { select: { id: true, name: true } } },
    });
    return {
      user,
      household,
      households: memberships.map((m) => ({ id: m.household.id, name: m.household.name, role: m.role })),
    };
  }

  /**
   * Household untuk sesi berikutnya.
   *
   * Sumber kebenaran `users.active_household_id`, bukan urutan keanggotaan: user yang ikut
   * undangan punya dua keanggotaan, dan `memberships[0]` akan selalu mengembalikannya ke
   * rumah tangga lamanya. Kalau kolom itu kosong atau menunjuk keanggotaan yang sudah tidak
   * ada (mis. dikeluarkan), jatuh ke keanggotaan terlama lalu disimpan supaya pilihannya
   * tidak berubah-ubah antar permintaan.
   */
  async resolveActiveHouseholdId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        activeHouseholdId: true,
        memberships: { orderBy: { joinedAt: 'asc' }, select: { householdId: true } },
      },
    });

    const ids = user.memberships.map((m) => m.householdId);
    const resolved = user.activeHouseholdId && ids.includes(user.activeHouseholdId) ? user.activeHouseholdId : ids[0];
    if (!resolved) throw new UnauthorizedException('Akun tidak punya rumah tangga');

    if (resolved !== user.activeHouseholdId) {
      await this.prisma.user.update({ where: { id: userId }, data: { activeHouseholdId: resolved } });
    }
    return resolved;
  }

  private async issueSession(userId: string, householdId: string): Promise<Session> {
    const accessToken = await this.issueAccessToken(userId, householdId);
    const refreshToken = randomBytes(48).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiresAt },
    });
    return { accessToken, refreshToken, refreshExpiresAt };
  }

  /**
   * Access token untuk household tertentu tanpa membuat refresh token baru. Dipakai setelah
   * pindah atau bergabung household: sesi yang sedang berjalan langsung menunjuk ke household
   * barunya, sedangkan refresh token lama tetap berlaku dan akan mengikuti kolom
   * `active_household_id` pada rotasi berikutnya.
   */
  issueAccessToken(userId: string, householdId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, hid: householdId },
      { expiresIn: ACCESS_TTL as unknown as number },
    );
  }
}
