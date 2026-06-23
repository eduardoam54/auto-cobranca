import { expect, type Page, test } from '@playwright/test';

const adminUser = {
  email: 'admin@teste.com',
  password: '123456',
};

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => window.localStorage.clear());
});

test('login com sucesso', async ({ page }) => {
  await login(page);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('login invalido', async ({ page }) => {
  await page.getByLabel('Email').fill(`erro-${Date.now()}@teste.com`);
  await page.getByLabel('Senha').fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.locator('form').locator('.text-red-700')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('dashboard mostra cards de resumo', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Total de clientes')).toBeVisible();
  await expect(page.getByText('Valor em aberto')).toBeVisible();
  await expect(page.getByText('Tarefas pendentes')).toBeVisible();
});

test('clientes permite cadastrar cliente unico', async ({ page }) => {
  await login(page);
  const suffix = uniqueSuffix();
  const client = await createClient(page, suffix);
  const clientRow = page.getByRole('row').filter({ hasText: client.name });

  await expect(clientRow).toBeVisible();
  await expect(clientRow).toContainText(client.phone);
});

test('cobrancas permite cadastrar cobranca para cliente', async ({ page }) => {
  await login(page);
  const suffix = uniqueSuffix();
  const client = await createClient(page, suffix);
  const collectionTitle = `Cobranca E2E ${suffix}`;

  await page.goto('/collections');
  await expect(page.getByRole('heading', { name: 'Cobrancas' })).toBeVisible();
  await page.getByRole('button', { name: 'Nova Cobranca' }).click();
  await page.getByLabel('Cliente').selectOption({ label: client.name });
  await page.getByLabel('Titulo').fill(collectionTitle);
  await page.getByLabel('Valor').fill('150.75');
  await page.getByLabel('Vencimento').fill(futureDate());
  await page.getByLabel('Status').selectOption('pending');
  await page.getByLabel('Forma de pagamento').selectOption('pix');
  await page.getByRole('button', { name: 'Cadastrar cobranca' }).click();
  const collectionRow = page
    .getByRole('row')
    .filter({ hasText: collectionTitle });

  await expect(page.getByText('Cobranca cadastrada com sucesso.')).toBeVisible();
  await expect(collectionRow).toBeVisible();
  await expect(collectionRow).toContainText('pix');
});

test('cobradores permite cadastrar cobrador unico', async ({ page }) => {
  await login(page);
  const suffix = uniqueSuffix();
  const collectorName = `Cobrador E2E ${suffix}`;
  const collectorPhone = uniquePhone(suffix);

  await page.goto('/collectors');
  await expect(page.getByRole('heading', { name: 'Cobradores' })).toBeVisible();
  await page.getByRole('button', { name: 'Novo Cobrador' }).click();
  await page.getByLabel('Nome').fill(collectorName);
  await page.getByLabel('Telefone').fill(collectorPhone);
  await page.getByLabel('WhatsApp').fill(`55${collectorPhone}`);
  await page.getByLabel('Email').fill(`cobrador-${suffix}@teste.com`);
  await page.getByRole('button', { name: 'Cadastrar cobrador' }).click();
  const collectorRow = page.getByRole('row').filter({ hasText: collectorName });

  await expect(page.getByText('Cobrador cadastrado com sucesso.')).toBeVisible();
  await expect(collectorRow).toBeVisible();
  await expect(collectorRow).toContainText(collectorPhone);
});

test('simular WhatsApp aciona IA e mostra resultado', async ({ page }) => {
  await login(page);
  const suffix = uniqueSuffix();
  const client = await createClient(page, suffix);
  await createCollection(page, client.name, `Cobranca IA E2E ${suffix}`);

  await page.goto('/messages/simulate');
  await expect(page.getByRole('heading', { name: 'Simular WhatsApp' })).toBeVisible();
  await page.getByLabel('Cliente').selectOption({ label: `${client.name} - ${client.whatsappPhone}` });
  await page
    .getByLabel('Mensagem')
    .fill('Pode passar aqui amanhã depois das 18h que eu pago');
  await page.getByRole('button', { name: 'Analisar com IA' }).click();

  await expect(page.getByText('Resultado da IA')).toBeVisible();
  await expect(page.getByText('Cliente identificado')).toBeVisible();
  await expect(page.getByText('Intencao')).toBeVisible();
  await expect(page.getByText('Acao recomendada')).toBeVisible();
  await expect(page.getByText('Tarefa criada', { exact: true })).toBeVisible();
  await expect(
    page.getByText(/created|duplicate_pending_task|conditions_not_met/).first(),
  ).toBeVisible();
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(adminUser.email);
  await page.getByLabel('Senha').fill(adminUser.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/dashboard$/);
}

async function createClient(page: Page, suffix: string) {
  const client = {
    name: `Cliente E2E ${suffix}`,
    document: `DOC-${suffix}`,
    phone: uniquePhone(suffix),
    whatsappPhone: `55${uniquePhone(suffix)}`,
  };

  await page.goto('/clients');
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
  await page.getByRole('button', { name: 'Novo Cliente' }).click();
  await page.getByLabel('Nome').fill(client.name);
  await page.getByLabel('Documento').fill(client.document);
  await page.getByLabel('Telefone').fill(client.phone);
  await page.getByLabel('WhatsApp').fill(client.whatsappPhone);
  await page.getByRole('button', { name: 'Cadastrar cliente' }).click();
  await expect(page.getByText('Cliente cadastrado com sucesso.')).toBeVisible();

  return client;
}

async function createCollection(page: Page, clientName: string, title: string) {
  await page.goto('/collections');
  await expect(page.getByRole('heading', { name: 'Cobrancas' })).toBeVisible();
  await page.getByRole('button', { name: 'Nova Cobranca' }).click();
  await page.getByLabel('Cliente').selectOption({ label: clientName });
  await page.getByLabel('Titulo').fill(title);
  await page.getByLabel('Valor').fill('200');
  await page.getByLabel('Vencimento').fill(futureDate());
  await page.getByLabel('Status').selectOption('pending');
  await page.getByLabel('Forma de pagamento').selectOption('pix');
  await page.getByRole('button', { name: 'Cadastrar cobranca' }).click();
  await expect(page.getByText('Cobranca cadastrada com sucesso.')).toBeVisible();
}

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function uniquePhone(suffix: string) {
  const digits = suffix.replace(/\D/g, '').slice(-8).padStart(8, '0');
  return `119${digits}`;
}

function futureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}
