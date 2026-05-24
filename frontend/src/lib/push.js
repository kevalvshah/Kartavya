export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function ensureServiceWorkerRegistered() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service worker not supported");
  }
  // sw.js is served from /public
  const reg = await navigator.serviceWorker.register("/sw.js");
  return reg;
}
