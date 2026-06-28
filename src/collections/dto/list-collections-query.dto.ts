import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CollectionStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListCollectionsQueryDto extends PaginationQueryDto {
  @IsEnum(CollectionStatus)
  @IsOptional()
  status?: CollectionStatus;

  @IsString()
  @IsOptional()
  clientId?: string;
}
