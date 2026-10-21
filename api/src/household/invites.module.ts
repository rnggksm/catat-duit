import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';

/**
 * InvitesService dipisah ke modul sendiri karena dipakai dua sisi: HouseholdModule (endpoint
 * undangan) dan AuthModule (register dengan token undangan).
 *
 * Menaruhnya langsung di HouseholdModule akan membuat siklus, sebab HouseholdModule mengimpor
 * AuthModule untuk AuthGuard. Modul ini tidak mengimpor apa pun selain PrismaService yang global.
 */
@Module({
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
