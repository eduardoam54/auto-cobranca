import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import {
  buildPaginatedResult,
  getPaginationParams,
  resolveOrderBy,
} from '../common/pagination';
import { CreateCollectionVisitDto } from './dto/create-collection-visit.dto';
import { ListCollectionVisitsQueryDto } from './dto/list-collection-visits-query.dto';

const COLLECTION_VISIT_SORT_FIELDS = ['visitedAt', 'createdAt'] as const;

@Injectable()
export class CollectionVisitService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    companyId: string,
    createCollectionVisitDto: CreateCollectionVisitDto,
  ) {
    const task = await this.prisma.collectionTask.findFirst({
      where: {
        id: createCollectionVisitDto.taskId,
        companyId,
        deletedAt: null,
      },
    });

    if (!task) {
      throw new NotFoundException('Tarefa de cobranca nao encontrada.');
    }

    this.validatePaymentFields(createCollectionVisitDto);

    if (createCollectionVisitDto.result === 'paid' && !task.collectionId) {
      throw new BadRequestException(
        'Tarefa precisa estar vinculada a uma cobranca para registrar pagamento total.',
      );
    }

    if (createCollectionVisitDto.result === 'paid' && task.collectionId) {
      await this.ensureActiveCollection(companyId, task.collectionId);
    }

    const visitedAt = createCollectionVisitDto.visitedAt ?? new Date();
    const paymentReceived = createCollectionVisitDto.paymentReceived ?? false;

    return this.prisma.$transaction(async (tx) => {
      const visit = await tx.collectionVisit.create({
        data: {
          companyId: task.companyId,
          taskId: task.id,
          clientId: task.clientId,
          collectionId: task.collectionId,
          collectorId: task.collectorId,
          result: createCollectionVisitDto.result,
          notes: createCollectionVisitDto.notes,
          paymentReceived,
          paymentAmount:
            createCollectionVisitDto.paymentAmount === undefined
              ? undefined
              : new Prisma.Decimal(createCollectionVisitDto.paymentAmount),
          paymentMethod: createCollectionVisitDto.paymentMethod,
          receiptUrl: createCollectionVisitDto.receiptUrl,
          visitedAt,
        },
      });

      if (createCollectionVisitDto.result === 'paid' && task.collectionId) {
        await tx.collection.update({
          where: {
            id: task.collectionId,
          },
          data: {
            status: 'paid',
            paidAt: visitedAt,
            paymentMethod: createCollectionVisitDto.paymentMethod,
          },
        });
      }

      return visit;
    });
  }

  async findAll(companyId: string, query: ListCollectionVisitsQueryDto) {
    const { page, limit, skip, take } = getPaginationParams(query);
    const search = query.search?.trim();

    const where: Prisma.CollectionVisitWhereInput = {
      companyId,
      deletedAt: null,
      ...(query.result ? { result: query.result } : {}),
      ...(query.collectorId ? { collectorId: query.collectorId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.visitedFrom || query.visitedTo
        ? {
            visitedAt: {
              ...(query.visitedFrom ? { gte: query.visitedFrom } : {}),
              ...(query.visitedTo ? { lte: query.visitedTo } : {}),
            },
          }
        : {}),
      ...(search ? { notes: { contains: search, mode: 'insensitive' } } : {}),
    };

    const orderBy = resolveOrderBy(
      query.sortBy,
      query.sortOrder,
      COLLECTION_VISIT_SORT_FIELDS,
      'visitedAt',
    );

    const [data, total] = await this.prisma.$transaction([
      this.prisma.collectionVisit.findMany({ where, orderBy, skip, take }),
      this.prisma.collectionVisit.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(companyId: string, id: string) {
    const visit = await this.prisma.collectionVisit.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
    });

    if (!visit) {
      throw new NotFoundException('Visita de cobranca nao encontrada.');
    }

    return visit;
  }

  async findByTask(companyId: string, taskId: string) {
    const task = await this.prisma.collectionTask.findFirst({
      where: {
        id: taskId,
        companyId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Tarefa de cobranca nao encontrada.');
    }

    return this.prisma.collectionVisit.findMany({
      where: {
        companyId,
        taskId,
        deletedAt: null,
      },
      orderBy: {
        visitedAt: 'desc',
      },
    });
  }

  private validatePaymentFields(
    createCollectionVisitDto: CreateCollectionVisitDto,
  ) {
    if (!createCollectionVisitDto.paymentReceived) {
      return;
    }

    if (createCollectionVisitDto.paymentAmount === undefined) {
      throw new BadRequestException(
        'Valor do pagamento e obrigatorio quando houver pagamento recebido.',
      );
    }

    if (!createCollectionVisitDto.paymentMethod) {
      throw new BadRequestException(
        'Metodo de pagamento e obrigatorio quando houver pagamento recebido.',
      );
    }
  }

  private async ensureActiveCollection(companyId: string, collectionId: string) {
    const collection = await this.prisma.collection.findFirst({
      where: {
        id: collectionId,
        companyId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!collection) {
      throw new NotFoundException('Cobranca relacionada nao encontrada.');
    }
  }
}
