import { useCallback, useState } from 'react';
import {
  Linking,
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

type VisitEntry = {
  id: string;
  clientName: string;
  result: string;
  paymentReceived: boolean;
  paymentAmount: number | null;
  paymentMethod: string | null;
  notes: string | null;
  visitedAt: string;
};

type DailyReport = {
  date: string;
  visitCount: number;
  totalCollected: number;
  kmEstimated: number;
  visits: VisitEntry[];
};

const RESULT_LABELS: Record<string, string> = {
  paid: 'Pago',
  partial_paid: 'Parcial',
  promised_payment: 'Prometeu pagar',
  not_home: 'Ausente',
  refused_payment: 'Recusou',
  rescheduled: 'Reagendado',
  wrong_address: 'End. errado',
  other: 'Outro',
};

const RESULT_COLORS: Record<string, string> = {
  paid: '#166534',
  partial_paid: '#0f766e',
  promised_payment: '#92400e',
  not_home: '#374151',
  refused_payment: '#991b1b',
  rescheduled: '#1e40af',
  wrong_address: '#7c2d12',
  other: '#374151',
};

export default function DailyReportScreen() {
  const { request } = useApiClient();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      setError(null);
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await request<DailyReport>('/mobile/daily-report');
        setReport(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar relatório.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [request],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function shareOnWhatsApp() {
    if (!report) return;
    const dateLabel = new Date(report.date + 'T12:00:00').toLocaleDateString('pt-BR');
    const lines = [
      `📊 *Relatório do dia — ${dateLabel}*`,
      ``,
      `💰 Total arrecadado: *${formatCurrency(report.totalCollected)}*`,
      `🏠 Visitas realizadas: *${report.visitCount}*`,
      `📍 Distância estimada: *${report.kmEstimated} km*`,
      ``,
      `*Detalhe das visitas:*`,
      ...report.visits.map(
        (v) =>
          `• ${v.clientName}: ${RESULT_LABELS[v.result] ?? v.result}${v.paymentAmount ? ` — ${formatCurrency(v.paymentAmount)}` : ''}`,
      ),
    ];
    const text = lines.join('\n');
    void Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() =>
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`),
    );
  }

  if (loading) return <LoadingScreen message="Carregando relatório" />;

  const dateLabel = report
    ? new Date(report.date + 'T12:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      })
    : '';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {report ? (
          <>
            <Text style={s.dateLabel}>{dateLabel}</Text>

            {/* Summary cards */}
            <View style={s.summaryRow}>
              <SummaryCard label="Arrecadado" value={formatCurrency(report.totalCollected)} color="#0f766e" />
              <SummaryCard label="Visitas" value={String(report.visitCount)} color="#1e40af" />
              <SummaryCard label="Km estimado" value={`${report.kmEstimated} km`} color="#6d28d9" />
            </View>

            {/* Share button */}
            <TouchableOpacity style={s.shareBtn} onPress={shareOnWhatsApp} activeOpacity={0.8}>
              <Text style={s.shareBtnText}>Compartilhar via WhatsApp</Text>
            </TouchableOpacity>

            {/* Visit list */}
            {report.visits.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>Nenhuma visita registrada hoje.</Text>
              </View>
            ) : (
              <View style={s.visitList}>
                <Text style={s.sectionTitle}>Visitas do dia</Text>
                {report.visits.map((v) => {
                  const color = RESULT_COLORS[v.result] ?? '#374151';
                  const time = new Date(v.visitedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <View key={v.id} style={s.visitCard}>
                      <View style={s.visitTop}>
                        <Text style={s.visitClient}>{v.clientName}</Text>
                        <Text style={s.visitTime}>{time}</Text>
                      </View>
                      <Text style={[s.visitResult, { color }]}>
                        {RESULT_LABELS[v.result] ?? v.result}
                      </Text>
                      {v.paymentAmount ? (
                        <Text style={s.visitAmount}>{formatCurrency(v.paymentAmount)}</Text>
                      ) : null}
                      {v.notes ? <Text style={s.visitNotes}>{v.notes}</Text> : null}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[s.summaryCard, { borderColor: color }]}>
      <Text style={[s.summaryValue, { color }]}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  content: { gap: 14, paddingBottom: 32 },

  errorBox: { borderRadius: 8, backgroundColor: '#fee2e2', padding: 12 },
  errorText: { color: '#991b1b', fontWeight: '700' },

  dateLabel: { fontSize: 16, fontWeight: '800', color: '#0f172a', textTransform: 'capitalize' },

  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: '#ffffff',
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: { fontSize: 16, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: '#64748b', fontWeight: '700' },

  shareBtn: {
    borderRadius: 8,
    backgroundColor: '#25d366',
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },

  empty: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { color: '#94a3b8', fontSize: 14 },

  visitList: { gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },

  visitCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 3,
  },
  visitTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visitClient: { fontSize: 14, fontWeight: '800', color: '#0f172a', flex: 1 },
  visitTime: { fontSize: 12, color: '#94a3b8' },
  visitResult: { fontSize: 13, fontWeight: '700' },
  visitAmount: { fontSize: 14, fontWeight: '800', color: '#166534' },
  visitNotes: { fontSize: 12, color: '#64748b', fontStyle: 'italic' },
});
