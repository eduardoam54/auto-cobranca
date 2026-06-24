import type { ReactNode } from 'react';

type DataTableProps = {
  columns: string[];
  rows: ReactNode[][];
  emptyMessage: string;
  rowIds?: string[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: (selectAll: boolean) => void;
};

export function DataTable({
  columns,
  rows,
  emptyMessage,
  rowIds,
  selectedIds,
  onToggleSelect,
  onToggleAll,
}: DataTableProps) {
  const hasSelection = !!rowIds && !!selectedIds && !!onToggleSelect && !!onToggleAll;
  const allSelected =
    hasSelection && rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id));
  const someSelected = hasSelection && rowIds.some((id) => selectedIds.has(id));

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-line bg-white px-4 py-6 text-sm text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-white">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-panel text-xs font-semibold uppercase text-muted">
          <tr>
            {hasSelection ? (
              <th className="w-10 border-b border-line px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-teal-700"
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th key={column} className="border-b border-line px-4 py-3">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, rowIndex) => {
            const id = rowIds?.[rowIndex];
            const isSelected = id ? (selectedIds?.has(id) ?? false) : false;
            return (
              <tr key={rowIndex} className={`text-ink ${isSelected ? 'bg-teal-50' : ''}`}>
                {hasSelection && id ? (
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(id)}
                      className="h-4 w-4 cursor-pointer accent-teal-700"
                    />
                  </td>
                ) : null}
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
