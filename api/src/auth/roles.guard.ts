import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { MemberRole } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth.guard';

export const ROLES_KEY = 'roles';

/**
 * Batasi handler ke peran tertentu, mis. `@Roles('OWNER')`.
 * Wajib dipasang SETELAH AuthGuard karena membaca `req.user` hasil verifikasi token.
 *
 * Guard ini SELALU memastikan pemanggil masih anggota rumah tangga yang diklaim token-nya —
 * termasuk pada handler tanpa `@Roles` — supaya anggota yang sudah dikeluarkan langsung
 * kehilangan akses, tidak menunggu access token 15 menit habis.
 */
export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<MemberRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Belum masuk');

    // Peran tidak dititipkan di token: dibaca dari DB supaya pencabutan peran langsung
    // berlaku, tidak menunggu access token (15 menit) kedaluwarsa.
    const membership = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId: user.householdId, userId: user.userId } },
      select: { role: true },
    });
    if (!membership) throw new ForbiddenException('Kamu bukan anggota rumah tangga ini');
    if (!required?.length) return true;
    if (!required.includes(membership.role)) {
      throw new ForbiddenException('Hanya pemilik rumah tangga yang bisa melakukan ini');
    }
    return true;
  }
}
