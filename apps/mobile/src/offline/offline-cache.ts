import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MobileTask } from '@/types/api';

const KEY = '@auto-cobranca/tasks-cache';
const TTL_MS = 30 * 60 * 1000; // 30 minutes

type CacheEntry = {
  tasks: MobileTask[];
  savedAt: number;
};

export async function cacheTasks(tasks: MobileTask[]): Promise<void> {
  const entry: CacheEntry = { tasks, savedAt: Date.now() };
  await AsyncStorage.setItem(KEY, JSON.stringify(entry));
}

export async function getCachedTasks(): Promise<MobileTask[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.savedAt > TTL_MS) return null;
    return entry.tasks;
  } catch {
    return null;
  }
}

export async function invalidateCache(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
