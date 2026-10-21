import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.guard';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  /** Jumlah percobaan yang diizinkan dalam satu jendela waktu. */
  limit: number;
  windowMs: number;
}

/** Batasi jumlah percobaan per handler, mis. `@RateLimit(10, 60 * 60 * 1000)`. */
export const RateLimit = (limit: number, windowMs: number) => SetMetadata(RATE_LIMIT_KEY, { limit, windowMs });

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Pembatas percobaan sederhana di memori, tanpa dependensi baru.
 *
 * Kunci: id user bila sudah login (route undangan), selain itu IP + nilai parameter `token`
 * (route pratinjau). Memakai id user menghindari masalah `req.ip` di belakang Caddy, yang
 * tanpa `trust proxy` akan terbaca sebagai IP kontainer proxy sehingga semua orang berbagi
 * satu ember.
 *
 * Batasan yang perlu diketahui: hitungan per proses. Kalau nanti API dijalankan lebih dari
 * satu replika, tiap replika punya hitungan sendiri dan restart mereset semuanya. Untuk satu
 * instance di belakang Caddy (kondisi sekarang) ini cukup; kalau perlu lintas replika,
 * pindahkan ke Redis atau @nestjs/throttler.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const key = `${context.getClass().name}.${context.getHandler().name}:${this.keyFor(req)}`;
    const now = Date.now();
    this.prune(now);

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > options.limit) {
      const seconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      throw new HttpException(`Terlalu banyak percobaan. Coba lagi dalam ${seconds} detik.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  private keyFor(req: Request & { user?: AuthUser }): string {
    if (req.user) return `user:${req.user.userId}`;
    const token = typeof req.params?.token === 'string' ? req.params.token.slice(0, 12) : '';
    return `ip:${req.ip ?? 'unknown'}:${token}`;
  }

  /** Buang ember yang sudah kedaluwarsa agar map tidak tumbuh tanpa batas. */
  private prune(now: number) {
    if (this.buckets.size < 1000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
