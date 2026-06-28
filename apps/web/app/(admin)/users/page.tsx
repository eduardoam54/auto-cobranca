'use client';

import { DataState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { SearchInput } from '@/components/search-input';
import { StatusPill } from '@/components/status-pill';
import { DataTable } from '@/components/table';
import { usePaginatedData } from '@/lib/use-paginated-data';
import type { User } from '@/lib/types';

export default function UsersPage() {
  const { items, meta, loading, error, setPage, search, setSearch } =
    usePaginatedData<User>('/users');

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Usuarios autorizados a acessar o painel."
      />
      <div className="my-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome ou email..."
        />
      </div>
      {loading ? <DataState message="Carregando usuarios" /> : null}
      {error ? <DataState message={error} /> : null}
      {!loading && !error ? (
        <>
          <DataTable
            columns={['Nome', 'Email', 'Perfil', 'Status ativo']}
            rows={items.map((user) => [
              user.name,
              user.email,
              user.role,
              <StatusPill key={user.id} value={user.active} />,
            ])}
            emptyMessage="Nenhum usuario encontrado."
          />
          <Pagination meta={meta} onPageChange={setPage} />
        </>
      ) : null}
    </>
  );
}
