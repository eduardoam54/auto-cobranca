'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4">
      <section className="w-full max-w-md rounded-md border border-line bg-white p-5 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-ink">
          Nao foi possivel carregar esta tela
        </h1>
        <p className="mt-2 text-sm text-muted">
          {error.message || 'Tente novamente em instantes.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
