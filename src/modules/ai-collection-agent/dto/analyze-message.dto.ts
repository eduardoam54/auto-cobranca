import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AnalyzeMessageDto {
  @IsString()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  messageContent: string;

  @IsString()
  @IsOptional()
  messageId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;
}
