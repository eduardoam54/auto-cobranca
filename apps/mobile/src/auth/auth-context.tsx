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
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import { syncOfflineQueue } from '@/offline/offline-sync';
import {
  apiRequest,
  setTokenProvider,
  setUnauthorizedHandler,
} from '@/api/client';
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  setStoredAccessToken,
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

  const setAuthToken = useCallback((nextToken: string | null) => {
    tokenRef.current = nextToken;
    setToken(nextToken);
  }, []);

  const logout = useCallback(async () => {
    await clearStoredAccessToken();
    setAuthToken(null);
    setMe(null);
    router.replace('/login');
  }, [setAuthToken]);

  const reloadMe = useCallback(async () => {
    const profile = await apiRequest<MobileMe>('/mobile/me');
    setMe(profile);
  }, []);

  useEffect(() => {
    setTokenProvider(() => tokenRef.current);
    setUnauthorizedHandler(logout);
  }, [logout]);

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

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const storedToken = await getStoredAccessToken();
        if (!active) {
          return;
        }

        if (!storedToken) {
          setAuthToken(null);
          return;
        }

        setAuthToken(storedToken);
        const profile = await apiRequest<MobileMe>('/mobile/me');
        if (active) {
          setMe(profile);
          void registerPushToken();
        }
      } catch {
        await clearStoredAccessToken();
        if (active) {
          setAuthToken(null);
          setMe(null);
        }
      } finally {
        if (active) {
          setInitializing(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [setAuthToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });

      await setStoredAccessToken(response.accessToken);
      setAuthToken(response.accessToken);
      const profile = await apiRequest<MobileMe>('/mobile/me');
      setMe(profile);
      void registerPushToken();
      router.replace('/tasks');
    },
    [setAuthToken],
  );

  const value = useMemo(
    () => ({
      token,
      me,
      initializing,
      login,
      logout,
      reloadMe,
    }),
    [initializing, login, logout, me, reloadMe, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth precisa estar dentro de AuthProvider.');
  }

  return value;
}

export function useProtectedRoute() {
  const { initializing, token } = useAuth();

  useEffect(() => {
    if (!initializing && !token) {
      router.replace('/login');
    }
  }, [initializing, token]);
}
