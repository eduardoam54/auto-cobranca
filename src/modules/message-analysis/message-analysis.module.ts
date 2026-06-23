import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SystemEventModule } from '../../events/system-event.module';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { QUEUE_NAMES } from '../../infra/queue/queue.constants';
import { WhatsappSenderModule } from '../../infra/whatsapp-sender/whatsapp-sender.module';
import { AiCollectionAgentModule } from '../ai-collection-agent/ai-collection-agent.module';
import { MessageAnalysisProcessor } from './message-analysis.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.MESSAGE_ANALYSIS }),
    PrismaModule,
    SystemEventModule,
    AiCollectionAgentModule,
    WhatsappSenderModule,
  ],
  providers: [MessageAnalysisProcessor],
})
export class MessageAnalysisModule {}
