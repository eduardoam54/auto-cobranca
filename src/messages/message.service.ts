import {
  BadRequestException,
  ConflictException,
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
import { CreateMessageDto } from './dto/create-message.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

const MESSAGE_SORT_FIELDS = ['createdAt', 'receivedAt', 'sentAt'] as const;

@Injectable()
export class MessageService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, createMessageDto: CreateMessageDto) {
    await this.validateRelations(companyId, createMessageDto.clientId);

    try {
      return await this.prisma.message.create({
        data: {
          ...createMessageDto,
          companyId,
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(companyId: string, query: ListMessagesQueryDto) {
    const { page, limit, skip, take } = getPaginationParams(query);
    const search = query.search?.trim();

    const where: Prisma.MessageWhereInput = {
      companyId,
      deletedAt: null,
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(search
        ? {
            OR: [
              { phone: { contains: search } },
              { content: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy = resolveOrderBy(
      query.sortBy,
      query.sortOrder,
      MESSAGE_SORT_FIELDS,
      'createdAt',
    );

    const [data, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({ where, orderBy, skip, take }),
      this.prisma.message.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(companyId: string, id: string) {
    const message = await this.prisma.message.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
    });

    if (!message) {
      throw new NotFoundException('Mensagem nao encontrada.');
    }

    return message;
  }

  async update(
    companyId: string,
    id: string,
    updateMessageDto: UpdateMessageDto,
  ) {
    const message = await this.findOne(companyId, id);
    await this.validateRelations(
      companyId,
      updateMessageDto.clientId === undefined
        ? (message.clientId ?? undefined)
        : updateMessageDto.clientId,
    );
    const { companyId: _ignoredCompanyId, ...data } = updateMessageDto;
    void _ignoredCompanyId;

    try {
      return await this.prisma.message.update({
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

    return this.prisma.message.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  private async validateRelations(companyId: string, clientId?: string) {
    await this.ensureActiveCompany(companyId);

    if (clientId) {
      await this.ensureActiveClientBelongsToCompany(clientId, companyId);
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

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ja existe uma mensagem externa com este identificador nesta empresa.',
      );
    }

    throw error;
  }
}
