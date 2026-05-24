import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
if (!BACKEND_URL) throw new Error('REACT_APP_BACKEND_URL is not set');
const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: false, // bearer-token auth only; cookies not used
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export { BACKEND_URL, API };
