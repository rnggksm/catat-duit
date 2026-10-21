import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { CreateInviteDto, SwitchHouseholdDto } from './household.dto';
import { InvitesService } from './invites.service';
import { MembersService } from './members.service';

/**
 * Pengelolaan household: anggota dan undangan.
 * Semua route di sini butuh login; route yang mengubah data menambah `@Roles('OWNER')`.
 * Route baca tanpa `@Roles` sengaja terbuka untuk semua anggota.
 */
@Controller('household')
@UseGuards(AuthGuard, RolesGuard, RateLimitGuard)
export class HouseholdController {
  constructor(
    private readonly invites: InvitesService,
    private readonly members: MembersService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Pindah household aktif, mis. dari rumah tangga sendiri ke rumah tangga pasangan.
   * Balikan menyertakan access token baru karena `hid` di token lama menunjuk ke tempat lain.
   */
  @Post('switch')
  async switch(@CurrentUser() user: AuthUser, @Body() dto: SwitchHouseholdDto) {
    const result = await this.members.switchActive(user.userId, dto.householdId);
    const accessToken = await this.auth.issueAccessToken(user.userId, result.householdId);
    return { ...result, accessToken };
  }

  @Get('members')
  listMembers(@CurrentUser() user: AuthUser) {
    return this.members.list(user.householdId);
  }

  @Delete('members/:userId')
  @Roles('OWNER')
  removeMember(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.members.remove(user.householdId, user.userId, userId);
  }

  @Post('invites')
  @Roles('OWNER')
  @RateLimit(10, 60 * 60 * 1000)
  createInvite(@CurrentUser() user: AuthUser, @Body() dto: CreateInviteDto) {
    return this.invites.create(user.householdId, user.userId, dto);
  }

  @Get('invites')
  @Roles('OWNER')
  listInvites(@CurrentUser() user: AuthUser) {
    return this.invites.list(user.householdId);
  }

  @Delete('invites/:id')
  @Roles('OWNER')
  revokeInvite(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.invites.revoke(user.householdId, id);
  }
}
