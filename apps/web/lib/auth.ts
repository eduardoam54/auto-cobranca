import type { LoginResponse } from './types';

export const tokenStorageKey = 'accessToken';
export const userStorageKey = 'authUser';

export function getToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    window.localStorage.getItem(tokenStorageKey) ??
    window.localStorage.getItem('auto-cobranca-token')
  );
}

export function setToken(token: string) {
  window.localStorage.setItem(tokenStorageKey, token);
  window.localStorage.removeItem('auto-cobranca-token');
}

export function setUser(user: LoginResponse['user']) {
  window.localStorage.setItem(userStorageKey, JSON.stringify(user));
}

export function clearToken() {
  window.localStorage.removeItem(tokenStorageKey);
  window.localStorage.removeItem(userStorageKey);
  window.localStorage.removeItem('auto-cobranca-token');
}
