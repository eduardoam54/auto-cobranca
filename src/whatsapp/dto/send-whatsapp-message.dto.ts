import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SendWhatsappMessageDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(30)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  message: string;
}
