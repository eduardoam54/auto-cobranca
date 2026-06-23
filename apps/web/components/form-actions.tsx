type FormActionsProps = {
  submitLabel: string;
  saving: boolean;
  onCancel: () => void;
  disabled?: boolean;
};

export function FormActions({
  submitLabel,
  saving,
  onCancel,
  disabled = false,
}: FormActionsProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex min-h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-panel"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={saving || disabled}
        className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </div>
  );
}
