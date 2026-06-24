'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CollectorNav } from '../collector-nav';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const tokenKey = 'collectorAccessToken';
const tasksCacheKey = 'collectorTasksCache';

type CollectorTask = {
  id: string;
  clientId: string;
  title: string | null;
  status: string;
  priority: string;
  address: string | null;
  scheduledDate: string | null;
  client: {
    id: string;
    name: string | null;
    phone: string | null;
    address: string | null;
    neighborhood: string | null;
    city: string | null;
  } | null;
  collection: {
    amount: number | string | null;
    dueDate: string | null;
  } | null;
};

const PRIORITY_STRIPE: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-blue-400',
  low: 'bg-gray-300',
};

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-red-50 text-red-600',
  high: 'bg-orange-50 text-orange-600',
  medium: 'bg-blue-50 text-blue-600',
  low: 'bg-gray-100 text-gray-500',
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export default function CollectorTasksPage() {
  const [tasks, setTasks] = useState<CollectorTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collectorName, setCollectorName] = useState<string | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem(tokenKey);
    if (!token) { window.location.assign('/collector/login'); return; }

    const cached = window.localStorage.getItem(tasksCacheKey);
    if (cached) {
      try { setTasks(JSON.parse(cached) as CollectorTask[]); } catch { /* ignore */ }
    }

    void loadAll();
  }, []);

  async function loadAll(isRefresh = false) {
    const token = window.localStorage.getItem(tokenKey);
    if (!token) { window.location.assign('/collector/login'); return; }

    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);

    try {
      const [tasksRes, meRes] = await Promise.all([
        fetch(`${apiUrl}/mobile/my-tasks`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/mobile/me`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (tasksRes.status === 401) {
        window.localStorage.removeItem(tokenKey);
        window.location.assign('/collector/login');
        return;
      }

      if (!tasksRes.ok) throw new Error('tasks_failed');

      const nextTasks = (await tasksRes.json()) as CollectorTask[];
      setTasks(nextTasks);
      window.localStorage.setItem(tasksCacheKey, JSON.stringify(nextTasks));

      if (meRes.ok) {
        const me = (await meRes.json()) as { user: { name: string } };
        setCollectorName(me.user?.name ?? null);
      }
    } catch {
      setError('Sem conexão. Exibindo dados em cache.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(tokenKey);
    window.localStorage.removeItem(tasksCacheKey);
    window.location.assign('/collector/login');
  }

  const inProgress = tasks.filter((t) => t.status === 'in_progress');
  const assigned = tasks.filter((t) => t.status === 'assigned');

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-20 border-b border-line bg-white shadow-sm">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand">
              Auto Cobrança
            </p>
            <h1 className="text-lg font-bold text-ink leading-tight">
              {collectorName ?? 'Área do Cobrador'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadAll(true)}
              disabled={loading || refreshing}
              aria-label="Atualizar tarefas"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-muted shadow-sm active:bg-panel disabled:opacity-40"
            >
              <IconRefresh spinning={refreshing} />
            </button>
            <button
              type="button"
              onClick={logout}
              className="h-9 rounded-full border border-line bg-white px-3 text-xs font-semibold text-ink shadow-sm active:bg-panel"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-4">
        {/* Summary */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 shadow-sm">
            <span className="text-sm font-bold text-white">{tasks.length}</span>
            <span className="text-xs text-teal-100">{tasks.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'}</span>
          </div>
          {inProgress.length > 0 ? (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              <span className="text-xs font-semibold text-amber-700">{inProgress.length} em andamento</span>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        ) : null}

        {/* Skeleton */}
        {loading && tasks.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-32 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : null}

        {/* Empty */}
        {!loading && tasks.length === 0 ? (
          <div className="rounded-xl border border-line bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-2xl">
              ✅
            </div>
            <h2 className="text-base font-semibold text-ink">Tudo em dia!</h2>
            <p className="mt-1 text-sm text-muted">Nenhuma tarefa pendente no momento.</p>
          </div>
        ) : null}

        {/* In progress */}
        {inProgress.length > 0 ? (
          <section className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wide text-amber-600">Em andamento</span>
            </div>
            <div className="space-y-3">
              {inProgress.map((task) => <TaskCard key={task.id} task={task} />)}
            </div>
          </section>
        ) : null}

        {/* Assigned */}
        {assigned.length > 0 ? (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand" />
              <span className="text-xs font-bold uppercase tracking-wide text-brand">Atribuídas</span>
            </div>
            <div className="space-y-3">
              {assigned.map((task) => <TaskCard key={task.id} task={task} />)}
            </div>
          </section>
        ) : null}
      </div>

      <CollectorNav />
    </main>
  );
}

function TaskCard({ task }: { task: CollectorTask }) {
  const stripe = PRIORITY_STRIPE[task.priority] ?? PRIORITY_STRIPE.medium;
  const badge = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.medium;
  const label = PRIORITY_LABEL[task.priority] ?? task.priority;

  const daysOverdue = task.collection?.dueDate
    ? Math.floor((Date.now() - new Date(task.collection.dueDate).getTime()) / 86_400_000)
    : null;

  const clientAddress = task.address ?? task.client?.address;
  const location = [clientAddress, task.client?.city].filter(Boolean).join(', ');

  return (
    <Link
      href={`/collector/tasks/${task.id}`}
      className="block overflow-hidden rounded-xl border border-line bg-white shadow-sm transition-transform active:scale-[0.98]"
    >
      <div className={`h-1 w-full ${stripe}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-ink">
              {task.client?.name ?? task.title ?? 'Tarefa'}
            </h2>
            {task.client?.phone ? (
              <p className="mt-0.5 text-sm text-muted">{task.client.phone}</p>
            ) : null}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>
            {label}
          </span>
        </div>

        {location ? (
          <p className="mt-2 flex items-center gap-1 truncate text-xs text-muted">
            <IconPin />
            {location}
          </p>
        ) : null}

        {task.collection ? (
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <span className="text-sm font-bold text-ink">
              {formatCurrency(task.collection.amount)}
            </span>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted">vence {formatDate(task.collection.dueDate)}</span>
            {daysOverdue !== null ? (
              <span className={`ml-auto shrink-0 text-xs font-bold ${daysOverdue > 0 ? 'text-red-600' : daysOverdue === 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {daysOverdue > 0
                  ? `${daysOverdue}d vencido`
                  : daysOverdue === 0
                  ? 'Vence hoje'
                  : `${Math.abs(daysOverdue)}d restantes`}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function IconRefresh({ spinning }: { spinning: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? 'animate-spin' : ''}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
}
