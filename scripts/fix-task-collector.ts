import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const collectorId = 'cmqol3ypv0003vlec17jwg3wo';

  // Reatribui todas as tarefas 'assigned' criadas pelo seed para o cobrador correto
  const updated = await p.collectionTask.updateMany({
    where: { status: 'assigned', collectorId: { not: collectorId } },
    data: { collectorId },
  });

  console.log(`${updated.count} tarefa(s) reatribuída(s) para Cobrador Teste`);
}
main().finally(() => p.$disconnect());
