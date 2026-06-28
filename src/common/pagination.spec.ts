import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  buildPaginatedResult,
  getPaginationParams,
  resolveOrderBy,
} from './pagination';

describe('getPaginationParams', () => {
  it('aplica defaults (page 1, limit 20)', () => {
    expect(getPaginationParams({})).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    });
  });

  it('calcula skip a partir de page/limit', () => {
    expect(getPaginationParams({ page: 3, limit: 10 })).toMatchObject({
      skip: 20,
      take: 10,
    });
  });

  it('limita o limite maximo a 100', () => {
    expect(getPaginationParams({ limit: 9999 }).take).toBe(100);
  });

  it('normaliza valores invalidos (page < 1)', () => {
    expect(getPaginationParams({ page: 0 }).page).toBe(1);
  });
});

describe('buildPaginatedResult', () => {
  it('monta meta de navegacao no meio da lista', () => {
    const result = buildPaginatedResult([1, 2], 25, 2, 10);
    expect(result.meta).toEqual({
      total: 25,
      page: 2,
      limit: 10,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('trata lista vazia sem paginas falsas', () => {
    const result = buildPaginatedResult([], 0, 1, 20);
    expect(result.meta).toMatchObject({
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('marca ultima pagina sem proxima', () => {
    const result = buildPaginatedResult([1], 21, 3, 10);
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.hasPreviousPage).toBe(true);
  });
});

describe('resolveOrderBy', () => {
  const allowed = ['createdAt', 'name', 'dueDate'];

  it('usa o campo solicitado quando permitido', () => {
    expect(resolveOrderBy('name', 'asc', allowed, 'createdAt')).toEqual({
      name: 'asc',
    });
  });

  it('cai no fallback quando o campo nao e permitido', () => {
    expect(resolveOrderBy('senha', 'asc', allowed, 'createdAt')).toEqual({
      createdAt: 'asc',
    });
  });

  it('usa desc como direcao padrao', () => {
    expect(resolveOrderBy(undefined, undefined, allowed, 'createdAt')).toEqual({
      createdAt: 'desc',
    });
  });
});
