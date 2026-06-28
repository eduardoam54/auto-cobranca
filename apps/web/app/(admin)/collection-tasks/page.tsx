'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/alert';
import { DataState } from '@/components/data-state';
import { DataTable } from '@/components/table';
import { FormActions } from '@/components/form-actions';
import { Modal } from '@/components/modal';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { SearchInput } from '@/components/search-input';
import { SelectField } from '@/components/select-field';
import { StatusPill } from '@/components/status-pill';
import { TextField } from '@/components/text-field';
import { ApiError, apiRequest } from '@/lib/api';
import { shortId } from '@/lib/format';
import { useApiList, usePaginatedData } from '@/lib/use-paginated-data';
import type { Client, Collection, CollectionTask, Collector } from '@/lib/types';

type PanelMode = 'new-task' | 'assign-collector' | null;

type NewTaskFormState = {
  clientId: string;
  collectionId: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  address: string;
  latitude: string;
  longitude: string;
};

type NewTaskPayloadResult =
  | { ok: true; data: Record<string, string | number> }
  | { ok: false; error: string };

const emptyNewTaskForm: NewTaskFormState = {
  clientId: '',
  collectionId: '',
  title: '',
  description: '',
  type: 'presencial_collection',
  priority: 'medium',
  status: 'pending',
  address: '',
  latitude: '',
  longitude: '',
};

const taskTypeOptions = [
  'presencial_collection',
  'whatsapp_followup',
  'phone_call',
  'payment_confirmation',
  'renegotiation_followup',
  'other',
].map((t) => ({ value: t, label: formatLabel(t) }));

const taskPriorityOptions = ['low', 'medium', 'high', 'critical'].map((p) => ({
  value: p,
  label: formatLabel(p),
}));

const taskStatusOptions = ['pending', 'assigned', 'in_progress', 'completed'].map((s) => ({
  value: s,
  label: formatLabel(s),
}));

