export const PT_LABELS: Record<string, string> = {
  // Status de cobranças
  pending: 'Pendente',
  overdue: 'Vencida',
  paid: 'Pago',
  canceled: 'Cancelada',
  renegotiated: 'Renegociada',

  // Status de tarefas
  assigned: 'Atribuída',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  failed: 'Falha',

  // Resultado de visitas
  partial_paid: 'Parcial',
  promised_payment: 'Promessa',
  not_home: 'Ausente',
  refused_payment: 'Recusou',
  rescheduled: 'Reagendado',
  wrong_address: 'End. errado',
  other: 'Outro',

  // Prioridades
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',

  // Tipos de tarefa
  presencial_collection: 'Visita presencial',
  whatsapp_followup: 'Acompanhamento WhatsApp',
  phone_call: 'Ligação',
  payment_confirmation: 'Confirmação de pagamento',
  renegotiation_followup: 'Acompanhamento de renegociação',

  // Formas de pagamento
  cash: 'Dinheiro',
  pix: 'Pix',
  bank_slip: 'Boleto',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',

  // Intenções IA
  payment_promise: 'Promessa de pagamento',
  payment_refusal: 'Recusa de pagamento',
  payment_question: 'Dúvida sobre pagamento',
  schedule_visit: 'Agendar visita',
  address_update: 'Atualização de endereço',
  general_inquiry: 'Dúvida geral',
  complaint: 'Reclamação',
  negotiation: 'Negociação',
};

export function toLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return PT_LABELS[value] ?? value.replaceAll('_', ' ');
}
