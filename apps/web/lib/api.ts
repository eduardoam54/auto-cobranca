import { clearToken, getToken, setToken } from './auth';

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
};

// Garante que só uma requisição de refresh ocorre por vez,
// e que todas as requests em espera reutilizam o mesmo resultado.
let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const res = await fetch(`${apiUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        clearToken();
        return false;
      }

      const data = (await res.json()) as { accessToken: string };
      setToken(data.accessToken);
      return true;
    } catch {
      clearToken();
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await doRequest(path, options);

  if (response.status === 401 && options.auth !== false) {
    const refreshed = await tryRefresh();
    if (!refreshed) {
      window.location.assign('/login');
      throw new ApiError('Sessão expirada.', 401);
    }
    return handleResponse<T>(await doRequest(path, options));
  }

  return handleResponse<T>(response);
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : 'Não foi possível completar a requisição.';
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

async function doRequest(
  path: string,
  options: RequestOptions,
): Promise<Response> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (options.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(`${apiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}
