import { IsNotEmpty, IsString } from 'class-validator';

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
}
