import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { AppButton, FormField } from '@/components/ui';
import { useAuth } from '@/auth/auth-context';

export default function LoginScreen() {
  const { initializing, login, token } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!initializing && token) {
    return <Redirect href="/tasks" />;
  }

  async function handleLogin() {
    setError(null);

    if (!email.trim() || !password) {
      setError('Informe email e senha.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Nao foi possivel entrar.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>Auto Cobranca</Text>
        <Text style={styles.title}>App do cobrador</Text>
        <Text style={styles.subtitle}>
          Acesse suas tarefas de visita e registre o resultado da cobranca.
        </Text>

        <View style={styles.form}>
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <FormField
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <AppButton
            label="Entrar"
            loading={submitting}
            onPress={handleLogin}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe3ea',
    backgroundColor: '#ffffff',
    padding: 20,
  },
  brand: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f766e',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
  },
  form: {
    gap: 14,
    marginTop: 24,
  },
  error: {
    borderRadius: 6,
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: 10,
    fontWeight: '600',
  },
});
