'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
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
import { useApiList, usePaginatedData } from '@/lib/use-paginated-data';
import type { Collector, User } from '@/lib/types';

type CollectorFormState = {
  name: string;
  phone: string;
  whatsappPhone: string;
  email: string;
  userId: string;
  active: boolean;
  currentLatitude: string;
  currentLongitude: string;
};

const emptyForm: CollectorFormState = {
  name: '',
  phone: '',
  whatsappPhone: '',
  email: '',
  userId: '',
  active: true,
  currentLatitude: '',
  currentLongitude: '',
};

const requiredFields = [
  { key: 'name', label: 'nome' },
  { key: 'phone', label: 'telefone' },
  { key: 'email', label: 'email' },
] as const;

const activeFilterOptions = [
  { value: undefined, label: 'Todos' },
  { value: 'true', label: 'Ativos' },
  { value: 'false', label: 'Inativos' },
];

function collectorToForm(c: Collector): CollectorFormState {
  return {
    name: c.name,
    phone: c.phone,
    whatsappPhone: c.whatsappPhone ?? '',
    email: c.email,
    userId: c.userId ?? '',
    active: c.active,
    currentLatitude: c.currentLatitude != null ? String(c.currentLatitude) : '',
    currentLongitude: c.currentLongitude != null ? String(c.currentLongitude) : '',
  };
}

