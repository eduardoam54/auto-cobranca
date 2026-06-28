import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  CollectionTaskPriority,
  CollectionTaskStatus,
} from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListCollectionTasksQueryDto extends PaginationQueryDto {
  @IsEnum(CollectionTaskStatus)
  @IsOptional()
  status?: CollectionTaskStatus;

  @IsEnum(CollectionTaskPriority)
  @IsOptional()
  priority?: CollectionTaskPriority;

  @IsString()
  @IsOptional()
  collectorId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;
}
