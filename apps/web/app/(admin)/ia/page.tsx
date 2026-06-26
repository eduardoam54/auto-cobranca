'use client';

import { useState } from 'react';
import { Alert } from '@/components/alert';
import { DataState } from '@/components/data-state';
import { Modal } from '@/components/modal';
import { PageHeader } from '@/components/page-header';
import { ApiError, apiRequest } from '@/lib/api';
import { useApiData } from '@/lib/use-api-data';
import type { Client } from '@/lib/types';

type BulkAction = { type: 'activate' | 'deactivate'; ids: Set<string> } | null;

export default function IaPage() {
  const { data: clients, loading, error, reload } = useApiData<Client[]>('/clients');
  const [toggling, setToggling] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedWithout, setSelectedWithout] = useState<Set<string>>(new Set());
  const [selectedWith, setSelectedWith] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const withAi = clients?.filter((c) => c.aiEnabled) ?? [];
  const withoutAi = clients?.filter((c) => !c.aiEnabled) ?? [];

  function toggleSelectWithout(id: string) {
    setSelectedWithout((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllWithout(selectAll: boolean) {
    setSelectedWithout(selectAll ? new Set(withoutAi.map((c) => c.id)) : new Set());
  }

  function toggleSelectWith(id: string) {
    setSelectedWith((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllWith(selectAll: boolean) {
    setSelectedWith(selectAll ? new Set(withAi.map((c) => c.id)) : new Set());
  }

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

  async function handleBulkToggle() {
    if (!bulkAction) return;
    setBulkLoading(true);
    const enable = bulkAction.type === 'activate';
    const ids = [...bulkAction.ids];
    await Promise.allSettled(
      ids.map((id) => apiRequest(`/clients/${id}`, { method: 'PATCH', body: { aiEnabled: enable } })),
    );
    setBulkAction(null);
    setBulkLoading(false);
    setSelectedWithout(new Set());
    setSelectedWith(new Set());
    setFeedback({ type: 'success', message: `IA ${enable ? 'ativada' : 'desativada'} para ${ids.length} cliente${ids.length !== 1 ? 's' : ''}.` });
    await reload();
  }

  return (
    <div>
      <PageHeader
        title="IA & Automacao"
        description="Gerencie quais clientes tem analise automatica de mensagens ativada."
      />

      {feedback && (
        <div className="mb-4">
          <Alert tone={feedback.type === 'error' ? 'error' : 'success'} message={feedback.message} />
        </div>
      )}

      {loading ? <DataState message="Carregando clientes..." /> : null}
      {error ? <DataState message={error} /> : null}

      {!loading && !error && (
        <div className="space-y-8">
          {/* Bloco: Sem IA */}
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
              <>
                {selectedWithout.size > 0 ? (
                  <div className="mb-3 flex items-center gap-3 rounded-md border border-line bg-panel px-4 py-2">
                    <span className="text-sm font-medium text-ink">
                      {selectedWithout.size} selecionado{selectedWithout.size !== 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBulkAction({ type: 'activate', ids: selectedWithout })}
                      className="inline-flex min-h-8 items-center justify-center rounded-md bg-brand px-3 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Ativar IA nos selecionados
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWithout(new Set())}
                      className="text-xs text-muted hover:text-ink"
                    >
                      Limpar selecao
                    </button>
                  </div>
                ) : null}

                <div className="overflow-hidden rounded-lg border border-line bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-panel">
                        <th className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedWithout.size === withoutAi.length && withoutAi.length > 0}
                            ref={(el) => {
                              if (el) el.indeterminate = selectedWithout.size > 0 && selectedWithout.size < withoutAi.length;
                            }}
                            onChange={(e) => toggleAllWithout(e.target.checked)}
                            className="h-4 w-4 cursor-pointer accent-teal-700"
                          />
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted">Cliente</th>
                        <th className="px-4 py-3 text-left font-medium text-muted">Telefone</th>
                        <th className="px-4 py-3 text-right font-medium text-muted">Acao</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {withoutAi.map((client) => (
                        <tr key={client.id} className={`hover:bg-panel/50 ${selectedWithout.has(client.id) ? 'bg-teal-50' : ''}`}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedWithout.has(client.id)}
                              onChange={() => toggleSelectWithout(client.id)}
                              className="h-4 w-4 cursor-pointer accent-teal-700"
                            />
                          </td>
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
              </>
            )}
          </section>

          {/* Bloco: Com IA */}
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
              <>
                {selectedWith.size > 0 ? (
                  <div className="mb-3 flex items-center gap-3 rounded-md border border-teal-200 bg-teal-50 px-4 py-2">
                    <span className="text-sm font-medium text-ink">
                      {selectedWith.size} selecionado{selectedWith.size !== 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBulkAction({ type: 'deactivate', ids: selectedWith })}
                      className="inline-flex min-h-8 items-center justify-center rounded-md border border-line bg-white px-3 text-xs font-semibold text-ink hover:bg-panel"
                    >
                      Desativar IA nos selecionados
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWith(new Set())}
                      className="text-xs text-muted hover:text-ink"
                    >
                      Limpar selecao
                    </button>
                  </div>
                ) : null}

                <div className="overflow-hidden rounded-lg border border-teal-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-teal-100 bg-teal-50">
                        <th className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedWith.size === withAi.length && withAi.length > 0}
                            ref={(el) => {
                              if (el) el.indeterminate = selectedWith.size > 0 && selectedWith.size < withAi.length;
                            }}
                            onChange={(e) => toggleAllWith(e.target.checked)}
                            className="h-4 w-4 cursor-pointer accent-teal-700"
                          />
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-brand">Cliente</th>
                        <th className="px-4 py-3 text-left font-medium text-brand">Telefone</th>
                        <th className="px-4 py-3 text-right font-medium text-brand">Acao</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-teal-100">
                      {withAi.map((client) => (
                        <tr key={client.id} className={`hover:bg-teal-50/50 ${selectedWith.has(client.id) ? 'bg-teal-100' : ''}`}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedWith.has(client.id)}
                              onChange={() => toggleSelectWith(client.id)}
                              className="h-4 w-4 cursor-pointer accent-teal-700"
                            />
                          </td>
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
              </>
            )}
          </section>
        </div>
      )}

      {bulkAction ? (
        <Modal
          title={bulkAction.type === 'activate' ? 'Ativar IA em massa' : 'Desativar IA em massa'}
          onClose={() => setBulkAction(null)}
          maxWidth="sm"
        >
          <p className="mb-4 text-sm text-ink">
            Tem certeza que deseja{' '}
            <strong>{bulkAction.type === 'activate' ? 'ativar' : 'desativar'} a IA</strong> para{' '}
            <strong>{bulkAction.ids.size} cliente{bulkAction.ids.size !== 1 ? 's' : ''}</strong>?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBulkAction(null)}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-panel"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleBulkToggle}
              disabled={bulkLoading}
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {bulkLoading ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
