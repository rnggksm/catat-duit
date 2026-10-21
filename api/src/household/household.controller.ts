import { Controller } from '@nestjs/common';

/**
 * Pengelolaan household: anggota dan undangan.
 * Otorisasi berbasis peran (hanya OWNER) dipasang di poin berikutnya.
 */
@Controller('household')
export class HouseholdController {}
