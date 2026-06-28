import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  buildPaginatedResult,
  getPaginationParams,
  resolveOrderBy,
} from '../common/pagination';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const CLIENT_SORT_FIELDS = ['name', 'createdAt', 'city'] as const;

@Injectable()
export class ClientService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, createClientDto: CreateClientDto) {
    await this.ensureActiveCompany(companyId);

    const document =
      createClientDto.document?.trim() ||
      `CLI-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    try {
      return await this.prisma.client.create({
        data: {
          ...createClientDto,
          document,
          companyId,
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(companyId: string, query: PaginationQueryDto) {
    const { page, limit, skip, take } = getPaginationParams(query);
    const search = query.search?.trim();

    const where: Prisma.ClientWhereInput = {
      companyId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { document: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { whatsappPhone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { neighborhood: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy = resolveOrderBy(
      query.sortBy,
      query.sortOrder,
      CLIENT_SORT_FIELDS,
      'createdAt',
    );

    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({ where, orderBy, skip, take }),
      this.prisma.client.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async getDistinctLocations(companyId: string) {
    const where: Prisma.ClientWhereInput = { companyId, deletedAt: null };

    const [addresses, neighborhoods, cities] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where: { ...where, address: { not: null } },
        select: { address: true },
        distinct: ['address'],
        orderBy: { address: 'asc' },
      }),
      this.prisma.client.findMany({
        where: { ...where, neighborhood: { not: null } },
        select: { neighborhood: true },
        distinct: ['neighborhood'],
        orderBy: { neighborhood: 'asc' },
      }),
      this.prisma.client.findMany({
        where: { ...where, city: { not: null } },
        select: { city: true },
        distinct: ['city'],
        orderBy: { city: 'asc' },
      }),
    ]);

    const clean = (values: (string | null)[]) =>
      values.filter((value): value is string => !!value?.trim());

    return {
      addresses: clean(addresses.map((row) => row.address)),
      neighborhoods: clean(neighborhoods.map((row) => row.neighborhood)),
      cities: clean(cities.map((row) => row.city)),
    };
  }

  async findOne(companyId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
    });

    if (!client) {
      throw new NotFoundException('Cliente nao encontrado.');
    }

    return client;
  }

  async update(companyId: string, id: string, updateClientDto: UpdateClientDto) {
    await this.findOne(companyId, id);
    const { companyId: _ignoredCompanyId, ...data } = updateClientDto;
    void _ignoredCompanyId;

    try {
      return await this.prisma.client.update({
        where: {
          id,
        },
        data,
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);

    return this.prisma.client.update({
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

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ja existe um cliente com este documento nesta empresa.',
      );
    }

    throw error;
  }
}
