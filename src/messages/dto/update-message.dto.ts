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
  MessageChannelDto,
  MessageDirectionDto,
  MessageStatusDto,
  MessageTypeDto,
} from './create-message.dto';

export class UpdateMessageDto {
  @IsString()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  phone?: string;

  @IsEnum(MessageDirectionDto)
  @IsOptional()
  direction?: MessageDirectionDto;

  @IsEnum(MessageChannelDto)
  @IsOptional()
  channel?: MessageChannelDto;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  content?: string;

  @IsEnum(MessageTypeDto)
  @IsOptional()
  messageType?: MessageTypeDto;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  externalMessageId?: string;

  @IsEnum(MessageStatusDto)
  @IsOptional()
  status?: MessageStatusDto;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  receivedAt?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  sentAt?: Date;

  @IsBoolean()
  @IsOptional()
  aiAnalyzed?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  aiIntent?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  aiConfidence?: number;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  aiSummary?: string;
}
