import { ConflictException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateInviteDto } from './household.dto';

/** Status undangan. Diturunkan dari kolom waktu, tidak disimpan di DB. */
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

const DEFAULT_TTL_DAYS = 7;

/** Masa berlaku undangan. 0 atau nilai tidak wajar diabaikan agar tidak membuat tautan mati seketika. */
export function inviteTtlMs(): number {
  const days = Number(process.env.INVITE_TTL_DAYS ?? DEFAULT_TTL_DAYS);
  return (Number.isFinite(days) && days > 0 ? days : DEFAULT_TTL_DAYS) * 24 * 60 * 60 * 1000;
}

/** Token mentah tidak pernah disimpan; hanya hash SHA-256, pola sama dengan RefreshToken. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newInviteToken(): string {
  return randomBytes(32).toString('hex');
}

/** Tautan dibagikan lewat WhatsApp/salin-tempel; belum ada infra email di stack ini. */
export function buildInviteUrl(token: string): string {
  const base = (process.env.APP_BASE_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/undang/${token}`;
}

/** rahasia@gmail.com -> ra*******@gmail.com. Tautan yang diteruskan tidak membocorkan alamat penuh. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const keep = local.slice(0, 2);
  return `${keep}${'*'.repeat(Math.max(local.length - keep.length, 3))}${domain}`;
}

export function inviteStatus(invite: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): InviteStatus {
  if (invite.acceptedAt) return 'ACCEPTED';
  if (invite.revokedAt) return 'REVOKED';
  if (invite.expiresAt.getTime() <= Date.now()) return 'EXPIRED';
  return 'PENDING';
}

@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Buat undangan untuk satu email. Mengembalikan tautan berisi token mentah — satu-satunya
   * kesempatan token itu terlihat; setelah ini hanya hash-nya yang tersimpan.
   *
   * Undangan lama untuk email yang sama dicabut dalam transaksi yang sama sehingga selalu
   * hanya ada satu tautan hidup per orang.
   */
  async create(householdId: string, userId: string, dto: CreateInviteDto) {
    const email = dto.email.trim().toLowerCase();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + inviteTtlMs());

    const registered = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, memberships: { where: { householdId }, select: { userId: true } } },
    });
    if (registered?.memberships.length) {
      throw new ConflictException('Email ini sudah menjadi anggota rumah tangga ini');
    }
    if (registered) {
      // Menggabungkan akun yang sudah punya rumah tangga sendiri butuh alur pindah-household
      // (pemilihan household aktif di token) yang belum ada. Ditolak terang-terangan daripada
      // membuat tautan yang tidak bisa dipakai.
      throw new ConflictException(
        'Email ini sudah punya akun Catat Duit. Menggabungkan akun lama belum didukung — undang dengan email lain.',
      );
    }

    const token = newInviteToken();
    const invite = await this.prisma.$transaction(async (tx) => {
      await tx.householdInvite.updateMany({
        where: { householdId, email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      return tx.householdInvite.create({
        data: {
          householdId,
          email,
          tokenHash: hashToken(token),
          role: 'MEMBER',
          invitedById: userId,
          expiresAt,
        },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      });
    });

    return { ...invite, status: 'PENDING' as InviteStatus, url: buildInviteUrl(token) };
  }

  /**
   * Daftar undangan sebuah household, terbaru dulu. Tautan mentah tidak ikut — hanya hash
   * yang tersimpan, jadi undangan lama harus dikirim ulang lewat `create`.
   */
  async list(householdId: string) {
    const rows = await this.prisma.householdInvite.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
        acceptedBy: { select: { name: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      status: inviteStatus(row),
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt,
      acceptedByName: row.acceptedBy?.name ?? null,
    }));
  }
}
