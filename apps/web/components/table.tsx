import type { ReactNode } from 'react';

type DataTableProps = {
  columns: string[];
  rows: ReactNode[][];
  emptyMessage: string;
};

export function DataTable({ columns, rows, emptyMessage }: DataTableProps) {
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
            {columns.map((column) => (
              <th key={column} className="border-b border-line px-4 py-3">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="text-ink">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
