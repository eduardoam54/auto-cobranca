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
import { router } from 'expo-router';
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
