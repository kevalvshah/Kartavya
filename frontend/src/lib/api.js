import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
if (!BACKEND_URL) {
  // Guard: only touch DOM in a real browser context (not SSR / test / Storybook)
  if (typeof document !== 'undefined' && document.body) {
    document.body.innerHTML =
      '<div style="display:flex;height:100vh;align-items:center;justify-content:center;font-family:sans-serif;flex-direction:column;gap:12px">' +
      '<h2 style="color:#dc2626">Configuration Error</h2>' +
      '<p style="color:#555">REACT_APP_BACKEND_URL is not set. Please check your deployment environment.</p>' +
      '</div>';
  }
  throw new Error('REACT_APP_BACKEND_URL is not set');
}
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
