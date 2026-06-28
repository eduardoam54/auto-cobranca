import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Executa fn() e, se receber P1001 (banco inacessível após idle), reconecta e tenta uma vez mais.
  async withReconnect<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P1001'
      ) {
        this.logger.warn('Conexão com banco perdida — reconectando e repetindo...');
        await this.$disconnect();
        await new Promise((r) => setTimeout(r, 3000));
        await this.$connect();
        return fn();
      }
      throw error;
    }
  }
}
