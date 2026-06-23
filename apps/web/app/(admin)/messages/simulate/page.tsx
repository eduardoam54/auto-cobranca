'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { ApiError, apiRequest } from '@/lib/api';
import { formatCurrency, formatText } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';
import type { AiCollectionAgentResult, Client } from '@/lib/types';

const exampleMessage = 'Pode passar aqui amanha depois das 18h que eu pago';

export default function SimulateWhatsAppPage() {
  const { data: clients, loading, error } = useApiData<Client[]>('/clients');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<AiCollectionAgentResult | null>(null);

  useEffect(() => {
    if (!selectedClientId && clients?.length) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  const selectedClient = useMemo(
    () => clients?.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setResult(null);

    if (!selectedClient) {
      setSubmitError('Selecione um cliente para simular a mensagem.');
      return;
    }

    const trimmedMessage = messageContent.trim();

    if (!trimmedMessage) {
      setSubmitError('Digite a mensagem recebida pelo WhatsApp.');
      return;
    }

    setAnalyzing(true);

    try {
      const analysis = await apiRequest<AiCollectionAgentResult>(
        '/ai-collection-agent/analyze-message',
        {
          method: 'POST',
          body: {
            clientId: selectedClient.id,
            phone: selectedClient.whatsappPhone ?? selectedClient.phone,
            messageContent: trimmedMessage,
          },
        },
      );

      setResult(analysis);
    } catch (error: unknown) {
      console.error(error);
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : 'Nao foi possivel analisar a mensagem com IA.',
      );
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Simular WhatsApp"
        description="Teste o Agente IA de Cobranca usando uma mensagem manual do painel."
      />

      {loading ? <DataState message="Carregando clientes" /> : null}
      {error ? <DataState message={error} /> : null}

      {!loading && !error ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="rounded-md border border-line bg-white p-4 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm font-medium text-ink">
                Cliente
                <select
                  value={selectedClientId}
                  onChange={(event) => {
                    setSelectedClientId(event.target.value);
                    setSubmitError(null);
                    setResult(null);
                  }}
                  className="mt-1 block min-h-10 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
                >
                  {clients?.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} - {client.whatsappPhone ?? client.phone}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-ink">
                Mensagem
                <textarea
                  value={messageContent}
                  onChange={(event) => {
                    setMessageContent(event.target.value);
                    setSubmitError(null);
                  }}
                  rows={6}
                  placeholder={exampleMessage}
                  className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
                />
              </label>

              {selectedClient ? (
                <div className="rounded-md border border-line bg-panel px-4 py-3 text-sm text-muted">
                  Telefone enviado:{' '}
                  <span className="font-medium text-ink">
                    {selectedClient.whatsappPhone ?? selectedClient.phone}
                  </span>
                </div>
              ) : null}

              {submitError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {submitError}
                </div>
              ) : null}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={analyzing || !clients?.length}
                  className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {analyzing ? 'Analisando...' : 'Analisar com IA'}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-md border border-line bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-ink">Resultado da IA</h2>
            <div className="mt-4">
              {result ? <AnalysisResult result={result} /> : null}
              {!result ? (
                <div className="rounded-md border border-line bg-panel px-4 py-6 text-sm text-muted">
                  O resultado da analise aparecera aqui.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function AnalysisResult({ result }: { result: AiCollectionAgentResult }) {
  const summary = result.openCollectionsSummary;

  return (
    <div className="space-y-4">
      {result.taskCreated ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Tarefa criada automaticamente pela IA
        </div>
      ) : null}

      {result.taskCreationReason === 'duplicate_pending_task' ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Ja existe uma tarefa pendente para esse cliente/cobranca
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <ResultItem
          label="Cliente identificado"
          value={result.clientIdentified ? 'Sim' : 'Nao'}
        />
        <ResultItem label="Intencao" value={formatText(result.intent)} />
        <ResultItem label="Confianca" value={`${result.confidence}`} />
        <ResultItem label="Prioridade" value={formatText(result.priority)} />
        <ResultItem
          label="Acao recomendada"
          value={formatText(result.recommendedAction.type)}
        />
        <ResultItem label="Tarefa criada" value={result.taskCreated ? 'Sim' : 'Nao'} />
        <ResultItem label="ID da tarefa" value={formatText(result.taskId)} />
        <ResultItem
          label="Motivo da tarefa"
          value={formatText(result.taskCreationReason)}
        />
        <ResultItem
          label="Cobrancas abertas"
          value={formatNullableNumber(summary.openCollectionsCount)}
        />
        <ResultItem
          label="Total em aberto"
          value={formatNullableCurrency(summary.totalOpenAmount)}
        />
      </div>

      <ResultItem label="Resumo" value={result.summary} large />

      <div className="rounded-md border border-line p-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted">
          Riscos
        </p>
        {result.risks.length ? (
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink">
            {result.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Nenhum risco informado.</p>
        )}
      </div>
    </div>
  );
}

function ResultItem({
  label,
  value,
  large = false,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div className={`rounded-md border border-line p-3 ${large ? 'sm:col-span-2' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function formatNullableNumber(value: number | null) {
  return value === null ? '-' : String(value);
}

function formatNullableCurrency(value: number | null) {
  return value === null ? '-' : formatCurrency(value);
}
