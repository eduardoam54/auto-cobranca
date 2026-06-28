'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearToken, getToken } from '@/lib/auth';
import { apiRequest } from '@/lib/api';

const navigation = [
  { href: '/dashboard',          label: 'Dashboard' },
  { href: '/collections',        label: 'Cobranças' },
  { href: '/clients',            label: 'Clientes' },
  { href: '/collection-tasks',   label: 'Tarefas' },
  { href: '/collectors',         label: 'Cobradores' },
  { href: '/visits',             label: 'Visitas' },
  { href: '/ia',                 label: 'IA & Automação' },
  { href: '/reports',            label: 'Relatórios' },
  { href: '/messages',           label: 'Mensagens' },
  { href: '/imports',            label: 'Importar Tabela' },
  { href: '/users',              label: 'Usuários' },
  { href: '/messages/simulate',  label: 'Simular WhatsApp' },
];

type AuthenticatedShellProps = {
  children: React.ReactNode;
};

export function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }

    setReady(true);
  }, [router]);

  async function handleLogout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // mesmo se falhar, limpa localmente
    }
    clearToken();
    router.replace('/login');
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-panel px-4 text-sm text-muted">
        Carregando
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-panel">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white px-4 py-5 lg:block">
        <div className="mb-8">
          <p className="text-lg font-semibold text-ink">Auto Cobrança</p>
          <p className="mt-1 text-xs text-muted">Painel administrativo</p>
        </div>
        <nav className="space-y-1">
          {navigation.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? 'bg-teal-50 text-brand'
                    : 'text-muted hover:bg-panel hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="absolute bottom-5 left-4 right-4 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-panel"
        >
          Sair
        </button>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold text-ink">Auto Cobrança</p>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink"
            >
              Sair
            </button>
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
                  pathname === item.href
                    ? 'bg-teal-50 text-brand'
                    : 'bg-panel text-muted'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