export default function CollectorsPage() {
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
  } = usePaginatedData<Collector>('/collectors');
  const { data: usersData, loading: usersLoading, error: usersError } =
    useApiList<User>('/users');

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CollectorFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null);
  const [deletingCollector, setDeletingCollector] = useState<Collector | null>(null);
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
    setSelectedIds(selectAll ? new Set(items.map((c) => c.id)) : new Set());
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    const ids = [...selectedIds];
    const results = await Promise.allSettled(
      ids.map((id) => apiRequest(`/collectors/${id}`, { method: 'DELETE' })),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    const deleted = ids.length - failed;
    setShowBulkDeleteModal(false);
    setBulkDeleting(false);
    reload();
    if (failed > 0) {
      toast.error(`${deleted} excluído(s). ${failed} não puderam ser excluídos.`);
    } else {
      toast.success(
        `${deleted} cobrador${deleted !== 1 ? 'es' : ''} excluído${deleted !== 1 ? 's' : ''} com sucesso.`,
      );
    }
  }

  function updateField(field: keyof CollectorFormState, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
  }

  function openCreate() {
    setForm(emptyForm);
    setFormOpen(true);
    setFormError(null);
  }

  function openEdit(collector: Collector) {
    setEditingCollector(collector);
    setForm(collectorToForm(collector));
    setFormError(null);
  }

  function closeCreate() {
    setFormOpen(false);
    setForm(emptyForm);
    setFormError(null);
  }

  function closeEdit() {
    setEditingCollector(null);
    setForm(emptyForm);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const missingField = requiredFields.find((f) => !String(form[f.key]).trim());
    if (missingField) {
      setFormError(`Informe o ${missingField.label} do cobrador.`);
      return;
    }

    const payload = buildCollectorPayload(form);
    if (payload === null) {
      setFormError('Latitude e longitude devem ser números válidos.');
      return;
    }

    setSaving(true);
    try {
      if (editingCollector) {
        await apiRequest<Collector>(`/collectors/${editingCollector.id}`, {
          method: 'PATCH',
          body: payload,
        });
        closeEdit();
        toast.success('Cobrador atualizado com sucesso.');
      } else {
        await apiRequest<Collector>('/collectors', { method: 'POST', body: payload });
        closeCreate();
        toast.success('Cobrador cadastrado com sucesso.');
      }
      reload();
    } catch (err: unknown) {
      setFormError(
        err instanceof ApiError ? err.message : 'Não foi possível salvar o cobrador.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingCollector) return;
    setDeleting(true);
    try {
      await apiRequest(`/collectors/${deletingCollector.id}`, { method: 'DELETE' });
      setDeletingCollector(null);
      toast.success('Cobrador excluído com sucesso.');
      reload();
    } catch (err: unknown) {
      setDeletingCollector(null);
      setFormError(
        err instanceof ApiError ? err.message : 'Não foi possível excluir o cobrador.',
      );
    } finally {
      setDeleting(false);
    }
  }

  const userOptions = (usersData ?? [])
    .filter((u) => u.role === 'collector' && u.active)
    .map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }));

  const collectorForm = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <TextField label="Nome" value={form.name} required onChange={(v) => updateField('name', v)} />
        <TextField label="Telefone" value={form.phone} required onChange={(v) => updateField('phone', v)} />
        <TextField label="WhatsApp" value={form.whatsappPhone} onChange={(v) => updateField('whatsappPhone', v)} />
        <TextField label="Email" type="email" value={form.email} required onChange={(v) => updateField('email', v)} />
        <SelectField
          label="Usuário vinculado"
          value={form.userId}
          disabled={usersLoading}
          onChange={(v) => updateField('userId', v)}
          options={userOptions}
          placeholder={usersLoading ? 'Carregando usuários...' : 'Sem usuário vinculado'}
        />
        <TextField label="Latitude atual" type="number" step="any" value={form.currentLatitude} onChange={(v) => updateField('currentLatitude', v)} />
        <TextField label="Longitude atual" type="number" step="any" value={form.currentLongitude} onChange={(v) => updateField('currentLongitude', v)} />
      </div>
      <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => updateField('active', e.target.checked)}
          className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
        />
        Cobrador ativo
      </label>
      {usersError ? (
        <Alert
          tone="warning"
          message="Não foi possível carregar usuários. O cobrador pode ser cadastrado sem usuário."
        />
      ) : null}
      {formError ? <Alert tone="error" message={formError} /> : null}
      <FormActions
        submitLabel={saving ? 'Salvando...' : editingCollector ? 'Salvar alterações' : 'Cadastrar cobrador'}
        saving={saving}
        onCancel={editingCollector ? closeEdit : closeCreate}
      />
    </form>
  );

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Cobradores"
          description="Equipe responsável pelas visitas e tarefas de cobrança."
        />
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Novo Cobrador
        </button>
      </div>

      {formOpen ? (
        <section className="mb-6 rounded-md border border-line bg-white p-4 shadow-sm">
          {collectorForm}
        </section>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome, email ou telefone..."
        />
        <div className="flex gap-1">
          {activeFilterOptions.map((f) => (
            <button
              key={String(f.value)}
              type="button"
              onClick={() => setFilters({ active: f.value })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filters.active === f.value
                  ? 'bg-brand text-white'
                  : 'bg-white border border-line text-muted hover:border-brand hover:text-brand'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <DataState message="Carregando cobradores" /> : null}
      {error ? <DataState message={error} /> : null}
      {!loading && !error ? (
        <>
          {selectedIds.size > 0 ? (
            <div className="mb-3 flex items-center gap-3 rounded-md border border-line bg-panel px-4 py-2">
              <span className="text-sm font-medium text-ink">
                {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="inline-flex min-h-8 items-center justify-center rounded-md bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700"
              >
                Excluir selecionados
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
            columns={['Nome', 'Telefone', 'Email', 'Ativo', 'Ações']}
            rowIds={items.map((c) => c.id)}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            rows={items.map((collector) => [
              <Link
                key={`name-${collector.id}`}
                href={`/collectors/${collector.id}`}
                className="font-medium text-brand hover:underline"
              >
                {collector.name}
              </Link>,
              collector.phone,
              collector.email,
              <StatusPill key={`active-${collector.id}`} value={collector.active} />,
              <RowActions
                key={`actions-${collector.id}`}
                onEdit={() => openEdit(collector)}
                onDelete={() => setDeletingCollector(collector)}
              />,
            ])}
            emptyMessage="Nenhum cobrador encontrado."
          />
          {meta && meta.totalPages > 1 ? (
            <div className="mt-4">
              <Pagination meta={meta} onPageChange={setPage} />
            </div>
          ) : null}
        </>
      ) : null}

      {editingCollector ? (
        <Modal title={`Editar: ${editingCollector.name}`} onClose={closeEdit}>
          {collectorForm}
        </Modal>
      ) : null}

      {showBulkDeleteModal ? (
        <Modal
          title="Excluir cobradores"
          onClose={() => setShowBulkDeleteModal(false)}
          maxWidth="sm"
        >
          <p className="mb-4 text-sm text-ink">
            Tem certeza que deseja excluir{' '}
            <strong>{selectedIds.size} cobrador{selectedIds.size !== 1 ? 'es' : ''}</strong>?
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

      {deletingCollector ? (
        <Modal
          title="Excluir cobrador"
          onClose={() => setDeletingCollector(null)}
          maxWidth="sm"
        >
          <p className="mb-4 text-sm text-ink">
            Tem certeza que deseja excluir o cobrador{' '}
            <strong>{deletingCollector.name}</strong>? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingCollector(null)}
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
    </>
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

function buildCollectorPayload(form: CollectorFormState) {
  const payload: Record<string, string | number | boolean> = {
    name: form.name.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    active: form.active,
  };

  const whatsappPhone = form.whatsappPhone.trim();
  if (whatsappPhone) payload.whatsappPhone = whatsappPhone;
  if (form.userId) payload.userId = form.userId;

  const lat = parseOptionalNumber(form.currentLatitude);
  const lng = parseOptionalNumber(form.currentLongitude);

  if (lat === null || lng === null) return null;
  if (lat !== undefined) payload.currentLatitude = lat;
  if (lng !== undefined) payload.currentLongitude = lng;

  return payload;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
