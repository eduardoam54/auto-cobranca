'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/alert';
import { DataState } from '@/components/data-state';
import { DataTable } from '@/components/table';
import { FormActions } from '@/components/form-actions';
import { Modal } from '@/components/modal';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
import { StatusPill } from '@/components/status-pill';
import { TextField } from '@/components/text-field';
import { ApiError, apiRequest } from '@/lib/api';
import { formatCurrency, formatDate, formatText } from '@/lib/format';
import { toLabel } from '@/lib/labels';
import { useApiData } from '@/lib/use-api-data';
import type { Client, Collection, CollectionTask, Collector } from '@/lib/types';

type CollectionFormState = {
  clientId: string;
  title: string;
  description: string;
  amount: string;
  dueDate: string;
  status: string;
  paymentMethod: string;
};

const emptyForm: CollectionFormState = {
  clientId: '',
  title: '',
  description: '',
  amount: '',
  dueDate: '',
  status: 'pending',
  paymentMethod: '',
};

const statusOptions = ['pending', 'overdue', 'paid', 'canceled', 'renegotiated'].map(
  (s) => ({ value: s, label: toLabel(s) }),
);

const paymentMethodOptions = [
  'cash', 'pix', 'bank_slip', 'credit_card', 'debit_card', 'other',
].map((m) => ({ value: m, label: toLabel(m) }));

const requiredFields = [
  { key: 'clientId', label: 'cliente' },
  { key: 'title', label: 'titulo' },
  { key: 'amount', label: 'valor' },
  { key: 'dueDate', label: 'vencimento' },
  { key: 'status', label: 'status' },
] as const;

function collectionToForm(c: Collection): CollectionFormState {
  return {
    clientId: c.clientId,
    title: c.title,
    description: c.description ?? '',
    amount: String(c.amount),
    dueDate: c.dueDate ? c.dueDate.slice(0, 10) : '',
    status: c.status,
    paymentMethod: c.paymentMethod ?? '',
  };
}

