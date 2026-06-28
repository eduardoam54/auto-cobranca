import {
  ArgumentsHost,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

type CapturedResponse = {
  status: jest.Mock;
  json: jest.Mock;
  body?: Record<string, unknown>;
};

function makeHost(
  request: Record<string, unknown>,
): { host: ArgumentsHost; res: CapturedResponse } {
  const res: CapturedResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(function (this: void, payload: Record<string, unknown>) {
      res.body = payload;
      return res;
    }),
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, res };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  const request = { id: 'req-123', url: '/api/clients', method: 'GET' };

  it('formata HttpException com status, errorCode e requestId', () => {
    const { host, res } = makeHost(request);

    filter.catch(new NotFoundException('Cliente nao encontrado.'), host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      message: 'Cliente nao encontrado.',
      requestId: 'req-123',
      path: '/api/clients',
    });
    expect(typeof res.body?.timestamp).toBe('string');
  });

  it('mapeia ConflictException para 409 CONFLICT', () => {
    const { host, res } = makeHost(request);

    filter.catch(new ConflictException('Documento duplicado.'), host);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toMatchObject({ statusCode: 409, errorCode: 'CONFLICT' });
  });

  it('mapeia erro de unicidade do Prisma (P2002) para 409', () => {
    const { host, res } = makeHost(request);
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '6.0.0' },
    );

    filter.catch(prismaError, host);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toMatchObject({
      statusCode: 409,
      errorCode: 'UNIQUE_CONSTRAINT',
    });
  });

  it('mapeia registro nao encontrado do Prisma (P2025) para 404', () => {
    const { host, res } = makeHost(request);
    const prismaError = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: '6.0.0',
    });

    filter.catch(prismaError, host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toMatchObject({ errorCode: 'NOT_FOUND' });
  });

  it('trata erro generico como 500 sem vazar detalhes internos', () => {
    const { host, res } = makeHost(request);

    filter.catch(new Error('alguma falha interna com stack secreto'), host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toMatchObject({
      statusCode: 500,
      errorCode: 'INTERNAL_ERROR',
      message: 'Erro interno no servidor.',
    });
    expect(res.body?.message).not.toContain('secreto');
  });

  it('gera requestId quando a request nao possui um', () => {
    const { host, res } = makeHost({ url: '/api/x', method: 'POST' });

    filter.catch(new NotFoundException(), host);

    expect(typeof res.body?.requestId).toBe('string');
    expect((res.body?.requestId as string).length).toBeGreaterThan(0);
  });
});
