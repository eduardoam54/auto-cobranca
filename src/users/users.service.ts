import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../infra/prisma/prisma.service';
import {
  buildPaginatedResult,
  getPaginationParams,
  resolveOrderBy,
} from '../common/pagination';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SORT_FIELDS = ['name', 'email', 'createdAt'] as const;

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

  async findAll(companyId: string, query: ListUsersQueryDto) {
    const { page, limit, skip, take } = getPaginationParams(query);
    const search = query.search?.trim();

    const where: Prisma.UserWhereInput = {
      companyId,
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy = resolveOrderBy(
      query.sortBy,
      query.sortOrder,
      USER_SORT_FIELDS,
      'createdAt',
    );

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, orderBy, skip, take }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(
      users.map((user) => this.toSafeUser(user)),
      total,
      page,
      limit,
    );
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
