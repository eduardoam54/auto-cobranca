import { randomUUID } from 'node:crypto';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Envelope de erro padronizado retornado para qualquer excecao.
 * Garante que clientes (web/mobile) recebam sempre o mesmo formato e
 * que cada erro carregue um `requestId` para correlacao nos logs.
 */
type ErrorEnvelope = {
  statusCode: number;
  error: string;
  message: string | string[];
  errorCode: string;
  requestId: string;
  timestamp: string;
  path: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const requestId = request.id ?? randomUUID();

    const { status, message, error, errorCode } = this.resolve(exception);

    const envelope: ErrorEnvelope = {
      statusCode: status,
      error,
      message,
      errorCode,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const line = `[${requestId}] ${request.method} ${request.url} -> ${status} ${errorCode}`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        line,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(line);
    }

    response.status(status).json(envelope);
  }

  private resolve(exception: unknown): {
    status: number;
    message: string | string[];
    error: string;
    errorCode: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message ??
            exception.message);
      const error =
        typeof res === 'object' && res !== null && 'error' in res
          ? String((res as { error?: string }).error)
          : exception.name;
      return { status, message, error, errorCode: this.codeFromStatus(status) };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrisma(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno no servidor.',
      error: 'InternalServerError',
      errorCode: 'INTERNAL_ERROR',
    };
  }

  private resolvePrisma(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
    errorCode: string;
  } {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Registro duplicado: ja existe um valor unico igual.',
          error: 'Conflict',
          errorCode: 'UNIQUE_CONSTRAINT',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Registro nao encontrado.',
          error: 'NotFound',
          errorCode: 'NOT_FOUND',
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Requisicao invalida para o banco de dados.',
          error: 'BadRequest',
          errorCode: `PRISMA_${exception.code}`,
        };
    }
  }

  private codeFromStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
    };
    return (
      map[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR')
    );
  }
}
