import { IsBoolean, IsHexColor, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Nama kategori wajib diisi' })
  @MaxLength(24, { message: 'Nama kategori maksimal 24 karakter' })
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  icon: string;

  @IsHexColor({ message: 'Warna harus kode hex, mis. #1E9E8F' })
  color: string;

  @IsBoolean()
  isEssential: boolean;

  @IsOptional()
  @IsIn(['EXPENSE', 'INCOME'])
  type?: 'EXPENSE' | 'INCOME';

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
