'use client';

import { useRef, useState } from 'react';
import { Alert } from '@/components/alert';
import { PageHeader } from '@/components/page-header';
import { getToken } from '@/lib/auth';

type RowResult = {
  clientName: string;
  clientAction: 'created' | 'found';
  collectionCreated: boolean;
  error?: string;
};

type ImportResult = {
  total: number;
  clientsCreated: number;
  clientsFound: number;
  collectionsCreated: number;
  errors: number;
  rows: RowResult[];
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

const ACCEPTED = '.csv,.xlsx,.xls,.ods';

export default function ImportsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(chosen: File | null) {
    if (!chosen) return;
    setFile(chosen);
    setResult(null);
    setError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0] ?? null;
    handleFileChange(dropped);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append('file', file);

      const token = getToken();
      const response = await fetch(`${apiUrl}/imports/table`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });

      const payload = await response.json() as ImportResult & { message?: string };

      if (!response.ok) {
        setError(payload.message ?? 'Erro ao processar o arquivo.');
        return;
      }

      setResult(payload);
    } catch {
      setError('Nao foi possivel conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <>
      <div className="mb-6">
        <PageHeader
          title="Importar Tabela de Dividas"
          description="Envie uma planilha com os dados das dividas e a IA fara a leitura, criando os clientes e registrando as cobrancas automaticamente."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border border-line bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-ink">Arquivo</h2>
          <p className="mb-4 text-xs text-muted">
            Formatos aceitos: CSV, Excel (.xlsx, .xls, .ods). A planilha deve conter colunas de
            nome do cliente, data de emissao, data de vencimento e valor.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragging
                  ? 'border-brand bg-teal-50'
                  : file
                  ? 'border-brand bg-teal-50'
                  : 'border-line bg-panel hover:border-brand hover:bg-teal-50'
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
                  <p className="mt-1 text-xs text-muted">
                    {(file.size / 1024).toFixed(1)} KB — clique para trocar
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-ink">
                    Arraste o arquivo aqui ou clique para selecionar
                  </p>
                  <p className="mt-1 text-xs text-muted">CSV, XLSX ate 10 MB</p>
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
                {loading ? 'Processando...' : 'Importar com IA'}
              </button>
              {(file || result) ? (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-panel"
                >
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
              <span>Selecione o arquivo exportado pelo seu sistema (CSV ou Excel).</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-brand">2</span>
              <span>A IA lera as colunas automaticamente, independente do nome ou formato das datas e valores.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-brand">3</span>
              <span>Para cada linha: se o cliente ja existe no cadastro, apenas a divida e registrada. Se nao existe, o cliente e criado com os dados basicos.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-brand">4</span>
              <span>Um relatorio detalhado e exibido ao final mostrando o que foi criado, encontrado ou com erro.</span>
            </li>
          </ol>
        </section>
      </div>

      {result ? (
        <section className="mt-6 rounded-md border border-line bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-ink">Resultado da importacao</h2>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total de linhas" value={result.total} color="ink" />
            <StatCard label="Cobrancas criadas" value={result.collectionsCreated} color="green" />
            <StatCard label="Clientes novos" value={result.clientsCreated} color="brand" />
            <StatCard label="Erros" value={result.errors} color="red" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold text-muted">
                  <th className="pb-2 pr-4">Cliente</th>
                  <th className="pb-2 pr-4">Situacao do cliente</th>
                  <th className="pb-2 pr-4">Cobranca</th>
                  <th className="pb-2">Observacao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.rows.map((row, i) => (
                  <tr key={i} className="text-xs">
                    <td className="py-2 pr-4 font-medium text-ink">{row.clientName}</td>
                    <td className="py-2 pr-4">
                      {row.clientAction === 'created' ? (
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-brand">
                          Criado
                        </span>
                      ) : (
                        <span className="rounded-full bg-panel px-2 py-0.5 text-xs font-medium text-muted">
                          Ja existia
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {row.collectionCreated ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          Registrada
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                          Nao criada
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-muted">{row.error ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'ink' | 'green' | 'brand' | 'red';
}) {
  const colorMap = {
    ink: 'text-ink',
    green: 'text-green-700',
    brand: 'text-brand',
    red: 'text-red-600',
  };

  return (
    <div className="rounded-md border border-line p-3">
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}
