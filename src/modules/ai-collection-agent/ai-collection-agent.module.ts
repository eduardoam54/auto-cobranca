import { Module } from '@nestjs/common';
import { SystemEventModule } from '../../events/system-event.module';
import { GeminiModule } from '../../infra/gemini/gemini.module';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { AiCollectionAgentController } from './ai-collection-agent.controller';
import { AiCollectionAgentService } from './ai-collection-agent.service';

@Module({
  imports: [PrismaModule, SystemEventModule, GeminiModule],
  controllers: [AiCollectionAgentController],
  providers: [AiCollectionAgentService],
  exports: [AiCollectionAgentService],
})
export class AiCollectionAgentModule {}
