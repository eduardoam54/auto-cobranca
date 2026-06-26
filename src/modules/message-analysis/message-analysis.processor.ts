import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  SystemEventSource,
  SystemEventStatus,
  SystemEventType,
} from '@prisma/client';
import { SystemEventService } from '../../events/system-event.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { WhatsappSenderService } from '../../infra/whatsapp-sender/whatsapp-sender.service';
import { QUEUE_NAMES } from '../../infra/queue/queue.constants';
import { AiCollectionAgentService } from '../ai-collection-agent/ai-collection-agent.service';
import { MessageAnalysisJobData } from './message-analysis.job';

@Processor(QUEUE_NAMES.MESSAGE_ANALYSIS)
export class MessageAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageAnalysisProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemEventService: SystemEventService,
    private readonly aiCollectionAgentService: AiCollectionAgentService,
    private readonly whatsappSenderService: WhatsappSenderService,
  ) {
    super();
  }

  async process(job: Job<MessageAnalysisJobData>): Promise<void> {
    const { companyId, messageId, phone, messageContent, clientId } = job.data;

    this.logger.log(`Processando job ${job.id} — mensagem ${messageId}`);

    if (clientId) {
      const client = await this.prisma.client.findUnique({
        where: { id: clientId },
        select: { aiEnabled: true },
      });

      if (!client?.aiEnabled) {
        this.logger.log(
          `Job ${job.id} ignorado — IA desativada para cliente ${clientId}`,
        );
        return;
      }
    }

    await this.systemEventService.record({
      companyId,
      clientId,
      messageId,
      source: SystemEventSource.ai,
      type: SystemEventType.ai_analysis_started,
      description: 'Analise de IA iniciada para mensagem do WhatsApp.',
    });

    try {
      const analysis = await this.aiCollectionAgentService.analyzeMessage(
        companyId,
        { phone, messageContent, messageId, clientId },
      );

      await this.prisma.message.update({
        where: { id: messageId },
        data: {
          clientId: analysis.client?.clientId ?? clientId,
          aiAnalyzed: true,
          aiIntent: analysis.intent,
          aiConfidence: analysis.confidence,
          aiSummary: analysis.summary,
        },
      });

      this.logger.log(
        `Job ${job.id} concluido — intent: ${analysis.intent}, confidence: ${analysis.confidence}`,
      );

      // Auto-send response to client if the AI recommended one and sender is configured
      const messageToClient = analysis.recommendedAction?.messageToClient;

      if (messageToClient && this.whatsappSenderService.isConfigured) {
        await this.sendAutoResponse({
          companyId,
          clientId: analysis.client?.clientId ?? clientId,
          phone,
          messageToClient,
          inboundMessageId: messageId,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';

      this.logger.error(`Job ${job.id} falhou: ${message}`);

      await this.systemEventService.record({
        companyId,
        clientId,
        messageId,
        source: SystemEventSource.ai,
        type: SystemEventType.ai_analysis_failed,
        status: SystemEventStatus.failed,
        description: 'Falha ao analisar mensagem do WhatsApp com IA.',
        metadata: { error: message, attempt: job.attemptsMade + 1 },
      });

      throw error;
    }
  }

  private async sendAutoResponse(params: {
    companyId: string;
    clientId?: string | null;
    phone: string;
    messageToClient: string;
    inboundMessageId: string;
  }) {
    const { companyId, clientId, phone, messageToClient, inboundMessageId } =
      params;

    try {
      const { externalMessageId } =
        await this.whatsappSenderService.sendText(phone, messageToClient);

      const outboundMessage = await this.prisma.message.create({
        data: {
          companyId,
          clientId: clientId ?? undefined,
          phone,
          direction: 'outbound',
          channel: 'whatsapp',
          content: messageToClient,
          messageType: 'text',
          externalMessageId: externalMessageId || undefined,
          status: 'sent',
          sentAt: new Date(),
        },
        select: { id: true },
      });

      await this.systemEventService.record({
        companyId,
        clientId: clientId ?? undefined,
        messageId: outboundMessageId(outboundMessage.id, inboundMessageId),
        source: SystemEventSource.ai,
        type: SystemEventType.whatsapp_message_sent,
        description: 'Resposta automatica enviada pelo agente de IA.',
        metadata: {
          to: phone,
          inboundMessageId,
          externalMessageId,
        },
      });

      this.logger.log(
        `Resposta automatica enviada para ${phone} — mensagem outbound: ${outboundMessage.id}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Falha ao enviar resposta automatica para ${phone}: ${message}`);

      await this.systemEventService.record({
        companyId,
        clientId: clientId ?? undefined,
        messageId: inboundMessageId,
        source: SystemEventSource.ai,
        type: SystemEventType.whatsapp_message_sent,
        status: SystemEventStatus.failed,
        description: 'Falha ao enviar resposta automatica do agente de IA.',
        metadata: { error: message, to: phone },
      });
    }
  }
}

// Use inbound message ID for the event record when outbound ID isn't available yet
function outboundMessageId(outboundId: string, fallback: string): string {
  return outboundId || fallback;
}
