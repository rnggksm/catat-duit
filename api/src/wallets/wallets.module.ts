import { Controller, Get, Injectable, Module, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  list(householdId: string) {
    return this.prisma.wallet.findMany({
      where: { householdId, archived: false },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, type: true, isShared: true, sortOrder: true },
    });
  }
}

@Controller('wallets')
@UseGuards(AuthGuard)
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.wallets.list(user.householdId);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [WalletsController],
  providers: [WalletsService],
})
export class WalletsModule {}
