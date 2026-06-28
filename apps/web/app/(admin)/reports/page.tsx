'use client';

import { useState } from 'react';
import { DataState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { formatCurrency } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

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

type CollectorStat = {
  collectorId: string;
  collectorName: string;
  total: number;
  paid: number;
  partialPaid: number;
  promisedPayment: number;
  notHome: number;
  refusedPayment: number;
  other: number;
  totalCollected: number;
  successRate: number;
};

type ReportsData = {
  summary: {
    totalVisits: number;
    successCount: number;
    successRate: number;
    totalCollected: number;
  };
  byCollector: CollectorStat[];
  resultDistribution: Array<{ result: string; count: number; pct: number }>;
  paymentMethods: Array<{ method: string; count: number; total: number; pct: number }>;
};

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const params = new URLSearchParams();
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);
  const qs = params.toString();

  const { data, loading, error } = useApiData<ReportsData>(
    `/dashboard/reports${qs ? `?${qs}` : ''}`,
  );

  return (
    <>
      <PageHeader
        title="Relatorios"
        description="Desempenho de cobrancas, visitas e cobradores."
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase text-muted mb-1">
            De
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-muted mb-1">
            Ate
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
          />
        </div>
        {(fromDate || toDate) ? (
          <button
            type="button"
            onClick={() => { setFromDate(''); setToDate(''); }}
            className="text-xs text-muted hover:text-ink"
          >
            Limpar filtro
          </button>
        ) : null}
      </div>

      {loading ? <DataState message="Carregando relatorios" /> : null}
      {error ? <DataState message={error} /> : null}

      {data ? (
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Total de visitas"
              value={String(data.summary.totalVisits)}
            />
            <SummaryCard
              label="Taxa de sucesso"
              value={`${data.summary.successRate}%`}
              color="text-emerald-600"
            />
            <SummaryCard
              label="Total arrecadado"
              value={formatCurrency(data.summary.totalCollected)}
              color="text-brand"
            />
          </div>

          <Section title="Desempenho por cobrador">
            {data.byCollector.length === 0 ? (
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
                    {data.byCollector.map((c) => (
                      <tr key={c.collectorId} className="hover:bg-panel transition-colors">
                        <td className="py-3 pr-4 font-medium text-ink">{c.collectorName}</td>
                        <Td>{c.total}</Td>
                        <Td color="text-emerald-600">{c.paid}</Td>
                        <Td color="text-teal-600">{c.partialPaid}</Td>
                        <Td color="text-red-500">{c.refusedPayment}</Td>
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

          <Section title="Distribuicao de resultados">
            {data.resultDistribution.length === 0 ? (
              <EmptyRow text="Nenhuma visita registrada." />
            ) : (
              <div className="space-y-2">
                {data.resultDistribution.map((r) => (
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

          <Section title="Formas de pagamento recebidas">
            {data.paymentMethods.length === 0 ? (
              <EmptyRow text="Nenhum pagamento registrado." />
            ) : (
              <div className="space-y-2">
                {data.paymentMethods.map((m) => (
                  <div key={m.method} className="flex items-center gap-3">
                    <span className="w-28 text-xs capitalize text-muted">
                      {m.method.replace(/_/g, ' ')}
                    </span>
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
