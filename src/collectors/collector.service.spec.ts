import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { CollectorService } from './collector.service';

const prismaMock = () => jest.fn<(...args: unknown[]) => Promise<unknown>>();

describe('CollectorService', () => {
  let service: CollectorService;
  let prisma: {
    company: { findFirst: ReturnType<typeof prismaMock> };
    user: { findFirst: ReturnType<typeof prismaMock> };
    collector: {
      create: ReturnType<typeof prismaMock>;
      findFirst: ReturnType<typeof prismaMock>;
      findMany: ReturnType<typeof prismaMock>;
      update: ReturnType<typeof prismaMock>;
    };
    collectionTask: { findMany: ReturnType<typeof prismaMock> };
  };

  beforeEach(() => {
    prisma = {
      company: { findFirst: prismaMock() },
      user: { findFirst: prismaMock() },
      collector: {
        create: prismaMock(),
        findFirst: prismaMock(),
        findMany: prismaMock(),
        update: prismaMock(),
      },
      collectionTask: { findMany: prismaMock() },
    };

    service = new CollectorService(prisma as unknown as PrismaService);
  });

  it('requires linked users to have collector role', async () => {
    prisma.company.findFirst.mockResolvedValue({ id: 'company-1' });
    prisma.user.findFirst.mockResolvedValue({
      companyId: 'company-1',
      role: UserRole.manager,
    });

    await expect(
      service.create('company-1', {
        userId: 'user-1',
        name: 'Cobrador',
        phone: '11999999999',
        email: 'cobrador@example.com',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not allow the same user on another active collector', async () => {
    prisma.company.findFirst.mockResolvedValue({ id: 'company-1' });
    prisma.user.findFirst.mockResolvedValue({
      companyId: 'company-1',
      role: UserRole.collector,
    });
    prisma.collector.findFirst.mockResolvedValue({ id: 'collector-2' });

    await expect(
      service.create('company-1', {
        userId: 'user-1',
        name: 'Cobrador',
        phone: '11999999999',
        email: 'cobrador@example.com',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('creates a collector linked to a valid collector user', async () => {
    const createdCollector = {
      id: 'collector-1',
      companyId: 'company-1',
      userId: 'user-1',
    };

    prisma.company.findFirst.mockResolvedValue({ id: 'company-1' });
    prisma.user.findFirst.mockResolvedValue({
      companyId: 'company-1',
      role: UserRole.collector,
    });
    prisma.collector.findFirst.mockResolvedValue(null);
    prisma.collector.create.mockResolvedValue(createdCollector);

    await expect(
      service.create('company-1', {
        userId: 'user-1',
        name: 'Cobrador',
        phone: '11999999999',
        email: 'cobrador@example.com',
      }),
    ).resolves.toBe(createdCollector);

    expect(prisma.collector.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'company-1',
          userId: 'user-1',
        }),
      }),
    );
  });
});
