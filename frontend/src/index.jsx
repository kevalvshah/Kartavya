import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { inject } from "@vercel/analytics";

inject();

// Warm the Railway connection before React boots — establishes TCP+TLS so the
// first real API call (login / teams fetch) doesn't pay the handshake cost.
const _backendUrl = import.meta.env.VITE_BACKEND_URL;
if (_backendUrl) {
  fetch(`${_backendUrl}/api/health`, { method: 'GET', cache: 'no-store' }).catch(() => {});
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
