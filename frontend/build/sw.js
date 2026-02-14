/* TaskFlow Service Worker (Web Push)
   Minimal SW to display push notifications.
*/

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "TaskFlow", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "TaskFlow";
  const options = {
    body: data.body || data.message || "",
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const hadWindow = clientsArr.some((win) => {
        if (win.url.includes(url) && "focus" in win) {
          win.focus();
          return true;
        }
        return false;
      });
      if (!hadWindow && self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    }),
  );
});
