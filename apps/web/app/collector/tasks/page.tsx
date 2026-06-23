'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const tokenKey = 'collectorAccessToken';
const tasksCacheKey = 'collectorTasksCache';

type CollectorTask = {
  id: string;
  title?: string | null;
  status?: string | null;
  address?: string | null;
  client?: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  collection?: {
    amount?: number | string | null;
    dueDate?: string | null;
  } | null;
};

export default function CollectorTasksPage() {
  const [tasks, setTasks] = useState<CollectorTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem(tokenKey);

    if (!token) {
      window.location.assign('/collector/login');
      return;
    }

    void loadTasks();
  }, []);

  async function loadTasks() {
    const token = window.localStorage.getItem(tokenKey);

    if (!token) {
      window.location.assign('/collector/login');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/mobile/my-tasks`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        window.localStorage.removeItem(tokenKey);
        window.location.assign('/collector/login');
        return;
      }

      if (!response.ok) {
        throw new Error('tasks_failed');
      }

      const nextTasks = (await response.json()) as CollectorTask[];
      setTasks(nextTasks);
      window.localStorage.setItem(tasksCacheKey, JSON.stringify(nextTasks));
    } catch {
      setError('Não foi possível carregar as tarefas');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(tokenKey);
    window.localStorage.removeItem(tasksCacheKey);
    window.location.assign('/collector/login');
  }

  return (
    <main className="min-h-screen bg-panel px-4 py-4">
      <section className="mx-auto w-full max-w-md pb-8">
        <header className="sticky top-0 z-10 -mx-4 border-b border-line bg-panel/95 px-4 py-3 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-brand">
                Área do Cobrador
              </p>
              <h1 className="text-2xl font-semibold text-ink">
                Minhas tarefas
              </h1>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink shadow-sm"
            >
              Sair
            </button>
          </div>
          <button
            type="button"
            onClick={loadTasks}
            disabled={loading}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </header>

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 rounded-md border border-line bg-white px-4 py-5 text-sm text-muted">
            Carregando tarefas...
          </div>
        ) : null}

        {!loading && !error && tasks.length === 0 ? (
          <div className="mt-4 rounded-md border border-line bg-white px-4 py-8 text-center">
            <h2 className="text-base font-semibold text-ink">
              Nenhuma tarefa atribuída
            </h2>
          </div>
        ) : null}

        {!loading && tasks.length > 0 ? (
          <div className="mt-4 space-y-3">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/collector/tasks/${task.id}`}
                className="block rounded-md border border-line bg-white p-4 shadow-sm active:border-brand"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-semibold text-ink">
                      {task.client?.name ?? task.title ?? 'Tarefa'}
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      {task.client?.phone ?? '-'}
                    </p>
                  </div>
                  <span className="rounded-md border border-line px-2 py-1 text-xs font-medium text-muted">
                    {task.status ?? '-'}
                  </span>
                </div>
                <p className="mt-3 break-words text-sm text-ink">
                  {task.address ?? task.client?.address ?? 'Endereço não informado'}
                </p>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
