import { IsEmail, MaxLength } from 'class-validator';

export class CreateInviteDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(160, { message: 'Email terlalu panjang' })
  email: string;
}
