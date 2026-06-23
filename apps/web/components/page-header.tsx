type PageHeaderProps = {
  title: string;
  description?: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-normal text-ink">
        {title}
      </h1>
      {description ? (
        <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>
      ) : null}
    </header>
  );
}
