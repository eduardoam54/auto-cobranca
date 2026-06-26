import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CollectionTaskStatus,
  CollectionVisitResult,
  Prisma,
  UserRole,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../infra/prisma/prisma.service';
import { CompleteMobileTaskDto } from './dto/complete-mobile-task.dto';
import { FailMobileTaskDto } from './dto/fail-mobile-task.dto';

type VisitLocationInput = {
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  visitedAt?: string;
};

@Injectable()
export class MobileService {
  constructor(private readonly prisma: PrismaService) {}

  async me(user: AuthenticatedUser) {
    this.ensureCollectorUser(user);

    const collector = await this.findCollectorForUser(user);
    const safeUser = await this.prisma.user.findFirst({
      where: {
        id: user.id,
        companyId: user.companyId,
        deletedAt: null,
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!safeUser) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    return {
      user: safeUser,
      collector,
    };
  }

  async myTasks(user: AuthenticatedUser) {
    const collector = await this.findCollectorForUser(user);

    return this.prisma.collectionTask.findMany({
      where: {
        companyId: user.companyId,
        collectorId: collector.id,
        deletedAt: null,
        status: {
          in: [
            CollectionTaskStatus.assigned,
            CollectionTaskStatus.in_progress,
          ],
        },
      },
      include: {
        client: true,
        collection: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { priority: 'desc' },
        { scheduledDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async startTask(user: AuthenticatedUser, taskId: string) {
    const collector = await this.findCollectorForUser(user);
    const task = await this.findOwnTask(user.companyId, collector.id, taskId);

    if (task.status !== CollectionTaskStatus.assigned) {
      throw new BadRequestException(
        'Tarefa precisa estar atribuida para ser iniciada.',
      );
    }

    return this.prisma.collectionTask.update({
      where: {
        id: task.id,
      },
      data: {
        status: CollectionTaskStatus.in_progress,
      },
    });
  }

  async completeTask(
    user: AuthenticatedUser,
    taskId: string,
    completeMobileTaskDto: CompleteMobileTaskDto,
  ) {
    const collector = await this.findCollectorForUser(user);
    const task = await this.findOwnTask(user.companyId, collector.id, taskId);

    this.ensureTaskCanBeFinished(task.status);
    this.validatePaymentFields(completeMobileTaskDto);
    await this.validateCheckinDistance(
      user.companyId,
      task.clientId,
      completeMobileTaskDto.latitude,
      completeMobileTaskDto.longitude,
    );

    if (
      completeMobileTaskDto.result === CollectionVisitResult.paid &&
      !task.collectionId
    ) {
      throw new BadRequestException(
        'Tarefa precisa estar vinculada a uma cobranca para registrar pagamento total.',
      );
    }

    const visitedAt = this.resolveVisitedAt(completeMobileTaskDto.visitedAt);
    const paymentReceived = completeMobileTaskDto.paymentReceived ?? false;

    return this.prisma.$transaction(async (tx) => {
      const visit = await tx.collectionVisit.create({
        data: {
          companyId: task.companyId,
          taskId: task.id,
          clientId: task.clientId,
          collectionId: task.collectionId,
          collectorId: collector.id,
          result: completeMobileTaskDto.result,
          notes: completeMobileTaskDto.notes,
          paymentReceived,
          paymentAmount:
            completeMobileTaskDto.paymentAmount === undefined
              ? undefined
              : new Prisma.Decimal(completeMobileTaskDto.paymentAmount),
          paymentMethod: completeMobileTaskDto.paymentMethod,
          ...this.buildVisitLocationData(completeMobileTaskDto),
          visitedAt,
        },
      });

      if (
        completeMobileTaskDto.result === CollectionVisitResult.paid &&
        task.collectionId
      ) {
        await tx.collection.update({
          where: {
            id: task.collectionId,
          },
          data: {
            status: 'paid',
            paidAt: visitedAt,
            paymentMethod: completeMobileTaskDto.paymentMethod,
          },
        });
      }

      const updatedTask = await tx.collectionTask.update({
        where: {
          id: task.id,
        },
        data: {
          status: CollectionTaskStatus.completed,
          completedAt: visitedAt,
        },
      });

      return {
        task: updatedTask,
        visit,
      };
    });
  }

  async failTask(
    user: AuthenticatedUser,
    taskId: string,
    failMobileTaskDto: FailMobileTaskDto,
  ) {
    const collector = await this.findCollectorForUser(user);
    const task = await this.findOwnTask(user.companyId, collector.id, taskId);

    this.ensureTaskCanBeFinished(task.status);
    await this.validateCheckinDistance(
      user.companyId,
      task.clientId,
      failMobileTaskDto.latitude,
      failMobileTaskDto.longitude,
    );
    const visitedAt = this.resolveVisitedAt(failMobileTaskDto.visitedAt);

    return this.prisma.$transaction(async (tx) => {
      const visit = await tx.collectionVisit.create({
        data: {
          companyId: task.companyId,
          taskId: task.id,
          clientId: task.clientId,
          collectionId: task.collectionId,
          collectorId: collector.id,
          result: failMobileTaskDto.result,
          notes: failMobileTaskDto.notes,
          paymentReceived: false,
          ...this.buildVisitLocationData(failMobileTaskDto),
          visitedAt,
        },
      });

      const updatedTask = await tx.collectionTask.update({
        where: { id: task.id },
        data: { status: CollectionTaskStatus.failed },
      });

      if (
        failMobileTaskDto.result === CollectionVisitResult.promised_payment &&
        failMobileTaskDto.promisedPaymentDate
      ) {
        await tx.collectionTask.create({
          data: {
            companyId: task.companyId,
            clientId: task.clientId,
            collectionId: task.collectionId,
            collectorId: task.collectorId,
            title: `Retorno - ${task.title}`,
            description: `Promessa de pagamento registrada em ${new Date().toLocaleDateString('pt-BR')}`,
            type: task.type,
            priority: task.priority,
            status: task.collectorId
              ? CollectionTaskStatus.assigned
              : CollectionTaskStatus.pending,
            scheduledDate: new Date(failMobileTaskDto.promisedPaymentDate),
          },
        });
      }

      return { task: updatedTask, visit };
    });
  }

  async myProgress(user: AuthenticatedUser) {
    const collector = await this.findCollectorForUser(user);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const [pending, completedToday, failedToday, visitsToday] = await Promise.all([
      this.prisma.collectionTask.count({
        where: {
          companyId: user.companyId,
          collectorId: collector.id,
          deletedAt: null,
          status: {
            in: [CollectionTaskStatus.assigned, CollectionTaskStatus.in_progress],
          },
        },
      }),
      this.prisma.collectionTask.count({
        where: {
          companyId: user.companyId,
          collectorId: collector.id,
          deletedAt: null,
          status: CollectionTaskStatus.completed,
          completedAt: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.collectionTask.count({
        where: {
          companyId: user.companyId,
          collectorId: collector.id,
          deletedAt: null,
          status: CollectionTaskStatus.failed,
          updatedAt: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.collectionVisit.findMany({
        where: {
          companyId: user.companyId,
          collectorId: collector.id,
          paymentReceived: true,
          visitedAt: { gte: today, lt: tomorrow },
        },
        select: { paymentAmount: true },
      }),
    ]);

    const totalCollectedToday = visitsToday.reduce(
      (sum, v) => sum + Number(v.paymentAmount ?? 0),
      0,
    );

    return {
      pending,
      completedToday,
      failedToday,
      visitedToday: completedToday + failedToday,
      totalCollectedToday,
    };
  }

  async ranking(user: AuthenticatedUser, period: 'weekly' | 'monthly') {
    const now = new Date();
    const from = new Date(now);
    if (period === 'weekly') {
      from.setDate(now.getDate() - 7);
    } else {
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
    }

    const visits = await this.prisma.collectionVisit.findMany({
      where: {
        companyId: user.companyId,
        paymentReceived: true,
        visitedAt: { gte: from },
        deletedAt: null,
        collectorId: { not: null },
      },
      select: {
        collectorId: true,
        paymentAmount: true,
        collector: { select: { id: true, name: true } },
      },
    });

    const map = new Map<string, { id: string; name: string; total: number; visits: number }>();
    for (const v of visits) {
      if (!v.collectorId || !v.collector) continue;
      const entry = map.get(v.collectorId) ?? {
        id: v.collector.id,
        name: v.collector.name,
        total: 0,
        visits: 0,
      };
      entry.total += Number(v.paymentAmount ?? 0);
      entry.visits += 1;
      map.set(v.collectorId, entry);
    }

    return [...map.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
      .map((e, idx) => ({ position: idx + 1, ...e }));
  }

  async dailyReport(user: AuthenticatedUser, dateStr?: string) {
    const collector = await this.findCollectorForUser(user);

    const day = dateStr ? new Date(dateStr) : new Date();
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);

    const visits = await this.prisma.collectionVisit.findMany({
      where: {
        companyId: user.companyId,
        collectorId: collector.id,
        visitedAt: { gte: day, lt: nextDay },
        deletedAt: null,
      },
      select: {
        id: true,
        result: true,
        paymentReceived: true,
        paymentAmount: true,
        paymentMethod: true,
        notes: true,
        visitedAt: true,
        latitude: true,
        longitude: true,
        client: { select: { name: true } },
      },
      orderBy: { visitedAt: 'asc' },
    });

    const totalCollected = visits.reduce(
      (sum, v) => sum + (v.paymentReceived ? Number(v.paymentAmount ?? 0) : 0),
      0,
    );

    const kmEstimated = this.calculateKm(
      visits
        .filter((v) => v.latitude && v.longitude)
        .map((v) => ({ lat: v.latitude!, lon: v.longitude! })),
    );

    return {
      date: day.toISOString().slice(0, 10),
      visitCount: visits.length,
      totalCollected,
      kmEstimated: Math.round(kmEstimated * 10) / 10,
      visits: visits.map((v) => ({
        id: v.id,
        clientName: v.client?.name ?? 'Desconhecido',
        result: v.result,
        paymentReceived: v.paymentReceived,
        paymentAmount: v.paymentReceived ? Number(v.paymentAmount ?? 0) : null,
        paymentMethod: v.paymentMethod,
        notes: v.notes,
        visitedAt: v.visitedAt,
      })),
    };
  }

  private calculateKm(points: { lat: number; lon: number }[]): number {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += this.haversineKm(
        points[i - 1].lat, points[i - 1].lon,
        points[i].lat, points[i].lon,
      );
    }
    return total;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async reorderTasks(user: AuthenticatedUser, orderedIds: string[]) {
    const collector = await this.findCollectorForUser(user);
    await this.prisma.$transaction(
      orderedIds.map((id, idx) =>
        this.prisma.collectionTask.updateMany({
          where: { id, collectorId: collector.id, companyId: user.companyId },
          data: { sortOrder: idx },
        }),
      ),
    );
    return { ok: true };
  }

  async savePushToken(user: AuthenticatedUser, token: string) {
    const collector = await this.findCollectorForUser(user);
    await this.prisma.collector.update({
      where: { id: collector.id },
      data: { expoPushToken: token },
      select: { id: true },
    });
  }

  async clientVisitHistory(user: AuthenticatedUser, clientId: string) {
    const collector = await this.findCollectorForUser(user);

    const hasTask = await this.prisma.collectionTask.findFirst({
      where: {
        companyId: user.companyId,
        collectorId: collector.id,
        clientId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!hasTask) {
      throw new ForbiddenException(
        'Cobrador nao tem tarefa atribuida para este cliente.',
      );
    }

    return this.prisma.collectionVisit.findMany({
      where: {
        companyId: user.companyId,
        clientId,
        deletedAt: null,
      },
      select: {
        id: true,
        result: true,
        notes: true,
        paymentReceived: true,
        paymentAmount: true,
        paymentMethod: true,
        visitedAt: true,
        collector: { select: { name: true } },
      },
      orderBy: { visitedAt: 'desc' },
      take: 20,
    });
  }

  async updateClient(
    user: AuthenticatedUser,
    clientId: string,
    data: {
      phone?: string;
      whatsappPhone?: string;
      address?: string;
      neighborhood?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
    },
  ) {
    const collector = await this.findCollectorForUser(user);

    const hasTask = await this.prisma.collectionTask.findFirst({
      where: {
        companyId: user.companyId,
        collectorId: collector.id,
        clientId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!hasTask) {
      throw new ForbiddenException(
        'Cobrador nao tem tarefa atribuida para este cliente.',
      );
    }

    const updateData: Prisma.ClientUpdateInput = {};
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.whatsappPhone !== undefined) updateData.whatsappPhone = data.whatsappPhone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.neighborhood !== undefined) updateData.neighborhood = data.neighborhood;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;

    return this.prisma.client.update({
      where: { id: clientId },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        whatsappPhone: true,
        address: true,
        neighborhood: true,
        city: true,
        latitude: true,
        longitude: true,
      },
    });
  }

  async uploadVisitPhoto(
    user: AuthenticatedUser,
    visitId: string,
    filename: string,
  ) {
    const collector = await this.findCollectorForUser(user);

    const visit = await this.prisma.collectionVisit.findFirst({
      where: {
        id: visitId,
        companyId: user.companyId,
        collectorId: collector.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!visit) {
      throw new NotFoundException('Visita nao encontrada.');
    }

    return this.prisma.collectionVisit.update({
      where: { id: visitId },
      data: { proofPhotoUrl: `/uploads/visit-photos/${filename}` },
      select: { id: true, proofPhotoUrl: true },
    });
  }

  private ensureCollectorUser(user: AuthenticatedUser) {
    if (user.role !== UserRole.collector) {
      throw new ForbiddenException(
        'Acesso permitido apenas para usuarios cobradores.',
      );
    }
  }

  private async findCollectorForUser(user: AuthenticatedUser) {
    this.ensureCollectorUser(user);

    const collector = await this.prisma.collector.findFirst({
      where: {
        userId: user.id,
        companyId: user.companyId,
        active: true,
        deletedAt: null,
      },
    });

    if (!collector) {
      throw new NotFoundException(
        'Cobrador vinculado ao usuario nao encontrado.',
      );
    }

    return collector;
  }

  private async findOwnTask(
    companyId: string,
    collectorId: string,
    taskId: string,
  ) {
    const task = await this.prisma.collectionTask.findFirst({
      where: {
        id: taskId,
        companyId,
        collectorId,
        deletedAt: null,
      },
    });

    if (!task) {
      throw new NotFoundException(
        'Tarefa nao encontrada para este cobrador.',
      );
    }

    return task;
  }

  private ensureTaskCanBeFinished(status: CollectionTaskStatus) {
    const allowedStatuses: CollectionTaskStatus[] = [
      CollectionTaskStatus.assigned,
      CollectionTaskStatus.in_progress,
    ];

    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException(
        'Tarefa precisa estar atribuida ou em andamento.',
      );
    }
  }

  private validatePaymentFields(
    completeMobileTaskDto: CompleteMobileTaskDto,
  ) {
    if (!completeMobileTaskDto.paymentReceived) {
      return;
    }

    if (completeMobileTaskDto.paymentAmount === undefined) {
      throw new BadRequestException(
        'Valor do pagamento e obrigatorio quando houver pagamento recebido.',
      );
    }

    if (!completeMobileTaskDto.paymentMethod) {
      throw new BadRequestException(
        'Metodo de pagamento e obrigatorio quando houver pagamento recebido.',
      );
    }
  }

  private buildVisitLocationData(input: VisitLocationInput) {
    return {
      latitude: input.latitude,
      longitude: input.longitude,
      locationAccuracy: input.locationAccuracy,
    };
  }

  private resolveVisitedAt(value: string | undefined) {
    return value ? new Date(value) : new Date();
  }

  private async validateCheckinDistance(
    companyId: string,
    clientId: string | null,
    collectorLat?: number,
    collectorLon?: number,
  ) {
    if (!clientId || collectorLat === undefined || collectorLon === undefined) return;

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId, deletedAt: null },
      select: { latitude: true, longitude: true },
    });

    if (!client?.latitude || !client?.longitude) return;

    const distance = this.haversineDistance(
      collectorLat, collectorLon,
      Number(client.latitude), Number(client.longitude),
    );

    const MAX_METERS = 30;
    if (distance > MAX_METERS) {
      throw new BadRequestException(
        `Voce esta a ${Math.round(distance)} metros do cliente. Aproxime-se para registrar a visita (maximo ${MAX_METERS}m).`,
      );
    }
  }

  private haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
  ): number {
    const R = 6371000;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
