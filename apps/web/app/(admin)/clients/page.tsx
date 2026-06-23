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
import { TextField } from '@/components/text-field';
import { ApiError, apiRequest } from '@/lib/api';
import { formatText } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';
import type { Client } from '@/lib/types';

type ClientFormState = {
  name: string;
  document: string;
  phone: string;
  whatsappPhone: string;
  email: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: string;
  longitude: string;
  notes: string;
};

const emptyForm: ClientFormState = {
  name: '',
  document: '',
  phone: '',
  whatsappPhone: '',
  email: '',
  address: '',
  neighborhood: '',
  city: '',
  state: '',
  zipCode: '',
  latitude: '',
  longitude: '',
  notes: '',
};

const requiredFields = [
  { key: 'name', label: 'nome' },
  { key: 'document', label: 'documento' },
  { key: 'phone', label: 'telefone' },
] as const;

const stateOptions = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
].map((uf) => ({ value: uf, label: uf }));

function clientToForm(client: Client): ClientFormState {
  return {
    name: client.name,
    document: client.document,
    phone: client.phone,
    whatsappPhone: client.whatsappPhone ?? '',
    email: client.email ?? '',
    address: client.address ?? '',
    neighborhood: client.neighborhood ?? '',
    city: client.city ?? '',
    state: client.state ?? '',
    zipCode: client.zipCode ?? '',
    latitude: client.latitude != null ? String(client.latitude) : '',
    longitude: client.longitude != null ? String(client.longitude) : '',
    notes: client.notes ?? '',
  };
}

