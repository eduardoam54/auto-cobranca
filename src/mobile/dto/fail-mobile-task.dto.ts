import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CollectionVisitResult } from '@prisma/client';

export class FailMobileTaskDto {
  @IsEnum(CollectionVisitResult)
  result: CollectionVisitResult;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

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

  @IsDateString()
  @IsOptional()
  promisedPaymentDate?: string;
}
