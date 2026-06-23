import { Module } from '@nestjs/common';
import { WhatsappSenderService } from './whatsapp-sender.service';

@Module({
  providers: [WhatsappSenderService],
  exports: [WhatsappSenderService],
})
export class WhatsappSenderModule {}
