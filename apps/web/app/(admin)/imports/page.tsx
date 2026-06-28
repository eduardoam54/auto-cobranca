'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/alert';
import { PageHeader } from '@/components/page-header';
import { getToken } from '@/lib/auth';
import { useApiList } from '@/lib/use-paginated-data';
import type { Collector } from '@/lib/types';

type ExtractedRow = {
  clientName: string;
  issueDate: string | null;
  dueDate: string | null;
  amount: number | null;
};

type RowResult = {
  clientName: string;
  clientAction: 'created' | 'found';
  collectionCreated: boolean;
  error?: string;
};

type SyncResult = {
  total: number;
  clientsCreated: number;
  clientsFound: number;
  collectionsCreated: number;
  tasksCreated: number;
  errors: number;
  rows: RowResult[];
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const ACCEPTED = '.json';

type Step = 'upload' | 'review' | 'done';

export default function ImportsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [collectorId, setCollectorId] = useState('');

  const { data: collectorsData } = useApiList<Collector>('/collectors');

  const authHeaders = (): Record<string, string> => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  };

  function handleFileChange(chosen: File | null) {
    if (!chosen) return;
    setFile(chosen);
    setError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFileChange(e.dataTransfer.files[0] ?? null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setError(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setError('O arquivo JSON precisa ser um array com pelo menos um registro.');
        return;
      }
      setRows(parsed as ExtractedRow[]);
      setStep('review');
    } catch {
      setError('Arquivo JSON inválido. Verifique o conteúdo e tente novamente.');
    }
  }

  async function handleSync() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/imports/sync`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ rows, collectorId: collectorId || undefined }),
      });

      const payload = await response.json() as SyncResult & { message?: string };

      if (!response.ok) {
        setError(payload.message ?? 'Erro ao sincronizar.');
        return;
      }

      setSyncResult(payload);
      setStep('done');
    } catch {
      setError('Nao foi possivel conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  }

  function updateRow(index: number, field: keyof ExtractedRow, value: string) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (field === 'amount') return { ...row, amount: value === '' ? null : parseFloat(value) };
        return { ...row, [field]: value === '' ? null : value };
      }),
    );
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function reset() {
    setFile(null);
    setRows([]);
    setSyncResult(null);
    setError(null);
    setStep('upload');
    setCollectorId('');
    if (inputRef.current) inputRef.current.value = '';
  }

  if (step === 'done' && syncResult) {
    return (
      <>
        <div className="mb-6">
          <PageHeader title="Importar Tabela de Dividas" description="Sincronizacao concluida." />
        </div>
        <section className="rounded-md border border-line bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-ink">Resultado da sincronizacao</h2>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Total de linhas" value={syncResult.total} color="ink" />
            <StatCard label="Cobrancas criadas" value={syncResult.collectionsCreated} color="green" />
            <StatCard label="Clientes novos" value={syncResult.clientsCreated} color="brand" />
            <StatCard label="Tarefas criadas" value={syncResult.tasksCreated} color="teal" />
            <StatCard label="Erros" value={syncResult.errors} color="red" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold text-muted">
                  <th className="pb-2 pr-4">Cliente</th>
                  <th className="pb-2 pr-4">Situacao</th>
                  <th className="pb-2 pr-4">Cobranca</th>
                  <th className="pb-2">Observacao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {syncResult.rows.map((row, i) => (
                  <tr key={i} className="text-xs">
                    <td className="py-2 pr-4 font-medium text-ink">{row.clientName}</td>
                    <td className="py-2 pr-4">
                      {row.clientAction === 'created' ? (
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-brand">Criado</span>
                      ) : (
                        <span className="rounded-full bg-panel px-2 py-0.5 text-xs font-medium text-muted">Ja existia</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {row.collectionCreated ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Registrada</span>
                      ) : (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">Nao criada</span>
                      )}
                    </td>
                    <td className="py-2 text-muted">{row.error ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6">
            <button type="button" onClick={reset} className="inline-flex min-h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-panel">
              Nova importacao
            </button>
          </div>
        </section>
      </>
    );
  }

  if (step === 'review') {
    return (
      <>
        <div className="mb-6">
          <PageHeader
            title="Importar Tabela de Dividas"
            description={`${rows.length} registros carregados. Revise e edite antes de sincronizar.`}
          />
        </div>
        {error ? <div className="mb-4"><Alert tone="error" message={error} /></div> : null}
        <section className="rounded-md border border-line bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-panel text-left text-xs font-semibold text-muted">
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Data Emissao</th>
                  <th className="px-3 py-2">Data Vencimento</th>
                  <th className="px-3 py-2">Valor (R$)</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-panel/50">
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={row.clientName}
                        onChange={(e) => updateRow(i, 'clientName', e.target.value)}
                        className="w-full min-w-[180px] rounded border border-line px-2 py-1 text-xs font-medium text-ink focus:border-brand focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="date"
                        value={row.issueDate ?? ''}
                        onChange={(e) => updateRow(i, 'issueDate', e.target.value)}
                        className="rounded border border-line px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="date"
                        value={row.dueDate ?? ''}
                        onChange={(e) => updateRow(i, 'dueDate', e.target.value)}
                        className="rounded border border-line px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        value={row.amount ?? ''}
                        onChange={(e) => updateRow(i, 'amount', e.target.value)}
                        className="w-24 rounded border border-line px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <button type="button" onClick={() => removeRow(i)} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="mt-4 space-y-3">
          {(collectorsData ?? []).filter((c) => c.active).length > 0 ? (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-ink whitespace-nowrap">
                Atribuir ao cobrador:
              </label>
              <select
                value={collectorId}
                onChange={(e) => setCollectorId(e.target.value)}
                className="rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
              >
                <option value="">Nenhum (opcional)</option>
                {(collectorsData ?? [])
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
              {collectorId ? (
                <span className="text-xs text-muted">
                  Uma tarefa de cobranca presencial sera criada para cada divida importada.
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSync}
              disabled={loading || rows.length === 0}
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {loading ? 'Sincronizando...' : `Sincronizar ${rows.length} registro${rows.length !== 1 ? 's' : ''}`}
            </button>
            <button type="button" onClick={reset} className="inline-flex min-h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-panel">
              Cancelar
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <PageHeader
          title="Importar Tabela de Dividas"
          description="Envie o arquivo JSON gerado pelo assistente para revisar e sincronizar com o banco de dados."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border border-line bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-ink">Arquivo JSON</h2>
          <p className="mb-4 text-xs text-muted">
            Envie o arquivo <strong>.json</strong> gerado pelo assistente no chat.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragging || file ? 'border-brand bg-teal-50' : 'border-line bg-panel hover:border-brand hover:bg-teal-50'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <>
                  <p className="text-sm font-medium text-brand">{file.name}</p>
                  <p className="mt-1 text-xs text-muted">{(file.size / 1024).toFixed(1)} KB — clique para trocar</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-ink">Arraste o arquivo aqui ou clique para selecionar</p>
                  <p className="mt-1 text-xs text-muted">Somente arquivos .json</p>
                </>
              )}
            </div>

            {error ? <Alert tone="error" message={error} /> : null}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!file || loading}
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {loading ? 'Carregando...' : 'Carregar JSON'}
              </button>
              {file ? (
                <button type="button" onClick={reset} className="inline-flex min-h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-panel">
                  Limpar
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-md border border-line bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-ink">Como funciona</h2>
          <ol className="space-y-3 text-sm text-muted">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-brand">1</span>
              <span>Envie o PDF da tabela para o assistente no chat e peça para extrair os dados como arquivo JSON.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-brand">2</span>
              <span>Baixe o arquivo <strong>.json</strong> retornado pelo assistente.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-brand">3</span>
              <span>Faça o upload aqui. Os dados carregam instantaneamente — sem IA, sem custo.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-brand">4</span>
              <span>Revise, edite o que precisar e clique em Sincronizar para salvar no banco.</span>
            </li>
          </ol>
        </section>
      </div>
    </>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'ink' | 'green' | 'brand' | 'teal' | 'red' }) {
  const colorMap = { ink: 'text-ink', green: 'text-green-700', brand: 'text-brand', teal: 'text-teal-600', red: 'text-red-600' };
  return (
    <div className="rounded-md border border-line p-3">
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}
