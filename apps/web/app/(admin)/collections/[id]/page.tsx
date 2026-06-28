'use client';

import Link from 'next/link';
import { use } from 'react';
import { DataState } from '@/components/data-state';
import { DataTable } from '@/components/table';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { formatCurrency, formatDate, formatText } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';
import { useApiList } from '@/lib/use-paginated-data';
import type { Client, Collection, CollectionTask } from '@/lib/types';

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: collection, loading: collectionLoading, error: collectionError } =
    useApiData<Collection>(`/collections/${id}`);
  const { data: allTasks, loading: tasksLoading } =
    useApiList<CollectionTask>('/collection-tasks');
  const { data: allClients } = useApiList<Client>('/clients');

  const tasks = (allTasks ?? []).filter((t) => t.collectionId === id);
  const client = collection
    ? (allClients ?? []).find((c) => c.id === collection.clientId)
    : null;

  const totalAmount = Number(collection?.amount ?? 0);
  const isPaid = collection?.status === 'paid';
  const isOverdue = collection?.status === 'overdue';

  if (collectionLoading) {
    return <DataState message="Carregando cobranca" />;
  }

  if (collectionError || !collection) {
    return <DataState message={collectionError ?? 'Cobranca nao encontrada.'} />;
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/collections" className="hover:text-brand hover:underline">
          Cobrancas
        </Link>
        <span>/</span>
        <span className="text-ink">{collection.title}</span>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={collection.title}
          description={`Vencimento: ${formatDate(collection.dueDate)}`}
        />
        <Link
          href="/collections"
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-panel"
        >
          Voltar
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-line bg-white p-4">
          <p className="text-xs font-semibold uppercase text-muted">Valor</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {formatCurrency(totalAmount)}
          </p>
        </div>
        <div className="rounded-md border border-line bg-white p-4">
          <p className="text-xs font-semibold uppercase text-muted">Status</p>
          <div className="mt-2">
            <StatusPill value={collection.status} />
          </div>
        </div>
        <div className="rounded-md border border-line bg-white p-4">
          <p className="text-xs font-semibold uppercase text-muted">Vencimento</p>
          <p className={`mt-1 text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-ink'}`}>
            {formatDate(collection.dueDate)}
            {isOverdue ? ' · Vencida' : ''}
          </p>
        </div>
        <div className="rounded-md border border-line bg-white p-4">
          <p className="text-xs font-semibold uppercase text-muted">Forma de pagamento</p>
          <p className="mt-1 text-sm text-ink">
            {formatText(collection.paymentMethod)}
          </p>
        </div>
      </div>

      {client ? (
        <div className="mb-6 rounded-md border border-line bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-muted">Cliente</p>
          <div className="flex items-center gap-4">
            <div>
              <Link
                href={`/clients/${client.id}`}
                className="font-semibold text-brand hover:underline"
              >
                {client.name}
              </Link>
              <p className="text-sm text-muted">
                {client.phone}
                {client.email ? ` · ${client.email}` : ''}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {collection.description ? (
        <div className="mb-6 rounded-md border border-line bg-white p-4">
          <p className="mb-1 text-xs font-semibold uppercase text-muted">Descricao</p>
          <p className="text-sm text-ink">{collection.description}</p>
        </div>
      ) : null}

      {isPaid ? (
        <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Esta cobranca foi marcada como paga.
        </div>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">
            Tarefas vinculadas ({tasks.length})
          </h2>
          <Link href="/collection-tasks" className="text-sm text-brand hover:underline">
            Ver todas as tarefas
          </Link>
        </div>
        {tasksLoading ? (
          <DataState message="Carregando tarefas" />
        ) : tasks.length === 0 ? (
          <div className="rounded-md border border-line bg-white px-4 py-6 text-sm text-muted">
            Nenhuma tarefa vinculada a esta cobranca.
          </div>
        ) : (
          <DataTable
            columns={['Titulo', 'Tipo', 'Prioridade', 'Status', 'Endereco']}
            rows={tasks.map((task) => [
              task.title,
              task.type.replaceAll('_', ' '),
              task.priority,
              <StatusPill key={`st-${task.id}`} value={task.status} />,
              formatText(task.address),
            ])}
            emptyMessage="Nenhuma tarefa encontrada."
          />
        )}
      </section>
    </>
  );
}
