import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SystemEventModule } from '../events/system-event.module';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { QUEUE_NAMES } from '../infra/queue/queue.constants';
import { WhatsappSenderModule } from '../infra/whatsapp-sender/whatsapp-sender.module';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.MESSAGE_ANALYSIS }),
    PrismaModule,
    SystemEventModule,
    WhatsappSenderModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService],
})
export class WhatsappModule {}
