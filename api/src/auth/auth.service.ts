import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { createHouseholdWithDefaults } from '../common/household-defaults';
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
  ) {}

  async register(dto: RegisterDto): Promise<Session> {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email sudah terdaftar');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { user, household } = await this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({ data: { email, passwordHash, name: dto.name.trim() } });
        const household = await createHouseholdWithDefaults(tx, { userId: user.id, name: `Rumah ${user.name}` });
        return { user, household };
      },
      { timeout: 20000 },
    );
    return this.issueSession(user.id, household.id);
  }

  async login(dto: LoginDto): Promise<Session> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { orderBy: { joinedAt: 'asc' }, take: 1 } },
    });
    const ok = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !ok || user.memberships.length === 0) {
      throw new UnauthorizedException('Email atau password salah');
    }
    return this.issueSession(user.id, user.memberships[0].householdId);
  }

  /** Menukar refresh token lama dengan sesi baru (rotasi). */
  async refresh(refreshToken: string | undefined): Promise<Session> {
    if (!refreshToken) throw new UnauthorizedException('Belum masuk');
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: { include: { memberships: { orderBy: { joinedAt: 'asc' }, take: 1 } } } },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Sesi kedaluwarsa, silakan masuk lagi');
    }
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const membership = stored.user.memberships[0];
    if (!membership) throw new UnauthorizedException('Akun tidak punya rumah tangga');
    return this.issueSession(stored.userId, membership.householdId);
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
    return { user, household };
  }

  private async issueSession(userId: string, householdId: string): Promise<Session> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, hid: householdId },
      { expiresIn: ACCESS_TTL as unknown as number },
    );
    const refreshToken = randomBytes(48).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiresAt },
    });
    return { accessToken, refreshToken, refreshExpiresAt };
  }
}
