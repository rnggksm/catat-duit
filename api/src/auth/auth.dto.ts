import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter' })
  @MaxLength(72)
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Nama wajib diisi' })
  @MaxLength(60)
  name: string;

  /**
   * Token dari tautan undangan (`/undang/<token>`). Bila diisi, akun baru langsung bergabung
   * ke rumah tangga pengundang dan tidak membuat rumah tangga sendiri.
   */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[0-9a-f]{64}$/, { message: 'Token undangan tidak valid' })
  inviteToken?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
