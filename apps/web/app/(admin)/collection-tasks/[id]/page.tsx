'use client';

import Link from 'next/link';
import { use, useMemo } from 'react';
import { DataState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatText,
} from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';
import type {
  Client,
  Collection,
  CollectionTask,
  CollectionVisit,
  Collector,
} from '@/lib/types';

const TYPE_LABELS: Record<string, string> = {
  presencial_collection: 'Visita presencial',
  whatsapp_followup: 'Followup WhatsApp',
  phone_call: 'Ligacao',
  payment_confirmation: 'Confirmacao de pagamento',
  renegotiation_followup: 'Followup renegociacao',
  other: 'Outro',
};

const MEDIA_BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'
).replace('/api', '');

export default function CollectionTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: task, loading: taskLoading, error: taskError } =
    useApiData<CollectionTask>(`/collection-tasks/${id}`);
  const { data: allVisits, loading: visitsLoading } =
    useApiData<CollectionVisit[]>('/collection-visits');
  const { data: allClients } = useApiData<Client[]>('/clients');
  const { data: allCollections } = useApiData<Collection[]>('/collections');
  const { data: allCollectors } = useApiData<Collector[]>('/collectors');

  const client = useMemo(
    () => (allClients ?? []).find((c) => c.id === task?.clientId),
    [allClients, task],
  );

  const collection = useMemo(
    () =>
      task?.collectionId
        ? (allCollections ?? []).find((c) => c.id === task.collectionId)
        : undefined,
    [allCollections, task],
  );

  const collector = useMemo(
    () =>
      task?.collectorId
        ? (allCollectors ?? []).find((c) => c.id === task.collectorId)
        : undefined,
    [allCollectors, task],
  );

  const taskVisits = useMemo(
    () =>
      (allVisits ?? [])
        .filter((v) => v.taskId === id)
        .sort(
          (a, b) =>
            new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime(),
        ),
    [allVisits, id],
  );

  const totalCollected = taskVisits
    .filter((v) => v.paymentReceived)
    .reduce((sum, v) => sum + Number(v.paymentAmount ?? 0), 0);

  if (taskLoading) return <DataState message="Carregando tarefa" />;
  if (taskError || !task) {
    return <DataState message={taskError ?? 'Tarefa nao encontrada.'} />;
  }

  const isDone =
    task.status === 'completed' ||
    task.status === 'failed' ||
    task.status === 'canceled';

  return (
    <>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/collection-tasks" className="hover:text-brand hover:underline">
          Tarefas
        </Link>
        <span>/</span>
        <span className="truncate text-ink">{task.title}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusPill value={task.status} />
            <StatusPill value={task.priority} />
            <span className="text-xs text-muted">
              {TYPE_LABELS[task.type] ?? task.type}
            </span>
          </div>
          <PageHeader title={task.title} description={task.description ?? ''} />
        </div>
        <Link
          href="/collection-tasks"
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-panel"
        >
          Voltar
        </Link>
      </div>

      {/* Task details grid */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard
          label="Data agendada"
          value={formatDate(task.scheduledDate)}
        />
        <InfoCard label="Horario" value={formatText(task.scheduledTime)} />
        <InfoCard
          label="Criada em"
          value={task.createdAt ? formatDate(task.createdAt) : '—'}
        />
        <InfoCard
          label="Total arrecadado"
          value={
            totalCollected > 0 ? formatCurrency(totalCollected) : '—'
          }
          highlight={totalCollected > 0}
        />
        {task.address ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <InfoCard label="Endereco da visita" value={task.address} />
          </div>
        ) : null}
        {task.aiRecommendation ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <div className="rounded-md border border-teal-100 bg-teal-50 p-4">
              <p className="mb-1 text-xs font-semibold uppercase text-brand">
                Recomendacao da IA
              </p>
              <p className="text-sm text-ink">{task.aiRecommendation}</p>
            </div>
          </div>
        ) : null}
        {isDone && task.completedAt ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <InfoCard
              label="Finalizada em"
              value={formatDateTime(task.completedAt)}
            />
          </div>
        ) : null}
      </div>

      {/* Relation cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {/* Cliente */}
        <div className="rounded-md border border-line bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase text-muted">
            Cliente
          </p>
          {client ? (
            <div className="space-y-1">
              <Link
                href={`/clients/${client.id}`}
                className="font-semibold text-brand hover:underline"
              >
                {client.name}
              </Link>
              <p className="text-sm text-muted">{client.phone}</p>
              {client.neighborhood || client.city ? (
                <p className="text-xs text-muted">
                  {[client.neighborhood, client.city]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              ) : null}
              {client.address ? (
                <p className="text-xs text-muted">{client.address}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">—</p>
          )}
        </div>

        {/* Cobrança */}
        <div className="rounded-md border border-line bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase text-muted">
            Cobranca
          </p>
          {collection ? (
            <div className="space-y-1">
              <Link
                href={`/collections/${collection.id}`}
                className="font-semibold text-brand hover:underline"
              >
                {collection.title}
              </Link>
              <p className="text-lg font-semibold text-ink">
                {formatCurrency(collection.amount)}
              </p>
              <div className="flex items-center gap-2">
                <StatusPill value={collection.status} />
                <span className="text-xs text-muted">
                  Vence {formatDate(collection.dueDate)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Sem cobranca vinculada</p>
          )}
        </div>

        {/* Cobrador */}
        <div className="rounded-md border border-line bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase text-muted">
            Cobrador
          </p>
          {collector ? (
            <div className="space-y-1">
              <Link
                href={`/collectors/${collector.id}`}
                className="font-semibold text-brand hover:underline"
              >
                {collector.name}
              </Link>
              <p className="text-sm text-muted">{collector.phone}</p>
              <p className="text-xs text-muted">{collector.email}</p>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  collector.active
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-panel text-muted'
                }`}
              >
                {collector.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted">Sem cobrador atribuido</p>
          )}
        </div>
      </div>

      {/* Visit history */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-ink">
          Visitas registradas ({taskVisits.length})
        </h2>
        {visitsLoading ? (
          <DataState message="Carregando visitas" />
        ) : taskVisits.length === 0 ? (
          <div className="rounded-md border border-line bg-white px-4 py-6 text-sm text-muted">
            Nenhuma visita registrada para esta tarefa.
          </div>
        ) : (
          <div className="space-y-3">
            {taskVisits.map((visit, index) => (
              <VisitCard
                key={visit.id}
                visit={visit}
                index={taskVisits.length - index}
                mediaBase={MEDIA_BASE}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p
        className={`mt-1 text-sm font-medium ${
          highlight ? 'text-emerald-600' : 'text-ink'
        }`}
      >
        {value || '—'}
      </p>
    </div>
  );
}

function VisitCard({
  visit,
  index,
  mediaBase,
}: {
  visit: CollectionVisit;
  index: number;
  mediaBase: string;
}) {
  const isSuccess =
    visit.result === 'paid' || visit.result === 'partial_paid';

  return (
    <div className="rounded-md border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          {/* Top row */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-muted">#{index}</span>
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

          {/* Payment info */}
          {isSuccess && visit.paymentReceived ? (
            <div className="mb-2 flex items-center gap-3">
              <span className="text-lg font-semibold text-emerald-600">
                {formatCurrency(visit.paymentAmount)}
              </span>
              {visit.paymentMethod ? (
                <span className="text-xs text-muted">
                  via {visit.paymentMethod.replaceAll('_', ' ')}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Notes */}
          {visit.notes ? (
            <p className="text-sm text-ink">{visit.notes}</p>
          ) : null}

          {/* GPS coords */}
          {visit.latitude != null && visit.longitude != null ? (
            <a
              href={`https://maps.google.com/?q=${visit.latitude},${visit.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs text-brand hover:underline"
            >
              Ver no mapa ({visit.latitude.toFixed(4)},{' '}
              {visit.longitude.toFixed(4)})
            </a>
          ) : null}
        </div>

        {/* Proof photo */}
        {visit.proofPhotoUrl ? (
          <a
            href={`${mediaBase}${visit.proofPhotoUrl}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src={`${mediaBase}${visit.proofPhotoUrl}`}
              alt="Comprovante"
              className="h-20 w-20 rounded-md border border-line object-cover hover:opacity-80 transition-opacity"
            />
          </a>
        ) : null}
      </div>
    </div>
  );
}
