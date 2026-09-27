import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthUser {
  userId: string;
  householdId: string;
}

interface AccessPayload {
  sub: string;
  hid: string;
}

/** Memeriksa header Authorization: Bearer <access token>. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Belum masuk');
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token);
      req.user = { userId: payload.sub, householdId: payload.hid };
      return true;
    } catch {
      throw new UnauthorizedException('Sesi kedaluwarsa');
    }
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
  return req.user;
});
