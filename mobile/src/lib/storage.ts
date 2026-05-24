import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({ id: 'kartavya' });

// Typed helpers
export function storeGet<T>(key: string): T | undefined {
  const raw = storage.getString(key);
  if (!raw) return undefined;
  try { return JSON.parse(raw) as T; } catch { return undefined; }
}

export function storeSet(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

export function storeDel(key: string): void {
  storage.delete(key);
}

export function storeClear(): void {
  storage.clearAll();
}
