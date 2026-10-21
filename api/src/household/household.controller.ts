import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CreateInviteDto } from './household.dto';
import { InvitesService } from './invites.service';

/**
 * Pengelolaan household: anggota dan undangan.
 * Semua route di sini butuh login; route yang mengubah data menambah `@Roles('OWNER')`.
 */
@Controller('household')
@UseGuards(AuthGuard, RolesGuard)
export class HouseholdController {
  constructor(private readonly invites: InvitesService) {}

  @Post('invites')
  @Roles('OWNER')
  createInvite(@CurrentUser() user: AuthUser, @Body() dto: CreateInviteDto) {
    return this.invites.create(user.householdId, user.userId, dto);
  }

  @Get('invites')
  @Roles('OWNER')
  listInvites(@CurrentUser() user: AuthUser) {
    return this.invites.list(user.householdId);
  }
}
