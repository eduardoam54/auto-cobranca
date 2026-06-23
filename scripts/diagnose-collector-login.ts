type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type HttpResult = {
  ok: boolean;
  status: number;
  url: string;
  contentType: string;
  text: string;
  data: unknown;
  error?: string;
};

const backendBaseUrl =
  process.env.DIAG_BACKEND_URL ?? 'http://localhost:3000/api';
const frontendBaseUrl =
  process.env.DIAG_FRONTEND_URL ?? 'http://localhost:3001';
const collectorEmail =
  process.env.DIAG_COLLECTOR_EMAIL ?? 'cobrador@teste.com';
const collectorPassword = process.env.DIAG_COLLECTOR_PASSWORD ?? '123456';

async function main() {
  printTitle('Diagnostico do login do cobrador');
  printLine(`Backend: ${backendBaseUrl}`);
  printLine(`Frontend: ${frontendBaseUrl}`);
  printLine(`Usuario: ${collectorEmail}`);

  const backendHealth = await runCheck('1. Backend health', async () => {
    const result = await request('GET', `${backendBaseUrl}/health`);
    printStatus(result);
    if (result.status === 200) {
      printOk('OK: backend respondeu health com status 200');
    } else {
      printError('ERRO: backend health nao respondeu status 200');
      printBody(result);
    }
    return result;
  });

  let backendToken: string | null = null;
  const backendLogin = await runCheck('2. Login direto no backend', async () => {
    const result = await request('POST', `${backendBaseUrl}/auth/login`, {
      email: collectorEmail,
      password: collectorPassword,
    });
    printStatus(result);
    printField('accessToken', getAccessToken(result.data) ? 'sim' : 'nao');
    printUserFields(result.data);

    backendToken = getAccessToken(result.data);

    if (!result.ok || !backendToken) {
      printError('Mensagem provavel: Usuario nao existe, senha incorreta ou usuario inativo');
      printBody(result);
    }

    return result;
  });

  const backendMe = await runCheck('3. /mobile/me direto no backend', async () => {
    if (!backendToken) {
      printError('PULADO: login direto nao retornou token');
      return skipped(`${backendBaseUrl}/mobile/me`);
    }

    const result = await request(
      'GET',
      `${backendBaseUrl}/mobile/me`,
      undefined,
      backendToken,
    );
    printStatus(result);
    printField('user.email', getPath(result.data, ['user', 'email']));
    printField('user.role', getPath(result.data, ['user', 'role']));
    printField('collector.id', getPath(result.data, ['collector', 'id']));
    printField('collector.name', getPath(result.data, ['collector', 'name']));

    if (!result.ok) {
      printError('Mensagem provavel: Usuario nao tem role collector ou nao esta vinculado a um Collector');
      printBody(result);
    }

    return result;
  });

  const backendTasks = await runCheck('4. /mobile/my-tasks direto no backend', async () => {
    if (!backendToken) {
      printError('PULADO: login direto nao retornou token');
      return skipped(`${backendBaseUrl}/mobile/my-tasks`);
    }

    const result = await request(
      'GET',
      `${backendBaseUrl}/mobile/my-tasks`,
      undefined,
      backendToken,
    );
    printStatus(result);
    const count = getTasksCount(result.data);
    printField('quantidade de tarefas', count ?? 'nao foi possivel contar');
    if (result.ok && count === 0) {
      printWarn('Login esta funcionando, mas cobrador nao tem tarefas atribuidas');
    }
    if (!result.ok) {
      printBody(result);
    }
    return result;
  });

  const frontendHealth = await runCheck('5. Frontend health basico', async () => {
    const result = await request('GET', `${frontendBaseUrl}/login`);
    printStatus(result);
    if (result.ok && isHtml(result)) {
      printOk('OK: frontend respondeu HTML');
    } else {
      printError('ERRO: /login nao respondeu HTML corretamente');
      printBody(result);
    }
    return result;
  });

  const collectorLoginPage = await runCheck('6. Rota /collector/login', async () => {
    const result = await request('GET', `${frontendBaseUrl}/collector/login`);
    printStatus(result);
    if (result.status === 404) {
      printError('Rota /collector/login nao existe ou foi criada no local errado');
      printBody(result);
    } else if (result.ok && isHtml(result)) {
      printOk('OK: /collector/login respondeu HTML');
    } else {
      printError('ERRO: /collector/login nao respondeu como esperado');
      printBody(result);
    }
    return result;
  });

  let proxyToken: string | null = null;
  const proxyLogin = await runCheck('7. Proxy Next de login', async () => {
    const result = await request(
      'POST',
      `${frontendBaseUrl}/api/backend/auth/login`,
      {
        email: collectorEmail,
        password: collectorPassword,
      },
    );
    printStatus(result);
    proxyToken = getAccessToken(result.data);
    printField('accessToken', proxyToken ? 'sim' : 'nao');
    if (!result.ok || !proxyToken) {
      printBody(result);
    }
    return result;
  });

  const proxyMe = await runCheck('8. Proxy Next de /mobile/me', async () => {
    const token = proxyToken ?? backendToken;
    if (!token) {
      printError('PULADO: nenhum token disponivel');
      return skipped(`${frontendBaseUrl}/api/backend/mobile/me`);
    }

    const result = await request(
      'GET',
      `${frontendBaseUrl}/api/backend/mobile/me`,
      undefined,
      token,
    );
    printStatus(result);
    printField('user.role', getPath(result.data, ['user', 'role']));
    printField('collector.id', getPath(result.data, ['collector', 'id']));
    if (!result.ok) {
      printBody(result);
    }
    return result;
  });

  printTitle('9. Diagnostico final');
  const diagnosis = buildDiagnosis({
    backendHealth,
    backendLogin,
    backendMe,
    backendTasks,
    frontendHealth,
    collectorLoginPage,
    proxyLogin,
    proxyMe,
    backendToken,
    proxyToken,
  });
  printLine(diagnosis);
}

