import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { InvitesService } from './invites.service';

/**
 * Endpoint undangan yang bisa diakses tanpa login, karena penerima tautan belum tentu
 * punya akun. Isinya sengaja minim (lihat InvitesService.preview).
 *
 * Dibatasi 20 permintaan per menit per IP+token: cukup untuk membuka halaman beberapa kali,
 * tapi menutup percobaan menebak token secara beruntun.
 */
@Controller('invites')
@UseGuards(RateLimitGuard)
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get(':token')
  @RateLimit(20, 60 * 1000)
  preview(@Param('token') token: string) {
    return this.invites.preview(token);
  }
}
