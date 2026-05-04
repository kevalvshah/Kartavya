import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from './config';

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function apiLogin(email, password) {
  const res = await api.post('/auth/login', { email, password });
  await AsyncStorage.setItem('auth_token', res.data.token);
  await AsyncStorage.setItem('auth_user', JSON.stringify(res.data.user));
  return res.data;
}

export async function apiLogout() {
  try { await api.post('/auth/logout'); } catch (_) {}
  await AsyncStorage.removeItem('auth_token');
  await AsyncStorage.removeItem('auth_user');
}

export async function getUser() {
  const s = await AsyncStorage.getItem('auth_user');
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}
