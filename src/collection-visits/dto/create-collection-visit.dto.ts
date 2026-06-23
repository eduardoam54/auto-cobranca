import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum CollectionVisitResultDto {
  paid = 'paid',
  partial_paid = 'partial_paid',
  not_home = 'not_home',
  refused_payment = 'refused_payment',
  promised_payment = 'promised_payment',
  wrong_address = 'wrong_address',
  rescheduled = 'rescheduled',
  other = 'other',
}

export enum CollectionVisitPaymentMethodDto {
  cash = 'cash',
  pix = 'pix',
  bank_slip = 'bank_slip',
  credit_card = 'credit_card',
  debit_card = 'debit_card',
  other = 'other',
}

export class CreateCollectionVisitDto {
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @IsEnum(CollectionVisitResultDto)
  result: CollectionVisitResultDto;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsBoolean()
  @IsOptional()
  paymentReceived?: boolean;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0.01)
  @Max(9999999999.99)
  paymentAmount?: number;

  @IsEnum(CollectionVisitPaymentMethodDto)
  @IsOptional()
  paymentMethod?: CollectionVisitPaymentMethodDto;

  @IsString()
  @IsOptional()
  @MaxLength(2048)
  receiptUrl?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  visitedAt?: Date;
}
