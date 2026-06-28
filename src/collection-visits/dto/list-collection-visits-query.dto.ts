import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { CollectionVisitResult } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListCollectionVisitsQueryDto extends PaginationQueryDto {
  @IsEnum(CollectionVisitResult)
  @IsOptional()
  result?: CollectionVisitResult;

  @IsString()
  @IsOptional()
  collectorId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  visitedFrom?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  visitedTo?: Date;
}
