import { Controller, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

/**
 * Pengelolaan household: anggota dan undangan.
 * Semua route di sini butuh login; route yang mengubah data menambah `@Roles('OWNER')`.
 */
@Controller('household')
@UseGuards(AuthGuard, RolesGuard)
export class HouseholdController {}
