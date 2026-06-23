import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { CreateCollectorDto } from './dto/create-collector.dto';
import { UpdateCollectorDto } from './dto/update-collector.dto';

@Injectable()
export class CollectorService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, createCollectorDto: CreateCollectorDto) {
    await this.ensureActiveCompany(companyId);
    await this.validateUserLink({
      companyId,
      userId: createCollectorDto.userId,
      active: createCollectorDto.active ?? true,
    });

    try {
      return await this.prisma.collector.create({
        data: {
          companyId,
          userId: createCollectorDto.userId,
          name: createCollectorDto.name,
          phone: createCollectorDto.phone,
          whatsappPhone: createCollectorDto.whatsappPhone,
          email: createCollectorDto.email,
          active: createCollectorDto.active,
          currentLatitude: createCollectorDto.currentLatitude,
          currentLongitude: createCollectorDto.currentLongitude,
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  findAll(companyId: string) {
    return this.prisma.collector.findMany({
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
    const collector = await this.prisma.collector.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
    });

    if (!collector) {
      throw new NotFoundException('Cobrador nao encontrado.');
    }

    return collector;
  }

  async findTasks(companyId: string, collectorId: string) {
    await this.findOne(companyId, collectorId);

    return this.prisma.collectionTask.findMany({
      where: {
        companyId,
        collectorId,
        deletedAt: null,
        status: {
          in: ['assigned', 'in_progress'],
        },
      },
      orderBy: [
        {
          priority: 'desc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });
  }

  async update(
    companyId: string,
    id: string,
    updateCollectorDto: UpdateCollectorDto,
  ) {
    const collector = await this.findOne(companyId, id);
    const { companyId: _ignoredCompanyId, ...data } = updateCollectorDto;
    void _ignoredCompanyId;
    await this.validateUserLink({
      companyId,
      userId:
        updateCollectorDto.userId === undefined
          ? (collector.userId ?? undefined)
          : updateCollectorDto.userId,
      active: updateCollectorDto.active ?? collector.active,
      currentCollectorId: id,
    });

    try {
      return await this.prisma.collector.update({
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

    return this.prisma.collector.update({
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

  private async validateUserLink(data: {
    companyId: string;
    userId?: string;
    active: boolean;
    currentCollectorId?: string;
  }) {
    if (!data.userId) {
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: data.userId,
        deletedAt: null,
      },
      select: {
        companyId: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario vinculado nao encontrado.');
    }

    if (user.companyId !== data.companyId) {
      throw new BadRequestException(
        'Usuario vinculado nao pertence a empresa informada.',
      );
    }

    if (user.role !== UserRole.collector) {
      throw new BadRequestException(
        'Usuario vinculado precisa ter perfil de cobrador.',
      );
    }

    if (!data.active) {
      return;
    }

    const existingActiveCollector = await this.prisma.collector.findFirst({
      where: {
        userId: data.userId,
        active: true,
        deletedAt: null,
        ...(data.currentCollectorId
          ? {
              id: {
                not: data.currentCollectorId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existingActiveCollector) {
      throw new ConflictException(
        'Usuario ja esta vinculado a outro cobrador ativo.',
      );
    }
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ja existe um cobrador com este email nesta empresa.',
      );
    }

    throw error;
  }
}
