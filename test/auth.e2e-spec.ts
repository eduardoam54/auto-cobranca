import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import request = require('supertest');
import type { App as SupertestApp } from 'supertest/types';
import { AppModule } from '../src/app.module';

type LoginResponse = {
  accessToken: string;
  user: {
    email: string;
  };
};

describe('Auth JWT e2e', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: SupertestApp;

  const adminEmail = 'admin@teste.com';
  const adminPassword = '123456';

  beforeAll(async () => {
    loadTestEnv();
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-test-secret';

    prisma = new PrismaClient();
    await ensureAdminUser();

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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('logs in successfully and returns a JWT access token', async () => {
    const response = await request(httpServer)
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password: adminPassword,
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const body = response.body as LoginResponse;
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.user.email).toBe(adminEmail);
  });

  it('rejects invalid login credentials', async () => {
    await request(httpServer)
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password: 'senhaerrada',
      })
      .expect(401);
  });

  it('rejects protected routes without a bearer token', async () => {
    await request(httpServer).get('/api/clients').expect(401);
  });

  it('allows protected routes with a valid bearer token', async () => {
    const loginResponse = await request(httpServer)
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password: adminPassword,
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const { accessToken } = loginResponse.body as LoginResponse;

    await request(httpServer)
      .get('/api/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  async function ensureAdminUser() {
    const company = await prisma.company.upsert({
      where: {
        document: 'TESTE-AUTH-E2E',
      },
      update: {
        deletedAt: null,
      },
      create: {
        name: 'Empresa Teste Auth E2E',
        document: 'TESTE-AUTH-E2E',
        phone: '11999999999',
        email: 'empresa-auth-e2e@teste.com',
      },
    });

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const existingAdmin = await prisma.user.findUnique({
      where: {
        email: adminEmail,
      },
    });

    if (existingAdmin) {
      await prisma.user.update({
        where: {
          id: existingAdmin.id,
        },
        data: {
          companyId: company.id,
          passwordHash,
          role: 'admin',
          active: true,
          deletedAt: null,
        },
      });

      return;
    }

    await prisma.user.create({
      data: {
        companyId: company.id,
        name: 'Admin Teste',
        email: adminEmail,
        passwordHash,
        role: 'admin',
        active: true,
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
