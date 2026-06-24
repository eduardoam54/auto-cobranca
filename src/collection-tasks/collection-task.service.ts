import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../infra/prisma/prisma.service';
import { ExpoPushService } from '../infra/expo-push/expo-push.service';
import { AssignCollectorDto } from './dto/assign-collector.dto';
import { CompleteCollectionTaskDto } from './dto/complete-collection-task.dto';
import { CreateCollectionTaskDto } from './dto/create-collection-task.dto';
import { FailCollectionTaskDto } from './dto/fail-collection-task.dto';
import { UpdateCollectionTaskDto } from './dto/update-collection-task.dto';

@Injectable()
export class CollectionTaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expoPush: ExpoPushService,
  ) {}

  async create(companyId: string, createCollectionTaskDto: CreateCollectionTaskDto) {
    await this.validateRelations({
      ...createCollectionTaskDto,
      companyId,
    });

    return this.prisma.collectionTask.create({
      data: {
        ...createCollectionTaskDto,
        companyId,
      },
    });
  }

  findAll(companyId: string) {
    return this.prisma.collectionTask.findMany({
      where: {
        companyId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(companyId: string, id: string) {
    const task = await this.prisma.collectionTask.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
    });

    if (!task) {
      throw new NotFoundException('Tarefa de cobranca nao encontrada.');
    }

    return task;
  }

  async update(
    companyId: string,
    id: string,
    updateCollectionTaskDto: UpdateCollectionTaskDto,
  ) {
    const task = await this.findOne(companyId, id);
    await this.validateRelations({
      companyId,
      clientId: updateCollectionTaskDto.clientId ?? task.clientId,
      collectionId:
        updateCollectionTaskDto.collectionId === undefined
          ? (task.collectionId ?? undefined)
          : updateCollectionTaskDto.collectionId,
      collectorId:
        updateCollectionTaskDto.collectorId === undefined
          ? (task.collectorId ?? undefined)
          : updateCollectionTaskDto.collectorId,
    });
    const { companyId: _ignoredCompanyId, ...data } = updateCollectionTaskDto;
    void _ignoredCompanyId;

    return this.prisma.collectionTask.update({
      where: {
        id,
      },
      data,
    });
  }

  async assignCollector(
    companyId: string,
    id: string,
    assignCollectorDto: AssignCollectorDto,
  ) {
    const task = await this.findOne(companyId, id);

    if (!['pending', 'assigned'].includes(task.status)) {
      throw new BadRequestException(
        'Tarefa precisa estar pendente ou atribuida para trocar o cobrador.',
      );
    }

    await this.ensureActiveCollectorBelongsToCompany(
      assignCollectorDto.collectorId,
      companyId,
    );

    const updatedTask = await this.prisma.collectionTask.update({
      where: { id },
      data: {
        collectorId: assignCollectorDto.collectorId,
        status: 'assigned',
      },
    });

    // Fire-and-forget push notification
    void this.prisma.collector
      .findFirst({
        where: { id: assignCollectorDto.collectorId },
        select: { expoPushToken: true, name: true },
      })
      .then((collector) => {
        if (collector?.expoPushToken) {
          void this.expoPush.send({
            to: collector.expoPushToken,
            title: 'Nova tarefa atribuida',
            body: updatedTask.title,
            data: { taskId: updatedTask.id },
          });
        }
      });

    return updatedTask;
  }

  async start(companyId: string, id: string) {
    const task = await this.findOne(companyId, id);

    if (task.status !== 'assigned') {
      throw new BadRequestException(
        'Tarefa precisa estar atribuida para ser iniciada.',
      );
    }

    return this.prisma.collectionTask.update({
      where: {
        id,
      },
      data: {
        status: 'in_progress',
      },
    });
  }

  async complete(
    companyId: string,
    id: string,
    completeCollectionTaskDto: CompleteCollectionTaskDto,
  ) {
    void completeCollectionTaskDto;

    const task = await this.findOne(companyId, id);

    this.ensureTaskCanBeFinished(task.status);

    return this.prisma.collectionTask.update({
      where: {
        id,
      },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });
  }

  async fail(
    companyId: string,
    id: string,
    failCollectionTaskDto: FailCollectionTaskDto,
  ) {
    void failCollectionTaskDto;

    const task = await this.findOne(companyId, id);

    this.ensureTaskCanBeFinished(task.status);

    return this.prisma.collectionTask.update({
      where: {
        id,
      },
      data: {
        status: 'failed',
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);

    return this.prisma.collectionTask.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  private async validateRelations(data: {
    companyId: string;
    clientId: string;
    collectionId?: string;
    collectorId?: string;
  }) {
    await this.ensureActiveCompany(data.companyId);
    await this.ensureActiveClientBelongsToCompany(
      data.clientId,
      data.companyId,
    );

    if (data.collectionId) {
      await this.ensureActiveCollectionBelongsToClientAndCompany(
        data.collectionId,
        data.clientId,
        data.companyId,
      );
    }

    if (data.collectorId) {
      await this.ensureActiveCollectorBelongsToCompany(
        data.collectorId,
        data.companyId,
      );
    }
  }

  private async ensureActiveCompany(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Empresa nao encontrada.');
    }
  }

  private async ensureActiveClientBelongsToCompany(
    clientId: string,
    companyId: string,
  ) {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        deletedAt: null,
      },
      select: {
        companyId: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Cliente nao encontrado.');
    }

    if (client.companyId !== companyId) {
      throw new BadRequestException(
        'Cliente nao pertence a empresa informada.',
      );
    }
  }

  private async ensureActiveCollectionBelongsToClientAndCompany(
    collectionId: string,
    clientId: string,
    companyId: string,
  ) {
    const collection = await this.prisma.collection.findFirst({
      where: {
        id: collectionId,
        deletedAt: null,
      },
      select: {
        companyId: true,
        clientId: true,
      },
    });

    if (!collection) {
      throw new NotFoundException('Cobranca nao encontrada.');
    }

    if (
      collection.companyId !== companyId ||
      collection.clientId !== clientId
    ) {
      throw new BadRequestException(
        'Cobranca nao pertence a empresa e cliente informados.',
      );
    }
  }

  private async ensureActiveCollectorBelongsToCompany(
    collectorId: string,
    companyId: string,
  ) {
    const collector = await this.prisma.collector.findFirst({
      where: {
        id: collectorId,
        deletedAt: null,
      },
      select: {
        active: true,
        companyId: true,
      },
    });

    if (!collector) {
      throw new NotFoundException('Cobrador nao encontrado.');
    }

    if (!collector.active) {
      throw new BadRequestException('Cobrador informado esta inativo.');
    }

    if (collector.companyId !== companyId) {
      throw new BadRequestException(
        'Cobrador nao pertence a empresa informada.',
      );
    }
  }

  private ensureTaskCanBeFinished(status: string) {
    if (!['assigned', 'in_progress'].includes(status)) {
      throw new BadRequestException(
        'Tarefa precisa estar atribuida ou em andamento.',
      );
    }
  }
}
