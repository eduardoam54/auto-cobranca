import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  SystemEventSource,
  SystemEventStatus,
  SystemEventType,
} from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { SystemEventService } from './system-event.service';

const prismaMock = () => jest.fn<(...args: unknown[]) => Promise<unknown>>();

describe('SystemEventService', () => {
  let service: SystemEventService;
  let prisma: {
    systemEvent: {
      create: ReturnType<typeof prismaMock>;
      findMany: ReturnType<typeof prismaMock>;
    };
  };

  beforeEach(() => {
    prisma = {
      systemEvent: {
        create: prismaMock(),
        findMany: prismaMock(),
      },
    };
    service = new SystemEventService(prisma as unknown as PrismaService);
  });

  it('records a system event with success status by default', async () => {
    prisma.systemEvent.create.mockResolvedValue({ id: 'event-1' });

    await service.record({
      companyId: 'company-1',
      source: SystemEventSource.whatsapp,
      type: SystemEventType.whatsapp_message_received,
      description: 'Mensagem recebida.',
      metadata: {
        externalMessageId: 'wamid-1',
      },
    });

    expect(prisma.systemEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        source: SystemEventSource.whatsapp,
        type: SystemEventType.whatsapp_message_received,
        status: SystemEventStatus.success,
        description: 'Mensagem recebida.',
      }),
    });
  });

  it('lists company events with filters and default limit', async () => {
    prisma.systemEvent.findMany.mockResolvedValue([]);

    await service.findAll('company-1', {
      source: SystemEventSource.ai,
      status: SystemEventStatus.failed,
    });

    expect(prisma.systemEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-1',
          source: SystemEventSource.ai,
          status: SystemEventStatus.failed,
        }),
        orderBy: {
          occurredAt: 'desc',
        },
        take: 50,
      }),
    );
  });
});
