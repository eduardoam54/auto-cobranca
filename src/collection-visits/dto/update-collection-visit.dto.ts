import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CollectionVisitPaymentMethodDto,
  CollectionVisitResultDto,
} from './create-collection-visit.dto';

export class UpdateCollectionVisitDto {
  @IsEnum(CollectionVisitResultDto)
  @IsOptional()
  result?: CollectionVisitResultDto;

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
