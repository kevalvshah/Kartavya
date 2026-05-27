import { apiClient } from './client';
import { storage } from '../lib/storage';
import type { User } from './types';

const TOKEN_KEY = 'auth_token';

export function getStoredToken(): string | null {
  return storage.getString(TOKEN_KEY) ?? null;
}

function saveToken(token: string | undefined) {
  if (token) {
    storage.set(TOKEN_KEY, token);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
}

export function clearToken() {
  storage.delete(TOKEN_KEY);
  delete apiClient.defaults.headers.common['Authorization'];
}

/** Call once on app boot to restore the token from MMKV into axios defaults. */
export function restoreToken() {
  const token = getStoredToken();
  if (token) apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export async function apiLogin(email: string, password: string): Promise<User> {
  const res = await apiClient.post('/auth/login', { email, password });
  const user: User = res.data.user ?? res.data;
  saveToken(res.data.token);
  storage.set('auth_user', JSON.stringify(user));
  return user;
}

export async function apiLogout(): Promise<void> {
  try { await apiClient.post('/auth/logout'); } catch (_) { /* fire-and-forget: logout always proceeds */ }
  clearToken();
  storage.delete('auth_user');
}

export async function apiMe(): Promise<User> {
  const res = await apiClient.get('/auth/me');
  const user: User = res.data.user ?? res.data;
  // Refresh token if backend returns a new one
  if (res.data.token) saveToken(res.data.token);
  storage.set('auth_user', JSON.stringify(user));
  return user;
}

export function getCachedUser(): User | null {
  const raw = storage.getString('auth_user');
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}
