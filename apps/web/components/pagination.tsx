import type { PaginationMeta } from '@/lib/types';

type PaginationProps = {
  meta: PaginationMeta | null;
  onPageChange: (page: number) => void;
};

export function Pagination({ meta, onPageChange }: PaginationProps) {
  if (!meta || meta.total === 0) {
    return null;
  }

  const { page, totalPages, total, hasNextPage, hasPreviousPage } = meta;

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted">
        {total} registro{total !== 1 ? 's' : ''} · pagina {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPreviousPage}
          className="inline-flex min-h-9 items-center justify-center rounded-md border border-line px-3 text-sm font-medium text-ink hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
          className="inline-flex min-h-9 items-center justify-center rounded-md border border-line px-3 text-sm font-medium text-ink hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
        >
          Proxima
        </button>
      </div>
    </div>
  );
}
