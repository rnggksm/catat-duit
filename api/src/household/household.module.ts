import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdController } from './household.controller';
import { InvitesService } from './invites.service';

@Module({
  imports: [AuthModule],
  controllers: [HouseholdController],
  providers: [InvitesService],
})
export class HouseholdModule {}
