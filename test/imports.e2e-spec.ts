import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request = require('supertest');
import type { App as SupertestApp } from 'supertest/types';
import { buildTestApp, cleanupByPrefix, loginAs } from './e2e-helpers';

const DOC_PREFIX = 'IMP-E2E-';

describe('POST /imports/sync e2e', () => {
  let app: INestApplication;
  let http: SupertestApp;
  let prisma: PrismaClient;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const password = 'Senha123!';

  let adminToken: string;
  let companyId: string;
  let collectorId: string;

  beforeAll(async () => {
    ({ app, http, prisma } = await buildTestApp());
    await cleanupByPrefix(prisma, DOC_PREFIX);
    await seed();
  });

  afterAll(async () => {
    await cleanupByPrefix(prisma, DOC_PREFIX);
    await prisma.$disconnect();
    await app.close();
  });

  // ── Criação básica ──────────────────────────────────────────────────────────

  it('cria clientes e cobranças a partir de linhas válidas', async () => {
    const rows = [
      { clientName: `IMPORTADO A ${runId}`, issueDate: '2026-01-01', dueDate: '2026-02-01', amount: 100 },
      { clientName: `IMPORTADO B ${runId}`, issueDate: null, dueDate: '2026-03-15', amount: 250.50 },
    ];

    const res = await request(http)
      .post('/api/imports/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(201);

    expect(res.body.total).toBe(2);
    expect(res.body.collectionsCreated).toBe(2);
    expect(res.body.errors).toBe(0);

    // At least one new client was created
    expect(res.body.clientsCreated + res.body.clientsFound).toBe(2);
  });

  // ── Deduplicação ────────────────────────────────────────────────────────────

  it('pula cobrança duplicada com mesmo valor e data de vencimento', async () => {
    const row = {
      clientName: `DUPLICADO ${runId}`,
      issueDate: '2026-01-10',
      dueDate: '2026-04-01',
      amount: 300,
    };

    // First sync — creates the record
    await request(http)
      .post('/api/imports/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows: [row] })
      .expect(201);

    // Second sync with same data — must deduplicate
    const res = await request(http)
      .post('/api/imports/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows: [row] })
      .expect(201);

    expect(res.body.collectionsCreated).toBe(0);
    expect(res.body.errors).toBe(1);
    expect(res.body.rows[0].error).toContain('ja existe');
  });

  it('encontra cliente existente em vez de criar duplicata', async () => {
    const clientName = `CLIENTE EXISTENTE ${runId}`;

    // Sync once to create the client
    await request(http)
      .post('/api/imports/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows: [{ clientName, issueDate: null, dueDate: '2026-05-01', amount: 400 }] })
      .expect(201);

    // Sync again with same client, different debt
    const res = await request(http)
      .post('/api/imports/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows: [{ clientName, issueDate: null, dueDate: '2026-06-01', amount: 500 }] })
      .expect(201);

    expect(res.body.clientsFound).toBe(1);
    expect(res.body.clientsCreated).toBe(0);
    expect(res.body.collectionsCreated).toBe(1);
  });

  // ── Com collectorId ─────────────────────────────────────────────────────────

  it('cria tarefas atribuídas quando collectorId é fornecido', async () => {
    const rows = [
      { clientName: `ATRIBUIDO A ${runId}`, issueDate: null, dueDate: '2026-07-01', amount: 150 },
      { clientName: `ATRIBUIDO B ${runId}`, issueDate: null, dueDate: '2026-07-15', amount: 200 },
    ];

    const res = await request(http)
      .post('/api/imports/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows, collectorId })
      .expect(201);

    expect(res.body.tasksCreated).toBe(2);
    expect(res.body.collectionsCreated).toBe(2);

    // Verify tasks exist in the database with correct collectorId
    const tasks = await prisma.collectionTask.findMany({
      where: { companyId, collectorId, deletedAt: null, status: 'assigned' },
    });
    expect(tasks.length).toBeGreaterThanOrEqual(2);
  });

  it('não cria tarefas quando collectorId não é fornecido', async () => {
    const res = await request(http)
      .post('/api/imports/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows: [{ clientName: `SEM COBRADOR ${runId}`, issueDate: null, dueDate: '2026-08-01', amount: 99 }] })
      .expect(201);

    expect(res.body.tasksCreated).toBe(0);
    expect(res.body.collectionsCreated).toBe(1);
  });

  // ── Validação de entrada ────────────────────────────────────────────────────

  it('retorna 400 quando rows está vazio', async () => {
    await request(http)
      .post('/api/imports/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows: [] })
      .expect(400);
  });

  it('retorna 400 quando body não tem rows', async () => {
    await request(http)
      .post('/api/imports/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });

  it('retorna 401 sem autenticação', async () => {
    await request(http)
      .post('/api/imports/sync')
      .send({ rows: [{ clientName: 'X', issueDate: null, dueDate: '2026-01-01', amount: 1 }] })
      .expect(401);
  });

  // ── Linha inválida dentro do lote ───────────────────────────────────────────

  it('registra erro para linha sem dueDate e continua o restante', async () => {
    const rows = [
      { clientName: `SEM VENCIMENTO ${runId}`, issueDate: null, dueDate: null, amount: 100 },
      { clientName: `VALIDO FINAL ${runId}`, issueDate: null, dueDate: '2026-09-01', amount: 175 },
    ];

    const res = await request(http)
      .post('/api/imports/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(201);

    expect(res.body.total).toBe(2);
    expect(res.body.errors).toBe(1);
    expect(res.body.collectionsCreated).toBe(1);

    const errorRow = res.body.rows.find((r: { error?: string }) => r.error);
    expect(errorRow.error).toContain('Vencimento ou valor ausente');
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  async function seed() {
    const passwordHash = await bcrypt.hash(password, 12);

    const company = await prisma.company.create({
      data: {
        name: `Empresa Imports E2E ${runId}`,
        document: `${DOC_PREFIX}${runId}`,
        phone: `119800${runId.slice(-5)}`,
        email: `imp-e2e-${runId}@example.com`,
      },
    });
    companyId = company.id;

    const adminUser = await prisma.user.create({
      data: {
        companyId,
        name: 'Admin Imports E2E',
        email: `admin-imp-${runId}@example.com`,
        passwordHash,
        role: 'admin',
        active: true,
      },
    });

    const collectorUser = await prisma.user.create({
      data: {
        companyId,
        name: 'Cobrador Imports E2E',
        email: `cob-imp-${runId}@example.com`,
        passwordHash,
        role: 'collector',
        active: true,
      },
    });

    const collector = await prisma.collector.create({
      data: {
        companyId,
        userId: collectorUser.id,
        name: 'Cobrador Imports E2E',
        phone: `119600${runId.slice(-5)}`,
        email: `cob-ent-imp-${runId}@example.com`,
        active: true,
      },
    });
    collectorId = collector.id;

    adminToken = await loginAs(http, adminUser.email, password);
  }
});
