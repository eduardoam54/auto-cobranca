import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  SystemEventSource,
  SystemEventStatus,
  SystemEventType,
} from '@prisma/client';

export class ListSystemEventsQueryDto {
  @IsEnum(SystemEventSource)
  @IsOptional()
  source?: SystemEventSource;

  @IsEnum(SystemEventType)
  @IsOptional()
  type?: SystemEventType;

  @IsEnum(SystemEventStatus)
  @IsOptional()
  status?: SystemEventStatus;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  collectionId?: string;

  @IsString()
  @IsOptional()
  taskId?: string;

  @IsString()
  @IsOptional()
  messageId?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  occurredFrom?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  occurredTo?: Date;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
