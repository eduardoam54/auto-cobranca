const variants: Record<string, string> = {
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  overdue: 'border-red-200 bg-red-50 text-red-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  in_progress: 'border-blue-200 bg-blue-50 text-blue-700',
  assigned: 'border-sky-200 bg-sky-50 text-sky-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
};

type StatusPillProps = {
  value: string | boolean;
};

export function StatusPill({ value }: StatusPillProps) {
  const label = typeof value === 'boolean' ? (value ? 'ativo' : 'inativo') : value;
  const className =
    typeof value === 'boolean'
      ? value
        ? variants.paid
        : 'border-slate-200 bg-slate-50 text-slate-700'
      : variants[value] ?? 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${className}`}
    >
      {label.replaceAll('_', ' ')}
    </span>
  );
}
