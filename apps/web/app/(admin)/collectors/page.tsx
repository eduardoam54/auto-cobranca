'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
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
import { useApiData } from '@/lib/use-api-data';
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
  const { data, loading, error } = useApiData<Collector[]>('/collectors');
  const { data: usersData, loading: usersLoading, error: usersError } =
    useApiData<User[]>('/users');
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CollectorFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null);
  const [deletingCollector, setDeletingCollector] = useState<Collector | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (data) setCollectors(data);
  }, [data]);

  function updateField(field: keyof CollectorFormState, value: string | boolean) {
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
      setFormError('Latitude e longitude devem ser numeros validos.');
      return;
    }

    setSaving(true);
    try {
      if (editingCollector) {
        const updated = await apiRequest<Collector>(
          `/collectors/${editingCollector.id}`,
          { method: 'PATCH', body: payload },
        );
        setCollectors((current) =>
          current.map((c) => (c.id === updated.id ? updated : c)),
        );
        closeEdit();
        setSuccessMessage('Cobrador atualizado com sucesso.');
      } else {
        const created = await apiRequest<Collector>('/collectors', {
          method: 'POST',
          body: payload,
        });
        setCollectors((current) => [created, ...current]);
        closeCreate();
        setSuccessMessage('Cobrador cadastrado com sucesso.');
      }
    } catch (err: unknown) {
      setFormError(
        err instanceof ApiError ? err.message : 'Nao foi possivel salvar o cobrador.',
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
      setCollectors((current) => current.filter((c) => c.id !== deletingCollector.id));
      setDeletingCollector(null);
      setSuccessMessage('Cobrador excluido com sucesso.');
    } catch (err: unknown) {
      setDeletingCollector(null);
      setFormError(
        err instanceof ApiError ? err.message : 'Nao foi possivel excluir o cobrador.',
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
          label="Usuario vinculado"
          value={form.userId}
          disabled={usersLoading}
          onChange={(v) => updateField('userId', v)}
          options={userOptions}
          placeholder={usersLoading ? 'Carregando usuarios...' : 'Sem usuario vinculado'}
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
      {usersError ? <Alert tone="warning" message="Nao foi possivel carregar usuarios. O cobrador pode ser cadastrado sem usuario." /> : null}
      {formError ? <Alert tone="error" message={formError} /> : null}
      <FormActions
        submitLabel={saving ? 'Salvando...' : editingCollector ? 'Salvar alteracoes' : 'Cadastrar cobrador'}
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
          description="Equipe responsavel pelas visitas e tarefas de cobranca."
        />
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Novo Cobrador
        </button>
      </div>

      {successMessage ? <Alert tone="success" message={successMessage} /> : null}

      {formOpen ? (
        <section className="mb-6 rounded-md border border-line bg-white p-4 shadow-sm">
          {collectorForm}
        </section>
      ) : null}

      {loading ? <DataState message="Carregando cobradores" /> : null}
      {error ? <DataState message={error} /> : null}
      {!loading && !error ? (
        <DataTable
          columns={['Nome', 'Telefone', 'Email', 'Ativo', 'Acoes']}
          rows={collectors.map((collector) => [
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
      ) : null}

      {editingCollector ? (
        <Modal title={`Editar: ${editingCollector.name}`} onClose={closeEdit}>
          {collectorForm}
        </Modal>
      ) : null}

      {deletingCollector ? (
        <Modal title="Excluir cobrador" onClose={() => setDeletingCollector(null)} maxWidth="sm">
          <p className="mb-4 text-sm text-ink">
            Tem certeza que deseja excluir o cobrador{' '}
            <strong>{deletingCollector.name}</strong>? Esta acao nao pode ser desfeita.
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
