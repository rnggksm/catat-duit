import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { HouseholdController } from './household.controller';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { MembersService } from './members.service';

@Module({
  imports: [AuthModule],
  controllers: [HouseholdController, InvitesController],
  providers: [InvitesService, MembersService, RolesGuard],
})
export class HouseholdModule {}
