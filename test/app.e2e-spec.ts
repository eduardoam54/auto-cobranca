import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import request = require('supertest');
import type { App as SupertestApp } from 'supertest/types';
import { AppModule } from '../src/app.module';

type EntityWithId = {
  id: string;
};

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    companyId: string;
    email: string;
    role: string;
  };
};

type AiAnalyzeResponse = {
  intent: string;
  taskCreated: boolean;
  taskId: string | null;
};

describe('Auto-Cobranca API e2e', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: SupertestApp;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const adminEmail = `admin-e2e-${runId}@example.com`;
  const viewerEmail = `viewer-e2e-${runId}@example.com`;
  const collectorUserEmail = `collector-user-e2e-${runId}@example.com`;
  const password = 'Senha123!';

  let companyId: string;
  let adminToken: string;
  let viewerToken: string;
  let collectorToken: string;
  let collectorUserId: string;
  let clientId: string;
  let collectionId: string;
  let collectorId: string;
  let taskId: string;

  beforeAll(async () => {
    loadTestEnv();
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-test-secret';

    prisma = new PrismaClient();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    httpServer = app.getHttpServer();

    await cleanupTestData();
    await createBootstrapData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
    await app.close();
  });

  it('runs the full collection workflow and validates permissions', async () => {
    await request(httpServer).get('/api/health').expect(200).expect((res) => {
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('auto-cobranca-api');
    });

    const adminLogin = await request(httpServer)
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password,
      })
      .expect(201);
    const adminBody = adminLogin.body as LoginResponse;
    adminToken = adminBody.accessToken;
    expect(adminBody.user.companyId).toBe(companyId);
    expect(adminBody.user.role).toBe('admin');

    const viewerLogin = await request(httpServer)
      .post('/api/auth/login')
      .send({
        email: viewerEmail,
        password,
      })
      .expect(201);
    viewerToken = (viewerLogin.body as LoginResponse).accessToken;

    await request(httpServer).get('/api/clients').expect(401);

    await request(httpServer)
      .get('/api/clients')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual([]);
      });

    await request(httpServer)
      .post('/api/clients')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send(createClientPayload('viewer-denied'))
      .expect(403);

    const clientResponse = await request(httpServer)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(createClientPayload('main'))
      .expect(201);
    clientId = (clientResponse.body as EntityWithId).id;
    expect(clientResponse.body.companyId).toBe(companyId);

    const collectionResponse = await request(httpServer)
      .post('/api/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId,
        title: 'Parcela vencida e2e',
        description: 'Cobranca criada pelo teste e2e',
        amount: 150.75,
        dueDate: '2026-01-10T00:00:00.000Z',
        status: 'overdue',
      })
      .expect(201);
    collectionId = (collectionResponse.body as EntityWithId).id;
    expect(collectionResponse.body.status).toBe('overdue');
    expect(collectionResponse.body.companyId).toBe(companyId);

    const collectorResponse = await request(httpServer)
      .post('/api/collectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: collectorUserId,
        name: 'Cobrador E2E',
        phone: `1198${runId.slice(-6)}`,
        whatsappPhone: `551198${runId.slice(-6)}`,
        email: `collector-e2e-${runId}@example.com`,
        active: true,
      })
      .expect(201);
    collectorId = (collectorResponse.body as EntityWithId).id;
    expect(collectorResponse.body.companyId).toBe(companyId);
    expect(collectorResponse.body.userId).toBe(collectorUserId);

    const collectorLogin = await request(httpServer)
      .post('/api/auth/login')
      .send({
        email: collectorUserEmail,
        password,
      })
      .expect(201);
    collectorToken = (collectorLogin.body as LoginResponse).accessToken;

    const aiResponse = await request(httpServer)
      .post('/api/ai-collection-agent/analyze-message')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        phone: `5511999${runId.slice(-6)}`,
        messageContent: 'Pode passar aqui amanha depois das 18h que eu pago.',
      })
      .expect(201);
    const aiBody = aiResponse.body as AiAnalyzeResponse;
    expect(aiBody.intent).toBe('presencial_collection');
    expect(aiBody.taskCreated).toBe(true);
    expect(aiBody.taskId).toEqual(expect.any(String));
    taskId = aiBody.taskId as string;

    const tasksResponse = await request(httpServer)
      .get('/api/collection-tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (tasksResponse.body as Array<EntityWithId>).some(
        (task) => task.id === taskId,
      ),
    ).toBe(true);

    await request(httpServer)
      .patch(`/api/collection-tasks/${taskId}/assign-collector`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ collectorId })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('assigned');
        expect(res.body.collectorId).toBe(collectorId);
      });

    const collectorTasksResponse = await request(httpServer)
      .get(`/api/collectors/${collectorId}/tasks`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (collectorTasksResponse.body as Array<EntityWithId>).some(
        (task) => task.id === taskId,
      ),
    ).toBe(true);

    await request(httpServer)
      .get('/api/mobile/me')
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.user.id).toBe(collectorUserId);
        expect(res.body.user.passwordHash).toBeUndefined();
        expect(res.body.collector.id).toBe(collectorId);
      });

    const mobileTasksResponse = await request(httpServer)
      .get('/api/mobile/my-tasks')
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(200);
    expect(
      (mobileTasksResponse.body as Array<EntityWithId>).some(
        (task) => task.id === taskId,
      ),
    ).toBe(true);

    await request(httpServer)
      .patch(`/api/mobile/tasks/${taskId}/start`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('in_progress');
      });

    await request(httpServer)
      .patch(`/api/mobile/tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .send({
        result: 'paid',
        notes: 'Pagamento recebido no local.',
        paymentReceived: true,
        paymentAmount: 150.75,
        paymentMethod: 'cash',
        latitude: -14.123456,
        longitude: -41.123456,
        locationAccuracy: 25,
        visitedAt: '2026-06-21T00:00:00.000Z',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.task.status).toBe('completed');
        expect(res.body.visit.result).toBe('paid');
        expect(res.body.visit.collectorId).toBe(collectorId);
        expect(res.body.visit.latitude).toBe(-14.123456);
        expect(res.body.visit.longitude).toBe(-41.123456);
        expect(res.body.visit.locationAccuracy).toBe(25);
      });

    await request(httpServer)
      .post('/api/collection-visits')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        taskId,
        result: 'paid',
        notes: 'Cliente pagou a cobranca vencida.',
        paymentReceived: true,
        paymentAmount: 150.75,
        paymentMethod: 'pix',
        receiptUrl: 'https://example.com/receipt-e2e.pdf',
        visitedAt: '2026-06-15T12:00:00.000Z',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.companyId).toBe(companyId);
        expect(res.body.taskId).toBe(taskId);
        expect(res.body.result).toBe('paid');
      });

    const failTaskResponse = await request(httpServer)
      .post('/api/collection-tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId,
        collectionId,
        collectorId,
        title: 'Tentativa de visita sem sucesso',
        type: 'presencial_collection',
        priority: 'medium',
        status: 'assigned',
      })
      .expect(201);
    const failTaskId = (failTaskResponse.body as EntityWithId).id;

    await request(httpServer)
      .patch(`/api/mobile/tasks/${failTaskId}/fail`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .send({
        reason: 'Cliente nao estava em casa',
        latitude: -14.654321,
        longitude: -41.654321,
        locationAccuracy: 30,
        visitedAt: '2026-06-21T01:00:00.000Z',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('failed');
        expect(res.body.collectorId).toBe(collectorId);
        expect(res.body.visit.result).toBe('other');
        expect(res.body.visit.notes).toBe('Cliente nao estava em casa');
        expect(res.body.visit.latitude).toBe(-14.654321);
        expect(res.body.visit.longitude).toBe(-41.654321);
        expect(res.body.visit.locationAccuracy).toBe(30);
      });

    await request(httpServer)
      .get(`/api/collections/${collectionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('paid');
        expect(res.body.paymentMethod).toBe('pix');
      });

    await request(httpServer)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(createClientPayload('admin-allowed'))
      .expect(201)
      .expect((res) => {
        expect(res.body.companyId).toBe(companyId);
      });
  });

  async function createBootstrapData() {
    const passwordHash = await bcrypt.hash(password, 12);

    const company = await prisma.company.create({
      data: {
        name: `Empresa E2E ${runId}`,
        document: `E2E-COMPANY-${runId}`,
        phone: `1199${runId.slice(-6)}`,
        email: `company-e2e-${runId}@example.com`,
      },
    });
    companyId = company.id;

    const users = await prisma.user.createManyAndReturn({
      data: [
        {
          companyId,
          name: 'Admin E2E',
          email: adminEmail,
          passwordHash,
          role: 'admin',
          active: true,
        },
        {
          companyId,
          name: 'Viewer E2E',
          email: viewerEmail,
          passwordHash,
          role: 'viewer',
          active: true,
        },
        {
          companyId,
          name: 'Collector User E2E',
          email: collectorUserEmail,
          passwordHash,
          role: 'collector',
          active: true,
        },
      ],
    });

    const collectorUser = users.find((user) => user.email === collectorUserEmail);

    if (!collectorUser) {
      throw new Error('Usuario cobrador de teste nao foi criado.');
    }

    collectorUserId = collectorUser.id;
  }

  function createClientPayload(suffix: string) {
    const documentSuffix = `${suffix.slice(0, 8)}-${runId.slice(-12)}`;

    return {
      name: `Cliente E2E ${suffix}`,
      document: `E2E-CLIENT-${documentSuffix}`,
      phone: `11999${runId.slice(-6)}`,
      whatsappPhone: `5511999${runId.slice(-6)}`,
      email: `client-${suffix}-${runId}@example.com`,
      address: 'Rua de Teste, 123',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '01001000',
      notes: 'Cliente criado pelo teste e2e',
    };
  }

  async function cleanupTestData() {
    const companies = await prisma.company.findMany({
      where: {
        document: {
          startsWith: 'E2E-COMPANY-',
        },
      },
      select: {
        id: true,
      },
    });
    const companyIds = companies.map((company) => company.id);

    if (companyIds.length === 0) {
      return;
    }

    await prisma.systemEvent.deleteMany({
      where: {
        companyId: {
          in: companyIds,
        },
      },
    });
    await prisma.collectionVisit.deleteMany({
      where: {
        companyId: {
          in: companyIds,
        },
      },
    });
    await prisma.collectionTask.deleteMany({
      where: {
        companyId: {
          in: companyIds,
        },
      },
    });
    await prisma.message.deleteMany({
      where: {
        companyId: {
          in: companyIds,
        },
      },
    });
    await prisma.collection.deleteMany({
      where: {
        companyId: {
          in: companyIds,
        },
      },
    });
    await prisma.collector.deleteMany({
      where: {
        companyId: {
          in: companyIds,
        },
      },
    });
    await prisma.client.deleteMany({
      where: {
        companyId: {
          in: companyIds,
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        companyId: {
          in: companyIds,
        },
      },
    });
    await prisma.company.deleteMany({
      where: {
        id: {
          in: companyIds,
        },
      },
    });
  }

  function loadTestEnv() {
    const envTestPath = resolve(process.cwd(), '.env.test');

    if (!existsSync(envTestPath)) {
      return;
    }

    const entries = readFileSync(envTestPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    for (const entry of entries) {
      const separatorIndex = entry.indexOf('=');

      if (separatorIndex === -1) {
        continue;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^["']|["']$/g, '');

      process.env[key] = value;
    }
  }
});
