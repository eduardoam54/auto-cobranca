'use client';

import { useMemo, useState } from 'react';
import { DataState } from '@/components/data-state';
import { Modal } from '@/components/modal';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { toLabel } from '@/lib/labels';
import { useApiData } from '@/lib/use-api-data';
import type { Client, CollectionVisit, Collector } from '@/lib/types';

const MEDIA_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api').replace(
    '/api',
    '',
  );

const resultFilters = [
  { value: '', label: 'Todas' },
  { value: 'paid', label: 'Pago' },
  { value: 'partial_paid', label: 'Parcial' },
  { value: 'promised_payment', label: 'Promessa' },
  { value: 'not_home', label: 'Ausente' },
  { value: 'refused_payment', label: 'Recusou' },
  { value: 'rescheduled', label: 'Reagendado' },
  { value: 'wrong_address', label: 'End. errado' },
  { value: 'other', label: 'Outro' },
];

export default function VisitsPage() {
  const { data: visits, loading, error } = useApiData<CollectionVisit[]>('/collection-visits');
  const { data: collectors } = useApiData<Collector[]>('/collectors');
  const { data: clients } = useApiData<Client[]>('/clients');
  const [resultFilter, setResultFilter] = useState('');
  const [selectedVisit, setSelectedVisit] = useState<CollectionVisit | null>(null);

  const collectorById = useMemo(
    () => new Map((collectors ?? []).map((c) => [c.id, c.name])),
    [collectors],
  );

  const clientById = useMemo(
    () => new Map((clients ?? []).map((c) => [c.id, c.name])),
    [clients],
  );

  const filtered = useMemo(() => {
    if (!visits) return [];
    if (!resultFilter) return visits;
    return visits.filter((v) => v.result === resultFilter);
  }, [visits, resultFilter]);

  const total = visits?.length ?? 0;
  const paid = visits?.filter((v) => v.result === 'paid' || v.result === 'partial_paid').length ?? 0;
  const withPhoto = visits?.filter((v) => v.proofPhotoUrl).length ?? 0;
  const withGps = visits?.filter((v) => v.latitude != null).length ?? 0;

  return (
    <>
      <PageHeader
        title="Visitas"
        description="Historico de visitas de cobranca realizadas pelos cobradores."
      />

      {loading ? <DataState message="Carregando visitas" /> : null}
      {error ? <DataState message={error} /> : null}

      {visits ? (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-4">
            <StatCard label="Total de visitas" value={String(total)} />
            <StatCard label="Com pagamento" value={String(paid)} color="text-emerald-600" />
            <StatCard label="Com foto" value={String(withPhoto)} color="text-brand" />
            <StatCard label="Com GPS" value={String(withGps)} color="text-blue-600" />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {resultFilters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setResultFilter(f.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  resultFilter === f.value
                    ? 'bg-brand text-white'
                    : 'bg-white border border-line text-muted hover:border-brand hover:text-brand'
                }`}
              >
                {f.label}
                {f.value === '' ? ` (${total})` : ''}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-md border border-line bg-white px-4 py-6 text-sm text-muted">
              Nenhuma visita encontrada.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((visit) => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  collectorName={collectorById.get(visit.collectorId ?? '') ?? '—'}
                  clientName={clientById.get(visit.clientId) ?? '—'}
                  mediaBase={MEDIA_BASE}
                  onOpen={() => setSelectedVisit(visit)}
                />
              ))}
            </div>
          )}
        </>
      ) : null}

      {selectedVisit ? (
        <VisitDetailModal
          visit={selectedVisit}
          collectorName={collectorById.get(selectedVisit.collectorId ?? '') ?? '—'}
          clientName={clientById.get(selectedVisit.clientId) ?? '—'}
          mediaBase={MEDIA_BASE}
          onClose={() => setSelectedVisit(null)}
        />
      ) : null}
    </>
  );
}

function StatCard({
  label,
  value,
  color = 'text-ink',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function VisitCard({
  visit,
  collectorName,
  clientName,
  mediaBase,
  onOpen,
}: {
  visit: CollectionVisit;
  collectorName: string;
  clientName: string;
  mediaBase: string;
  onOpen: () => void;
}) {
  return (
    <div
      className="cursor-pointer rounded-md border border-line bg-white p-4 hover:border-brand transition-colors"
      onClick={onOpen}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <StatusPill value={visit.result} />
            <span className="text-xs text-muted">{formatDateTime(visit.visitedAt)}</span>
            {visit.proofPhotoUrl ? (
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-brand">
                📷 foto
              </span>
            ) : null}
            {visit.latitude != null ? (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                📍 GPS
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <span className="text-muted">Cliente: </span>
              <span className="font-medium text-ink">{clientName}</span>
            </span>
            <span>
              <span className="text-muted">Cobrador: </span>
              <span className="font-medium text-ink">{collectorName}</span>
            </span>
            {visit.paymentReceived && visit.paymentAmount ? (
              <span className="font-semibold text-emerald-600">
                {formatCurrency(visit.paymentAmount)}
              </span>
            ) : null}
          </div>
          {visit.notes ? (
            <p className="mt-1 line-clamp-1 text-xs text-muted">{visit.notes}</p>
          ) : null}
        </div>
        {visit.proofPhotoUrl ? (
          <img
            src={`${mediaBase}${visit.proofPhotoUrl}`}
            alt="Comprovante"
            className="h-14 w-14 rounded-md object-cover border border-line"
          />
        ) : null}
      </div>
    </div>
  );
}

function VisitDetailModal({
  visit,
  collectorName,
  clientName,
  mediaBase,
  onClose,
}: {
  visit: CollectionVisit;
  collectorName: string;
  clientName: string;
  mediaBase: string;
  onClose: () => void;
}) {
  return (
    <Modal title="Detalhe da visita" onClose={onClose} maxWidth="lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Resultado" value={<StatusPill value={visit.result} />} />
          <InfoRow label="Data" value={formatDateTime(visit.visitedAt)} />
          <InfoRow label="Cliente" value={clientName} />
          <InfoRow label="Cobrador" value={collectorName} />
        </div>

        {visit.paymentReceived ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold uppercase text-emerald-700">Pagamento recebido</p>
            <p className="mt-1 text-lg font-semibold text-emerald-700">
              {formatCurrency(visit.paymentAmount)}
            </p>
            {visit.paymentMethod ? (
              <p className="text-xs text-emerald-600">
                Forma: {toLabel(visit.paymentMethod)}
              </p>
            ) : null}
          </div>
        ) : null}

        {visit.notes ? (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted">Observacoes</p>
            <p className="text-sm text-ink">{visit.notes}</p>
          </div>
        ) : null}

        {visit.latitude != null && visit.longitude != null ? (
          <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase text-blue-700">Localizacao GPS</p>
            <p className="text-sm font-mono text-blue-800">
              {visit.latitude.toFixed(6)}, {visit.longitude.toFixed(6)}
            </p>
            {visit.locationAccuracy != null ? (
              <p className="text-xs text-blue-600">
                Precisao: ±{Math.round(visit.locationAccuracy)}m
              </p>
            ) : null}
            <a
              href={`https://maps.google.com/?q=${visit.latitude},${visit.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-brand hover:underline"
            >
              Ver no Google Maps →
            </a>
          </div>
        ) : null}

        {visit.proofPhotoUrl ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted">
              Foto de comprovante
            </p>
            <img
              src={`${mediaBase}${visit.proofPhotoUrl}`}
              alt="Foto de comprovante"
              className="w-full rounded-md border border-line object-contain"
              style={{ maxHeight: 360 }}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <div className="mt-1 text-sm text-ink">{value}</div>
    </div>
  );
}
