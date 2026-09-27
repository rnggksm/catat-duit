import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { CreateCategoryDto } from './categories.dto';
import { CategoriesService } from './categories.service';

@Controller('categories')
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('type') type?: string) {
    return this.categories.list(user.householdId, type === 'INCOME' ? 'INCOME' : 'EXPENSE');
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.categories.create(user.householdId, dto);
  }
}
