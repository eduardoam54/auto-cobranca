type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  step?: string;
  placeholder?: string;
};

export function TextField({
  label,
  value,
  onChange,
  required = false,
  type = 'text',
  step,
  placeholder,
}: TextFieldProps) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
      <input
        type={type}
        step={step}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block min-h-10 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}
