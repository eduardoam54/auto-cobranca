'use client';

import { useMemo } from 'react';
import { DataState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { formatCurrency } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';
import type { Client, CollectionVisit, Collector } from '@/lib/types';

const RESULT_LABELS: Record<string, string> = {
  paid: 'Pago',
  partial_paid: 'Parcial',
  promised_payment: 'Promessa',
  not_home: 'Ausente',
  refused_payment: 'Recusou',
  rescheduled: 'Reagendado',
  wrong_address: 'End. errado',
  other: 'Outro',
};

const RESULT_COLORS: Record<string, string> = {
  paid: 'bg-emerald-500',
  partial_paid: 'bg-teal-400',
  promised_payment: 'bg-yellow-400',
  not_home: 'bg-slate-400',
  refused_payment: 'bg-red-400',
  rescheduled: 'bg-blue-400',
  wrong_address: 'bg-orange-400',
  other: 'bg-gray-300',
};

const RESULT_ORDER = [
  'paid',
  'partial_paid',
  'promised_payment',
  'not_home',
  'refused_payment',
  'rescheduled',
  'wrong_address',
  'other',
];

type CollectorStats = {
  id: string;
  name: string;
  total: number;
  paid: number;
  partial: number;
  refused: number;
  other: number;
  totalCollected: number;
  successRate: number;
};

export default function ReportsPage() {
  const { data: visits, loading, error } = useApiData<CollectionVisit[]>('/collection-visits');
  const { data: collectors } = useApiData<Collector[]>('/collectors');
  const { data: clients } = useApiData<Client[]>('/clients');

  const collectorById = useMemo(
    () => new Map((collectors ?? []).map((c) => [c.id, c.name])),
    [collectors],
  );

  const collectorStats = useMemo<CollectorStats[]>(() => {
    if (!visits || !collectors) return [];

    const map = new Map<string, CollectorStats>();

    for (const c of collectors) {
      map.set(c.id, {
        id: c.id,
        name: c.name,
        total: 0,
        paid: 0,
        partial: 0,
        refused: 0,
        other: 0,
        totalCollected: 0,
        successRate: 0,
      });
    }

    for (const v of visits) {
      const cid = v.collectorId ?? '';
      const entry = map.get(cid);
      if (!entry) continue;

      entry.total++;
      if (v.result === 'paid') entry.paid++;
      else if (v.result === 'partial_paid') entry.partial++;
      else if (v.result === 'refused_payment') entry.refused++;
      else entry.other++;

      if (v.paymentReceived && v.paymentAmount) {
        entry.totalCollected += Number(v.paymentAmount);
      }
    }

    for (const entry of map.values()) {
      entry.successRate =
        entry.total > 0
          ? Math.round(((entry.paid + entry.partial) / entry.total) * 100)
          : 0;
    }

    return [...map.values()]
      .filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [visits, collectors]);

  const resultDistribution = useMemo(() => {
    if (!visits) return [];
    const total = visits.length;
    if (total === 0) return [];

    const counts: Record<string, number> = {};
    for (const v of visits) {
      counts[v.result] = (counts[v.result] ?? 0) + 1;
    }

    return RESULT_ORDER.filter((r) => counts[r] > 0).map((r) => ({
      result: r,
      count: counts[r],
      pct: Math.round((counts[r] / total) * 100),
    }));
  }, [visits]);

  const paymentMethodStats = useMemo(() => {
    if (!visits) return [];
    const paid = visits.filter((v) => v.paymentReceived && v.paymentMethod);
    if (paid.length === 0) return [];

    const methods: Record<string, { count: number; total: number }> = {};
    for (const v of paid) {
      const m = v.paymentMethod!;
      if (!methods[m]) methods[m] = { count: 0, total: 0 };
      methods[m].count++;
      methods[m].total += Number(v.paymentAmount ?? 0);
    }

    return Object.entries(methods)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([method, data]) => ({
        method: method.replace(/_/g, ' '),
        count: data.count,
        total: data.total,
        pct: Math.round((data.count / paid.length) * 100),
      }));
  }, [visits]);

  const totalCollected = useMemo(
    () =>
      visits
        ?.filter((v) => v.paymentReceived)
        .reduce((sum, v) => sum + Number(v.paymentAmount ?? 0), 0) ?? 0,
    [visits],
  );

  const successCount =
    visits?.filter((v) => v.result === 'paid' || v.result === 'partial_paid').length ?? 0;
  const totalVisits = visits?.length ?? 0;
  const successRate =
    totalVisits > 0 ? Math.round((successCount / totalVisits) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Relatorios"
        description="Desempenho de cobrancas, visitas e cobradores."
      />

      {loading ? <DataState message="Carregando relatorios" /> : null}
      {error ? <DataState message={error} /> : null}

      {visits ? (
        <div className="space-y-8">
          {/* Resumo geral */}
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Total de visitas"
              value={String(totalVisits)}
            />
            <SummaryCard
              label="Taxa de sucesso"
              value={`${successRate}%`}
              color="text-emerald-600"
            />
            <SummaryCard
              label="Total arrecadado"
              value={formatCurrency(totalCollected)}
              color="text-brand"
            />
          </div>

          {/* Desempenho por cobrador */}
          <Section title="Desempenho por cobrador">
            {collectorStats.length === 0 ? (
              <EmptyRow text="Nenhuma visita registrada." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <Th>Cobrador</Th>
                      <Th>Visitas</Th>
                      <Th>Pago</Th>
                      <Th>Parcial</Th>
                      <Th>Recusou</Th>
                      <Th>Taxa de sucesso</Th>
                      <Th>Total arrecadado</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {collectorStats.map((c) => (
                      <tr key={c.id} className="hover:bg-panel transition-colors">
                        <td className="py-3 pr-4 font-medium text-ink">{c.name}</td>
                        <Td>{c.total}</Td>
                        <Td color="text-emerald-600">{c.paid}</Td>
                        <Td color="text-teal-600">{c.partial}</Td>
                        <Td color="text-red-500">{c.refused}</Td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 rounded-full bg-line">
                              <div
                                className="h-1.5 rounded-full bg-emerald-500"
                                style={{ width: `${c.successRate}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-ink">
                              {c.successRate}%
                            </span>
                          </div>
                        </td>
                        <Td color="text-brand">{formatCurrency(c.totalCollected)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Distribuicao de resultados */}
          <Section title="Distribuicao de resultados">
            {resultDistribution.length === 0 ? (
              <EmptyRow text="Nenhuma visita registrada." />
            ) : (
              <div className="space-y-2">
                {resultDistribution.map((r) => (
                  <div key={r.result} className="flex items-center gap-3">
                    <span className="w-28 text-xs text-muted">
                      {RESULT_LABELS[r.result] ?? r.result}
                    </span>
                    <div className="relative flex-1 h-5 rounded bg-line overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 rounded ${
                          RESULT_COLORS[r.result] ?? 'bg-gray-400'
                        }`}
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                    <span className="w-14 text-right text-xs font-semibold text-ink">
                      {r.count} ({r.pct}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Formas de pagamento */}
          <Section title="Formas de pagamento recebidas">
            {paymentMethodStats.length === 0 ? (
              <EmptyRow text="Nenhum pagamento registrado." />
            ) : (
              <div className="space-y-2">
                {paymentMethodStats.map((m) => (
                  <div key={m.method} className="flex items-center gap-3">
                    <span className="w-28 text-xs capitalize text-muted">{m.method}</span>
                    <div className="relative flex-1 h-5 rounded bg-line overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded bg-brand"
                        style={{ width: `${m.pct}%` }}
                      />
                    </div>
                    <div className="w-36 text-right">
                      <span className="text-xs font-semibold text-ink">
                        {m.count}x — {formatCurrency(m.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      ) : null}
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-line bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase text-muted">{title}</h2>
      {children}
    </div>
  );
}

function SummaryCard({
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase text-muted">
      {children}
    </th>
  );
}

function Td({
  children,
  color = 'text-ink',
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <td className={`py-3 pr-4 ${color}`}>
      {children}
    </td>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-sm text-muted">{text}</p>;
}
