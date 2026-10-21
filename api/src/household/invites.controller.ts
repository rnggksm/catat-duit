import { Controller, Get, Param } from '@nestjs/common';
import { InvitesService } from './invites.service';

/**
 * Endpoint undangan yang bisa diakses tanpa login, karena penerima tautan belum tentu
 * punya akun. Isinya sengaja minim (lihat InvitesService.preview).
 */
@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invites.preview(token);
  }
}
