'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import NetInfo from '@react-native-community/netinfo';
import { syncOfflineQueue } from '@/offline/offline-sync';
import {
  apiRequest,
  setTokenProvider,
  setUnauthorizedHandler,
  setRefreshHandler,
} from '@/api/client';
import {
  clearAllTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredAccessToken,
  setStoredRefreshToken,
} from './auth-storage';
import type { LoginResponse, MobileMe } from '@/types/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const perms = (await Notifications.getPermissionsAsync()) as any;
    if (!perms.granted) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req = (await Notifications.requestPermissionsAsync()) as any;
      if (!req.granted) return;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await apiRequest('/mobile/push-token', {
      method: 'PATCH',
      body: { token: tokenData.data },
    });
  } catch {
    // Never block auth flow due to push token failure
  }
}

type AuthContextValue = {
  token: string | null;
  me: MobileMe | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MobileMe | null>(null);
  const [initializing, setInitializing] = useState(true);
  const tokenRef = useRef<string | null>(null);
  // Controle de bloqueio de biometria ao voltar do background
  const backgroundedAt = useRef<number | null>(null);
  const [biometricLocked, setBiometricLocked] = useState(false);

  const setAuthToken = useCallback((nextToken: string | null) => {
    tokenRef.current = nextToken;
    setToken(nextToken);
  }, []);

  const logout = useCallback(async () => {
    const refresh = await getStoredRefreshToken();
    if (refresh) {
      try {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: { refreshToken: refresh },
          auth: false,
        });
      } catch {
        // falha silenciosa — limpa localmente de qualquer forma
      }
    }
    await clearAllTokens();
    setAuthToken(null);
    setMe(null);
    router.replace('/login');
  }, [setAuthToken]);

  const reloadMe = useCallback(async () => {
    const profile = await apiRequest<MobileMe>('/mobile/me');
    setMe(profile);
  }, []);

  // Função de refresh chamada pelo api/client quando recebe 401
  const doRefresh = useCallback(async (): Promise<string | null> => {
    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await apiRequest<{ accessToken: string; refreshToken: string }>(
        '/auth/refresh',
        { method: 'POST', body: { refreshToken }, auth: false },
      );
      await setStoredAccessToken(res.accessToken);
      await setStoredRefreshToken(res.refreshToken);
      setAuthToken(res.accessToken);
      return res.accessToken;
    } catch {
      await logout();
      return null;
    }
  }, [setAuthToken, logout]);

  useEffect(() => {
    setTokenProvider(() => tokenRef.current);
    setUnauthorizedHandler(logout);
    setRefreshHandler(doRefresh);
  }, [logout, doRefresh]);

  // Auto-sync queue when connectivity is restored
  useEffect(() => {
    let wasOffline = false;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (wasOffline && online && tokenRef.current) {
        void syncOfflineQueue();
      }
      wasOffline = !online;
    });
    return unsubscribe;
  }, []);

  // Biometric lock: solicita biometria se app ficou em background por > 5 min
  useEffect(() => {
    const LOCK_AFTER_MS = 5 * 60 * 1000;

    function handleAppState(nextState: AppStateStatus) {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (nextState === 'active' && backgroundedAt.current) {
        const elapsed = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (elapsed > LOCK_AFTER_MS && tokenRef.current) {
          setBiometricLocked(true);
        }
      }
    }

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  // Autentica com biometria quando bloqueado
  useEffect(() => {
    if (!biometricLocked) return;

    async function authenticate() {
      const supported = await LocalAuthentication.hasHardwareAsync();
      if (!supported) {
        setBiometricLocked(false);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirme sua identidade para continuar',
        cancelLabel: 'Sair',
      });
      if (result.success) {
        setBiometricLocked(false);
      } else {
        await logout();
      }
    }

    void authenticate();
  }, [biometricLocked, logout]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const storedToken = await getStoredAccessToken();
        if (!active) return;

        if (!storedToken) {
          // Tenta renovar silenciosamente via refresh token persistido
          const refreshed = await doRefresh();
          if (!active) return;
          if (refreshed) {
            const profile = await apiRequest<MobileMe>('/mobile/me');
            if (active) {
              setMe(profile);
              void registerPushToken();
            }
          } else {
            setAuthToken(null);
          }
          return;
        }

        setAuthToken(storedToken);
        const profile = await apiRequest<MobileMe>('/mobile/me');
        if (active) {
          setMe(profile);
          void registerPushToken();
        }
      } catch {
        // Access token expirou — tenta refresh
        const refreshed = await doRefresh();
        if (!active) return;
        if (refreshed) {
          try {
            const profile = await apiRequest<MobileMe>('/mobile/me');
            if (active) setMe(profile);
          } catch {
            await clearAllTokens();
            if (active) { setAuthToken(null); setMe(null); }
          }
        } else {
          await clearAllTokens();
          if (active) { setAuthToken(null); setMe(null); }
        }
      } finally {
        if (active) setInitializing(false);
      }
    }

    void bootstrap();
    return () => { active = false; };
  }, [setAuthToken, doRefresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });

      await setStoredAccessToken(response.accessToken);
      if (response.refreshToken) {
        await setStoredRefreshToken(response.refreshToken);
      }
      setAuthToken(response.accessToken);
      const profile = await apiRequest<MobileMe>('/mobile/me');
      setMe(profile);
      void registerPushToken();
      router.replace('/tasks');
    },
    [setAuthToken],
  );

  const value = useMemo(
    () => ({ token, me, initializing, login, logout, reloadMe }),
    [initializing, login, logout, me, reloadMe, token],
  );

  if (biometricLocked) {
    return null; // tela em branco enquanto aguarda biometria
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth precisa estar dentro de AuthProvider.');
  return value;
}

export function useProtectedRoute() {
  const { initializing, token } = useAuth();
  useEffect(() => {
    if (!initializing && !token) router.replace('/login');
  }, [initializing, token]);
}
