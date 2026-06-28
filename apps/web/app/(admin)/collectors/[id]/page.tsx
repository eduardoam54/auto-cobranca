'use client';

import Link from 'next/link';
import { use, useMemo } from 'react';
import { DataState } from '@/components/data-state';
import { DataTable } from '@/components/table';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { formatCurrency, formatDate, formatDateTime, formatText } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';
import { useApiList } from '@/lib/use-paginated-data';
import type { Client, CollectionTask, CollectionVisit, Collector } from '@/lib/types';

const RESULT_LABELS: Record<string, string> = {
  paid: 'Pago',
  partial_paid: 'Parcial',
  promised_payment: 'Prometeu pagar',
  not_home: 'Ausente',
  refused_payment: 'Recusou',
  rescheduled: 'Reagendado',
  wrong_address: 'End. errado',
  other: 'Outro',
};

export default function CollectorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: collector, loading: collectorLoading, error: collectorError } =
    useApiData<Collector>(`/collectors/${id}`);
  const { data: allTasks, loading: tasksLoading } =
    useApiList<CollectionTask>(`/collection-tasks?collectorId=${id}`);
  const { data: allVisits, loading: visitsLoading } =
    useApiList<CollectionVisit>(`/collection-visits?collectorId=${id}`);
  const { data: allClients } =
    useApiList<Client>('/clients');

  const clientById = useMemo(
    () => new Map((allClients ?? []).map((c) => [c.id, c.name])),
    [allClients],
  );

  const myTasks = useMemo(
    () => (allTasks ?? []).filter((t) => t.collectorId === id),
    [allTasks, id],
  );

  const activeTasks = useMemo(
    () => myTasks.filter((t) => t.status === 'assigned' || t.status === 'in_progress'),
    [myTasks],
  );

  const myVisits = useMemo(
    () =>
      (allVisits ?? [])
        .filter((v) => v.collectorId === id)
        .sort(
          (a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime(),
        ),
    [allVisits, id],
  );

  // Performance stats
  const totalVisits = myVisits.length;
  const successCount = myVisits.filter(
    (v) => v.result === 'paid' || v.result === 'partial_paid',
  ).length;
  const successRate =
    totalVisits > 0 ? Math.round((successCount / totalVisits) * 100) : 0;
  const totalCollected = myVisits
    .filter((v) => v.paymentReceived)
    .reduce((sum, v) => sum + Number(v.paymentAmount ?? 0), 0);

  if (collectorLoading) return <DataState message="Carregando cobrador" />;
  if (collectorError || !collector) {
    return <DataState message={collectorError ?? 'Cobrador nao encontrado.'} />;
  }

  return (
    <>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/collectors" className="hover:text-brand hover:underline">
          Cobradores
        </Link>
        <span>/</span>
        <span className="text-ink">{collector.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <PageHeader
            title={collector.name}
            description={`${collector.email} · ${collector.phone}`}
          />
          <span
            className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              collector.active
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-panel text-muted'
            }`}
          >
            {collector.active ? 'Ativo' : 'Inativo'}
          </span>
        </div>
        <Link
          href="/collectors"
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-panel"
        >
          Voltar
        </Link>
      </div>

      {/* Info cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InfoCard label="Telefone" value={collector.phone} />
        <InfoCard label="WhatsApp" value={formatText(collector.whatsappPhone)} />
        <InfoCard label="Email" value={collector.email} />
      </div>

      {/* Performance stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total de visitas"
          value={String(totalVisits)}
        />
        <StatCard
          label="Taxa de sucesso"
          value={`${successRate}%`}
          color="text-emerald-600"
          sub={`${successCount} com pagamento`}
        />
        <StatCard
          label="Total arrecadado"
          value={formatCurrency(totalCollected)}
          color="text-brand"
        />
        <StatCard
          label="Tarefas ativas"
          value={String(activeTasks.length)}
          color={activeTasks.length > 0 ? 'text-yellow-600' : 'text-muted'}
        />
      </div>

      {/* Active tasks */}
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-ink">
          Tarefas ativas ({activeTasks.length})
        </h2>
        {tasksLoading ? (
          <DataState message="Carregando tarefas" />
        ) : activeTasks.length === 0 ? (
          <Empty message="Nenhuma tarefa ativa atribuida a este cobrador." />
        ) : (
          <DataTable
            columns={['Titulo', 'Cliente', 'Prioridade', 'Status']}
            rows={activeTasks.map((task) => [
              <Link
                key={`task-title-${task.id}`}
                href={`/collection-tasks/${task.id}`}
                className="font-medium text-brand hover:underline"
              >
                {task.title}
              </Link>,
              formatText(clientById.get(task.clientId)),
              <StatusPill key={`task-pri-${task.id}`} value={task.priority} />,
              <StatusPill key={`task-st-${task.id}`} value={task.status} />,
            ])}
            emptyMessage=""
          />
        )}
      </section>

      {/* Visit history */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-ink">
          Historico de visitas ({totalVisits})
        </h2>
        {visitsLoading ? (
          <DataState message="Carregando visitas" />
        ) : myVisits.length === 0 ? (
          <Empty message="Nenhuma visita registrada por este cobrador." />
        ) : (
          <div className="space-y-2">
            {myVisits.map((visit) => (
              <VisitRow
                key={visit.id}
                visit={visit}
                clientName={clientById.get(visit.clientId) ?? '—'}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="mt-1 text-sm text-ink">{value || '—'}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'text-ink',
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-line bg-white px-4 py-6 text-sm text-muted">
      {message}
    </div>
  );
}

function VisitRow({
  visit,
  clientName,
}: {
  visit: CollectionVisit;
  clientName: string;
}) {
  const isSuccess = visit.result === 'paid' || visit.result === 'partial_paid';

  return (
    <div className="rounded-md border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <StatusPill value={visit.result} />
            <span className="text-xs text-muted">
              {formatDateTime(visit.visitedAt)}
            </span>
            {visit.latitude != null ? (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                GPS
              </span>
            ) : null}
            {visit.proofPhotoUrl ? (
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-brand">
                foto
              </span>
            ) : null}
          </div>
          <p className="text-sm font-medium text-ink">{clientName}</p>
          {visit.notes ? (
            <p className="mt-1 line-clamp-1 text-xs text-muted">{visit.notes}</p>
          ) : null}
        </div>
        {isSuccess && visit.paymentAmount ? (
          <span className="text-base font-semibold text-emerald-600">
            {formatCurrency(visit.paymentAmount)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
