import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Buscando empresa e cobrador existentes...');

  const company = await prisma.company.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  if (!company) {
    console.error('Nenhuma empresa encontrada no banco. Crie uma empresa primeiro.');
    process.exit(1);
  }

  const collector = await prisma.collector.findFirst({
    where: { companyId: company.id, active: true, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  if (!collector) {
    console.error('Nenhum cobrador encontrado para a empresa. Crie um cobrador primeiro.');
    process.exit(1);
  }

  console.log(`Empresa: ${company.name} (${company.id})`);
  console.log(`Cobrador: ${collector.name} (${collector.id})`);

  // Cria cliente de teste
  const document = `00000000${Date.now().toString().slice(-3)}`;
  const client = await prisma.client.upsert({
    where: { companyId_document: { companyId: company.id, document } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Joao da Silva (Teste)',
      document,
      phone: '11999990001',
      whatsappPhone: '11999990001',
      address: 'Rua das Flores, 123 - Centro',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '01310-100',
      notes: 'Cliente de teste criado pelo seed.',
    },
  });

  console.log(`Cliente: ${client.name} (${client.id})`);

  // Cria cobrança vencida
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() - 10);

  const collection = await prisma.collection.create({
    data: {
      companyId: company.id,
      clientId: client.id,
      title: 'Fatura de teste - vencida',
      description: 'Cobranca criada pelo script de seed para teste do app mobile.',
      amount: 850.0,
      dueDate,
      status: 'overdue',
    },
  });

  console.log(`Cobranca: ${collection.title} - R$ ${collection.amount} (${collection.id})`);

  // Cria tarefa atribuída ao cobrador
  const task = await prisma.collectionTask.create({
    data: {
      companyId: company.id,
      clientId: client.id,
      collectionId: collection.id,
      collectorId: collector.id,
      title: 'Coleta presencial - Teste',
      description: 'Tarefa de teste criada pelo seed. Teste o fluxo de concluir com pagamento e captura de foto.',
      type: 'presencial_collection',
      priority: 'high',
      status: 'assigned',
      address: client.address,
    },
  });

  console.log(`Tarefa: ${task.title} - status: ${task.status} (${task.id})`);
  console.log('\nPronto! Atualize a lista de tarefas no app para ver a tarefa.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
