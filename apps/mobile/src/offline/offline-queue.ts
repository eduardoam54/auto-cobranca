import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@auto-cobranca/offline-queue';

export type QueueItem = {
  id: string;
  path: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body: unknown;
  createdAt: string;
  followUpPhotoUri?: string;
};

async function readQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueueItem[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
}

export async function enqueue(item: Omit<QueueItem, 'id' | 'createdAt'>): Promise<void> {
  const queue = await readQueue();
  queue.push({
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  });
  await writeQueue(queue);
}

export async function getAll(): Promise<QueueItem[]> {
  return readQueue();
}

export async function remove(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((item) => item.id !== id));
}

export async function getPendingCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}
