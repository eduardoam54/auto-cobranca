import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CollectionVisitResult, PaymentMethod } from '@prisma/client';

export class CompleteMobileTaskDto {
  @IsEnum(CollectionVisitResult)
  result: CollectionVisitResult;

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

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  locationAccuracy?: number;

  @IsDateString()
  @IsOptional()
  visitedAt?: string;
}