export default function ClientsPage() {
  const { data, loading, error } = useApiData<Client[]>('/clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (data) setClients(data);
  }, [data]);

  function updateField(field: keyof ClientFormState, value: string) {
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

  function openEdit(client: Client) {
    setEditingClient(client);
    setForm(clientToForm(client));
    setFormError(null);
  }

  function closeCreate() {
    setFormOpen(false);
    setForm(emptyForm);
    setFormError(null);
  }

  function closeEdit() {
    setEditingClient(null);
    setForm(emptyForm);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const missingField = requiredFields.find((f) => !form[f.key].trim());
    if (missingField) {
      setFormError(`Informe o ${missingField.label} do cliente.`);
      return;
    }

    const payload = buildClientPayload(form);
    if (payload === null) {
      setFormError('Latitude e longitude devem ser numeros validos.');
      return;
    }

    setSaving(true);
    try {
      if (editingClient) {
        const updated = await apiRequest<Client>(`/clients/${editingClient.id}`, {
          method: 'PATCH',
          body: payload,
        });
        setClients((current) =>
          current.map((c) => (c.id === updated.id ? updated : c)),
        );
        closeEdit();
        setSuccessMessage('Cliente atualizado com sucesso.');
      } else {
        const created = await apiRequest<Client>('/clients', {
          method: 'POST',
          body: payload,
        });
        setClients((current) => [created, ...current]);
        closeCreate();
        setSuccessMessage('Cliente cadastrado com sucesso.');
      }
    } catch (err: unknown) {
      setFormError(
        err instanceof ApiError ? err.message : 'Nao foi possivel salvar o cliente.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingClient) return;
    setDeleting(true);
    try {
      await apiRequest(`/clients/${deletingClient.id}`, { method: 'DELETE' });
      setClients((current) => current.filter((c) => c.id !== deletingClient.id));
      setDeletingClient(null);
      setSuccessMessage('Cliente excluido com sucesso.');
    } catch (err: unknown) {
      setDeletingClient(null);
      setSuccessMessage(null);
      setFormError(
        err instanceof ApiError ? err.message : 'Nao foi possivel excluir o cliente.',
      );
    } finally {
      setDeleting(false);
    }
  }

  const clientForm = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <TextField label="Nome" value={form.name} required onChange={(v) => updateField('name', v)} />
        <TextField label="Documento (CPF/CNPJ)" value={form.document} required onChange={(v) => updateField('document', v)} />
        <TextField label="Telefone" value={form.phone} required onChange={(v) => updateField('phone', v)} />
        <TextField label="WhatsApp" value={form.whatsappPhone} onChange={(v) => updateField('whatsappPhone', v)} />
        <TextField label="Email" type="email" value={form.email} onChange={(v) => updateField('email', v)} />
        <TextField label="CEP" value={form.zipCode} onChange={(v) => updateField('zipCode', v)} />
        <TextField label="Endereco" value={form.address} onChange={(v) => updateField('address', v)} />
        <TextField label="Bairro" value={form.neighborhood} onChange={(v) => updateField('neighborhood', v)} />
        <TextField label="Cidade" value={form.city} onChange={(v) => updateField('city', v)} />
        <SelectField
          label="Estado"
          value={form.state}
          onChange={(v) => updateField('state', v)}
          options={stateOptions}
          placeholder="Selecione"
        />
        <TextField label="Latitude" type="number" step="any" value={form.latitude} onChange={(v) => updateField('latitude', v)} />
        <TextField label="Longitude" type="number" step="any" value={form.longitude} onChange={(v) => updateField('longitude', v)} />
      </div>
      <label className="block text-sm font-medium text-ink">
        Observacoes
        <textarea
          value={form.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
        />
      </label>
      {formError ? <Alert tone="error" message={formError} /> : null}
      <FormActions
        submitLabel={saving ? 'Salvando...' : editingClient ? 'Salvar alteracoes' : 'Cadastrar cliente'}
        saving={saving}
        onCancel={editingClient ? closeEdit : closeCreate}
      />
    </form>
  );

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Clientes" description="Base de clientes da empresa." />
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Novo Cliente
        </button>
      </div>

      {successMessage ? <Alert tone="success" message={successMessage} /> : null}
      {formError && !formOpen && !editingClient ? <Alert tone="error" message={formError} /> : null}

      {formOpen ? (
        <section className="mb-6 rounded-md border border-line bg-white p-4 shadow-sm">
          {clientForm}
        </section>
      ) : null}

      {loading ? <DataState message="Carregando clientes" /> : null}
      {error ? <DataState message={error} /> : null}
      {!loading && !error ? (
        <DataTable
          columns={['Nome', 'Telefone', 'Bairro', 'Cidade', 'UF', 'Acoes']}
          rows={clients.map((client) => [
            <Link
              key={`name-${client.id}`}
              href={`/clients/${client.id}`}
              className="font-medium text-brand hover:underline"
            >
              {client.name}
            </Link>,
            client.phone,
            formatText(client.neighborhood),
            formatText(client.city),
            formatText(client.state),
            <RowActions
              key={`actions-${client.id}`}
              onEdit={() => openEdit(client)}
              onDelete={() => setDeletingClient(client)}
            />,
          ])}
          emptyMessage="Nenhum cliente encontrado."
        />
      ) : null}

      {editingClient ? (
        <Modal title={`Editar: ${editingClient.name}`} onClose={closeEdit}>
          {clientForm}
        </Modal>
      ) : null}

      {deletingClient ? (
        <Modal title="Excluir cliente" onClose={() => setDeletingClient(null)} maxWidth="sm">
          <p className="mb-4 text-sm text-ink">
            Tem certeza que deseja excluir o cliente{' '}
            <strong>{deletingClient.name}</strong>? Esta acao nao pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingClient(null)}
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

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
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

function buildClientPayload(form: ClientFormState) {
  const payload: Record<string, string | number> = {
    name: form.name.trim(),
    document: form.document.trim(),
    phone: form.phone.trim(),
  };

  const optionalText: Array<keyof ClientFormState> = [
    'whatsappPhone', 'email', 'address', 'neighborhood', 'city', 'state', 'zipCode', 'notes',
  ];

  optionalText.forEach((field) => {
    const value = form[field].trim();
    if (value) payload[field] = value;
  });

  const latitude = parseOptionalNumber(form.latitude);
  const longitude = parseOptionalNumber(form.longitude);

  if (latitude === null || longitude === null) return null;
  if (latitude !== undefined) payload.latitude = latitude;
  if (longitude !== undefined) payload.longitude = longitude;

  return payload;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
