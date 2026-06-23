import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import {
  SystemEventSource,
  SystemEventStatus,
  SystemEventType,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { SystemEventService } from '../events/system-event.service';
import { PrismaService } from '../infra/prisma/prisma.service';
import { MessageAnalysisJobData } from '../modules/message-analysis/message-analysis.job';
import { WhatsappService } from './whatsapp.service';

const prismaMock = () => jest.fn<(...args: unknown[]) => Promise<unknown>>();

describe('WhatsappService', () => {
  let service: WhatsappService;
  let config: { get: jest.Mock<(key: string) => string | undefined> };
  let prisma: {
    company: { findFirst: ReturnType<typeof prismaMock> };
    client: { findFirst: ReturnType<typeof prismaMock> };
    message: {
      create: ReturnType<typeof prismaMock>;
      findFirst: ReturnType<typeof prismaMock>;
      update: ReturnType<typeof prismaMock>;
    };
  };
  let systemEventService: {
    record: ReturnType<typeof prismaMock>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let messageAnalysisQueue: { add: jest.Mock<any> };

  beforeEach(() => {
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-token',
          WHATSAPP_COMPANY_ID: 'company-1',
          WHATSAPP_PHONE_NUMBER_ID: 'phone-number-1',
        };

        return values[key];
      }),
    };
    prisma = {
      company: { findFirst: prismaMock() },
      client: { findFirst: prismaMock() },
      message: {
        create: prismaMock(),
        findFirst: prismaMock(),
        update: prismaMock(),
      },
    };
    systemEventService = {
      record: prismaMock(),
    };
    messageAnalysisQueue = {
      add: jest.fn().mockImplementation(() => Promise.resolve({ id: 'job-1' })),
    };

    service = new WhatsappService(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
      systemEventService as unknown as SystemEventService,
      messageAnalysisQueue as unknown as Queue<MessageAnalysisJobData>,
    );
  });

  it('returns challenge when webhook verification token matches', () => {
    expect(
      service.verifyWebhook('subscribe', 'verify-token', 'challenge-123'),
    ).toBe('challenge-123');
  });

  it('rejects webhook verification with invalid token', () => {
    expect(() =>
      service.verifyWebhook('subscribe', 'wrong-token', 'challenge-123'),
    ).toThrow(ForbiddenException);
  });

  it('requires configured company id to process inbound webhook', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'WHATSAPP_COMPANY_ID') {
        return undefined;
      }

      return 'configured';
    });

    await expect(service.handleWebhook({ entry: [] })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects webhook when configured company does not exist', async () => {
    prisma.company.findFirst.mockResolvedValue(null);

    await expect(service.handleWebhook({ entry: [] })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('persists inbound text message and enqueues analysis job', async () => {
    prisma.company.findFirst.mockResolvedValue({ id: 'company-1' });
    prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
    prisma.message.findFirst.mockResolvedValue(null);
    prisma.message.create.mockResolvedValue({ id: 'message-1' });

    await expect(
      service.handleWebhook({
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: {
                    phone_number_id: 'phone-number-1',
                  },
                  messages: [
                    {
                      id: 'wamid-1',
                      from: '5577999999999',
                      timestamp: '1781910000',
                      type: 'text',
                      text: {
                        body: 'Pode passar aqui amanha depois das 18h',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    ).resolves.toEqual({
      received: true,
      processedMessages: 1,
      skippedMessages: 0,
    });

    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'company-1',
          clientId: 'client-1',
          externalMessageId: 'wamid-1',
          direction: 'inbound',
          channel: 'whatsapp',
          status: 'received',
        }),
      }),
    );
    expect(messageAnalysisQueue.add).toHaveBeenCalledWith(
      'analyze',
      expect.objectContaining({
        companyId: 'company-1',
        messageId: 'message-1',
        phone: '5577999999999',
        messageContent: 'Pode passar aqui amanha depois das 18h',
        clientId: 'client-1',
      }),
      expect.objectContaining({ attempts: 3 }),
    );
    expect(systemEventService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        clientId: 'client-1',
        messageId: 'message-1',
        source: SystemEventSource.whatsapp,
        type: SystemEventType.whatsapp_message_received,
      }),
    );
  });

  it('records duplicate inbound messages as skipped events', async () => {
    prisma.company.findFirst.mockResolvedValue({ id: 'company-1' });
    prisma.message.findFirst.mockResolvedValue({ id: 'message-1' });

    await expect(
      service.handleWebhook({
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: {
                    phone_number_id: 'phone-number-1',
                  },
                  messages: [
                    {
                      id: 'wamid-1',
                      from: '5577999999999',
                      timestamp: '1781910000',
                      type: 'text',
                      text: {
                        body: 'Mensagem repetida',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    ).resolves.toEqual({
      received: true,
      processedMessages: 0,
      skippedMessages: 1,
    });

    expect(systemEventService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        messageId: 'message-1',
        source: SystemEventSource.whatsapp,
        type: SystemEventType.whatsapp_message_duplicated,
        status: SystemEventStatus.warning,
      }),
    );
  });
});
