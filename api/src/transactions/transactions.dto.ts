import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const MAX_AMOUNT = 1_000_000_000;

/** Data satu pengeluaran (PRD 5.1). `id` dibuat klien agar input offline idempotent. */
export class TransactionInputDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsInt({ message: 'Nominal harus bilangan bulat' })
  @Min(1, { message: 'Nominal harus lebih dari 0' })
  @Max(MAX_AMOUNT, { message: 'Nominal maksimal Rp 1.000.000.000' })
  amount: number;

  @IsUUID('all', { message: 'Kategori wajib dipilih' })
  categoryId: string;

  @IsUUID('all', { message: 'Dompet wajib dipilih' })
  walletId: string;

  @IsISO8601()
  occurredAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Catatan maksimal 120 karakter' })
  note?: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT)
  amount?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  walletId?: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string;
}

export class ListTransactionsQuery {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  walletId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class SyncOpDto {
  @IsIn(['upsert', 'delete'])
  kind: 'upsert' | 'delete';

  @IsUUID()
  id: string;

  @IsISO8601()
  clientUpdatedAt: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TransactionInputDto)
  data?: TransactionInputDto;
}

export class SyncDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SyncOpDto)
  ops: SyncOpDto[];
}
