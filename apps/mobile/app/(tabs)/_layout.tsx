import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiFocused]}>{emoji}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#0f172a',
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Minhas tarefas',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📋" label="Tarefas" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Mapa do dia',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🗺️" label="Mapa" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Meu progresso',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📊" label="Progresso" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="daily-report"
        options={{
          title: 'Fechamento do dia',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📝" label="Relatório" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabEmoji: {
    fontSize: 22,
    opacity: 0.45,
  },
  tabEmojiFocused: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tabLabelFocused: {
    color: '#0f766e',
  },
});
