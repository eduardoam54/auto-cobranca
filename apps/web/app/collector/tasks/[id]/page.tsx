'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const tokenKey = 'collectorAccessToken';
const tasksCacheKey = 'collectorTasksCache';

type CollectorTask = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  address?: string | null;
  aiRecommendation?: string | null;
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

type VisitLocation = {
  latitude: number;
  longitude: number;
  locationAccuracy: number;
  visitedAt: string;
};

export default function CollectorTaskDetailPage() {
  const params = useParams<{ id: string }>();
  const [task, setTask] = useState<CollectorTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [failReason, setFailReason] = useState('');
  const [visitLocation, setVisitLocation] = useState<VisitLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);

  const loadTask = useCallback(async () => {
    const token = window.localStorage.getItem(tokenKey);

    if (!token) {
      window.location.assign('/collector/login');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cachedTask = readCachedTask(params.id);

      if (cachedTask) {
        setTask(cachedTask);
      }

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

      const tasks = (await response.json()) as CollectorTask[];
      window.localStorage.setItem(tasksCacheKey, JSON.stringify(tasks));
      const freshTask = tasks.find((item) => item.id === params.id);

      if (freshTask) {
        setTask(freshTask);
      } else if (!cachedTask) {
        setError('Tarefa não encontrada');
      }
    } catch {
      setError('Não foi possível carregar a tarefa');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    const token = window.localStorage.getItem(tokenKey);

    if (!token) {
      window.location.assign('/collector/login');
      return;
    }

    void loadTask();
  }, [loadTask]);

  async function patchTask(path: string, body?: unknown) {
    const token = window.localStorage.getItem(tokenKey);

    if (!token) {
      window.location.assign('/collector/login');
      return null;
    }

    const response = await fetch(`${apiUrl}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) {
      window.localStorage.removeItem(tokenKey);
      window.location.assign('/collector/login');
      return null;
    }

    if (!response.ok) {
      throw new Error('action_failed');
    }

    return response.json();
  }

  async function startTask() {
    if (!task) {
      return;
    }

    setSaving('start');
    setError(null);
    setMessage(null);

    try {
      const updated = (await patchTask(`/mobile/tasks/${task.id}/start`)) as {
        status?: string;
      } | null;

      if (updated) {
        setTask({ ...task, status: updated.status ?? 'in_progress' });
        setMessage('Tarefa iniciada');
      }
    } catch {
      setError('Não foi possível iniciar a tarefa');
    } finally {
      setSaving(null);
    }
  }

  async function completeTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!task) {
      return;
    }

    const amount = Number(paymentAmount.replace(',', '.'));

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Informe um valor recebido válido');
      return;
    }

    setSaving('complete');
    setError(null);
    setMessage(null);
    const location = await captureLocation({ silent: true });

    try {
      await patchTask(`/mobile/tasks/${task.id}/complete`, {
        result: 'paid',
        notes: paymentNotes,
        paymentReceived: true,
        paymentAmount: amount,
        paymentMethod,
        ...(location ?? {}),
      });
      setTask({ ...task, status: 'completed' });
      setMessage('Pagamento registrado');
    } catch {
      setError('Não foi possível concluir a tarefa');
    } finally {
      setSaving(null);
    }
  }

  async function failTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!task) {
      return;
    }

    if (!failReason.trim()) {
      setError('Informe o motivo da falha');
      return;
    }

    setSaving('fail');
    setError(null);
    setMessage(null);
    const location = await captureLocation({ silent: true });

    try {
      await patchTask(`/mobile/tasks/${task.id}/fail`, {
        reason: failReason.trim(),
        ...(location ?? {}),
      });
      setTask({ ...task, status: 'failed' });
      setMessage('Tarefa marcada como falha');
    } catch {
      setError('Não foi possível marcar falha');
    } finally {
      setSaving(null);
    }
  }

  async function captureLocation(options: { silent?: boolean } = {}) {
    if (!navigator.geolocation) {
      setLocationWarning(
        'Este navegador não oferece suporte a localização. Você pode continuar sem ela.',
      );
      return null;
    }

    setLocationLoading(true);
    setLocationWarning(null);

    if (!options.silent) {
      setLocationMessage(null);
    }

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000,
          });
        },
      );
      const nextLocation: VisitLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        locationAccuracy: position.coords.accuracy,
        visitedAt: new Date().toISOString(),
      };

      setVisitLocation(nextLocation);
      setLocationMessage('Localização capturada com sucesso');
      return nextLocation;
    } catch {
      setLocationWarning(
        'Não foi possível obter a localização. Você pode concluir a visita mesmo assim.',
      );
      return visitLocation;
    } finally {
      setLocationLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-panel px-4 py-4">
      <section className="mx-auto w-full max-w-md pb-8">
        <header className="-mx-4 border-b border-line bg-panel px-4 py-3">
          <Link
            href="/collector/tasks"
            className="inline-flex min-h-10 items-center rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink shadow-sm"
          >
            Voltar
          </Link>
        </header>

        {loading ? (
          <div className="mt-4 rounded-md border border-line bg-white px-4 py-5 text-sm text-muted">
            Carregando tarefa...
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {message}
          </div>
        ) : null}

        {!loading && task ? (
          <>
            <article className="mt-4 rounded-md border border-line bg-white p-4 shadow-sm">
              <h1 className="break-words text-2xl font-semibold text-ink">
                {task.client?.name ?? task.title ?? 'Detalhe da tarefa'}
              </h1>
              <dl className="mt-5 grid gap-4">
                <Detail label="Cliente" value={task.client?.name} />
                <Detail label="Telefone" value={task.client?.phone} />
                <Detail label="Endereço" value={task.address ?? task.client?.address} />
                <Detail label="Valor" value={formatCurrency(task.collection?.amount)} />
                <Detail label="Vencimento" value={formatDate(task.collection?.dueDate)} />
                <Detail label="Status" value={task.status} />
              </dl>
            </article>

            <section className="mt-4 rounded-md border border-line bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-ink">Localização</h2>
              <button
                type="button"
                onClick={() => void captureLocation()}
                disabled={locationLoading || saving !== null}
                className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-brand px-4 text-base font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {locationLoading ? 'Obtendo localização...' : 'Obter localização'}
              </button>

              {locationMessage ? (
                <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                  {locationMessage}
                </p>
              ) : null}

              {locationWarning ? (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                  {locationWarning}
                </p>
              ) : null}

              {visitLocation ? (
                <dl className="mt-4 grid gap-3">
                  <Detail label="Latitude" value={visitLocation.latitude.toFixed(6)} />
                  <Detail label="Longitude" value={visitLocation.longitude.toFixed(6)} />
                  <Detail
                    label="Precisão em metros"
                    value={Math.round(visitLocation.locationAccuracy)}
                  />
                </dl>
              ) : null}
            </section>

            <section className="mt-4 rounded-md border border-line bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={startTask}
                disabled={saving !== null}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-brand px-4 text-base font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving === 'start' ? 'Iniciando...' : 'Iniciar tarefa'}
              </button>
            </section>

            <form
              onSubmit={completeTask}
              className="mt-4 rounded-md border border-line bg-white p-4 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-ink">
                Concluir com pagamento
              </h2>
              <TextField
                label="Valor recebido"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={setPaymentAmount}
                required
              />
              <label className="mt-4 block text-sm font-medium text-ink">
                Forma de pagamento
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-md border border-line bg-white px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
                >
                  <option value="cash">Dinheiro</option>
                  <option value="pix">Pix</option>
                  <option value="bank_slip">Boleto</option>
                  <option value="credit_card">Cartão de crédito</option>
                  <option value="debit_card">Cartão de débito</option>
                  <option value="other">Outro</option>
                </select>
              </label>
              <TextArea
                label="Observação"
                value={paymentNotes}
                onChange={setPaymentNotes}
              />
              <button
                type="submit"
                disabled={saving !== null}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-accent px-4 text-base font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving === 'complete' ? 'Salvando...' : 'Concluir com pagamento'}
              </button>
            </form>

            <form
              onSubmit={failTask}
              className="mt-4 rounded-md border border-line bg-white p-4 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-ink">Marcar falha</h2>
              <TextArea
                label="Motivo"
                value={failReason}
                onChange={setFailReason}
                required
              />
              <button
                type="submit"
                disabled={saving !== null}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-md border border-red-200 bg-red-50 px-4 text-base font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving === 'fail' ? 'Salvando...' : 'Marcar falha'}
              </button>
            </form>
          </>
        ) : null}
      </section>
    </main>
  );
}

function readCachedTask(taskId: string) {
  const cached = window.localStorage.getItem(tasksCacheKey);

  if (!cached) {
    return null;
  }

  try {
    const tasks = JSON.parse(cached) as CollectorTask[];
    return tasks.find((item) => item.id === taskId) ?? null;
  } catch {
    return null;
  }
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-ink">
        {value ?? '-'}
      </dd>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required = false,
  type = 'text',
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  step?: string;
}) {
  return (
    <label className="mt-4 block text-sm font-medium text-ink">
      {label}
      <input
        type={type}
        step={step}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-md border border-line px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="mt-4 block text-sm font-medium text-ink">
      {label}
      <textarea
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="mt-2 w-full rounded-md border border-line px-3 py-2 text-base outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}

function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
}