async function runCheck(
  title: string,
  check: () => Promise<HttpResult>,
): Promise<HttpResult> {
  printTitle(title);
  try {
    return await check();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printError(`ERRO inesperado: ${message}`);
    return {
      ok: false,
      status: 0,
      url: title,
      contentType: '',
      text: '',
      data: null,
      error: message,
    };
  }
}

async function request(
  method: string,
  url: string,
  body?: JsonValue,
  token?: string,
): Promise<HttpResult> {
  const headers = new Headers();
  headers.set('Accept', 'application/json, text/html, text/plain, */*');
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      url,
      contentType: response.headers.get('content-type') ?? '',
      text,
      data: parseBody(text),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      contentType: '',
      text: '',
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function skipped(url: string): HttpResult {
  return {
    ok: false,
    status: 0,
    url,
    contentType: '',
    text: '',
    data: null,
    error: 'Skipped',
  };
}

function parseBody(text: string): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getAccessToken(data: unknown): string | null {
  const token = getPath(data, ['accessToken']) ?? getPath(data, ['access_token']);
  return typeof token === 'string' && token.length > 0 ? token : null;
}

function getPath(data: unknown, path: string[]): unknown {
  let current = data;
  for (const key of path) {
    if (!isRecord(current) || !(key in current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function printUserFields(data: unknown) {
  const user = isRecord(data) && isRecord(data.user) ? data.user : data;
  printField('user.email', getPath(user, ['email']));
  printField('user.role', getPath(user, ['role']));
  printField('user.active', getPath(user, ['active']));
  printField('user.companyId', getPath(user, ['companyId']));
}

function getTasksCount(data: unknown): number | null {
  if (Array.isArray(data)) {
    return data.length;
  }
  if (isRecord(data) && Array.isArray(data.tasks)) {
    return data.tasks.length;
  }
  return null;
}

function isHtml(result: HttpResult): boolean {
  return (
    result.contentType.includes('text/html') ||
    result.text.trimStart().toLowerCase().startsWith('<!doctype html') ||
    result.text.includes('<html')
  );
}

function buildDiagnosis(input: {
  backendHealth: HttpResult;
  backendLogin: HttpResult;
  backendMe: HttpResult;
  backendTasks: HttpResult;
  frontendHealth: HttpResult;
  collectorLoginPage: HttpResult;
  proxyLogin: HttpResult;
  proxyMe: HttpResult;
  backendToken: string | null;
  proxyToken: string | null;
}) {
  if (!input.backendHealth.ok) {
    return 'Backend nao respondeu /api/health. Verifique se o NestJS esta rodando na porta 3000.';
  }
  if (!input.backendLogin.ok || !input.backendToken) {
    return 'Problema no usuario/senha/status active';
  }
  if (!input.backendMe.ok) {
    return 'Problema no vinculo User collector -> Collector ou role errada';
  }
  if (!input.frontendHealth.ok) {
    return 'Frontend Next nao respondeu /login. Verifique se o Next esta rodando na porta 3001.';
  }
  if (input.collectorLoginPage.status === 404) {
    return 'Rota /collector/login nao existe ou foi criada no local errado';
  }
  if (!input.proxyLogin.ok || !input.proxyToken) {
    return 'Problema no proxy Next /api/backend';
  }
  if (!input.proxyMe.ok) {
    return 'Problema no proxy Next /api/backend';
  }
  if (!input.collectorLoginPage.ok) {
    return 'Problema no frontend da tela /collector/login';
  }
  if (input.backendTasks.ok && getTasksCount(input.backendTasks.data) === 0) {
    return 'Backend, vinculo, proxy e rotas estao funcionando. O cobrador entrou, mas nao tem tarefas atribuidas.';
  }
  return 'Backend, vinculo, proxy e rotas estao funcionando. O problema pode estar no navegador/cache do celular.';
}

function printTitle(title: string) {
  console.log(`\n=== ${title} ===`);
}

function printLine(message: string) {
  console.log(message);
}

function printOk(message: string) {
  console.log(`OK: ${message}`);
}

function printWarn(message: string) {
  console.log(`AVISO: ${message}`);
}

function printError(message: string) {
  console.log(`ERRO: ${message}`);
}

function printStatus(result: HttpResult) {
  const suffix = result.error ? ` (${result.error})` : '';
  console.log(`HTTP ${result.status} - ${result.url}${suffix}`);
}

function printField(label: string, value: unknown) {
  console.log(`${label}: ${formatValue(value)}`);
}

function printBody(result: HttpResult) {
  if (result.error) {
    printField('erro', result.error);
  }
  if (result.text) {
    printField('body', limit(result.text, 2000));
  }
}

function formatValue(value: unknown): string {
  if (value === undefined) {
    return 'nao informado';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

function limit(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
