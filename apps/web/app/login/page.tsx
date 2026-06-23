'use client';

import { FormEvent, useState } from 'react';
import { apiRequest, ApiError } from '@/lib/api';
import { setToken, setUser } from '@/lib/auth';
import type { LoginResponse } from '@/lib/types';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        auth: false,
        body: {
          email,
          password,
        },
      });

      setToken(response.accessToken);
      setUser(response.user);
      window.location.assign('/dashboard');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Nao foi possivel entrar.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4">
      <section className="w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-ink">Auto Cobranca</h1>
          <p className="mt-1 text-sm text-muted">Acesse o painel</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="rounded-md border border-line bg-white p-5 shadow-sm"
        >
          <label className="block text-sm font-medium text-ink" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
            autoComplete="email"
            required
          />

          <label
            className="mt-4 block text-sm font-medium text-ink"
            htmlFor="password"
          >
            Senha
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
            autoComplete="current-password"
            required
          />

          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Entrando' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
