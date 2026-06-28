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
import { CreateCollectionDto } from './dto/create-collection.dto';
import { ListCollectionsQueryDto } from './dto/list-collections-query.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

const COLLECTION_SORT_FIELDS = [
  'dueDate',
  'createdAt',
  'amount',
  'status',
] as const;

@Injectable()
export class CollectionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, createCollectionDto: CreateCollectionDto) {
    await this.ensureActiveCompany(companyId);
    await this.ensureActiveClientBelongsToCompany(
      createCollectionDto.clientId,
      companyId,
    );

    return this.prisma.collection.create({
      data: {
        ...createCollectionDto,
        companyId,
      },
    });
  }

  async findAll(companyId: string, query: ListCollectionsQueryDto) {
    const { page, limit, skip, take } = getPaginationParams(query);
    const search = query.search?.trim();

    const where: Prisma.CollectionWhereInput = {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy = resolveOrderBy(
      query.sortBy,
      query.sortOrder,
      COLLECTION_SORT_FIELDS,
      'dueDate',
      'asc',
    );

    const [data, total] = await this.prisma.$transaction([
      this.prisma.collection.findMany({ where, orderBy, skip, take }),
      this.prisma.collection.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(companyId: string, id: string) {
    const collection = await this.prisma.collection.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
    });

    if (!collection) {
      throw new NotFoundException('Cobranca nao encontrada.');
    }

    return collection;
  }

  async update(
    companyId: string,
    id: string,
    updateCollectionDto: UpdateCollectionDto,
  ) {
    const collection = await this.findOne(companyId, id);
    const clientId = updateCollectionDto.clientId ?? collection.clientId;
    const { companyId: _ignoredCompanyId, ...data } = updateCollectionDto;
    void _ignoredCompanyId;

    if (updateCollectionDto.clientId) {
      await this.ensureActiveClientBelongsToCompany(clientId, companyId);
    }

    return this.prisma.collection.update({
      where: {
        id,
      },
      data,
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);

    return this.prisma.collection.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
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
}