export default function CollectionsPage() {
  const { data, loading, error } = useApiData<Collection[]>('/collections');
  const { data: clientsData, loading: clientsLoading, error: clientsError } =
    useApiData<Client[]>('/clients');
  const { data: collectorsData } = useApiData<Collector[]>('/collectors');
  const { data: tasksData } = useApiData<CollectionTask[]>('/collection-tasks');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CollectionFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [deletingCollection, setDeletingCollection] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [assignedCollectorId, setAssignedCollectorId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    if (data) { setCollections(data); setSelectedIds(new Set()); }
  }, [data]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll(selectAll: boolean) {
    setSelectedIds(selectAll ? new Set(collections.map((c) => c.id)) : new Set());
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    const ids = [...selectedIds];
    const results = await Promise.allSettled(
      ids.map((id) => apiRequest(`/collections/${id}`, { method: 'DELETE' })),
    );
    const deleted = ids.filter((_, i) => results[i].status === 'fulfilled');
    setCollections((prev) => prev.filter((c) => !deleted.includes(c.id)));
    setSelectedIds(new Set());
    setShowBulkDeleteModal(false);
    setBulkDeleting(false);
    const failed = ids.length - deleted.length;
    setSuccessMessage(
      failed > 0
        ? `${deleted.length} excluida(s). ${failed} nao puderam ser excluidas.`
        : `${deleted.length} cobranca${deleted.length !== 1 ? 's' : ''} excluida${deleted.length !== 1 ? 's' : ''} com sucesso.`,
    );
  }

  function updateField(field: keyof CollectionFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
    setSuccessMessage(null);
  }

  function openCreate() {
    setForm(emptyForm);
    setFormOpen(true);
    setFormError(null);
    setSuccessMessage(null);
  }

  function openEdit(collection: Collection) {
    setEditingCollection(collection);
    setForm(collectionToForm(collection));
    setAssignedCollectorId('');
    setFormError(null);
  }

  function closeCreate() {
    setFormOpen(false);
    setForm(emptyForm);
    setFormError(null);
  }

  function closeEdit() {
    setEditingCollection(null);
    setForm(emptyForm);
    setAssignedCollectorId('');
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const missingField = requiredFields.find((f) => !form[f.key].trim());
    if (missingField) {
      setFormError(`Informe o ${missingField.label} da cobranca.`);
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('O valor da cobranca deve ser um numero maior que zero.');
      return;
    }

    const payload = buildCollectionPayload(form, amount);
    setSaving(true);

    try {
      if (editingCollection) {
        const updated = await apiRequest<Collection>(
          `/collections/${editingCollection.id}`,
          { method: 'PATCH', body: payload },
        );
        setCollections((current) =>
          current.map((c) => (c.id === updated.id ? updated : c)),
        );

        if (assignedCollectorId) {
          await apiRequest('/collection-tasks', {
            method: 'POST',
            body: {
              clientId: editingCollection.clientId,
              collectionId: editingCollection.id,
              collectorId: assignedCollectorId,
              title: `Cobranca: ${editingCollection.title}`,
              type: 'presencial_collection',
              priority: 'medium',
              status: 'assigned',
            },
          });
        }

        closeEdit();
        setSuccessMessage(
          assignedCollectorId
            ? 'Cobranca atualizada e cobrador atribuido com sucesso.'
            : 'Cobranca atualizada com sucesso.',
        );
      } else {
        const created = await apiRequest<Collection>('/collections', {
          method: 'POST',
          body: payload,
        });
        setCollections((current) => [created, ...current]);
        closeCreate();
        setSuccessMessage('Cobranca cadastrada com sucesso.');
      }
    } catch (err: unknown) {
      setFormError(
        err instanceof ApiError ? err.message : 'Nao foi possivel salvar a cobranca.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingCollection) return;
    setDeleting(true);
    try {
      await apiRequest(`/collections/${deletingCollection.id}`, { method: 'DELETE' });
      setCollections((current) =>
        current.filter((c) => c.id !== deletingCollection.id),
      );
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(deletingCollection.id); return next; });
      setDeletingCollection(null);
      setSuccessMessage('Cobranca excluida com sucesso.');
    } catch (err: unknown) {
      setDeletingCollection(null);
      setFormError(
        err instanceof ApiError ? err.message : 'Nao foi possivel excluir a cobranca.',
      );
    } finally {
      setDeleting(false);
    }
  }

  const clientOptions = (clientsData ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const collectorOptions = (collectorsData ?? [])
    .filter((c) => c.active)
    .map((c) => ({ value: c.id, label: c.name }));

  const collectorById = useMemo(
    () => new Map((collectorsData ?? []).map((c) => [c.id, c.name])),
    [collectorsData],
  );

  // For each collectionId, pick the most relevant active task that has a collector
  const collectorByCollection = useMemo(() => {
    const STATUS_PRIORITY: Record<string, number> = {
      in_progress: 0,
      assigned: 1,
      pending: 2,
      failed: 3,
      completed: 4,
      canceled: 5,
    };
    const result = new Map<string, { name: string; status: string }>();
    for (const task of tasksData ?? []) {
      if (!task.collectionId || !task.collectorId) continue;
      const existing = result.get(task.collectionId);
      const priority = STATUS_PRIORITY[task.status] ?? 99;
      const existingPriority = existing
        ? (STATUS_PRIORITY[existing.status] ?? 99)
        : 999;
      if (priority < existingPriority) {
        const name = collectorById.get(task.collectorId);
        if (name) {
          result.set(task.collectionId, { name, status: task.status });
        }
      }
    }
    return result;
  }, [tasksData, collectorById]);

  const collectionForm = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField
          label="Cliente"
          value={form.clientId}
          required
          disabled={clientsLoading || clientOptions.length === 0}
          onChange={(v) => updateField('clientId', v)}
          options={clientOptions}
          placeholder={clientsLoading ? 'Carregando clientes' : 'Selecione um cliente'}
        />
        <TextField
          label="Titulo"
          value={form.title}
          required
          onChange={(v) => updateField('title', v)}
        />
        <TextField
          label="Valor (R$)"
          type="number"
          step="0.01"
          value={form.amount}
          required
          onChange={(v) => updateField('amount', v)}
        />
        <TextField
          label="Vencimento"
          type="date"
          value={form.dueDate}
          required
          onChange={(v) => updateField('dueDate', v)}
        />
        <SelectField
          label="Status"
          value={form.status}
          required
          onChange={(v) => updateField('status', v)}
          options={statusOptions}
        />
        <SelectField
          label="Forma de pagamento"
          value={form.paymentMethod}
          onChange={(v) => updateField('paymentMethod', v)}
          options={paymentMethodOptions}
          placeholder="Selecione uma forma"
        />
      </div>
      <label className="block text-sm font-medium text-ink">
        Descricao
        <textarea
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
        />
      </label>
      {editingCollection ? (
        <div className="rounded-md border border-line bg-panel px-4 py-3">
          <p className="mb-3 text-xs font-semibold uppercase text-muted">
            Atribuir cobrador
          </p>
          <SelectField
            label="Cobrador responsavel"
            value={assignedCollectorId}
            onChange={setAssignedCollectorId}
            options={collectorOptions}
            placeholder={
              collectorOptions.length === 0
                ? 'Nenhum cobrador ativo cadastrado'
                : 'Selecione um cobrador (opcional)'
            }
            disabled={collectorOptions.length === 0}
          />
          {assignedCollectorId ? (
            <p className="mt-2 text-xs text-muted">
              Uma tarefa de cobranca presencial sera criada e atribuida a este cobrador ao salvar.
            </p>
          ) : null}
        </div>
      ) : null}
      {clientsError ? <Alert tone="warning" message="Nao foi possivel carregar clientes." /> : null}
      {!clientsLoading && clientOptions.length === 0 ? (
        <Alert tone="warning" message="Cadastre um cliente antes de criar uma cobranca." />
      ) : null}
      {formError ? <Alert tone="error" message={formError} /> : null}
      <FormActions
        submitLabel={saving ? 'Salvando...' : editingCollection ? 'Salvar alteracoes' : 'Cadastrar cobranca'}
        saving={saving}
        disabled={clientsLoading || clientOptions.length === 0}
        onCancel={editingCollection ? closeEdit : closeCreate}
      />
    </form>
  );

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Cobrancas"
          description="Cobrancas cadastradas e seus status atuais."
        />
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Nova Cobranca
        </button>
      </div>

      {successMessage ? <Alert tone="success" message={successMessage} /> : null}

      {formOpen ? (
        <section className="mb-6 rounded-md border border-line bg-white p-4 shadow-sm">
          {collectionForm}
        </section>
      ) : null}

      {loading ? <DataState message="Carregando cobrancas" /> : null}
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
                Limpar selecao
              </button>
            </div>
          ) : null}
          <DataTable
            columns={['Titulo', 'Valor', 'Emissao', 'Vencimento', 'Dias Vencido', 'Status', 'Cobrador', 'Acoes']}
            rowIds={collections.map((c) => c.id)}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            rows={collections.map((collection) => {
              const assignment = collectorByCollection.get(collection.id);
              const daysOverdue = collection.dueDate
                ? Math.floor((Date.now() - new Date(collection.dueDate).getTime()) / 86_400_000)
                : null;
              return [
                <Link
                  key={`title-${collection.id}`}
                  href={`/collections/${collection.id}`}
                  className="font-medium text-brand hover:underline"
                >
                  {collection.title}
                </Link>,
                formatCurrency(collection.amount),
                collection.issuedAt ? formatDate(collection.issuedAt) : <span className="text-xs text-muted">—</span>,
                formatDate(collection.dueDate),
                <DaysOverdueCell key={`days-${collection.id}`} days={daysOverdue} />,
                <StatusPill key={`status-${collection.id}`} value={collection.status} />,
                <CollectorCell
                  key={`collector-${collection.id}`}
                  assignment={assignment}
                />,
                <RowActions
                  key={`actions-${collection.id}`}
                  onEdit={() => openEdit(collection)}
                  onDelete={() => setDeletingCollection(collection)}
                />,
              ];
            })}
            emptyMessage="Nenhuma cobranca encontrada."
          />
        </>
      ) : null}

      {editingCollection ? (
        <Modal title={`Editar: ${editingCollection.title}`} onClose={closeEdit}>
          {collectionForm}
        </Modal>
      ) : null}

      {deletingCollection ? (
        <Modal title="Excluir cobranca" onClose={() => setDeletingCollection(null)} maxWidth="sm">
          <p className="mb-4 text-sm text-ink">
            Tem certeza que deseja excluir a cobranca{' '}
            <strong>{deletingCollection.title}</strong>? Esta acao nao pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingCollection(null)}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-panel"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </Modal>
      ) : null}

      {showBulkDeleteModal ? (
        <Modal title="Excluir cobrancas selecionadas" onClose={() => setShowBulkDeleteModal(false)} maxWidth="sm">
          <p className="mb-4 text-sm text-ink">
            Tem certeza que deseja excluir{' '}
            <strong>{selectedIds.size} cobranca{selectedIds.size !== 1 ? 's' : ''}</strong>?{' '}
            Esta acao nao pode ser desfeita.
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
    </>
  );
}

