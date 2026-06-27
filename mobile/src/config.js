// API URL is read from environment at build time.
// Development  → EXPO_PUBLIC_API_URL in mobile/.env
// Production   → EXPO_PUBLIC_API_URL set in EAS build env (eas.json or EAS dashboard)
// Future       → switch to https://api.Kartavaya.aekaminc.com by updating the env var only
export const BACKEND_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://Kartavaya-production.up.railway.app';

export const API_URL = `${BACKEND_URL}/api`;
