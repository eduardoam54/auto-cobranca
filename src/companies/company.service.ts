import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCompanyDto: CreateCompanyDto) {
    try {
      return await this.prisma.company.create({
        data: createCompanyDto,
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findOwn(companyId: string) {
    return [await this.findOne(companyId)];
  }

  async findOwnById(companyId: string, id: string) {
    if (id !== companyId) {
      throw new NotFoundException('Empresa nao encontrada.');
    }

    return this.findOne(companyId);
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!company) {
      throw new NotFoundException('Empresa nao encontrada.');
    }

    return company;
  }

  async update(companyId: string, id: string, updateCompanyDto: UpdateCompanyDto) {
    if (id !== companyId) {
      throw new NotFoundException('Empresa nao encontrada.');
    }

    await this.findOne(companyId);

    try {
      return await this.prisma.company.update({
        where: {
          id,
        },
        data: updateCompanyDto,
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(companyId: string, id: string) {
    if (id !== companyId) {
      throw new NotFoundException('Empresa nao encontrada.');
    }

    await this.findOne(companyId);

    return this.prisma.company.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Ja existe uma empresa com este documento.');
    }

    throw error;
  }
}
