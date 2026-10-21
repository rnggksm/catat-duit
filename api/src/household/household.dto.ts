import { Transform } from 'class-transformer';
import { IsEmail, IsUUID, MaxLength } from 'class-validator';

export class CreateInviteDto {
  /**
   * Dirapikan sebelum validasi: alamat yang disalin dari WhatsApp/email klien sering membawa
   * spasi di ujung, dan `@IsEmail` menolak spasi mentah.
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(160, { message: 'Email terlalu panjang' })
  email: string;
}

export class SwitchHouseholdDto {
  @IsUUID('all', { message: 'ID rumah tangga tidak valid' })
  householdId: string;
}
