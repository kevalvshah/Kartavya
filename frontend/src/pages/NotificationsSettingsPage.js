import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { ensureServiceWorkerRegistered, urlBase64ToUint8Array } from "../lib/push";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

export default function NotificationsSettingsPage() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState("default");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window);
    setPermission(Notification.permission);
  }, []);

  const statusTone = useMemo(() => {
    if (!supported) return "danger";
    if (permission === "denied") return "danger";
    if (enabled) return "info";
    return "neutral";
  }, [supported, permission, enabled]);

  const refreshEnabled = async () => {
    if (!supported) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return setEnabled(false);
    const sub = await reg.pushManager.getSubscription();
    setEnabled(!!sub);
  };

  useEffect(() => {
    refreshEnabled().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const enablePush = async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const reg = await ensureServiceWorkerRegistered();
      const keyRes = await api.get("/push/vapid-public-key");
      const publicKey = keyRes.data.public_key;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await api.post("/push/subscribe", subscription);
      await refreshEnabled();
    } finally {
      setLoading(false);
    }
  };

  const disablePush = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.post("/push/unsubscribe", sub);
        await sub.unsubscribe();
      }
      await refreshEnabled();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="notifications-settings-page" className="space-y-6">
      <div>
        <div data-testid="notifications-settings-title" className="text-sm font-semibold">Notifications</div>
        <div data-testid="notifications-settings-subtitle" className="mt-1 text-sm text-muted-foreground">
          Enable browser push notifications (works on desktop + mobile browsers). A native app can be added later.
        </div>
      </div>

      <div data-testid="push-status-card" className="rounded-3xl border border-border/70 bg-card/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div data-testid="push-status-label" className="text-sm font-semibold">Browser push</div>
            <div data-testid="push-status-meta" className="mt-1 text-sm text-muted-foreground">
              Supported: {supported ? "Yes" : "No"} • Permission: {permission}
            </div>
          </div>
          <Badge data-testid="push-status-badge" tone={statusTone}>
            {enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button data-testid="push-enable-button" onClick={enablePush} disabled={loading || !supported || enabled}>
            Enable
          </Button>
          <Button data-testid="push-disable-button" variant="ghost" onClick={disablePush} disabled={loading || !supported || !enabled}>
            Disable
          </Button>
        </div>

        {permission === "denied" ? (
          <div data-testid="push-permission-denied" className="mt-4 text-sm text-muted-foreground">
            Notifications are blocked in your browser settings. Please allow notifications for this site.
          </div>
        ) : null}
      </div>

      <div data-testid="reminder-policy-card" className="rounded-3xl border border-border/70 bg-card/50 p-6">
        <div data-testid="reminder-policy-title" className="text-sm font-semibold">Reminder defaults</div>
        <div data-testid="reminder-policy-text" className="mt-1 text-sm text-muted-foreground">
          Default reminder is 2 hours before the due date. You can override it per task in the Task Editor.
        </div>
      </div>
    </div>
  );
}
