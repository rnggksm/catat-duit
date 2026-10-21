import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { InvitesService } from './invites.service';

/**
 * Endpoint undangan. Pratinjau sengaja publik karena penerima tautan belum tentu punya akun;
 * `accept` butuh login. Guard dipasang per-route, bukan di level controller, supaya pratinjau
 * tidak ikut terkunci dan urutan AuthGuard -> RateLimitGuard tetap benar (kunci per user).
 */
@Controller('invites')
export class InvitesController {
  constructor(
    private readonly invites: InvitesService,
    private readonly auth: AuthService,
  ) {}

  @Get(':token')
  @UseGuards(RateLimitGuard)
  @RateLimit(20, 60 * 1000)
  preview(@Param('token') token: string) {
    return this.invites.preview(token);
  }

  /**
   * Gabung ke rumah tangga pengundang. Balikan memuat access token baru karena `hid` di token
   * lama menunjuk ke rumah tangga sebelumnya; refresh token tidak berubah.
   */
  @Post(':token/accept')
  @UseGuards(AuthGuard, RateLimitGuard)
  @RateLimit(10, 60 * 1000)
  async accept(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    const joined = await this.invites.accept(user.userId, token);
    const accessToken = await this.auth.issueAccessToken(user.userId, joined.householdId);
    return { ...joined, accessToken };
  }
}
