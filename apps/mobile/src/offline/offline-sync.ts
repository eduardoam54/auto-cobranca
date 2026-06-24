import { apiRequest, apiUpload } from '@/api/client';
import { getAll, remove } from './offline-queue';
import { invalidateCache } from './offline-cache';

type VisitResponse = { visit?: { id: string } };

export async function syncOfflineQueue(): Promise<number> {
  const items = await getAll();
  if (items.length === 0) return 0;

  let synced = 0;

  for (const item of items) {
    try {
      const result = await apiRequest<VisitResponse>(item.path, {
        method: item.method,
        body: item.body,
      });

      // If there is a photo to upload, do it now using the visitId from the response
      if (item.followUpPhotoUri && result?.visit?.id) {
        try {
          const formData = new FormData();
          formData.append('file', {
            uri: item.followUpPhotoUri,
            type: 'image/jpeg',
            name: 'proof.jpg',
          } as unknown as Blob);
          await apiUpload(`/mobile/visits/${result.visit.id}/photo`, formData);
        } catch {
          // Photo upload failure doesn't prevent removing from queue
        }
      }

      await remove(item.id);
      synced++;
    } catch {
      // Keep item in queue — will retry on next sync
      break; // Stop on first failure to preserve order
    }
  }

  if (synced > 0) {
    await invalidateCache();
  }

  return synced;
}
