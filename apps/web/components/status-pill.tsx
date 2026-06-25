import { toLabel } from '@/lib/labels';

const variants: Record<string, string> = {
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  overdue: 'border-red-200 bg-red-50 text-red-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  in_progress: 'border-blue-200 bg-blue-50 text-blue-700',
  assigned: 'border-sky-200 bg-sky-50 text-sky-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  canceled: 'border-slate-200 bg-slate-50 text-slate-600',
  renegotiated: 'border-purple-200 bg-purple-50 text-purple-700',
  partial_paid: 'border-teal-200 bg-teal-50 text-teal-700',
  promised_payment: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  not_home: 'border-slate-200 bg-slate-50 text-slate-600',
  refused_payment: 'border-red-200 bg-red-50 text-red-700',
  rescheduled: 'border-blue-200 bg-blue-50 text-blue-700',
  wrong_address: 'border-orange-200 bg-orange-50 text-orange-700',
  other: 'border-slate-200 bg-slate-50 text-slate-600',
  low: 'border-slate-200 bg-slate-50 text-slate-600',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  high: 'border-orange-200 bg-orange-50 text-orange-700',
  critical: 'border-red-200 bg-red-50 text-red-700',
};

type StatusPillProps = {
  value: string | boolean;
};

export function StatusPill({ value }: StatusPillProps) {
  const label =
    typeof value === 'boolean' ? (value ? 'Ativo' : 'Inativo') : toLabel(value);
  const className =
    typeof value === 'boolean'
      ? value
        ? variants.paid
        : 'border-slate-200 bg-slate-50 text-slate-700'
      : (variants[value] ?? 'border-slate-200 bg-slate-50 text-slate-700');

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
