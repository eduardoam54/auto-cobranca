import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AuthProvider } from '@/auth/auth-context';

async function checkForUpdate() {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // em desenvolvimento ou sem conexão — ignora silenciosamente
  }
}

export default function RootLayout() {
  useEffect(() => {
    void checkForUpdate();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#0f172a',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#f8fafc' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="tasks/[id]" options={{ title: 'Detalhe da tarefa' }} />
        <Stack.Screen name="ranking" options={{ title: 'Ranking' }} />
      </Stack>
    </AuthProvider>
  );
}
