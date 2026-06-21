import * as SecureStore from 'expo-secure-store';
import { apiClient } from './client';
import { storage } from '../lib/storage';
import type { User } from './types';

const TOKEN_KEY = 'auth_token';

export function getStoredToken(): string | null {
  // Synchronous read from SecureStore is not available; use cached MMKV value.
  // SecureStore is the write-path; MMKV shadow keeps the value readable sync.
  return storage.getString(TOKEN_KEY) ?? null;
}

async function saveToken(token: string | undefined) {
  if (token) {
    // Persist in hardware-backed secure storage, shadow in MMKV for sync reads.
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    storage.set(TOKEN_KEY, token);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  storage.delete(TOKEN_KEY);
  delete apiClient.defaults.headers.common['Authorization'];
}

/** Call once on app boot — prefers SecureStore, falls back to MMKV shadow. */
export async function restoreToken() {
  const secure = await SecureStore.getItemAsync(TOKEN_KEY);
  const token = secure ?? storage.getString(TOKEN_KEY) ?? null;
  if (token) {
    if (secure) storage.set(TOKEN_KEY, token); // keep shadow fresh
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
}

export async function apiLogin(email: string, password: string): Promise<User> {
  const res = await apiClient.post('/auth/login', { email, password });
  const user: User = res.data.user ?? res.data;
  await saveToken(res.data.token);
  storage.set('auth_user', JSON.stringify(user));
  return user;
}

export async function apiLogout(): Promise<void> {
  try { await apiClient.post('/auth/logout'); } catch (_) { /* fire-and-forget: logout always proceeds */ }
  await clearToken();
  storage.delete('auth_user');
}

export async function apiMe(): Promise<User> {
  const res = await apiClient.get('/auth/me');
  const user: User = res.data.user ?? res.data;
  // Refresh token if backend returns a new one
  if (res.data.token) await saveToken(res.data.token);
  storage.set('auth_user', JSON.stringify(user));
  return user;
}

export function getCachedUser(): User | null {
  const raw = storage.getString('auth_user');
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}
