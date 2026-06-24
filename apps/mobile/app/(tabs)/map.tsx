import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { LoadingScreen, Screen } from '@/components/ui';
import { useApiClient } from '@/api/client';
import { formatCurrency, getCollectionAmount, getTaskClientName } from '@/components/formatters';
import type { MobileTask } from '@/types/api';

// Haversine distance in km
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type TaskWithCoords = MobileTask & { _lat: number; _lon: number };

export default function MapScreen() {
  const { request } = useApiClient();
  const mapRef = useRef<MapView>(null);

  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, []),
  );

  async function load() {
    setLoading(true);
    try {
      const [data, locPerm] = await Promise.all([
        request<MobileTask[]>('/mobile/my-tasks'),
        Location.requestForegroundPermissionsAsync(),
      ]);
      setTasks(data);
      if (locPerm.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setMyLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingScreen message="Carregando mapa" />;

  // Separate tasks with and without coordinates
  const mapped = tasks.filter(
    (t) => t.client?.latitude && t.client?.longitude,
  ) as TaskWithCoords[];
  mapped.forEach((t) => {
    (t as any)._lat = t.client!.latitude!;
    (t as any)._lon = t.client!.longitude!;
  });

  // Sort by distance from current location
  const sorted = myLocation
    ? [...mapped].sort(
        (a, b) =>
          haversineKm(myLocation.lat, myLocation.lon, (a as any)._lat, (a as any)._lon) -
          haversineKm(myLocation.lat, myLocation.lon, (b as any)._lat, (b as any)._lon),
      )
    : mapped;

  const unmapped = tasks.filter((t) => !t.client?.latitude || !t.client?.longitude);

  const initialRegion =
    sorted.length > 0
      ? {
          latitude: (sorted[0] as any)._lat,
          longitude: (sorted[0] as any)._lon,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }
      : myLocation
        ? { latitude: myLocation.lat, longitude: myLocation.lon, latitudeDelta: 0.05, longitudeDelta: 0.05 }
        : { latitude: -23.55, longitude: -46.63, latitudeDelta: 0.1, longitudeDelta: 0.1 };

  function openNavigation(task: MobileTask) {
    const lat = task.client?.latitude;
    const lon = task.client?.longitude;
    if (!lat || !lon) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
    void Linking.openURL(url);
  }

  function focusMarker(task: MobileTask) {
    setSelectedId(task.id);
    const lat = task.client?.latitude;
    const lon = task.client?.longitude;
    if (lat && lon && mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude: lat, longitude: lon, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        400,
      );
    }
  }

  const selected = sorted.find((t) => t.id === selectedId) ?? null;

  return (
    <Screen padding={false}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={s.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {sorted.map((task, idx) => (
          <Marker
            key={task.id}
            coordinate={{ latitude: (task as any)._lat, longitude: (task as any)._lon }}
            title={getTaskClientName(task)}
            description={formatCurrency(getCollectionAmount(task))}
            pinColor={selectedId === task.id ? '#0f766e' : '#ef4444'}
            onPress={() => focusMarker(task)}
          >
            <View style={[s.pin, selectedId === task.id && s.pinSelected]}>
              <Text style={s.pinText}>{idx + 1}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Bottom sheet */}
      <View style={s.sheet}>
        {selected ? (
          <View style={s.selectedCard}>
            <View style={s.selectedTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.selectedName}>{getTaskClientName(selected)}</Text>
                <Text style={s.selectedMeta}>
                  {formatCurrency(getCollectionAmount(selected))} •{' '}
                  {selected.client?.neighborhood ?? selected.client?.city ?? ''}
                </Text>
              </View>
              <TouchableOpacity
                style={s.navBtn}
                onPress={() => openNavigation(selected)}
                activeOpacity={0.8}
              >
                <Text style={s.navBtnText}>Navegar</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setSelectedId(null)}>
              <Text style={s.deselectText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={s.list} contentContainerStyle={s.listContent}>
            <Text style={s.listTitle}>
              {sorted.length} tarefa(s) no mapa
              {myLocation ? ' • ordenadas por proximidade' : ''}
            </Text>
            {sorted.map((task, idx) => (
              <TouchableOpacity
                key={task.id}
                style={s.listItem}
                onPress={() => focusMarker(task)}
                activeOpacity={0.75}
              >
                <View style={s.listBadge}>
                  <Text style={s.listBadgeText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.listItemName}>{getTaskClientName(task)}</Text>
                  <Text style={s.listItemMeta}>
                    {formatCurrency(getCollectionAmount(task))}
                    {task.client?.neighborhood ? ` • ${task.client.neighborhood}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.miniNavBtn}
                  onPress={() => openNavigation(task)}
                  activeOpacity={0.8}
                >
                  <Text style={s.miniNavBtnText}>IR</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            {unmapped.length > 0 ? (
              <>
                <Text style={s.unmappedTitle}>{unmapped.length} sem localização cadastrada</Text>
                {unmapped.map((task) => (
                  <View key={task.id} style={[s.listItem, s.listItemDim]}>
                    <View style={[s.listBadge, s.listBadgeDim]}>
                      <Text style={s.listBadgeDimText}>—</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.listItemName}>{getTaskClientName(task)}</Text>
                      <Text style={s.listItemMeta}>{formatCurrency(getCollectionAmount(task))}</Text>
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  map: { flex: 1 },

  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSelected: { backgroundColor: '#0f766e', width: 34, height: 34, borderRadius: 17 },
  pinText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },

  sheet: {
    maxHeight: 280,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },

  selectedCard: { padding: 16, gap: 8 },
  selectedTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectedName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  selectedMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  navBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  deselectText: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },

  list: { flex: 1 },
  listContent: { padding: 12, gap: 6 },
  listTitle: { fontSize: 12, color: '#94a3b8', fontWeight: '700', marginBottom: 4 },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  listItemDim: { opacity: 0.5 },
  listBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listBadgeDim: { backgroundColor: '#cbd5e1' },
  listBadgeDimText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  listBadgeText: { color: '#ffffff', fontWeight: '800', fontSize: 11 },
  listItemName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  listItemMeta: { fontSize: 12, color: '#64748b' },
  miniNavBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  miniNavBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },

  unmappedTitle: { fontSize: 12, color: '#94a3b8', fontWeight: '700', marginTop: 8, marginBottom: 4 },
});
