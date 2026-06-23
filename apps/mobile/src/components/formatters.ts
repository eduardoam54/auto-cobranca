import type { MobileTask } from '@/types/api';

export function getTaskClientName(task: MobileTask) {
  return task.client?.name ?? 'Cliente nao informado';
}

export function getTaskAddress(task: MobileTask) {
  return task.address ?? task.client?.address ?? null;
}

export function getCollectionAmount(task: MobileTask) {
  return task.collection?.amount ?? null;
}

export function formatCurrency(value?: string | number | null) {
  if (value === undefined || value === null || value === '') {
    return 'Valor nao informado';
  }

  const numberValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return String(value);
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numberValue);
}

export function formatDate(value?: string | null) {
  if (!value) {
    return 'Nao informado';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
