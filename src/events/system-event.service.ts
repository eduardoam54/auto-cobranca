import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SystemEventSource,
  SystemEventStatus,
  SystemEventType,
} from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { ListSystemEventsQueryDto } from './dto/list-system-events-query.dto';

type RecordSystemEventInput = {
  companyId: string;
  clientId?: string | null;
  collectionId?: string | null;
  taskId?: string | null;
  messageId?: string | null;
  actorUserId?: string | null;
  source: SystemEventSource;
  type: SystemEventType;
  status?: SystemEventStatus;
  description: string;
  metadata?: Prisma.InputJsonValue;
  occurredAt?: Date;
};

@Injectable()
export class SystemEventService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: RecordSystemEventInput) {
    return this.prisma.systemEvent.create({
      data: {
        companyId: input.companyId,
        clientId: input.clientId,
        collectionId: input.collectionId,
        taskId: input.taskId,
        messageId: input.messageId,
        actorUserId: input.actorUserId,
        source: input.source,
        type: input.type,
        status: input.status ?? SystemEventStatus.success,
        description: input.description,
        metadata: input.metadata,
        occurredAt: input.occurredAt,
      },
    });
  }

  findAll(companyId: string, query: ListSystemEventsQueryDto) {
    const occurredAt: Prisma.DateTimeFilter = {};

    if (query.occurredFrom) {
      occurredAt.gte = query.occurredFrom;
    }

    if (query.occurredTo) {
      occurredAt.lte = query.occurredTo;
    }

    return this.prisma.systemEvent.findMany({
      where: {
        companyId,
        source: query.source,
        type: query.type,
        status: query.status,
        clientId: query.clientId,
        collectionId: query.collectionId,
        taskId: query.taskId,
        messageId: query.messageId,
        occurredAt:
          query.occurredFrom || query.occurredTo ? occurredAt : undefined,
      },
      orderBy: {
        occurredAt: 'desc',
      },
      take: query.limit ?? 50,
    });
  }
}
