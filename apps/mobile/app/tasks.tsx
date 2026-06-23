'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { AppButton, EmptyState, LoadingScreen, Screen } from '@/components/ui';
import { useApiClient } from '@/api/client';
import { useAuth, useProtectedRoute } from '@/auth/auth-context';
import type { MobileTask } from '@/types/api';
import {
  formatCurrency,
  formatDate,
  getCollectionAmount,
  getTaskAddress,
  getTaskClientName,
} from '@/components/formatters';

const NO_NEIGHBORHOOD = '__sem_bairro__';

export default function TasksScreen() {
  useProtectedRoute();

  const { request } = useApiClient();
  const { me, logout } = useAuth();
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);

  const loadTasks = useCallback(
    async (refresh = false) => {
      setError(null);
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const data = await request<MobileTask[]>('/mobile/my-tasks');
        setTasks(data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Nao foi possivel carregar as tarefas.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [request],
  );

  useFocusEffect(
    useCallback(() => {
      void loadTasks();
    }, [loadTasks]),
  );

  // Build sorted list of unique neighborhoods from all tasks
  const neighborhoods = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      const n = task.client?.neighborhood?.trim() || NO_NEIGHBORHOOD;
      counts[n] = (counts[n] ?? 0) + 1;
    }
    const named = Object.entries(counts)
      .filter(([key]) => key !== NO_NEIGHBORHOOD)
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
    const noNeighborhood = counts[NO_NEIGHBORHOOD]
      ? [[NO_NEIGHBORHOOD, counts[NO_NEIGHBORHOOD]] as [string, number]]
      : [];
    return [...named, ...noNeighborhood];
  }, [tasks]);

  // Filter tasks by selected neighborhood
  const filteredTasks = useMemo(() => {
    if (!selectedNeighborhood) return tasks;
    return tasks.filter((task) => {
      const n = task.client?.neighborhood?.trim() || NO_NEIGHBORHOOD;
      return n === selectedNeighborhood;
    });
  }, [tasks, selectedNeighborhood]);

  const hasNeighborhoodFilter = neighborhoods.length > 1;

  if (loading) {
    return <LoadingScreen message="Carregando tarefas" />;
  }

  const activeCount = selectedNeighborhood
    ? filteredTasks.length
    : tasks.length;

  return (
    <Screen>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerText}>
          <Text style={s.greeting}>Ola, {me?.user.name ?? 'cobrador'}</Text>
          <Text style={s.summary}>
            {activeCount} tarefa(s){selectedNeighborhood && selectedNeighborhood !== NO_NEIGHBORHOOD
              ? ` em ${selectedNeighborhood}`
              : selectedNeighborhood === NO_NEIGHBORHOOD
              ? ' sem bairro'
              : ' em aberto'}
          </Text>
        </View>
        <AppButton label="Sair" variant="ghost" compact onPress={logout} />
      </View>

      {/* Error */}
      {error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
          <AppButton label="Tentar novamente" onPress={() => loadTasks()} />
        </View>
      ) : null}

      {/* Neighborhood filter chips */}
      {hasNeighborhoodFilter ? (
        <View style={s.filterWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterScroll}
          >
            {/* "Todos" chip */}
            <TouchableOpacity
              onPress={() => setSelectedNeighborhood(null)}
              style={[
                s.chip,
                !selectedNeighborhood && s.chipActive,
              ]}
            >
              <Text
                style={[
                  s.chipText,
                  !selectedNeighborhood && s.chipTextActive,
                ]}
              >
                Todos ({tasks.length})
              </Text>
            </TouchableOpacity>

            {/* One chip per neighborhood */}
            {neighborhoods.map(([name, count]) => {
              const active = selectedNeighborhood === name;
              const label = name === NO_NEIGHBORHOOD ? 'Sem bairro' : name;
              return (
                <TouchableOpacity
                  key={name}
                  onPress={() =>
                    setSelectedNeighborhood(active ? null : name)
                  }
                  style={[s.chip, active && s.chipActive]}
                >
                  <Text
                    style={[s.chipText, active && s.chipTextActive]}
                  >
                    {label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Task list */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          filteredTasks.length === 0 ? s.emptyList : s.list
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTasks(true)}
          />
        }
        ListEmptyComponent={
          <EmptyState
            message={
              selectedNeighborhood
                ? 'Nenhuma tarefa neste bairro.'
                : 'Nenhuma tarefa atribuida no momento.'
            }
          />
        }
        renderItem={({ item }) => (
          <Link
            href={{ pathname: '/tasks/[id]', params: { id: item.id } }}
            asChild
          >
            <TouchableOpacity style={s.taskCard} activeOpacity={0.78}>
              <View style={s.taskTop}>
                <Text style={s.clientName}>{getTaskClientName(item)}</Text>
                <StatusBadge status={item.status} />
              </View>

              <Text style={s.amount}>
                {formatCurrency(getCollectionAmount(item))}
              </Text>

              <Text style={s.meta}>
                Vencimento: {formatDate(item.collection?.dueDate)}
              </Text>

              {/* Neighborhood + address row */}
              <View style={s.locationRow}>
                {item.client?.neighborhood ? (
                  <View style={s.neighborhoodBadge}>
                    <Text style={s.neighborhoodBadgeText}>
                      {item.client.neighborhood}
                    </Text>
                  </View>
                ) : null}
                {getTaskAddress(item) ? (
                  <Text style={s.address} numberOfLines={1}>
                    {getTaskAddress(item)}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          </Link>
        )}
      />
    </Screen>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    assigned:    { bg: '#ecfeff', text: '#0f766e' },
    in_progress: { bg: '#fef3c7', text: '#92400e' },
    completed:   { bg: '#dcfce7', text: '#166534' },
    failed:      { bg: '#fee2e2', text: '#991b1b' },
  };
  const colors = colorMap[status] ?? { bg: '#f1f5f9', text: '#475569' };
  return (
    <View style={[s.statusBadge, { backgroundColor: colors.bg }]}>
      <Text style={[s.statusBadgeText, { color: colors.text }]}>{status}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  headerText: { flex: 1 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  summary: { marginTop: 4, color: '#475569', fontSize: 14 },

  errorBox: {
    gap: 10,
    marginBottom: 14,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    padding: 12,
  },
  errorText: { color: '#991b1b', fontWeight: '700' },

  // Filter chips
  filterWrapper: { marginBottom: 12 },
  filterScroll: { gap: 8, paddingRight: 4 },
  chip: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: {
    borderColor: '#0f766e',
    backgroundColor: '#0f766e',
  },
  chipText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  chipTextActive: { color: '#ffffff' },

  // List
  list: { gap: 12, paddingBottom: 28 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },

  // Task card
  taskCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe3ea',
    backgroundColor: '#ffffff',
    padding: 16,
  },
  taskTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  clientName: { flex: 1, color: '#0f172a', fontSize: 17, fontWeight: '800' },
  statusBadge: {
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '800' },
  amount: { marginTop: 10, color: '#111827', fontSize: 18, fontWeight: '800' },
  meta: { marginTop: 6, color: '#475569', fontSize: 14 },

  // Location row
  locationRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  neighborhoodBadge: {
    borderRadius: 4,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  neighborhoodBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  address: { flex: 1, color: '#334155', fontSize: 13 },
});
