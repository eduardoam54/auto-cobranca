import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  MessageChannel,
  MessageDirection,
  MessageStatus,
} from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListMessagesQueryDto extends PaginationQueryDto {
  @IsEnum(MessageDirection)
  @IsOptional()
  direction?: MessageDirection;

  @IsEnum(MessageChannel)
  @IsOptional()
  channel?: MessageChannel;

  @IsEnum(MessageStatus)
  @IsOptional()
  status?: MessageStatus;

  @IsString()
  @IsOptional()
  clientId?: string;
}
