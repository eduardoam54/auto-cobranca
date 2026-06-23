import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const collectors = await p.collector.findMany({
    where: { deletedAt: null },
    include: { user: { select: { name: true, email: true } } },
  });
  collectors.forEach((c) =>
    console.log(`${c.id} | cobrador: ${c.name} | user: ${c.user?.name} <${c.user?.email}>`),
  );
}
main().finally(() => p.$disconnect());
