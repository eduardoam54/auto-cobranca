type AlertProps = {
  tone: 'error' | 'warning' | 'success';
  message: string;
};

const toneClass = {
  error: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

export function Alert({ tone, message }: AlertProps) {
  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm font-medium ${toneClass[tone]}`}
    >
      {message}
    </div>
  );
}
