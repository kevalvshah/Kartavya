import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_URL } from './config';

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (_) {}
  return config;
});

export async function apiLogin(email, password) {
  const res = await api.post('/auth/login', { email, password });
  await SecureStore.setItemAsync('auth_token', res.data.token);
  await SecureStore.setItemAsync('auth_user', JSON.stringify(res.data.user));
  return res.data;
}

export async function apiLogout() {
  try { await api.post('/auth/logout'); } catch (_) {}
  await SecureStore.deleteItemAsync('auth_token');
  await SecureStore.deleteItemAsync('auth_user');
}

export async function getUser() {
  try {
    const s = await SecureStore.getItemAsync('auth_user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}
