/**
 * Helpers de paginação compartilhados por todos os endpoints de listagem.
 * Mantém o formato de resposta `{ data, meta }` consistente em toda a API.
 */

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Normaliza page/limit e calcula skip/take para o Prisma. */
export function getPaginationParams(query: { page?: number; limit?: number }): {
  page: number;
  limit: number;
  skip: number;
  take: number;
} {
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.trunc(query.limit ?? 20)));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

/** Monta a resposta paginada com metadados de navegação. */
export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && total > 0,
    },
  };
}

/**
 * Resolve o `orderBy` do Prisma a partir de entrada do usuário, aceitando
 * apenas campos da allowlist (evita erro/abuso com colunas arbitrárias).
 */
export function resolveOrderBy(
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
  allowedFields: readonly string[],
  fallbackField: string,
  fallbackOrder: 'asc' | 'desc' = 'desc',
): Record<string, 'asc' | 'desc'> {
  const field =
    sortBy && allowedFields.includes(sortBy) ? sortBy : fallbackField;
  return { [field]: sortOrder ?? fallbackOrder };
}
