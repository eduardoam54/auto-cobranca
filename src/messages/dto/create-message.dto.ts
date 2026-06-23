import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum MessageDirectionDto {
  inbound = 'inbound',
  outbound = 'outbound',
}

export enum MessageChannelDto {
  whatsapp = 'whatsapp',
  system = 'system',
  manual = 'manual',
}

export enum MessageTypeDto {
  text = 'text',
  audio = 'audio',
  image = 'image',
  document = 'document',
  location = 'location',
  other = 'other',
}

export enum MessageStatusDto {
  received = 'received',
  sent = 'sent',
  delivered = 'delivered',
  read = 'read',
  failed = 'failed',
  pending = 'pending',
}

export class CreateMessageDto {
  @IsString()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone: string;

  @IsEnum(MessageDirectionDto)
  direction: MessageDirectionDto;

  @IsEnum(MessageChannelDto)
  channel: MessageChannelDto;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;

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
