import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum CollectionTaskTypeDto {
  presencial_collection = 'presencial_collection',
  whatsapp_followup = 'whatsapp_followup',
  phone_call = 'phone_call',
  payment_confirmation = 'payment_confirmation',
  renegotiation_followup = 'renegotiation_followup',
  other = 'other',
}

export enum CollectionTaskPriorityDto {
  low = 'low',
  medium = 'medium',
  high = 'high',
  critical = 'critical',
}

export enum CollectionTaskStatusDto {
  pending = 'pending',
  assigned = 'assigned',
  in_progress = 'in_progress',
  completed = 'completed',
  canceled = 'canceled',
  failed = 'failed',
}

export class CreateCollectionTaskDto {
  @IsString()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsOptional()
  collectionId?: string;

  @IsString()
  @IsOptional()
  collectorId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsEnum(CollectionTaskTypeDto)
  type: CollectionTaskTypeDto;

  @IsEnum(CollectionTaskPriorityDto)
  @IsOptional()
  priority?: CollectionTaskPriorityDto;

  @IsEnum(CollectionTaskStatusDto)
  @IsOptional()
  status?: CollectionTaskStatusDto;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  scheduledDate?: Date;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  scheduledTime?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  aiRecommendation?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  completedAt?: Date;
}
