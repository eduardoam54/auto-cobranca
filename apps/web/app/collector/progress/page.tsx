'use client';

import { useEffect, useState } from 'react';
import { CollectorNav } from '../collector-nav';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const tokenKey = 'collectorAccessToken';

type Progress = {
  pending: number;
  completedToday: number;
  failedToday: number;
  visitedToday: number;
  totalCollectedToday: number;
};

export default function CollectorProgressPage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [collectorName, setCollectorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem(tokenKey);
    if (!token) { window.location.assign('/collector/login'); return; }
    void loadData();
  }, []);

  async function loadData() {
    const token = window.localStorage.getItem(tokenKey);
    if (!token) { window.location.assign('/collector/login'); return; }

    setLoading(true);
    setError(null);

    try {
      const [progressRes, meRes] = await Promise.all([
        fetch(`${apiUrl}/mobile/my-progress`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/mobile/me`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (progressRes.status === 401) {
        window.localStorage.removeItem(tokenKey);
        window.location.assign('/collector/login');
        return;
      }

      if (!progressRes.ok) throw new Error();

      setProgress((await progressRes.json()) as Progress);

      if (meRes.ok) {
        const me = (await meRes.json()) as { user: { name: string } };
        setCollectorName(me.user?.name ?? null);
      }
    } catch {
      setError('Não foi possível carregar o progresso.');
    } finally {
      setLoading(false);
    }
  }

  const totalToday = progress ? progress.visitedToday + progress.pending : 0;
  const pct = totalToday > 0 && progress ? Math.round((progress.completedToday / totalToday) * 100) : 0;

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="border-b border-line bg-white shadow-sm">
        <div className="mx-auto max-w-md px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Progresso</p>
          <h1 className="text-lg font-bold text-ink leading-tight">
            {collectorName ?? 'Cobrador'}
          </h1>
          <p className="mt-0.5 text-xs capitalize text-muted">{today}</p>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-xl bg-gray-200" />)}
          </div>
        ) : null}

        {!loading && progress ? (
          <>
            {/* Total recebido */}
            <section className="overflow-hidden rounded-xl bg-brand text-white shadow-sm">
              <div className="px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-200">
                  Total recebido hoje
                </p>
                <p className="mt-1 text-4xl font-bold">
                  {formatCurrency(progress.totalCollectedToday)}
                </p>
                <p className="mt-1 text-sm text-teal-100">
                  {progress.completedToday} cobrança{progress.completedToday !== 1 ? 's' : ''} concluída{progress.completedToday !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Progress bar */}
              <div className="bg-teal-800/30 px-5 pb-4">
                <div className="mb-1 flex items-center justify-between text-xs text-teal-200">
                  <span>Meta do dia</span>
                  <span className="font-bold text-white">{pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-teal-800/40">
                  <div
                    className="h-2 rounded-full bg-white transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-teal-200">
                  {progress.visitedToday} de {totalToday} visitas realizadas
                </p>
              </div>
            </section>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                value={progress.pending}
                label="Pendentes"
                color="bg-amber-50 text-amber-700"
                dot="bg-amber-400"
              />
              <StatCard
                value={progress.completedToday}
                label="Concluídas"
                color="bg-green-50 text-green-700"
                dot="bg-green-500"
              />
              <StatCard
                value={progress.failedToday}
                label="Falhas"
                color="bg-red-50 text-red-600"
                dot="bg-red-500"
              />
            </div>

            {/* Status message */}
            <section className="rounded-xl border border-line bg-white px-4 py-4 shadow-sm">
              <p className="text-sm font-semibold text-ink">{statusMessage(progress)}</p>
              <p className="mt-1 text-xs text-muted">
                {progress.pending > 0
                  ? `Ainda há ${progress.pending} tarefa${progress.pending !== 1 ? 's' : ''} pendente${progress.pending !== 1 ? 's' : ''}.`
                  : 'Todas as tarefas do dia foram visitadas.'}
              </p>
            </section>
          </>
        ) : null}

        {!loading && !progress && !error ? (
          <div className="rounded-xl border border-line bg-white p-8 text-center">
            <p className="text-sm text-muted">Nenhum dado disponível.</p>
          </div>
        ) : null}
      </div>

      <CollectorNav />
    </main>
  );
}

function StatCard({
  value,
  label,
  color,
  dot,
}: {
  value: number;
  label: string;
  color: string;
  dot: string;
}) {
  return (
    <div className={`rounded-xl px-3 py-3 ${color} shadow-sm`}>
      <p className="text-2xl font-bold">{value}</p>
      <div className="mt-1 flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <p className="text-xs font-medium">{label}</p>
      </div>
    </div>
  );
}

function statusMessage(p: Progress): string {
  if (p.visitedToday === 0) return 'Nenhuma visita realizada ainda hoje.';
  if (p.pending === 0 && p.completedToday > 0) return '🎉 Ótimo trabalho! Todas as tarefas concluídas.';
  if (p.completedToday === 0 && p.failedToday > 0) return 'Nenhum pagamento recebido ainda hoje.';
  const rate = Math.round((p.completedToday / p.visitedToday) * 100);
  if (rate >= 80) return `Excelente! Taxa de sucesso de ${rate}%.`;
  if (rate >= 50) return `Bom progresso! Taxa de sucesso de ${rate}%.`;
  return `Continue! Taxa de sucesso de ${rate}%.`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
