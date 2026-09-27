import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { ListTransactionsQuery, SyncDto, TransactionInputDto, UpdateTransactionDto } from './transactions.dto';
import { TransactionsService } from './transactions.service';

@Controller()
@UseGuards(AuthGuard)
export class TransactionsController {
  constructor(private readonly txs: TransactionsService) {}

  @Get('transactions')
  list(@CurrentUser() user: AuthUser, @Query() query: ListTransactionsQuery) {
    return this.txs.list(user.householdId, query);
  }

  @Get('transactions/notes')
  notes(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.txs.noteSuggestions(user.householdId, q);
  }

  @Get('transactions/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.txs.get(user.householdId, id);
  }

  @Post('transactions')
  create(@CurrentUser() user: AuthUser, @Body() dto: TransactionInputDto) {
    return this.txs.create(user.householdId, user.userId, dto);
  }

  @Patch('transactions/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTransactionDto) {
    return this.txs.update(user.householdId, user.userId, id, dto);
  }

  @Delete('transactions/:id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.txs.remove(user.householdId, id);
  }

  /** Antrean dari klien offline (PRD 9: POST /sync). */
  @Post('sync')
  @HttpCode(200)
  sync(@CurrentUser() user: AuthUser, @Body() dto: SyncDto) {
    return this.txs.sync(user.householdId, user.userId, dto.ops);
  }
}
