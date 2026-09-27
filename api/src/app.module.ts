import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './auth/auth.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { HealthController } from './health.controller';
import { InsightsModule } from './insights/insights.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { SummaryModule } from './summary/summary.module';
import { TransactionsModule } from './transactions/transactions.module';
import { WalletsModule } from './wallets/wallets.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET ?? 'dev-only-secret',
    }),
    AuthModule,
    CategoriesModule,
    WalletsModule,
    TransactionsModule,
    SummaryModule,
    ReportsModule,
    InsightsModule,
    BudgetsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
