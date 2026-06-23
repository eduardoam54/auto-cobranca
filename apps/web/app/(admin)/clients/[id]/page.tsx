'use client';

import Link from 'next/link';
import { use } from 'react';
import { DataState } from '@/components/data-state';
import { DataTable } from '@/components/table';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { formatCurrency, formatDate, formatText } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';
import type { Client, Collection, Message } from '@/lib/types';

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: client, loading: clientLoading, error: clientError } =
    useApiData<Client>(`/clients/${id}`);
  const { data: allCollections, loading: collectionsLoading } =
    useApiData<Collection[]>('/collections');
  const { data: allMessages, loading: messagesLoading } =
    useApiData<Message[]>('/messages');

  const collections = (allCollections ?? []).filter((c) => c.clientId === id);
  const messages = client
    ? (allMessages ?? []).filter(
        (m) =>
          m.phone === client.phone ||
          (client.whatsappPhone && m.phone === client.whatsappPhone),
      )
    : [];

  if (clientLoading) {
    return <DataState message="Carregando cliente" />;
  }

  if (clientError || !client) {
    return <DataState message={clientError ?? 'Cliente nao encontrado.'} />;
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/clients" className="hover:text-brand hover:underline">
          Clientes
        </Link>
        <span>/</span>
        <span className="text-ink">{client.name}</span>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={client.name}
          description={`Documento: ${client.document} · Telefone: ${client.phone}`}
        />
        <Link
          href="/clients"
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-panel"
        >
          Voltar
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InfoCard label="Telefone" value={client.phone} />
        <InfoCard label="WhatsApp" value={formatText(client.whatsappPhone)} />
        <InfoCard label="Email" value={formatText(client.email)} />
        <InfoCard label="Endereco" value={formatText(client.address)} />
        <InfoCard label="Cidade" value={formatText(client.city)} />
        <InfoCard label="Estado" value={formatText(client.state)} />
        {client.notes ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <InfoCard label="Observacoes" value={client.notes} />
          </div>
        ) : null}
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">
            Cobrancas ({collections.length})
          </h2>
          <Link
            href={`/collections`}
            className="text-sm text-brand hover:underline"
          >
            Ver todas
          </Link>
        </div>
        {collectionsLoading ? (
          <DataState message="Carregando cobrancas" />
        ) : collections.length === 0 ? (
          <div className="rounded-md border border-line bg-white px-4 py-6 text-sm text-muted">
            Nenhuma cobranca cadastrada para este cliente.
          </div>
        ) : (
          <DataTable
            columns={['Titulo', 'Valor', 'Vencimento', 'Status', 'Forma de pagamento']}
            rows={collections.map((c) => [
              <Link
                key={`col-${c.id}`}
                href={`/collections/${c.id}`}
                className="font-medium text-brand hover:underline"
              >
                {c.title}
              </Link>,
              formatCurrency(c.amount),
              formatDate(c.dueDate),
              <StatusPill key={`st-${c.id}`} value={c.status} />,
              formatText(c.paymentMethod),
            ])}
            emptyMessage="Nenhuma cobranca encontrada."
          />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-ink">
          Mensagens recentes ({messages.length})
        </h2>
        {messagesLoading ? (
          <DataState message="Carregando mensagens" />
        ) : messages.length === 0 ? (
          <div className="rounded-md border border-line bg-white px-4 py-6 text-sm text-muted">
            Nenhuma mensagem encontrada para este cliente.
          </div>
        ) : (
          <div className="space-y-2">
            {messages.slice(0, 20).map((message) => (
              <div
                key={message.id}
                className="rounded-md border border-line bg-white p-4"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase text-muted">
                    {message.direction === 'inbound' ? 'Cliente' : 'Sistema'}
                  </span>
                  {message.aiIntent ? (
                    <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-brand">
                      {message.aiIntent.replaceAll('_', ' ')}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-ink">{message.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="mt-1 text-sm text-ink">{value || '—'}</p>
    </div>
  );
}
