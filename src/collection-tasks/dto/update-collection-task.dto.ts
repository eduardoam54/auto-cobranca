import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CollectionTaskPriorityDto,
  CollectionTaskStatusDto,
  CollectionTaskTypeDto,
} from './create-collection-task.dto';

export class UpdateCollectionTaskDto {
  @IsString()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  collectionId?: string;

  @IsString()
  @IsOptional()
  collectorId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsEnum(CollectionTaskTypeDto)
  @IsOptional()
  type?: CollectionTaskTypeDto;

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
