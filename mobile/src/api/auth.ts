import { apiClient } from './client';
import { storage } from '../lib/storage';
import type { User } from './types';

export async function apiLogin(email: string, password: string): Promise<User> {
  const res = await apiClient.post('/auth/login', { email, password });
  const user: User = res.data.user ?? res.data;
  storage.set('auth_user', JSON.stringify(user));
  return user;
}

export async function apiLogout(): Promise<void> {
  try { await apiClient.post('/auth/logout'); } catch (_) { /* fire-and-forget: logout always proceeds */ }
  storage.delete('auth_user');
}

export async function apiMe(): Promise<User> {
  const res = await apiClient.get('/auth/me');
  const user: User = res.data.user ?? res.data;
  storage.set('auth_user', JSON.stringify(user));
  return user;
}

export function getCachedUser(): User | null {
  const raw = storage.getString('auth_user');
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}
