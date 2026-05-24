import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_URL } from './config';

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (_) { /* token not yet stored — proceed without auth header */ }
  return config;
});

/**
 * Log in with email/password, persist token and user to SecureStore.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{token: string, user: object}>}
 */
export async function apiLogin(email, password) {
  const res = await api.post('/auth/login', { email, password });
  await SecureStore.setItemAsync('auth_token', res.data.token);
  await SecureStore.setItemAsync('auth_user', JSON.stringify(res.data.user));
  return res.data;
}

/**
 * Log out: fire server logout (best-effort) then clear local SecureStore credentials.
 * @returns {Promise<void>}
 */
export async function apiLogout() {
  try { await api.post('/auth/logout'); } catch (_) { /* fire-and-forget: logout always proceeds */ }
  await SecureStore.deleteItemAsync('auth_token');
  await SecureStore.deleteItemAsync('auth_user');
}

/**
 * Read the cached user object from SecureStore without a network call.
 * @returns {Promise<object|null>} Parsed user or null if not signed in.
 */
export async function getUser() {
  try {
    const s = await SecureStore.getItemAsync('auth_user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}
