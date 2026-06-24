import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import request = require('supertest');
import type { App as SupertestApp } from 'supertest/types';
import { AppModule } from '../src/app.module';

export type E2eApp = {
  app: INestApplication;
  http: SupertestApp;
  prisma: PrismaClient;
};

export function loadTestEnv() {
  const path = resolve(process.cwd(), '.env.test');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const sep = trimmed.indexOf('=');
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    const value = trimmed.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = value;
  }
}

export async function buildTestApp(): Promise<E2eApp> {
  loadTestEnv();
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-test-secret';

  const prisma = new PrismaClient();

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  return { app, http: app.getHttpServer(), prisma };
}

export async function loginAs(
  http: SupertestApp,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(http)
    .post('/api/auth/login')
    .send({ email, password });
  return (res.body as { accessToken: string }).accessToken;
}

/**
 * Deletes all data created during a test run.
 * Uses the company document prefix to identify test data.
 */
export async function cleanupByPrefix(prisma: PrismaClient, prefix: string) {
  const companies = await prisma.company.findMany({
    where: { document: { startsWith: prefix } },
    select: { id: true },
  });
  const ids = companies.map((c) => c.id);
  if (!ids.length) return;

  await prisma.systemEvent.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.collectionVisit.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.collectionTask.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.message.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.collection.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.collector.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.client.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.user.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.company.deleteMany({ where: { id: { in: ids } } });
}
