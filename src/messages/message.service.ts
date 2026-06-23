import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

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

  findAll(companyId: string) {
    return this.prisma.message.findMany({
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
