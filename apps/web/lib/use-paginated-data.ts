'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiRequest } from './api';
import { getToken } from './auth';
import { useApiData } from './use-api-data';
import type { Paginated, PaginationMeta } from './types';

/**
 * Atalho para consumir um endpoint paginado quando NAO se quer UI de paginação
 * (dropdowns, telas de detalhe, lookups). Busca uma página grande e devolve
 * apenas o array — mantendo o mesmo formato do antigo `useApiData<T[]>`.
 *
 * Para listas grandes, prefira `usePaginatedData` com paginação real.
 */
export function useApiList<T>(path: string, limit = 100) {
  const separator = path.includes('?') ? '&' : '?';
  const { data, loading, error, reload } = useApiData<Paginated<T>>(
    `${path}${separator}limit=${limit}`,
  );
  return {
    data: data ? data.data : null,
    meta: data ? data.meta : null,
    loading,
    error,
    reload,
  };
}

export type QueryParams = Record<string, string | number | undefined>;

type State<T> = {
  items: T[];
  meta: PaginationMeta | null;
  loading: boolean;
  error: string | null;
};

function buildQuery(params: QueryParams): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Busca dados de um endpoint paginado (`{ data, meta }`), controlando
 * página, busca textual (com debounce) e filtros — tudo no servidor.
 */
export function usePaginatedData<T>(
  basePath: string,
  options: { limit?: number; initialFilters?: QueryParams } = {},
) {
  const limit = options.limit ?? 20;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<QueryParams>(
    options.initialFilters ?? {},
  );
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<State<T>>({
    items: [],
    meta: null,
    loading: true,
    error: null,
  });

  const debouncedSearch = useDebounced(search, 350);
  const filtersKey = JSON.stringify(filters);

  // Volta para a primeira página sempre que a busca ou os filtros mudam.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filtersKey]);

  useEffect(() => {
    if (!getToken()) {
      window.location.assign('/login');
      return;
    }

    let active = true;
    setState((prev) => ({ ...prev, loading: true }));

    const query = buildQuery({
      page,
      limit,
      search: debouncedSearch || undefined,
      ...filters,
    });

    apiRequest<Paginated<T>>(`${basePath}${query}`)
      .then((res) => {
        if (active) {
          setState({
            items: res.data,
            meta: res.meta,
            loading: false,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            items: [],
            meta: null,
            loading: false,
            error:
              error instanceof ApiError
                ? error.message
                : 'Nao foi possivel carregar os dados.',
          });
        }
      });

    return () => {
      active = false;
    };
    // filtersKey cobre mudanças em `filters` sem instabilidade de referência.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath, page, limit, debouncedSearch, filtersKey, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const updateFilters = useCallback(
    (next: QueryParams) => setFilters((prev) => ({ ...prev, ...next })),
    [],
  );

  return {
    ...state,
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilters: updateFilters,
    reload,
  };
}
