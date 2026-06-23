import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../infra/prisma/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

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

  findAll(companyId: string) {
    return this.prisma.collection.findMany({
      where: {
        companyId,
        deletedAt: null,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });
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
