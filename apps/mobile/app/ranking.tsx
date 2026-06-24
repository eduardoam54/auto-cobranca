import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LoadingScreen, Screen } from '@/components/ui';
import { useApiClient } from '@/api/client';
import { formatCurrency } from '@/components/formatters';
import { useAuth } from '@/auth/auth-context';

type Period = 'weekly' | 'monthly';

type RankingEntry = {
  position: number;
  id: string;
  name: string;
  total: number;
  visits: number;
};

export default function RankingScreen() {
  const { request } = useApiClient();
  const { me } = useAuth();
  const [period, setPeriod] = useState<Period>('weekly');
  const [data, setData] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: Period, refresh = false) => {
      setError(null);
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await request<RankingEntry[]>(`/mobile/ranking?period=${p}`);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar ranking.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [request],
  );

  useFocusEffect(
    useCallback(() => {
      void load(period);
    }, [load, period]),
  );

  function changePeriod(p: Period) {
    setPeriod(p);
    void load(p);
  }

  const myCollectorId = me?.collector.id;

  if (loading) return <LoadingScreen message="Carregando ranking" />;

  return (
    <Screen>
      {/* Period tabs */}
      <View style={s.tabs}>
        {(['weekly', 'monthly'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[s.tab, period === p && s.tabActive]}
            onPress={() => changePeriod(p)}
            activeOpacity={0.8}
          >
            <Text style={[s.tabText, period === p && s.tabTextActive]}>
              {p === 'weekly' ? 'Esta semana' : 'Este mês'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(period, true)} />
        }
      >
        {data.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>Nenhum dado de cobrança no período.</Text>
          </View>
        ) : (
          data.map((entry) => {
            const isMe = entry.id === myCollectorId;
            return (
              <View
                key={entry.id}
                style={[s.row, isMe && s.rowMe, entry.position <= 3 && s.rowTop]}
              >
                {/* Position badge */}
                <View style={[s.posBadge, entry.position === 1 && s.pos1, entry.position === 2 && s.pos2, entry.position === 3 && s.pos3]}>
                  <Text style={s.posText}>
                    {entry.position === 1 ? '🥇' : entry.position === 2 ? '🥈' : entry.position === 3 ? '🥉' : `#${entry.position}`}
                  </Text>
                </View>

                {/* Info */}
                <View style={s.info}>
                  <Text style={[s.name, isMe && s.nameMe]}>
                    {entry.name}{isMe ? ' (você)' : ''}
                  </Text>
                  <Text style={s.visits}>{entry.visits} visita(s) com pagamento</Text>
                </View>

                {/* Total */}
                <Text style={[s.total, isMe && s.totalMe]}>
                  {formatCurrency(entry.total)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingVertical: 9,
    alignItems: 'center',
  },
  tabActive: { borderColor: '#0f766e', backgroundColor: '#0f766e' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  tabTextActive: { color: '#ffffff' },

  errorBox: { borderRadius: 8, backgroundColor: '#fee2e2', padding: 12, marginBottom: 12 },
  errorText: { color: '#991b1b', fontWeight: '700' },

  content: { gap: 8, paddingBottom: 32 },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#94a3b8', fontSize: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 14,
  },
  rowMe: { borderColor: '#0f766e', backgroundColor: '#f0fdf9' },
  rowTop: { borderColor: '#fcd34d', backgroundColor: '#fffbeb' },

  posBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pos1: { backgroundColor: '#fef9c3' },
  pos2: { backgroundColor: '#f1f5f9' },
  pos3: { backgroundColor: '#fef3e2' },
  posText: { fontSize: 16, fontWeight: '800', color: '#334155' },

  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  nameMe: { color: '#0f766e' },
  visits: { fontSize: 12, color: '#64748b', marginTop: 2 },

  total: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  totalMe: { color: '#0f766e' },
});
