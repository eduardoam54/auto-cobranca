'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const tokenKey = 'collectorAccessToken';
const tasksCacheKey = 'collectorTasksCache';

type CollectorTask = {
  id: string;
  clientId: string;
  title: string | null;
  description: string | null;
  status: string;
  priority: string;
  address: string | null;
  aiRecommendation: string | null;
  scheduledDate: string | null;
  client: {
    id: string;
    name: string | null;
    phone: string | null;
    whatsappPhone: string | null;
    address: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
  } | null;
  collection: {
    amount: number | string | null;
    dueDate: string | null;
    issuedAt: string | null;
    status: string | null;
  } | null;
};

const STATUS_BANNER: Record<string, { bg: string; text: string; label: string }> = {
  assigned:    { bg: 'bg-teal-500',  text: 'text-white', label: 'Atribuída' },
  in_progress: { bg: 'bg-amber-500', text: 'text-white', label: 'Em andamento' },
  completed:   { bg: 'bg-green-500', text: 'text-white', label: 'Concluída' },
  failed:      { bg: 'bg-red-500',   text: 'text-white', label: 'Falha' },
  canceled:    { bg: 'bg-gray-400',  text: 'text-white', label: 'Cancelada' },
};

export default function CollectorTaskDetailPage() {
  const params = useParams<{ id: string }>();
  const [task, setTask] = useState<CollectorTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [failReason, setFailReason] = useState('');
  const [locationCaptured, setLocationCaptured] = useState(false);
  const [capturedCoords, setCapturedCoords] = useState<{ latitude: number; longitude: number; locationAccuracy: number } | null>(null);

  const loadTask = useCallback(async () => {
    const token = window.localStorage.getItem(tokenKey);
    if (!token) { window.location.assign('/collector/login'); return; }

    setLoading(true);
    setErrorMsg(null);

    const cachedTask = readCachedTask(params.id);
    if (cachedTask) setTask(cachedTask);

    try {
      const res = await fetch(`${apiUrl}/mobile/my-tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        window.localStorage.removeItem(tokenKey);
        window.location.assign('/collector/login');
        return;
      }

      if (!res.ok) throw new Error();

      const tasks = (await res.json()) as CollectorTask[];
      window.localStorage.setItem(tasksCacheKey, JSON.stringify(tasks));
      const found = tasks.find((t) => t.id === params.id);
      if (found) setTask(found);
      else if (!cachedTask) setErrorMsg('Tarefa não encontrada');
    } catch {
      if (!cachedTask) setErrorMsg('Não foi possível carregar a tarefa');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    const token = window.localStorage.getItem(tokenKey);
    if (!token) { window.location.assign('/collector/login'); return; }
    void loadTask();
    void tryCaptureSilentLocation();
  }, [loadTask]);

  async function tryCaptureSilentLocation() {
    if (!navigator.geolocation) return;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }),
      );
      setCapturedCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        locationAccuracy: pos.coords.accuracy,
      });
      setLocationCaptured(true);
    } catch {
      /* location optional */
    }
  }

  async function apiPatch(path: string, body?: unknown) {
    const token = window.localStorage.getItem(tokenKey);
    if (!token) { window.location.assign('/collector/login'); return null; }

    const res = await fetch(`${apiUrl}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      window.localStorage.removeItem(tokenKey);
      window.location.assign('/collector/login');
      return null;
    }

    if (!res.ok) throw new Error('action_failed');
    return res.json();
  }

  async function startTask() {
    if (!task) return;
    setSaving('start');
    setErrorMsg(null);
    try {
      await apiPatch(`/mobile/tasks/${task.id}/start`);
      setTask({ ...task, status: 'in_progress' });
      setSuccessMsg('Visita iniciada!');
    } catch {
      setErrorMsg('Não foi possível iniciar a tarefa');
    } finally {
      setSaving(null);
    }
  }

  async function completeTask(e: FormEvent) {
    e.preventDefault();
    if (!task) return;

    const amount = Number(paymentAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMsg('Informe um valor recebido válido');
      return;
    }

    setSaving('complete');
    setErrorMsg(null);

    if (!locationCaptured) await tryCaptureSilentLocation();

    try {
      await apiPatch(`/mobile/tasks/${task.id}/complete`, {
        result: 'paid',
        notes: paymentNotes || undefined,
        paymentReceived: true,
        paymentAmount: amount,
        paymentMethod,
        ...(capturedCoords ?? {}),
        visitedAt: new Date().toISOString(),
      });
      setTask({ ...task, status: 'completed' });
      setSuccessMsg('Pagamento registrado com sucesso!');
    } catch {
      setErrorMsg('Não foi possível registrar o pagamento');
    } finally {
      setSaving(null);
    }
  }

  async function failTask(e: FormEvent) {
    e.preventDefault();
    if (!task) return;
    if (!failReason.trim()) { setErrorMsg('Informe o motivo'); return; }

    setSaving('fail');
    setErrorMsg(null);

    if (!locationCaptured) await tryCaptureSilentLocation();

    try {
      await apiPatch(`/mobile/tasks/${task.id}/fail`, {
        result: 'not_home',
        notes: failReason.trim(),
        ...(capturedCoords ?? {}),
        visitedAt: new Date().toISOString(),
      });
      setTask({ ...task, status: 'failed' });
      setSuccessMsg('Tarefa registrada como falha.');
    } catch {
      setErrorMsg('Não foi possível registrar a falha');
    } finally {
      setSaving(null);
    }
  }

  const banner = task ? (STATUS_BANNER[task.status] ?? STATUS_BANNER.assigned) : null;

  const daysOverdue = task?.collection?.dueDate
    ? Math.floor((Date.now() - new Date(task.collection.dueDate).getTime()) / 86_400_000)
    : null;

  const clientPhone = task?.client?.phone;
  const clientAddress = task?.address ?? task?.client?.address;
  const mapsQuery = clientAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(clientAddress)}`
    : null;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-white shadow-sm">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link
            href="/collector/tasks"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white shadow-sm active:bg-panel"
            aria-label="Voltar"
          >
            <IconChevronLeft />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">Detalhes da tarefa</p>
            <h1 className="truncate text-sm font-bold text-ink">
              {task?.client?.name ?? task?.title ?? '—'}
            </h1>
          </div>
          {banner && task ? (
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${banner.bg} ${banner.text}`}>
              {banner.label}
            </span>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-3 px-4 py-4 pb-10">
        {loading && !task ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-xl bg-gray-200" />)}
          </div>
        ) : null}

        {errorMsg ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMsg}
          </div>
        ) : null}

        {successMsg ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {successMsg}
          </div>
        ) : null}

        {task ? (
          <>
            {/* Client card */}
            <section className="rounded-xl border border-line bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Cliente</p>
                  <h2 className="mt-0.5 text-xl font-bold text-ink">
                    {task.client?.name ?? '—'}
                  </h2>
                </div>
                <Link
                  href={`/collector/clients/${task.clientId}`}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-ink active:bg-gray-200"
                >
                  <IconEdit />
                  Editar
                </Link>
              </div>
              <div className="divide-y divide-line">
                {clientPhone ? (
                  <a
                    href={`tel:${clientPhone}`}
                    className="flex items-center justify-between px-4 py-3 active:bg-panel"
                  >
                    <div>
                      <p className="text-xs text-muted">Telefone</p>
                      <p className="text-sm font-semibold text-ink">{clientPhone}</p>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-brand">
                      <IconPhone />
                    </span>
                  </a>
                ) : null}

                {task.client?.whatsappPhone ? (
                  <a
                    href={`https://wa.me/55${task.client.whatsappPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-3 active:bg-panel"
                  >
                    <div>
                      <p className="text-xs text-muted">WhatsApp</p>
                      <p className="text-sm font-semibold text-ink">{task.client.whatsappPhone}</p>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50 text-green-600">
                      <IconWhatsApp />
                    </span>
                  </a>
                ) : null}

                {clientAddress ? (
                  <a
                    href={mapsQuery ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-3 active:bg-panel"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-xs text-muted">Endereço</p>
                      <p className="text-sm font-semibold text-ink">{clientAddress}</p>
                      {task.client?.city ? (
                        <p className="text-xs text-muted">{[task.client.city, task.client.state].filter(Boolean).join(' - ')}</p>
                      ) : null}
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <IconMap />
                    </span>
                  </a>
                ) : null}
              </div>
            </section>

            {/* Debt card */}
            {task.collection ? (
              <section className="rounded-xl border border-line bg-white px-4 py-4 shadow-sm">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Cobrança</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted">Valor</p>
                    <p className="text-2xl font-bold text-ink">{formatCurrency(task.collection.amount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">Vencimento</p>
                    <p className="text-sm font-semibold text-ink">{formatDate(task.collection.dueDate)}</p>
                    {daysOverdue !== null ? (
                      <p className={`text-xs font-bold ${daysOverdue > 0 ? 'text-red-600' : daysOverdue === 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {daysOverdue > 0
                          ? `${daysOverdue} dias vencido`
                          : daysOverdue === 0
                          ? 'Vence hoje'
                          : `${Math.abs(daysOverdue)} dias restantes`}
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {/* AI recommendation */}
            {task.aiRecommendation ? (
              <section className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-200 text-xs">✨</span>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Recomendação da IA</p>
                </div>
                <p className="text-sm leading-relaxed text-blue-900">{task.aiRecommendation}</p>
              </section>
            ) : null}

            {/* Description */}
            {task.description ? (
              <section className="rounded-xl border border-line bg-white px-4 py-4 shadow-sm">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Observações</p>
                <p className="text-sm text-ink">{task.description}</p>
              </section>
            ) : null}

            {/* Location indicator */}
            <div className="flex items-center gap-2 px-1">
              <span className={`h-2 w-2 rounded-full ${locationCaptured ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-xs text-muted">
                {locationCaptured ? 'Localização capturada automaticamente' : 'Localização não disponível (visita será registrada sem GPS)'}
              </span>
            </div>

            {/* ── ACTIONS ── */}

            {/* Status: assigned → Iniciar */}
            {task.status === 'assigned' ? (
              <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
                <h3 className="mb-1 text-base font-bold text-ink">Iniciar visita</h3>
                <p className="mb-4 text-sm text-muted">Confirme que você chegou ao local do cliente.</p>
                <button
                  type="button"
                  onClick={() => void startTask()}
                  disabled={saving !== null}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand text-base font-bold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {saving === 'start' ? 'Iniciando...' : '▶ Iniciar visita'}
                </button>
              </section>
            ) : null}

            {/* Status: in_progress → complete + fail */}
            {task.status === 'in_progress' ? (
              <>
                <form
                  onSubmit={(e) => void completeTask(e)}
                  className="rounded-xl border border-line bg-white p-4 shadow-sm"
                >
                  <h3 className="mb-1 text-base font-bold text-ink">Registrar pagamento</h3>
                  <p className="mb-4 text-sm text-muted">Preencha os dados do pagamento recebido.</p>

                  <label className="block text-sm font-semibold text-ink">
                    Valor recebido (R$)
                    <input
                      type="number"
                      step="0.01"
                      value={paymentAmount}
                      required
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0,00"
                      className="mt-2 min-h-12 w-full rounded-xl border border-line px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
                    />
                  </label>

                  <label className="mt-4 block text-sm font-semibold text-ink">
                    Forma de pagamento
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
                    >
                      <option value="cash">Dinheiro</option>
                      <option value="pix">Pix</option>
                      <option value="bank_slip">Boleto</option>
                      <option value="credit_card">Cartão de crédito</option>
                      <option value="debit_card">Cartão de débito</option>
                      <option value="other">Outro</option>
                    </select>
                  </label>

                  <label className="mt-4 block text-sm font-semibold text-ink">
                    Observação (opcional)
                    <textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      rows={2}
                      className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={saving !== null}
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-green-600 text-base font-bold text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {saving === 'complete' ? 'Salvando...' : '✓ Confirmar pagamento'}
                  </button>
                </form>

                <form
                  onSubmit={(e) => void failTask(e)}
                  className="rounded-xl border border-red-100 bg-white p-4 shadow-sm"
                >
                  <h3 className="mb-1 text-base font-bold text-red-700">Registrar falha</h3>
                  <p className="mb-4 text-sm text-muted">Use quando não foi possível realizar a cobrança.</p>

                  <label className="block text-sm font-semibold text-ink">
                    Motivo
                    <textarea
                      value={failReason}
                      onChange={(e) => setFailReason(e.target.value)}
                      required
                      rows={3}
                      placeholder="Ex: Cliente ausente, recusou pagamento..."
                      className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-base outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={saving !== null}
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 text-base font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    {saving === 'fail' ? 'Salvando...' : '✕ Registrar falha'}
                  </button>
                </form>
              </>
            ) : null}

            {/* Status: completed */}
            {task.status === 'completed' ? (
              <section className="rounded-xl border border-green-200 bg-green-50 p-6 text-center shadow-sm">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-200 text-2xl">
                  ✓
                </div>
                <h3 className="text-base font-bold text-green-800">Tarefa concluída</h3>
                <p className="mt-1 text-sm text-green-700">Pagamento registrado com sucesso.</p>
              </section>
            ) : null}

            {/* Status: failed */}
            {task.status === 'failed' ? (
              <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-200 text-2xl">
                  ✕
                </div>
                <h3 className="text-base font-bold text-red-800">Tarefa com falha</h3>
                <p className="mt-1 text-sm text-red-700">A visita foi registrada como não concluída.</p>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

function readCachedTask(taskId: string): CollectorTask | null {
  const cached = window.localStorage.getItem(tasksCacheKey);
  if (!cached) return null;
  try {
    const tasks = JSON.parse(cached) as CollectorTask[];
    return tasks.find((t) => t.id === taskId) ?? null;
  } catch {
    return null;
  }
}

function IconEdit() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.37 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.75a16 16 0 0 0 6.29 6.29l.97-.97a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
