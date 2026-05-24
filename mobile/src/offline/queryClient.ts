import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { storage } from '../lib/storage';

// MMKV-backed storage adapter for TanStack Query persistence
const mmkvStorageAdapter = {
  setItem:    (key: string, value: string) => { storage.set(key, value); },
  getItem:    (key: string): string | null => storage.getString(key) ?? null,
  removeItem: (key: string) => { storage.delete(key); },
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:         60_000,          // 1 min — don't refetch if fresh
      gcTime:            1000 * 60 * 60 * 2,  // 2h cache — keeps MMKV write size small
      retry:             2,
      refetchOnWindowFocus: false,        // mobile: refetch on app-foreground instead
    },
    mutations: {
      retry: 0,
    },
  },
});

export const persister = createSyncStoragePersister({
  storage: mmkvStorageAdapter,
  key:     'rq_cache',
  throttleTime: 1000,
});

export function setupQueryPersistence() {
  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 2,    // 2h — matches gcTime
    buster: '2.0.0',                 // bump to invalidate on major deploys
  });
}
