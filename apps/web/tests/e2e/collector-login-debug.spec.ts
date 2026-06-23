import { expect, test } from '@playwright/test';

test('debug login do cobrador', async ({ page }) => {
  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('requestfailed', (request) => {
    requestFailures.push(
      `${request.method()} ${request.url()} - ${request.failure()?.errorText}`,
    );
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/collector/login');
  await page.evaluate(() => window.localStorage.clear());

  await expect(
    page.getByRole('heading', { name: /Area do Cobrador|Área do Cobrador/ }),
  ).toBeVisible();

  await page.getByLabel(/email/i).fill('cobrador@teste.com');
  await page.getByLabel(/senha/i).fill('123456');
  await page.getByRole('button', { name: /entrar/i }).click();

  try {
    await expect(page).toHaveURL(/\/collector\/tasks$/, { timeout: 15_000 });
  } catch (error) {
    const visibleText = await page.locator('body').innerText();
    throw new Error(
      [
        'Login do cobrador nao chegou em /collector/tasks.',
        '',
        'Mensagens visiveis na tela:',
        limit(visibleText, 3000),
        '',
        'Console errors:',
        consoleErrors.length ? consoleErrors.join('\n') : 'nenhum',
        '',
        'Requests failed:',
        requestFailures.length ? requestFailures.join('\n') : 'nenhum',
        '',
        error instanceof Error ? error.message : String(error),
      ].join('\n'),
    );
  }

  await expect(
    page.getByRole('heading', { name: /Minhas tarefas/i }),
  ).toBeVisible();
});

function limit(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
