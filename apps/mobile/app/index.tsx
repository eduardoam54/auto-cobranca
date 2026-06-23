import { Redirect } from 'expo-router';
import { LoadingScreen } from '@/components/ui';
import { useAuth } from '@/auth/auth-context';

export default function IndexScreen() {
  const { initializing, token } = useAuth();

  if (initializing) {
    return <LoadingScreen message="Carregando app" />;
  }

  return <Redirect href={token ? '/tasks' : '/login'} />;
}