function DaysOverdueCell({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-muted">—</span>;
  if (days < 0) {
    return (
      <span className="text-xs font-medium text-green-700">
        {Math.abs(days)}d restantes
      </span>
    );
  }
  if (days === 0) {
    return <span className="text-xs font-medium text-yellow-600">Vence hoje</span>;
  }
  return (
    <span className="text-xs font-semibold text-red-600">{days}d vencido</span>
  );
}

function CollectorCell({
  assignment,
}: {
  assignment: { name: string; status: string } | undefined;
}) {
  if (!assignment) {
    return <span className="text-xs text-muted">Nao atribuido</span>;
  }

  const isActive =
    assignment.status === 'assigned' || assignment.status === 'in_progress';

  return (
    <span className="flex items-center gap-1.5">
      <span className="text-sm font-medium text-ink">{assignment.name}</span>
      {isActive ? (
        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-brand">
          {assignment.status === 'in_progress' ? 'Em andamento' : 'Atribuído'}
        </span>
      ) : (
        <span className="rounded-full bg-panel px-2 py-0.5 text-xs text-muted">
          {toLabel(assignment.status)}
        </span>
      )}
    </span>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onEdit}
        className="rounded px-2 py-1 text-xs font-medium text-brand hover:bg-teal-50"
      >
        Editar
      </button>
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

function buildCollectionPayload(form: CollectionFormState, amount: number) {
  const payload: Record<string, string | number> = {
    clientId: form.clientId,
    title: form.title.trim(),
    amount,
    dueDate: form.dueDate,
    status: form.status,
  };

  const description = form.description.trim();
  if (description) payload.description = description;
  if (form.paymentMethod) payload.paymentMethod = form.paymentMethod;

  return payload;
}

