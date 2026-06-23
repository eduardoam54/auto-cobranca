import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4">
      <section className="w-full max-w-md rounded-md border border-line bg-white p-5 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-ink">
          Pagina nao encontrada
        </h1>
        <p className="mt-2 text-sm text-muted">
          O endereco informado nao existe no painel.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Voltar para login
        </Link>
      </section>
    </main>
  );
}
