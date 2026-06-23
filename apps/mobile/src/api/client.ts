import { useCallback } from 'react';
import axios, { AxiosError } from 'axios';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
};

type TokenProvider = () => Promise<string | null> | string | null;
type UnauthorizedHandler = () => Promise<void> | void;

export const API_URL = 'http://192.168.1.3:3000/api';

let tokenProvider: TokenProvider = () => null;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function setTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  unauthorizedHandler = handler;
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function apiUpload(path: string, formData: FormData): Promise<void> {
  const token = await tokenProvider();
  const headers: Record<string, string> = {
    'Content-Type': 'multipart/form-data',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    await api.post(path, formData, { headers });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw await toApiError(error, true);
    }
    throw new ApiError('Nao foi possivel enviar o arquivo.', 0);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.auth !== false) {
    const token = await tokenProvider();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  try {
    const response = await api.request<T>({
      url: path,
      method: options.method ?? 'GET',
      headers,
      data: options.body,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw await toApiError(error, options.auth !== false);
    }

    throw new ApiError('Nao foi possivel completar a requisicao.', 0);
  }
}

export function useApiClient() {
  const request = useCallback(
    <T,>(path: string, options?: RequestOptions) =>
      apiRequest<T>(path, options),
    [],
  );

  const upload = useCallback(
    (path: string, formData: FormData) => apiUpload(path, formData),
    [],
  );

  return { request, upload };
}

async function toApiError(error: AxiosError, shouldHandleUnauthorized: boolean) {
  const status = error.response?.status ?? 0;

  if (status === 401 && shouldHandleUnauthorized) {
    await unauthorizedHandler?.();
  }

  const payload = error.response?.data;
  const message =
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    typeof payload.message === 'string'
      ? payload.message
      : 'Nao foi possivel completar a requisicao.';

  return new ApiError(message, status);
}
