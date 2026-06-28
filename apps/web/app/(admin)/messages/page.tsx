'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/alert';
import { DataState } from '@/components/data-state';
import { FormActions } from '@/components/form-actions';
import { Modal } from '@/components/modal';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { SearchInput } from '@/components/search-input';
import { ApiError, apiRequest } from '@/lib/api';
import { usePaginatedData } from '@/lib/use-paginated-data';
import type { Message } from '@/lib/types';

type SendResult = { messageId: string; externalMessageId: string };

const directionFilters = [
  { value: '', label: 'Todas' },
  { value: 'inbound', label: 'Recebidas' },
  { value: 'outbound', label: 'Enviadas' },
];

export default function MessagesPage() {
  const {
    items: data,
    meta,
    loading,
    error,
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilters,
  } = usePaginatedData<Message>('/messages');
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const directionFilter = (filters.direction as string | undefined) ?? '';

  function openReply(message: Message) {
    setReplyTarget(message);
    setReplyText('');
    setSendError(null);
  }

  function closeReply() {
    setReplyTarget(null);
    setReplyText('');
    setSendError(null);
  }

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!replyTarget || !replyText.trim()) return;

    setSending(true);
    setSendError(null);

    try {
      await apiRequest<SendResult>('/whatsapp/send', {
        method: 'POST',
        body: { phone: replyTarget.phone, message: replyText.trim() },
      });
      closeReply();
      toast.success(`Mensagem enviada para ${replyTarget.phone}.`);
    } catch (err: unknown) {
      setSendError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível enviar a mensagem. Verifique se o WHATSAPP_ACCESS_TOKEN está configurado.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Mensagens"
        description="Histórico de mensagens e classificações da IA."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por telefone ou conteúdo..."
        />
        <div className="flex gap-1">
          {directionFilters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilters({ direction: f.value || undefined })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                directionFilter === f.value
                  ? 'bg-brand text-white'
                  : 'bg-white border border-line text-muted hover:border-brand hover:text-brand'
              }`}
            >
              {f.label}
              {meta && f.value === '' ? ` (${meta.total})` : ''}
            </button>
          ))}
        </div>
      </div>

      {loading ? <DataState message="Carregando mensagens" /> : null}
      {error ? <DataState message={error} /> : null}

      {!loading && !error ? (
        <div className="space-y-3">
          {data.length === 0 ? (
            <div className="rounded-md border border-line bg-white px-4 py-6 text-sm text-muted">
              Nenhuma mensagem encontrada.
            </div>
          ) : (
            data.map((message) =>
              message.direction === 'inbound' ? (
                <MessageCard
                  key={message.id}
                  message={message}
                  onReply={() => openReply(message)}
                />
              ) : (
                <OutboundCard key={message.id} message={message} />
              ),
            )
          )}
          {meta && meta.totalPages > 1 ? (
            <div className="mt-4">
              <Pagination meta={meta} onPageChange={setPage} />
            </div>
          ) : null}
        </div>
      ) : null}

      {replyTarget ? (
        <Modal
          title={`Responder para ${replyTarget.phone}`}
          onClose={closeReply}
          maxWidth="md"
        >
          <div className="mb-4 rounded-md border border-line bg-panel p-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted">
              Mensagem original
            </p>
            <p className="text-sm text-ink">{replyTarget.content}</p>
            {replyTarget.aiIntent ? (
              <p className="mt-2 text-xs text-muted">
                Intenção detectada:{' '}
                <span className="font-medium text-brand">
                  {replyTarget.aiIntent.replaceAll('_', ' ')}
                </span>
              </p>
            ) : null}
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <label className="block text-sm font-medium text-ink">
              Mensagem
              <span className="text-red-600"> *</span>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={5}
                required
                maxLength={4096}
                placeholder="Digite a mensagem a ser enviada via WhatsApp..."
                className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
              />
              <span className="mt-1 block text-right text-xs text-muted">
                {replyText.length}/4096
              </span>
            </label>
            {sendError ? <Alert tone="error" message={sendError} /> : null}
            <FormActions
              submitLabel={sending ? 'Enviando...' : 'Enviar via WhatsApp'}
              saving={sending}
              onCancel={closeReply}
            />
          </form>
        </Modal>
      ) : null}
    </>
  );
}

function MessageCard({
  message,
  onReply,
}: {
  message: Message;
  onReply: () => void;
}) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{message.phone}</span>
          {message.aiIntent ? (
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-brand">
              {message.aiIntent.replaceAll('_', ' ')}
            </span>
          ) : null}
          {message.aiAnalyzed === false ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
              aguardando análise
            </span>
          ) : null}
          {message.aiConfidence != null ? (
            <span className="text-xs text-muted">
              {Math.round(message.aiConfidence * 100)}% confiança
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onReply}
          className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
        >
          Responder
        </button>
      </div>

      <p className="mb-2 text-sm text-ink">{message.content}</p>

      {message.aiSummary ? (
        <div className="mt-2 rounded-md border border-teal-100 bg-teal-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-brand">
            Análise da IA
          </p>
          <p className="mt-1 text-xs text-ink">{message.aiSummary}</p>
        </div>
      ) : null}
    </div>
  );
}

function OutboundCard({ message }: { message: Message }) {
  const isAuto = message.status === 'sent';

  return (
    <div className="rounded-md border border-line bg-white p-4 opacity-80">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{message.phone}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            isAuto
              ? 'bg-blue-50 text-blue-700'
              : 'bg-panel text-muted'
          }`}
        >
          {isAuto ? 'enviada' : message.status}
        </span>
      </div>
      <p className="text-sm text-muted">{message.content}</p>
    </div>
  );
}