const statusFilterOptions = [
  { value: '', label: 'Todas' },
  { value: 'pending', label: 'Pendente' },
  { value: 'assigned', label: 'Atribuída' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluída' },
  { value: 'failed', label: 'Falhou' },
  { value: 'canceled', label: 'Cancelada' },
];

const priorityFilterOptions = [
  { value: '', label: 'Todas' },
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

export default function CollectionTasksPage() {
  const {
    items,
    meta,
    loading,
    error,
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilters,
    reload,
  } = usePaginatedData<CollectionTask>('/collection-tasks');
  const { data: collectorsData, loading: collectorsLoading, error: collectorsError } =
    useApiList<Collector>('/collectors');
  const { data: clientsData, loading: clientsLoading } = useApiList<Client>('/clients');
  const { data: collectionsData, loading: collectionsLoading } =
    useApiList<Collection>('/collections');

  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedCollectorId, setSelectedCollectorId] = useState('');
  const [newTaskForm, setNewTaskForm] = useState<NewTaskFormState>(emptyNewTaskForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingTask, setDeletingTask] = useState<CollectionTask | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [items]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll(selectAll: boolean) {
    setSelectedIds(selectAll ? new Set(items.map((t) => t.id)) : new Set());
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    const ids = [...selectedIds];
    const results = await Promise.allSettled(
      ids.map((id) => apiRequest(`/collection-tasks/${id}`, { method: 'DELETE' })),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    const deleted = ids.length - failed;
    setShowBulkDeleteModal(false);
    setBulkDeleting(false);
    reload();
    if (failed > 0) {
      toast.error(`${deleted} excluída(s). ${failed} não puderam ser excluídas.`);
    } else {
      toast.success(
        `${deleted} tarefa${deleted !== 1 ? 's' : ''} excluída${deleted !== 1 ? 's' : ''} com sucesso.`,
      );
    }
  }

  const activeCollectors = useMemo(
    () => (collectorsData ?? []).filter((c) => c.active),
    [collectorsData],
  );

  const collectorNameById = useMemo(
    () => new Map((collectorsData ?? []).map((c) => [c.id, c.name])),
    [collectorsData],
  );

  const clientNameById = useMemo(
    () => new Map((clientsData ?? []).map((c) => [c.id, c.name])),
    [clientsData],
  );

  const filteredCollections = useMemo(() => {
    if (!newTaskForm.clientId) return collectionsData ?? [];
    return (collectionsData ?? []).filter(
      (c) => c.clientId === newTaskForm.clientId,
    );
  }, [collectionsData, newTaskForm.clientId]);

  const selectedTask = items.find((t) => t.id === selectedTaskId);

  function openNewTaskForm() {
    setPanelMode('new-task');
    setSelectedTaskId(null);
    setSelectedCollectorId('');
    setFormError(null);
  }

  function openAssignForm(task: CollectionTask) {
    setPanelMode('assign-collector');
    setSelectedTaskId(task.id);
    setSelectedCollectorId(task.collectorId ?? '');
    setFormError(null);
  }

  function closePanel() {
    setPanelMode(null);
    setSelectedTaskId(null);
    setSelectedCollectorId('');
    setFormError(null);
  }

  function updateNewTaskField(field: keyof NewTaskFormState, value: string) {
    setNewTaskForm((current) => {
      if (field === 'clientId') return { ...current, clientId: value, collectionId: '' };
      return { ...current, [field]: value };
    });
    setFormError(null);
  }

  async function handleAssignCollector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTaskId) return;
    if (!selectedCollectorId) {
      setFormError('Selecione um cobrador ativo.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiRequest<CollectionTask>(
        `/collection-tasks/${selectedTaskId}/assign-collector`,
        { method: 'PATCH', body: { collectorId: selectedCollectorId } },
      );
      reload();
      closePanel();
      toast.success('Cobrador atribuído com sucesso.');
    } catch (err: unknown) {
      setFormError(
        err instanceof ApiError ? err.message : 'Não foi possível atribuir o cobrador.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const payload = buildNewTaskPayload(newTaskForm);
    if (!payload.ok) {
      setFormError(payload.error);
      return;
    }
    setSaving(true);
    try {
      await apiRequest<CollectionTask>('/collection-tasks', {
        method: 'POST',
        body: payload.data,
      });
      reload();
      setNewTaskForm(emptyNewTaskForm);
      closePanel();
      toast.success('Tarefa criada com sucesso.');
    } catch (err: unknown) {
      setFormError(
        err instanceof ApiError ? err.message : 'Não foi possível criar a tarefa.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTask() {
    if (!deletingTask) return;
    setDeleting(true);
    try {
      await apiRequest(`/collection-tasks/${deletingTask.id}`, { method: 'DELETE' });
      setDeletingTask(null);
      toast.success('Tarefa excluída com sucesso.');
      reload();
    } catch (err: unknown) {
      setDeletingTask(null);
      setFormError(
        err instanceof ApiError ? err.message : 'Não foi possível excluir a tarefa.',
      );
    } finally {
      setDeleting(false);
    }
  }

  const statusFilter = (filters.status as string | undefined) ?? '';
  const priorityFilter = (filters.priority as string | undefined) ?? '';

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Tarefas de Cobrança"
          description="Fila de ações para acompanhamento das cobranças."
        />
        <button
          type="button"
          onClick={openNewTaskForm}
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Nova Tarefa
        </button>
      </div>

      {collectorsError ? (
        <div className="mb-4">
          <Alert tone="error" message={collectorsError} />
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por título, descrição ou endereço..."
        />
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs font-semibold uppercase text-muted mr-1">Status:</span>
            {statusFilterOptions.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilters({ status: f.value || undefined })}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  statusFilter === f.value
                    ? 'bg-brand text-white'
                    : 'bg-white border border-line text-muted hover:border-brand hover:text-brand'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs font-semibold uppercase text-muted mr-1">Prioridade:</span>
            {priorityFilterOptions.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilters({ priority: f.value || undefined })}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  priorityFilter === f.value
                    ? 'bg-brand text-white'
                    : 'bg-white border border-line text-muted hover:border-brand hover:text-brand'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <DataState message="Carregando tarefas" /> : null}
      {error ? <DataState message={error} /> : null}
      {!loading && !error ? (
        <>
          {selectedIds.size > 0 ? (
            <div className="mb-3 flex items-center gap-3 rounded-md border border-line bg-panel px-4 py-2">
              <span className="text-sm font-medium text-ink">
                {selectedIds.size} selecionada{selectedIds.size !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="inline-flex min-h-8 items-center justify-center rounded-md bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700"
              >
                Excluir selecionadas
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-muted hover:text-ink"
              >
                Limpar seleção
              </button>
            </div>
          ) : null}
          <DataTable
            columns={['Título', 'Cliente', 'Cobrador', 'Tipo', 'Prioridade', 'Status', 'Ações']}
            rowIds={items.map((t) => t.id)}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            rows={items.map((task) => [
              <Link
                key={`title-${task.id}`}
                href={`/collection-tasks/${task.id}`}
                className="font-medium text-brand hover:underline"
              >
                {task.title}
              </Link>,
              clientNameById.get(task.clientId) ?? shortId(task.clientId),
              task.collectorId
                ? (collectorNameById.get(task.collectorId) ?? shortId(task.collectorId))
                : '—',
              formatLabel(task.type),
              formatLabel(task.priority),
              <StatusPill key={`st-${task.id}`} value={task.status} />,
              <TaskActions
                key={`act-${task.id}`}
                task={task}
                onAssign={() => openAssignForm(task)}
                onDelete={() => setDeletingTask(task)}
              />,
            ])}
            emptyMessage="Nenhuma tarefa encontrada."
          />
          {meta && meta.totalPages > 1 ? (
            <div className="mt-4">
              <Pagination meta={meta} onPageChange={setPage} />
            </div>
          ) : null}
        </>
      ) : null}

      {panelMode === 'assign-collector' && selectedTask ? (
        <section className="mt-6 rounded-md border border-line bg-white p-4 shadow-sm">
          <form onSubmit={handleAssignCollector} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
              <div>
                <p className="text-xs font-semibold uppercase text-muted">Tarefa selecionada</p>
                <p className="mt-1 text-sm font-semibold text-ink">{selectedTask.title}</p>
                <p className="mt-1 text-xs text-muted">
                  Status atual: {formatLabel(selectedTask.status)}
                </p>
              </div>
              <SelectField
                label="Cobrador ativo"
                value={selectedCollectorId}
                required
                disabled={collectorsLoading || activeCollectors.length === 0}
                onChange={(v) => {
                  setSelectedCollectorId(v);
                  setFormError(null);
                }}
                placeholder={
                  collectorsLoading ? 'Carregando cobradores' : 'Selecione um cobrador'
                }
                options={activeCollectors.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            {!collectorsLoading && activeCollectors.length === 0 ? (
              <Alert tone="warning" message="Nenhum cobrador ativo encontrado." />
            ) : null}
            {formError ? <Alert tone="error" message={formError} /> : null}
            <FormActions
              submitLabel={saving ? 'Salvando...' : 'Confirmar atribuição'}
              saving={saving}
              onCancel={closePanel}
            />
          </form>
        </section>
      ) : null}

      {panelMode === 'new-task' ? (
        <section className="mt-6 rounded-md border border-line bg-white p-4 shadow-sm">
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField
                label="Cliente"
                value={newTaskForm.clientId}
                required
                disabled={clientsLoading || !clientsData?.length}
                onChange={(v) => updateNewTaskField('clientId', v)}
                placeholder={clientsLoading ? 'Carregando clientes' : 'Selecione um cliente'}
                options={(clientsData ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
              <SelectField
                label="Cobrança"
                value={newTaskForm.collectionId}
                disabled={collectionsLoading || !newTaskForm.clientId}
                onChange={(v) => updateNewTaskField('collectionId', v)}
                placeholder="Opcional"
                options={filteredCollections.map((c) => ({ value: c.id, label: c.title }))}
              />
              <TextField
                label="Título"
                value={newTaskForm.title}
                required
                onChange={(v) => updateNewTaskField('title', v)}
              />
              <SelectField
                label="Tipo"
                value={newTaskForm.type}
                required
                onChange={(v) => updateNewTaskField('type', v)}
                options={taskTypeOptions}
              />
              <SelectField
                label="Prioridade"
                value={newTaskForm.priority}
                required
                onChange={(v) => updateNewTaskField('priority', v)}
                options={taskPriorityOptions}
              />
              <SelectField
                label="Status"
                value={newTaskForm.status}
                required
                onChange={(v) => updateNewTaskField('status', v)}
                options={taskStatusOptions}
              />
              <TextField
                label="Endereço"
                value={newTaskForm.address}
                onChange={(v) => updateNewTaskField('address', v)}
              />
              <TextField
                label="Latitude"
                type="number"
                step="any"
                value={newTaskForm.latitude}
                onChange={(v) => updateNewTaskField('latitude', v)}
              />
              <TextField
                label="Longitude"
                type="number"
                step="any"
                value={newTaskForm.longitude}
                onChange={(v) => updateNewTaskField('longitude', v)}
              />
            </div>
            <label className="block text-sm font-medium text-ink">
              Descrição
              <textarea
                value={newTaskForm.description}
                onChange={(e) => updateNewTaskField('description', e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
              />
            </label>
            {!clientsLoading && clientsData?.length === 0 ? (
              <Alert tone="warning" message="Cadastre um cliente antes de criar uma tarefa." />
            ) : null}
            {formError ? <Alert tone="error" message={formError} /> : null}
            <FormActions
              submitLabel={saving ? 'Criando...' : 'Criar tarefa'}
              saving={saving || clientsLoading}
              onCancel={closePanel}
            />
          </form>
        </section>
      ) : null}

      {showBulkDeleteModal ? (
        <Modal title="Excluir tarefas" onClose={() => setShowBulkDeleteModal(false)} maxWidth="sm">
          <p className="mb-4 text-sm text-ink">
            Tem certeza que deseja excluir{' '}
            <strong>{selectedIds.size} tarefa{selectedIds.size !== 1 ? 's' : ''}</strong>?
            {' '}Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowBulkDeleteModal(false)}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-panel"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {bulkDeleting ? 'Excluindo...' : `Excluir ${selectedIds.size}`}
            </button>
          </div>
        </Modal>
      ) : null}

      {deletingTask ? (
        <Modal title="Excluir tarefa" onClose={() => setDeletingTask(null)} maxWidth="sm">
          <p className="mb-4 text-sm text-ink">
            Tem certeza que deseja excluir a tarefa{' '}
            <strong>{deletingTask.title}</strong>? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingTask(null)}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-panel"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDeleteTask}
              disabled={deleting}
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

type TaskActionsProps = {
  task: CollectionTask;
  onAssign: () => void;
  onDelete: () => void;
};

function TaskActions({ task, onAssign, onDelete }: TaskActionsProps) {
  const status = task.status.trim().toLowerCase();
  const canAssign = status === 'pending' || status === 'assigned';

  return (
    <div className="flex flex-wrap gap-1">
      {canAssign ? (
        <button
          type="button"
          onClick={onAssign}
          className="rounded px-2 py-1 text-xs font-medium text-brand hover:bg-teal-50"
        >
          {status === 'assigned' ? 'Reatribuir' : 'Atribuir'}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDelete}
        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        Excluir
      </button>
    </div>
  );
}

function buildNewTaskPayload(form: NewTaskFormState): NewTaskPayloadResult {
  if (!form.clientId) return { ok: false, error: 'Selecione um cliente.' };
  if (!form.title.trim()) return { ok: false, error: 'Informe o título da tarefa.' };

  const latitude = parseOptionalNumber(form.latitude);
  const longitude = parseOptionalNumber(form.longitude);

  if (latitude === null || longitude === null) {
    return { ok: false, error: 'Latitude e longitude devem ser números válidos.' };
  }

  const data: Record<string, string | number> = {
    clientId: form.clientId,
    title: form.title.trim(),
    type: form.type,
    priority: form.priority,
    status: form.status,
  };

  const optionalText: Array<keyof NewTaskFormState> = ['collectionId', 'description', 'address'];
  optionalText.forEach((field) => {
    const value = form[field].trim();
    if (value) data[field] = value;
  });

  if (latitude !== undefined) data.latitude = latitude;
  if (longitude !== undefined) data.longitude = longitude;

  return { ok: true, data };
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return '—';
  return value.replaceAll('_', ' ');
}
