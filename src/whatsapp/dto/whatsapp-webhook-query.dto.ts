import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class WhatsappWebhookQueryDto {
  @IsString()
  @IsNotEmpty()
  'hub.mode': string;

  @IsString()
  @IsNotEmpty()
  'hub.verify_token': string;

  @IsString()
  @IsNotEmpty()
  'hub.challenge': string;

  // Meta também envia os mesmos campos com underline — aceitar para não rejeitar com 400
  @IsString()
  @IsOptional()
  hub_mode?: string;

  @IsString()
  @IsOptional()
  hub_verify_token?: string;

  @IsString()
  @IsOptional()
  hub_challenge?: string;
}
