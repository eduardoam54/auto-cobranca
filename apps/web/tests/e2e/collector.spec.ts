import { expect, test } from '@playwright/test';

test.describe('PWA do cobrador', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.localStorage.clear()).catch(() => null);
  });

  test('login e tela de tarefas continuam funcionando', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'collector-token-e2e',
          user: { role: 'collector' },
        }),
      });
    });
    await page.route('**/mobile/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { role: 'collector' },
          collector: { id: 'collector-e2e' },
        }),
      });
    });
    await page.route('**/mobile/my-tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/collector/login');
    await expect(
      page.getByRole('heading', { name: 'Área do Cobrador' }),
    ).toBeVisible();

    await page.getByLabel('Email').fill('cobrador@teste.com');
    await page.getByLabel('Senha').fill('123456');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/collector\/tasks$/);
    await expect(page.getByText('Nenhuma tarefa atribuída')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Atualizar' })).toBeVisible();
  });

  test('detalhe da tarefa captura geolocalizacao', async ({ context, page }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: -14.123456,
      longitude: -41.123456,
      accuracy: 25,
    });
    await page.addInitScript(() => {
      window.localStorage.setItem('collectorAccessToken', 'collector-token-e2e');
    });
    await page.route('**/mobile/my-tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'task-geo',
            title: 'Visita com geolocalizacao',
            description: 'Teste de detalhe da PWA',
            status: 'assigned',
            address: 'Rua de Teste, 123',
            client: {
              name: 'Cliente Geo',
              phone: '11999999999',
              address: 'Rua de Teste, 123',
            },
            collection: {
              amount: 150.75,
              dueDate: '2026-06-21T00:00:00.000Z',
            },
          },
        ]),
      });
    });

    await page.goto('/collector/tasks/task-geo');

    await expect(page.getByRole('heading', { name: 'Cliente Geo' })).toBeVisible();
    await page.getByRole('button', { name: 'Obter localização' }).click();

    await expect(
      page.getByText('Localização capturada com sucesso'),
    ).toBeVisible();
    await expect(page.getByText('-14.123456')).toBeVisible();
    await expect(page.getByText('-41.123456')).toBeVisible();
    await expect(page.getByText('25')).toBeVisible();
  });
});
