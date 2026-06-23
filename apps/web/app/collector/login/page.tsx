'use client';

import { FormEvent, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const tokenKey = 'collectorAccessToken';

type LoginResponse = {
  accessToken: string;
};

type CollectorProfile = {
  user: {
    role: string;
  };
};

export default function CollectorLoginPage() {
  const [email, setEmail] = useState('cobrador@teste.com');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const loginResponse = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!loginResponse.ok) {
        throw new Error('login_failed');
      }

      const login = (await loginResponse.json()) as LoginResponse;
      window.localStorage.setItem(tokenKey, login.accessToken);

      const profileResponse = await fetch(`${apiUrl}/mobile/me`, {
        headers: {
          Authorization: `Bearer ${login.accessToken}`,
        },
      });

      if (!profileResponse.ok) {
        throw new Error('profile_failed');
      }

      const profile = (await profileResponse.json()) as CollectorProfile;

      if (profile.user.role !== 'collector') {
        window.localStorage.removeItem(tokenKey);
        setError('Usuário não é cobrador');
        return;
      }

      window.location.assign('/collector/tasks');
    } catch {
      window.localStorage.removeItem(tokenKey);
      setError('Não foi possível entrar como cobrador');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4 py-6">
      <section className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-ink">Área do Cobrador</h1>
          <p className="mt-2 text-sm text-muted">
            Acesse suas tarefas de cobrança pelo celular.
          </p>
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
            className="mt-2 min-h-12 w-full rounded-md border border-line px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
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
            className="mt-2 min-h-12 w-full rounded-md border border-line px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
            autoComplete="current-password"
            required
          />

          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-brand px-4 text-base font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
