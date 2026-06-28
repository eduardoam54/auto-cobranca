import { useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { enqueue } from '@/offline/offline-queue';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  /** If set and the request is queued offline, upload this photo URI after the action syncs */
  followUpPhotoUri?: string;
};

type TokenProvider = () => Promise<string | null> | string | null;
type UnauthorizedHandler = () => Promise<void> | void;
type RefreshHandler = () => Promise<string | null>;

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000/api';

let tokenProvider: TokenProvider = () => null;
let unauthorizedHandler: UnauthorizedHandler | null = null;
let refreshHandler: RefreshHandler | null = null;
let isRefreshing = false;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class OfflineQueuedError extends Error {
  constructor() {
    super('Ação salva! Será enviada ao servidor quando você se conectar.');
    this.name = 'OfflineQueuedError';
  }
}

export function setTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  unauthorizedHandler = handler;
}

export function setRefreshHandler(handler: RefreshHandler) {
  refreshHandler = handler;
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function isConnected(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

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
    throw new ApiError('Não foi possível enviar o arquivo.', 0);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET';

  // Mutating requests offline → enfileirar
  if (method !== 'GET' && options.auth !== false) {
    const online = await isConnected();
    if (!online) {
      await enqueue({
        path,
        method: method as 'POST' | 'PATCH' | 'DELETE',
        body: options.body,
        followUpPhotoUri: options.followUpPhotoUri,
      });
      throw new OfflineQueuedError();
    }
  }

  try {
    return await doRequest<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && options.auth !== false) {
      // Tenta renovar o token uma única vez
      if (!isRefreshing && refreshHandler) {
        isRefreshing = true;
        try {
          const newToken = await refreshHandler();
          if (newToken) {
            return doRequest<T>(path, options);
          }
        } finally {
          isRefreshing = false;
        }
      }
      // Refresh falhou ou já estava em andamento
      await unauthorizedHandler?.();
    }
    throw error;
  }
}

async function doRequest<T>(path: string, options: RequestOptions): Promise<T> {
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
    throw new ApiError('Não foi possível completar a requisição.', 0);
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

  // 401 é tratado no chamador (apiRequest), não aqui, para permitir retry
  if (status === 401 && shouldHandleUnauthorized) {
    // Lança como ApiError para o chamador interceptar
    const payload = error.response?.data;
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof (payload as Record<string, unknown>).message === 'string'
        ? (payload as Record<string, unknown>).message as string
        : 'Sessão expirada.';
    return new ApiError(message, 401);
  }

  const payload = error.response?.data;
  const message =
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    typeof (payload as Record<string, unknown>).message === 'string'
      ? (payload as Record<string, unknown>).message as string
      : 'Não foi possível completar a requisição.';

  return new ApiError(message, status);
}
