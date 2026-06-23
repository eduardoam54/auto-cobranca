'use client';

import { DataState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { DataTable } from '@/components/table';
import { useApiData } from '@/lib/use-api-data';
import type { User } from '@/lib/types';

export default function UsersPage() {
  const { data, loading, error } = useApiData<User[]>('/users');

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Usuarios autorizados a acessar o painel."
      />
      {loading ? <DataState message="Carregando usuarios" /> : null}
      {error ? <DataState message={error} /> : null}
      {data ? (
        <DataTable
          columns={['Nome', 'Email', 'Perfil', 'Status ativo']}
          rows={data.map((user) => [
            user.name,
            user.email,
            user.role,
            <StatusPill key={user.id} value={user.active} />,
          ])}
          emptyMessage="Nenhum usuario encontrado."
        />
      ) : null}
    </>
  );
}
