import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

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

  findAll(companyId: string) {
    return this.prisma.client.findMany({
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
