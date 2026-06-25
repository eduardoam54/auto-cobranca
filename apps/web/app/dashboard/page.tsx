'use client';

import Link from 'next/link';
import { AuthenticatedShell } from '@/components/authenticated-shell';
import { DataState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { formatCurrency } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';
import type { DashboardSummary } from '@/lib/types';

export default function DashboardPage() {
  const { data, loading, error } = useApiData<DashboardSummary>('/dashboard/summary');

  return (
    <AuthenticatedShell>
      <PageHeader
        title="Painel"
        description="Resumo operacional das cobranças, tarefas e recebimentos."
      />

      {loading ? <DataState message="Carregando painel" /> : null}
      {error ? <DataState message={error} /> : null}
      {data ? <DashboardContent data={data} /> : null}
    </AuthenticatedShell>
  );
}

function DashboardContent({ data }: { data: DashboardSummary }) {
  const totalCollections =
    data.collections.pending + data.collections.overdue + data.collections.paid;

  const paidPct = totalCollections > 0
    ? Math.round((data.collections.paid / totalCollections) * 100)
    : 0;

  const overdueRatio = totalCollections > 0
    ? data.collections.overdue / totalCollections
    : 0;

  const totalTasks = data.tasks.pending + data.tasks.completed;
  const completedPct = totalTasks > 0
    ? Math.round((data.tasks.completed / totalTasks) * 100)
    : 0;

  const totalAmount =
    (data.collections.totalOpenAmount ?? 0) +
    (data.collections.totalPaidAmount ?? 0);

  const receivedPct = totalAmount > 0
    ? Math.round((data.collections.totalPaidAmount / totalAmount) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Resumo financeiro</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="Valor em aberto"
            value={formatCurrency(data.collections.totalOpenAmount)}
            sub={`${data.collections.pending} pendentes · ${data.collections.overdue} vencidas`}
            tone={overdueRatio > 0.3 ? 'danger' : 'neutral'}
          />
          <MetricCard
            label="Valor recebido"
            value={formatCurrency(data.collections.totalPaidAmount)}
            sub={`${data.collections.paid} cobrancas pagas`}
            tone="success"
          />
          <MetricCard
            label="Total de clientes"
            value={String(data.clientsCount)}
            sub={
              <Link href="/clients" className="text-brand hover:underline">
                Ver clientes
              </Link>
            }
            tone="neutral"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Cobrancas</h2>
        <div className="rounded-md border border-line bg-white p-5">
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <Stat label="Pendentes" value={data.collections.pending} color="text-amber-600" />
            <Stat label="Vencidas" value={data.collections.overdue} color="text-red-600" />
            <Stat label="Pagas" value={data.collections.paid} color="text-emerald-600" />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>{paidPct}% pagas</span>
              <span>{totalCollections} total</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-panel">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${paidPct}%` }}
              />
            </div>
          </div>
          <div className="mt-4 text-right">
            <Link href="/collections" className="text-sm text-brand hover:underline">
              Ver todas as cobrancas →
            </Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Tarefas de campo</h2>
        <div className="rounded-md border border-line bg-white p-5">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <Stat label="Pendentes" value={data.tasks.pending} color="text-amber-600" />
            <Stat label="Concluidas" value={data.tasks.completed} color="text-emerald-600" />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>{completedPct}% concluidas</span>
              <span>{totalTasks} total</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-panel">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${completedPct}%` }}
              />
            </div>
          </div>
          <div className="mt-4 text-right">
            <Link href="/collection-tasks" className="text-sm text-brand hover:underline">
              Ver todas as tarefas →
            </Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Progresso de recebimento</h2>
        <div className="rounded-md border border-line bg-white p-5">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted">Em aberto</p>
              <p className="mt-1 text-lg font-semibold text-ink">
                {formatCurrency(data.collections.totalOpenAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Recebido</p>
              <p className="mt-1 text-lg font-semibold text-emerald-600">
                {formatCurrency(data.collections.totalPaidAmount)}
              </p>
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>{receivedPct}% recebido</span>
              <span>Total: {formatCurrency(totalAmount)}</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-panel">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${receivedPct}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Acesso rapido</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/clients', label: 'Clientes', desc: 'Gerenciar base de clientes' },
            { href: '/collections', label: 'Cobrancas', desc: 'Ver e editar cobrancas' },
            { href: '/collectors', label: 'Cobradores', desc: 'Equipe de campo' },
            { href: '/messages', label: 'Mensagens', desc: 'Historico do WhatsApp' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border border-line bg-white p-4 hover:border-brand hover:bg-teal-50 transition-colors"
            >
              <p className="font-semibold text-ink">{item.label}</p>
              <p className="mt-1 text-sm text-muted">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  tone: 'neutral' | 'success' | 'danger';
}) {
  const valueColor =
    tone === 'success'
      ? 'text-emerald-600'
      : tone === 'danger'
      ? 'text-red-600'
      : 'text-ink';

  return (
    <div className="rounded-md border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
