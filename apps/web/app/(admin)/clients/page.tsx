'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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
  phone: string;
  whatsappPhone: string;
  email: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  notes: string;
};

const emptyForm: ClientFormState = {
  name: '',
  phone: '',
  whatsappPhone: '',
  email: '',
  address: '',
  neighborhood: '',
  city: '',
  state: '',
  notes: '',
};

const requiredFields = [
  { key: 'name', label: 'nome' },
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
    phone: client.phone,
    whatsappPhone: client.whatsappPhone ?? '',
    email: client.email ?? '',
    address: client.address ?? '',
    neighborhood: client.neighborhood ?? '',
    city: client.city ?? '',
    state: client.state ?? '',
    notes: client.notes ?? '',
  };
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v?.trim()))].sort();
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    if (data) { setClients(data); setSelectedIds(new Set()); }
  }, [data]);

  const suggestionAddresses    = useMemo(() => unique(clients.map((c) => c.address)),     [clients]);
  const suggestionNeighborhoods = useMemo(() => unique(clients.map((c) => c.neighborhood)), [clients]);
  const suggestionCities        = useMemo(() => unique(clients.map((c) => c.city)),        [clients]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll(selectAll: boolean) {
    setSelectedIds(selectAll ? new Set(clients.map((c) => c.id)) : new Set());
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    const ids = [...selectedIds];
    const results = await Promise.allSettled(
      ids.map((id) => apiRequest(`/clients/${id}`, { method: 'DELETE' })),
    );
    const deleted = ids.filter((_, i) => results[i].status === 'fulfilled');
    setClients((prev) => prev.filter((c) => !deleted.includes(c.id)));
    setSelectedIds(new Set());
    setShowBulkDeleteModal(false);
    setBulkDeleting(false);
    const failed = ids.length - deleted.length;
    setSuccessMessage(
      failed > 0
        ? `${deleted.length} excluido(s). ${failed} nao puderam ser excluidos.`
        : `${deleted.length} cliente${deleted.length !== 1 ? 's' : ''} excluido${deleted.length !== 1 ? 's' : ''} com sucesso.`,
    );
  }

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
    setSaving(true);
    try {
      if (editingClient) {
        const updated = await apiRequest<Client>(`/clients/${editingClient.id}`, {
          method: 'PATCH',
          body: payload,
        });
        setClients((current) => current.map((c) => (c.id === updated.id ? updated : c)));
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
      setFormError(err instanceof ApiError ? err.message : 'Nao foi possivel salvar o cliente.');
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
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(deletingClient.id); return next; });
      setDeletingClient(null);
      setSuccessMessage('Cliente excluido com sucesso.');
    } catch (err: unknown) {
      setDeletingClient(null);
      setSuccessMessage(null);
      setFormError(err instanceof ApiError ? err.message : 'Nao foi possivel excluir o cliente.');
    } finally {
      setDeleting(false);
    }
  }

  const clientForm = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Contato */}
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Nome completo" value={form.name} required onChange={(v) => updateField('name', v)} />
        <TextField label="Telefone" value={form.phone} required onChange={(v) => updateField('phone', v)} />
        <TextField label="WhatsApp" value={form.whatsappPhone} onChange={(v) => updateField('whatsappPhone', v)} />
        <TextField label="Email" type="email" value={form.email} onChange={(v) => updateField('email', v)} />
      </div>

      {/* Endereco */}
      <div className="rounded-md border border-line bg-panel/50 px-4 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Endereco</p>
        <div className="grid gap-4 md:grid-cols-2">
          <ComboField
            label="Rua / Logradouro"
            value={form.address}
            options={suggestionAddresses}
            onChange={(v) => updateField('address', v)}
            placeholder="Digite ou selecione"
          />
          <ComboField
            label="Bairro"
            value={form.neighborhood}
            options={suggestionNeighborhoods}
            onChange={(v) => updateField('neighborhood', v)}
            placeholder="Digite ou selecione"
          />
          <ComboField
            label="Cidade"
            value={form.city}
            options={suggestionCities}
            onChange={(v) => updateField('city', v)}
            placeholder="Digite ou selecione"
          />
          <SelectField
            label="Estado (UF)"
            value={form.state}
            onChange={(v) => updateField('state', v)}
            options={stateOptions}
            placeholder="Selecione"
          />
        </div>
      </div>

      {/* Observacoes */}
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
                Limpar selecao
              </button>
            </div>
          ) : null}
          <DataTable
            columns={['Nome', 'Telefone', 'Bairro', 'Cidade', 'UF', 'Acoes']}
            rowIds={clients.map((c) => c.id)}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
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
        </>
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

      {showBulkDeleteModal ? (
        <Modal title="Excluir clientes selecionados" onClose={() => setShowBulkDeleteModal(false)} maxWidth="sm">
          <p className="mb-4 text-sm text-ink">
            Tem certeza que deseja excluir{' '}
            <strong>{selectedIds.size} cliente{selectedIds.size !== 1 ? 's' : ''}</strong>?{' '}
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

// ── ComboField ──────────────────────────────────────────────────────────────

function ComboField({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(value.toLowerCase()),
  );

  function select(option: string) {
    onChange(option);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          className="block w-full rounded-md border border-line px-3 py-2 pr-8 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen((o) => !o)}
          className="absolute inset-y-0 right-0 flex items-center px-2 text-muted hover:text-ink"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {open ? (
        <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border border-line bg-white shadow-lg">
          {filtered.length > 0 ? (
            filtered.map((option) => (
              <button
                key={option}
                type="button"
                onMouseDown={() => select(option)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-teal-50 ${
                  option === value ? 'font-semibold text-brand' : 'text-ink'
                }`}
              >
                {option === value ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-brand">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                {option}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-center">
              <p className="text-xs text-muted">Nenhum cadastrado ainda.</p>
              {value.trim() ? (
                <p className="mt-0.5 text-xs font-medium text-ink">&quot;{value}&quot; sera adicionado como novo.</p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── RowActions ───────────────────────────────────────────────────────────────

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

// ── payload ──────────────────────────────────────────────────────────────────

function buildClientPayload(form: ClientFormState): Record<string, string> {
  const payload: Record<string, string> = {
    name: form.name.trim(),
    phone: form.phone.trim(),
  };

  const optional: Array<keyof ClientFormState> = [
    'whatsappPhone', 'email', 'address', 'neighborhood', 'city', 'state', 'notes',
  ];

  for (const field of optional) {
    const value = form[field].trim();
    if (value) payload[field] = value;
  }

  return payload;
}
