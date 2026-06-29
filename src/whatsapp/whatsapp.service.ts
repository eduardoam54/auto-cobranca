import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  SystemEventSource,
  SystemEventStatus,
  SystemEventType,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { SystemEventService } from '../events/system-event.service';
import { PrismaService } from '../infra/prisma/prisma.service';
import { QUEUE_NAMES } from '../infra/queue/queue.constants';
import { WhatsappSenderService } from '../infra/whatsapp-sender/whatsapp-sender.service';
import { MessageAnalysisJobData } from '../modules/message-analysis/message-analysis.job';
import {
  EvolutionWebhookPayload,
  WhatsappMessage,
  WhatsappWebhookPayload,
  WhatsappWebhookResult,
} from './whatsapp.types';

export type SendMessageResult = {
  messageId: string;
  externalMessageId: string;
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly systemEventService: SystemEventService,
    private readonly whatsappSenderService: WhatsappSenderService,
    @InjectQueue(QUEUE_NAMES.MESSAGE_ANALYSIS)
    private readonly messageAnalysisQueue: Queue<MessageAnalysisJobData>,
  ) {}

  verifyWebhook(mode: string, verifyToken: string, challenge: string) {
    const expectedToken = this.configService.get<string>(
      'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
    );

    if (!expectedToken) {
      throw new BadRequestException(
        'Token de verificacao do WhatsApp nao configurado.',
      );
    }

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      return challenge;
    }

    throw new ForbiddenException('Verificacao do webhook recusada.');
  }

  async handleWebhook(
    payload: WhatsappWebhookPayload,
  ): Promise<WhatsappWebhookResult> {
    const companyId = this.configService.get<string>('WHATSAPP_COMPANY_ID');
    const configuredPhoneNumberId = this.configService.get<string>(
      'WHATSAPP_PHONE_NUMBER_ID',
    );

    if (!companyId) {
      throw new BadRequestException('Empresa do WhatsApp nao configurada.');
    }

    await this.ensureActiveCompany(companyId);

    let processedMessages = 0;
    let skippedMessages = 0;

    for (const change of this.extractMessageChanges(payload)) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;

      if (
        configuredPhoneNumberId &&
        phoneNumberId &&
        phoneNumberId !== configuredPhoneNumberId
      ) {
        const skippedCount = change.value?.messages?.length ?? 0;
        skippedMessages += skippedCount;
        await this.systemEventService.record({
          companyId,
          source: SystemEventSource.whatsapp,
          type: SystemEventType.whatsapp_message_skipped,
          status: SystemEventStatus.warning,
          description:
            'Payload do WhatsApp ignorado por phone_number_id diferente do configurado.',
          metadata: {
            receivedPhoneNumberId: phoneNumberId,
            configuredPhoneNumberId,
            skippedMessages: skippedCount,
          },
        });
        continue;
      }

      for (const message of change.value?.messages ?? []) {
        const processed = await this.processInboundMessage(companyId, message);

        if (processed) {
          processedMessages += 1;
        } else {
          skippedMessages += 1;
        }
      }
    }

    return {
      received: true,
      processedMessages,
      skippedMessages,
    };
  }

  private extractMessageChanges(payload: WhatsappWebhookPayload) {
    return (
      payload.entry
        ?.flatMap((entry) => entry.changes ?? [])
        .filter((change) => {
          return (
            change.field === 'messages' &&
            Array.isArray(change.value?.messages) &&
            change.value.messages.length > 0
          );
        }) ?? []
    );
  }

  private async processInboundMessage(
    companyId: string,
    message: WhatsappMessage,
  ) {
    if (!message.id || !message.from) {
      await this.systemEventService.record({
        companyId,
        source: SystemEventSource.whatsapp,
        type: SystemEventType.whatsapp_message_skipped,
        status: SystemEventStatus.warning,
        description:
          'Mensagem do WhatsApp ignorada por nao conter id ou telefone de origem.',
        metadata: {
          externalMessageId: message.id ?? null,
          from: message.from ?? null,
          type: message.type ?? null,
        },
      });
      return false;
    }

    const content = this.extractContent(message);

    if (!content) {
      await this.systemEventService.record({
        companyId,
        source: SystemEventSource.whatsapp,
        type: SystemEventType.whatsapp_message_skipped,
        status: SystemEventStatus.warning,
        description:
          'Mensagem do WhatsApp ignorada por nao ter conteudo processavel.',
        metadata: {
          externalMessageId: message.id,
          from: message.from,
          type: message.type ?? null,
        },
      });
      return false;
    }

    const existingMessage = await this.prisma.message.findFirst({
      where: {
        companyId,
        externalMessageId: message.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingMessage) {
      await this.systemEventService.record({
        companyId,
        messageId: existingMessage.id,
        source: SystemEventSource.whatsapp,
        type: SystemEventType.whatsapp_message_duplicated,
        status: SystemEventStatus.warning,
        description:
          'Mensagem do WhatsApp ignorada porque ja havia sido registrada.',
        metadata: {
          externalMessageId: message.id,
          from: message.from,
        },
      });
      return false;
    }

    const client = await this.findClientByPhone(companyId, message.from);
    const receivedAt = message.timestamp
      ? new Date(Number(message.timestamp) * 1000)
      : new Date();

    const savedMessage = await this.createMessage({
      companyId,
      clientId: client?.id,
      phone: message.from,
      content,
      externalMessageId: message.id,
      receivedAt,
      messageType: this.toMessageType(message.type),
    });

    await this.systemEventService.record({
      companyId,
      clientId: client?.id,
      messageId: savedMessage.id,
      source: SystemEventSource.whatsapp,
      type: SystemEventType.whatsapp_message_received,
      description: 'Mensagem inbound do WhatsApp registrada.',
      metadata: {
        externalMessageId: message.id,
        from: message.from,
        messageType: message.type ?? null,
      },
    });

    await this.messageAnalysisQueue.add(
      'analyze',
      {
        companyId,
        messageId: savedMessage.id,
        phone: message.from,
        messageContent: content,
        clientId: client?.id,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    );

    this.logger.log(
      `Mensagem ${savedMessage.id} salva — job de analise enfileirado.`,
    );

    return true;
  }

  private createMessage(data: {
    companyId: string;
    clientId?: string;
    phone: string;
    content: string;
    externalMessageId: string;
    receivedAt: Date;
    messageType: 'text' | 'audio' | 'image' | 'document' | 'location' | 'other';
  }) {
    try {
      return this.prisma.message.create({
        data: {
          companyId: data.companyId,
          clientId: data.clientId,
          phone: data.phone,
          direction: 'inbound',
          channel: 'whatsapp',
          content: data.content,
          messageType: data.messageType,
          externalMessageId: data.externalMessageId,
          status: 'received',
          receivedAt: data.receivedAt,
        },
        select: { id: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Mensagem do WhatsApp ja registrada para esta empresa.',
        );
      }

      throw error;
    }
  }

  private findClientByPhone(companyId: string, phone: string) {
    return this.prisma.client.findFirst({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { phone },
          { whatsappPhone: phone },
          { phone: `+${phone}` },
          { whatsappPhone: `+${phone}` },
        ],
      },
      select: { id: true },
    });
  }

  private async ensureActiveCompany(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Empresa do WhatsApp nao encontrada.');
    }
  }

  private extractContent(message: WhatsappMessage) {
    if (message.type === 'text') {
      return message.text?.body?.trim() ?? null;
    }

    if (message.type === 'image') {
      return message.image?.caption?.trim() || '[imagem]';
    }

    if (message.type === 'document') {
      return message.document?.caption?.trim() || '[documento]';
    }

    if (message.type) {
      return `[${message.type}]`;
    }

    return null;
  }

  private toMessageType(type?: string) {
    if (
      type === 'text' ||
      type === 'audio' ||
      type === 'image' ||
      type === 'document' ||
      type === 'location'
    ) {
      return type;
    }

    return 'other';
  }

  async handleEvolutionWebhook(
    payload: EvolutionWebhookPayload,
  ): Promise<WhatsappWebhookResult> {
    // Ignorar eventos que não são mensagens recebidas
    if (payload.event !== 'messages.upsert' || payload.data?.key?.fromMe) {
      return { received: true, processedMessages: 0, skippedMessages: 0 };
    }

    const companyId = this.configService.get<string>('WHATSAPP_COMPANY_ID');
    if (!companyId) {
      throw new BadRequestException('Empresa do WhatsApp nao configurada.');
    }

    await this.ensureActiveCompany(companyId);

    const key = payload.data?.key;
    const msgData = payload.data;

    if (!key?.id || !key?.remoteJid) {
      return { received: true, processedMessages: 0, skippedMessages: 1 };
    }

    // Extrai número: "5511999990001@s.whatsapp.net" → "5511999990001"
    const phone = key.remoteJid.replace(/@.*$/, '');

    const content = this.extractEvolutionContent(msgData?.message, msgData?.messageType);
    if (!content) {
      return { received: true, processedMessages: 0, skippedMessages: 1 };
    }

    const existingMessage = await this.prisma.message.findFirst({
      where: { companyId, externalMessageId: key.id, deletedAt: null },
      select: { id: true },
    });

    if (existingMessage) {
      return { received: true, processedMessages: 0, skippedMessages: 1 };
    }

    const client = await this.findClientByPhone(companyId, phone);
    const receivedAt = msgData?.messageTimestamp
      ? new Date(msgData.messageTimestamp * 1000)
      : new Date();

    const messageType = this.toEvolutionMessageType(msgData?.messageType);

    const savedMessage = await this.createMessage({
      companyId,
      clientId: client?.id,
      phone,
      content,
      externalMessageId: key.id,
      receivedAt,
      messageType,
    });

    await this.systemEventService.record({
      companyId,
      clientId: client?.id,
      messageId: savedMessage.id,
      source: SystemEventSource.whatsapp,
      type: SystemEventType.whatsapp_message_received,
      description: 'Mensagem inbound do WhatsApp registrada via Evolution API.',
      metadata: { externalMessageId: key.id, from: phone, messageType },
    });

    await this.messageAnalysisQueue.add(
      'analyze',
      {
        companyId,
        messageId: savedMessage.id,
        phone,
        messageContent: content,
        clientId: client?.id,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    );

    this.logger.log(`[Evolution] Mensagem ${savedMessage.id} salva — job de analise enfileirado.`);

    return { received: true, processedMessages: 1, skippedMessages: 0 };
  }

  private extractEvolutionContent(
    message: NonNullable<EvolutionWebhookPayload['data']>['message'],
    messageType?: string,
  ): string | null {
    if (!message || !messageType) return null;

    if (messageType === 'conversation') {
      return message.conversation?.trim() || null;
    }
    if (messageType === 'imageMessage') {
      return message.imageMessage?.caption?.trim() || '[imagem]';
    }
    if (messageType === 'documentMessage') {
      return message.documentMessage?.caption?.trim() || '[documento]';
    }
    if (messageType === 'videoMessage') {
      return message.videoMessage?.caption?.trim() || '[vídeo]';
    }
    if (messageType === 'audioMessage') {
      return '[áudio]';
    }

    return `[${messageType}]`;
  }

  private toEvolutionMessageType(
    messageType?: string,
  ): 'text' | 'audio' | 'image' | 'document' | 'location' | 'other' {
    if (messageType === 'conversation') return 'text';
    if (messageType === 'audioMessage') return 'audio';
    if (messageType === 'imageMessage') return 'image';
    if (messageType === 'documentMessage') return 'document';
    if (messageType === 'locationMessage') return 'location';
    return 'other';
  }

  async sendMessage(
    companyId: string,
    phone: string,
    message: string,
    actorUserId?: string,
  ): Promise<SendMessageResult> {
    await this.ensureActiveCompany(companyId);

    const { externalMessageId } =
      await this.whatsappSenderService.sendText(phone, message);

    const client = await this.findClientByPhone(companyId, phone);

    const savedMessage = await this.prisma.message.create({
      data: {
        companyId,
        clientId: client?.id,
        phone,
        direction: 'outbound',
        channel: 'whatsapp',
        content: message,
        messageType: 'text',
        externalMessageId: externalMessageId || undefined,
        status: 'sent',
        sentAt: new Date(),
      },
      select: { id: true },
    });

    await this.systemEventService.record({
      companyId,
      clientId: client?.id,
      messageId: savedMessage.id,
      source: SystemEventSource.web,
      type: SystemEventType.whatsapp_message_sent,
      description: 'Mensagem enviada manualmente pelo painel administrativo.',
      metadata: {
        to: phone,
        externalMessageId,
        actorUserId: actorUserId ?? null,
      },
    });

    this.logger.log(
      `Mensagem manual enviada para ${phone} — messageId: ${savedMessage.id}`,
    );

    return { messageId: savedMessage.id, externalMessageId };
  }
}
