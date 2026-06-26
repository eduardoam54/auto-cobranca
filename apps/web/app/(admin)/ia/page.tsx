'use client';

import { useState } from 'react';
import { Alert } from '@/components/alert';
import { DataState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { ApiError, apiRequest } from '@/lib/api';
import { useApiData } from '@/lib/use-api-data';
import type { Client } from '@/lib/types';

export default function IaPage() {
  const { data: clients, loading, error, reload } = useApiData<Client[]>('/clients');
  const [toggling, setToggling] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const withAi = clients?.filter((c) => c.aiEnabled) ?? [];
  const withoutAi = clients?.filter((c) => !c.aiEnabled) ?? [];

  async function toggleAi(client: Client) {
    setToggling(client.id);
    setFeedback(null);

    try {
      await apiRequest(`/clients/${client.id}`, {
        method: 'PATCH',
        body: { aiEnabled: !client.aiEnabled },
      });
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Erro ao atualizar cliente.';
      setFeedback({ type: 'error', message });
    } finally {
      setToggling(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="IA & Automacao"
        description="Gerencie quais clientes tem analise automatica de mensagens ativada."
      />

      {feedback && (
        <div className="mb-4">
          <Alert tone="error" message={feedback.message} />
        </div>
      )}

      {loading ? <DataState message="Carregando clientes..." /> : null}
      {error ? <DataState message={error} /> : null}

      {!loading && !error && (
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-sm font-semibold text-ink">Sem IA ativada</h2>
              <span className="rounded-full bg-panel px-2 py-0.5 text-xs text-muted">
                {withoutAi.length}
              </span>
            </div>

            {withoutAi.length === 0 ? (
              <p className="rounded-lg border border-line bg-white px-4 py-6 text-center text-sm text-muted">
                Todos os clientes estao com IA ativada.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-line bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-panel">
                      <th className="px-4 py-3 text-left font-medium text-muted">Cliente</th>
                      <th className="px-4 py-3 text-left font-medium text-muted">Telefone</th>
                      <th className="px-4 py-3 text-right font-medium text-muted">Acao</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {withoutAi.map((client) => (
                      <tr key={client.id} className="hover:bg-panel/50">
                        <td className="px-4 py-3 font-medium text-ink">{client.name}</td>
                        <td className="px-4 py-3 text-muted">{client.whatsappPhone || client.phone}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => toggleAi(client)}
                            disabled={toggling === client.id}
                            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {toggling === client.id ? 'Ativando...' : 'Ativar IA'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-sm font-semibold text-ink">Com IA ativada</h2>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-brand">
                {withAi.length}
              </span>
            </div>

            {withAi.length === 0 ? (
              <p className="rounded-lg border border-line bg-white px-4 py-6 text-center text-sm text-muted">
                Nenhum cliente com IA ativada ainda.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-teal-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-teal-100 bg-teal-50">
                      <th className="px-4 py-3 text-left font-medium text-brand">Cliente</th>
                      <th className="px-4 py-3 text-left font-medium text-brand">Telefone</th>
                      <th className="px-4 py-3 text-right font-medium text-brand">Acao</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-100">
                    {withAi.map((client) => (
                      <tr key={client.id} className="hover:bg-teal-50/50">
                        <td className="px-4 py-3 font-medium text-ink">{client.name}</td>
                        <td className="px-4 py-3 text-muted">{client.whatsappPhone || client.phone}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => toggleAi(client)}
                            disabled={toggling === client.id}
                            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-panel disabled:opacity-50"
                          >
                            {toggling === client.id ? 'Desativando...' : 'Desativar IA'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
