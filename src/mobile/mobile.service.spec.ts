import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  CollectionTaskStatus,
  CollectionVisitResult,
  PaymentMethod,
  UserRole,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../infra/prisma/prisma.service';
import { MobileService } from './mobile.service';

const prismaMock = () => jest.fn<(...args: unknown[]) => Promise<unknown>>();

describe('MobileService', () => {
  let service: MobileService;
  let prisma: {
    user: { findFirst: ReturnType<typeof prismaMock> };
    collector: { findFirst: ReturnType<typeof prismaMock> };
    collectionTask: {
      findMany: ReturnType<typeof prismaMock>;
      findFirst: ReturnType<typeof prismaMock>;
      update: ReturnType<typeof prismaMock>;
    };
    collectionVisit: { create: ReturnType<typeof prismaMock> };
    collection: { update: ReturnType<typeof prismaMock> };
    $transaction: ReturnType<
      typeof jest.fn<
        (callback: (tx: typeof prisma) => Promise<unknown>) => Promise<unknown>
      >
    >;
  };

  const collectorUser: AuthenticatedUser = {
    id: 'user-1',
    companyId: 'company-1',
    name: 'Cobrador',
    email: 'cobrador@example.com',
    role: UserRole.collector,
  };

  beforeEach(() => {
    prisma = {
      user: { findFirst: prismaMock() },
      collector: { findFirst: prismaMock() },
      collectionTask: {
        findMany: prismaMock(),
        findFirst: prismaMock(),
        update: prismaMock(),
      },
      collectionVisit: { create: prismaMock() },
      collection: { update: prismaMock() },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    service = new MobileService(prisma as unknown as PrismaService);
  });

  it('rejects non-collector users on mobile profile', async () => {
    await expect(
      service.me({
        ...collectorUser,
        role: UserRole.manager,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns only assigned and in-progress tasks for the linked collector', async () => {
    prisma.collector.findFirst.mockResolvedValue({ id: 'collector-1' });
    prisma.collectionTask.findMany.mockResolvedValue([]);

    await service.myTasks(collectorUser);

    expect(prisma.collectionTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-1',
          collectorId: 'collector-1',
          status: {
            in: [
              CollectionTaskStatus.assigned,
              CollectionTaskStatus.in_progress,
            ],
          },
        }),
      }),
    );
  });

  it('starts only assigned tasks owned by the linked collector', async () => {
    prisma.collector.findFirst.mockResolvedValue({ id: 'collector-1' });
    prisma.collectionTask.findFirst.mockResolvedValue({
      id: 'task-1',
      status: CollectionTaskStatus.assigned,
    });
    prisma.collectionTask.update.mockResolvedValue({
      id: 'task-1',
      status: CollectionTaskStatus.in_progress,
    });

    await expect(service.startTask(collectorUser, 'task-1')).resolves.toEqual({
      id: 'task-1',
      status: CollectionTaskStatus.in_progress,
    });

    expect(prisma.collectionTask.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'task-1',
        companyId: 'company-1',
        collectorId: 'collector-1',
        deletedAt: null,
      },
    });
  });

  it('does not start tasks that are not assigned', async () => {
    prisma.collector.findFirst.mockResolvedValue({ id: 'collector-1' });
    prisma.collectionTask.findFirst.mockResolvedValue({
      id: 'task-1',
      status: CollectionTaskStatus.in_progress,
    });

    await expect(service.startTask(collectorUser, 'task-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('completes a paid task by creating a visit, paying the collection, and closing the task', async () => {
    const visitedAt = '2026-06-21T00:00:00.000Z';

    prisma.collector.findFirst.mockResolvedValue({ id: 'collector-1' });
    prisma.collectionTask.findFirst.mockResolvedValue({
      id: 'task-1',
      companyId: 'company-1',
      clientId: 'client-1',
      collectionId: 'collection-1',
      status: CollectionTaskStatus.in_progress,
    });
    prisma.collectionVisit.create.mockResolvedValue({ id: 'visit-1' });
    prisma.collectionTask.update.mockResolvedValue({
      id: 'task-1',
      status: CollectionTaskStatus.completed,
    });

    await service.completeTask(collectorUser, 'task-1', {
      result: CollectionVisitResult.paid,
      notes: 'Cliente pagou em dinheiro',
      paymentReceived: true,
      paymentAmount: 150.75,
      paymentMethod: PaymentMethod.cash,
      latitude: -14.123456,
      longitude: -41.123456,
      locationAccuracy: 25,
      visitedAt,
    });

    expect(prisma.collectionVisit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: 'task-1',
          collectorId: 'collector-1',
          result: CollectionVisitResult.paid,
          paymentReceived: true,
          paymentMethod: PaymentMethod.cash,
          latitude: -14.123456,
          longitude: -41.123456,
          locationAccuracy: 25,
          visitedAt: new Date(visitedAt),
        }),
      }),
    );
    expect(prisma.collection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'collection-1' },
        data: expect.objectContaining({
          status: 'paid',
          paymentMethod: PaymentMethod.cash,
        }),
      }),
    );
    expect(prisma.collectionTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: CollectionTaskStatus.completed,
        }),
      }),
    );
  });

  it('fails a task by creating a visit with reason and location, then closing the task', async () => {
    const visitedAt = '2026-06-21T01:00:00.000Z';

    prisma.collector.findFirst.mockResolvedValue({ id: 'collector-1' });
    prisma.collectionTask.findFirst.mockResolvedValue({
      id: 'task-1',
      companyId: 'company-1',
      clientId: 'client-1',
      collectionId: 'collection-1',
      status: CollectionTaskStatus.assigned,
    });
    prisma.collectionVisit.create.mockResolvedValue({ id: 'visit-1' });
    prisma.collectionTask.update.mockResolvedValue({
      id: 'task-1',
      status: CollectionTaskStatus.failed,
    });

    await service.failTask(collectorUser, 'task-1', {
      reason: 'Cliente nao estava em casa',
      latitude: -14.123456,
      longitude: -41.123456,
      locationAccuracy: 25,
      visitedAt,
    });

    expect(prisma.collectionVisit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: 'task-1',
          collectorId: 'collector-1',
          result: CollectionVisitResult.other,
          notes: 'Cliente nao estava em casa',
          paymentReceived: false,
          latitude: -14.123456,
          longitude: -41.123456,
          locationAccuracy: 25,
          visitedAt: new Date(visitedAt),
        }),
      }),
    );
    expect(prisma.collectionTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: CollectionTaskStatus.failed,
        }),
      }),
    );
  });
});
