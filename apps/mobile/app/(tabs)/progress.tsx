import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppButton, LoadingScreen, Screen } from '@/components/ui';
import { TouchableOpacity } from 'react-native';
import { useApiClient } from '@/api/client';
import { formatCurrency } from '@/components/formatters';

type ProgressData = {
  pending: number;
  completedToday: number;
  failedToday: number;
  visitedToday: number;
  totalCollectedToday: number;
};

const DAILY_GOAL = 2000;

export default function ProgressScreen() {
  const { request } = useApiClient();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = useCallback(
    async (refresh = false) => {
      setError(null);
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await request<ProgressData>('/mobile/my-progress');
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar progresso.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [request],
  );

  useFocusEffect(
    useCallback(() => {
      void loadProgress();
    }, [loadProgress]),
  );

  if (loading) return <LoadingScreen message="Carregando progresso" />;

  const collected = data?.totalCollectedToday ?? 0;
  const progressPct = Math.min((collected / DAILY_GOAL) * 100, 100);
  const totalVisits = data?.visitedToday ?? 0;
  const successRate =
    totalVisits > 0 ? Math.round(((data?.completedToday ?? 0) / totalVisits) * 100) : 0;

  const motivational =
    successRate >= 80
      ? 'Excelente! Continue assim!'
      : successRate >= 50
        ? 'Bom trabalho! Voce pode mais!'
        : totalVisits === 0
          ? 'Bora comecar o dia!'
          : 'Nao desista, cada visita conta!';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadProgress(true)} />
        }
      >
        {error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
            <AppButton label="Tentar novamente" onPress={() => loadProgress()} />
          </View>
        ) : null}

        {/* Arrecadação card */}
        <View style={s.mainCard}>
          <Text style={s.mainLabel}>Arrecadado hoje</Text>
          <Text style={s.mainValue}>{formatCurrency(collected)}</Text>
          <Text style={s.goalText}>Meta diária: {formatCurrency(DAILY_GOAL)}</Text>
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${progressPct}%` as any }]} />
          </View>
          <Text style={s.pctText}>{Math.round(progressPct)}% da meta</Text>
        </View>

        {/* Mini stats */}
        <View style={s.statsRow}>
          <StatCard
            label="Pendentes"
            value={data?.pending ?? 0}
            color="#92400e"
            bg="#fef3c7"
          />
          <StatCard
            label="Concluidas"
            value={data?.completedToday ?? 0}
            color="#166534"
            bg="#dcfce7"
          />
          <StatCard
            label="Falhas"
            value={data?.failedToday ?? 0}
            color="#991b1b"
            bg="#fee2e2"
          />
        </View>

        {/* Motivacional */}
        <View style={s.motivCard}>
          <Text style={s.motivText}>{motivational}</Text>
        </View>

        {/* Quick links */}
        <View style={s.linksRow}>
          <TouchableOpacity
            style={s.linkBtn}
            onPress={() => router.push('/ranking')}
            activeOpacity={0.8}
          >
            <Text style={s.linkBtnText}>Ver ranking</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.linkBtn}
            onPress={() => router.push('/daily-report')}
            activeOpacity={0.8}
          >
            <Text style={s.linkBtnText}>Fechamento do dia</Text>
          </TouchableOpacity>
        </View>

        <AppButton
          label="Ver tarefas"
          variant="ghost"
          onPress={() => router.replace('/tasks')}
        />
      </ScrollView>
    </Screen>
  );
}

function StatCard({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <View style={[s.statCard, { backgroundColor: bg }]}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={[s.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  content: { gap: 16, paddingBottom: 32 },

  errorBox: {
    gap: 10,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    padding: 12,
  },
  errorText: { color: '#991b1b', fontWeight: '700' },

  mainCard: {
    borderRadius: 12,
    backgroundColor: '#0f766e',
    padding: 20,
    gap: 6,
  },
  mainLabel: { color: '#99f6e4', fontSize: 13, fontWeight: '700' },
  mainValue: { color: '#ffffff', fontSize: 36, fontWeight: '800' },
  goalText: { color: '#99f6e4', fontSize: 13 },

  barBg: {
    marginTop: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  pctText: { color: '#ccfbf1', fontSize: 12, fontWeight: '700', marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '700' },

  motivCard: {
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 16,
    alignItems: 'center',
  },
  motivText: {
    color: '#166534',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  linksRow: { flexDirection: 'row', gap: 8 },
  linkBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0f766e',
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkBtnText: { color: '#0f766e', fontWeight: '700', fontSize: 13 },
});
