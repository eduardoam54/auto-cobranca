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
        {
          priority: 'desc',
        },
        {
          scheduledDate: 'asc',
        },
        {
          createdAt: 'asc',
        },
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
        where: {
          id: task.id,
        },
        data: {
          status: CollectionTaskStatus.failed,
        },
      });

      return {
        task: updatedTask,
        visit,
      };
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
}
