import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../infra/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UserService {
  private readonly passwordSaltRounds = 12;

  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, createUserDto: CreateUserDto) {
    await this.ensureActiveCompany(companyId);

    try {
      const user = await this.prisma.user.create({
        data: {
          companyId,
          name: createUserDto.name,
          email: createUserDto.email.toLowerCase(),
          passwordHash: await this.hashPassword(createUserDto.password),
          role: createUserDto.role,
          active: createUserDto.active,
        },
      });

      return this.toSafeUser(user);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(companyId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map((user) => this.toSafeUser(user));
  }

  async findOne(id: string, companyId?: string) {
    const user = await this.findActiveUserById(id, companyId);

    return this.toSafeUser(user);
  }

  async update(companyId: string, id: string, updateUserDto: UpdateUserDto) {
    await this.findActiveUserById(id, companyId);

    try {
      const user = await this.prisma.user.update({
        where: {
          id,
        },
        data: {
          companyId,
          name: updateUserDto.name,
          email: updateUserDto.email?.toLowerCase(),
          passwordHash: updateUserDto.password
            ? await this.hashPassword(updateUserDto.password)
            : undefined,
          role: updateUserDto.role,
          active: updateUserDto.active,
        },
      });

      return this.toSafeUser(user);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(companyId: string, id: string) {
    await this.findActiveUserById(id, companyId);

    const user = await this.prisma.user.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return this.toSafeUser(user);
  }

  async findActiveUserByEmail(email: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        active: true,
        deletedAt: null,
        company: {
          deletedAt: null,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    return user;
  }

  toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      companyId: user.companyId,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }

  private async findActiveUserById(id: string, companyId?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    return user;
  }

  private async hashPassword(password: string) {
    return bcrypt.hash(password, this.passwordSaltRounds);
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
      throw new ConflictException('Ja existe um usuario com este email.');
    }

    throw error;
  }
}
