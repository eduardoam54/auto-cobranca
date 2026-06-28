import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { document: '12345678000100' },
    update: {},
    create: {
      name: 'Empresa Teste',
      document: '12345678000100',
      phone: '11999999999',
      email: 'empresa@teste.com',
    },
  });

  const hash = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@teste.com' },
    update: {},
    create: {
      companyId: company.id,
      name: 'Admin Teste',
      email: 'admin@teste.com',
      passwordHash: hash,
      role: 'admin',
      active: true,
    },
  });

  const cobradorUser = await prisma.user.upsert({
    where: { email: 'cobrador@teste.com' },
    update: {},
    create: {
      companyId: company.id,
      name: 'Cobrador Teste',
      email: 'cobrador@teste.com',
      passwordHash: hash,
      role: 'collector',
      active: true,
    },
  });

  await prisma.collector.upsert({
    where: { companyId_email: { companyId: company.id, email: 'cobrador@teste.com' } },
    update: { userId: cobradorUser.id },
    create: {
      companyId: company.id,
      userId: cobradorUser.id,
      name: 'Cobrador Teste',
      phone: '11988888888',
      email: 'cobrador@teste.com',
      active: true,
    },
  });

  console.log('Seed concluido:', { company: company.name, admin: admin.email, cobrador: cobradorUser.email });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
