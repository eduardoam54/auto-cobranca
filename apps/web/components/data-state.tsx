type DataStateProps = {
  message: string;
};

export function DataState({ message }: DataStateProps) {
  return (
    <div className="rounded-md border border-line bg-white px-4 py-6 text-sm text-muted">
      {message}
    </div>
  );
}
