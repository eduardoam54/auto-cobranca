import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export enum CollectionStatusDto {
  pending = 'pending',
  overdue = 'overdue',
  paid = 'paid',
  canceled = 'canceled',
  renegotiated = 'renegotiated',
}

export enum PaymentMethodDto {
  cash = 'cash',
  pix = 'pix',
  bank_slip = 'bank_slip',
  credit_card = 'credit_card',
  debit_card = 'debit_card',
  other = 'other',
}

export class CreateCollectionDto {
  @IsString()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @Type(() => Date)
  @IsDate()
  dueDate: Date;

  @IsEnum(CollectionStatusDto)
  @IsOptional()
  status?: CollectionStatusDto;

  @IsEnum(PaymentMethodDto)
  @IsOptional()
  paymentMethod?: PaymentMethodDto;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  paidAt?: Date;
}
