import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

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
}
