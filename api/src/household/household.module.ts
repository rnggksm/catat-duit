import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { HouseholdController } from './household.controller';
import { InvitesController } from './invites.controller';
import { InvitesModule } from './invites.module';
import { MembersService } from './members.service';

@Module({
  imports: [AuthModule, InvitesModule],
  controllers: [HouseholdController, InvitesController],
  providers: [MembersService, RolesGuard, RateLimitGuard],
})
export class HouseholdModule {}
