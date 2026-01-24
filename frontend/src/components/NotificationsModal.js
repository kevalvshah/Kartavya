import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "../components/ui/modal";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import { api } from "../lib/api";

function timeAgo(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationsModal({ open, onOpenChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = useMemo(() => items.filter((i) => !i.read_at).length, [items]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/notifications");
      setItems(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const markAll = async () => {
    await api.post("/notifications/mark-read", { mark_all: true, notification_ids: [] });
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
  };

  const markOne = async (id) => {
    await api.post("/notifications/mark-read", { mark_all: false, notification_ids: [id] });
    setItems((prev) => prev.map((n) => (n.notification_id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Notifications"
      dataTestId="notifications-modal"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div data-testid="notifications-unread-count" className="text-xs text-muted-foreground">
            Unread: {unreadCount}
          </div>
          <Button data-testid="notifications-mark-all" variant="ghost" onClick={markAll} disabled={items.length === 0}>
            Mark all read
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {loading ? (
          <div data-testid="notifications-loading" className="text-sm text-muted-foreground">
            Loading…
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div data-testid="notifications-empty" className="text-sm text-muted-foreground">
            No notifications yet.
          </div>
        ) : null}

        {items.map((n) => (
          <div
            key={n.notification_id}
            data-testid={`notification-item-${n.notification_id}`}
            className={cn(
              "rounded-2xl border border-border/60 bg-background/30 p-4",
              !n.read_at ? "ring-1 ring-violet-500/20" : "opacity-80",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div data-testid={`notification-title-${n.notification_id}`} className="text-sm font-semibold">
                    {n.title}
                  </div>
                  {!n.read_at ? (
                    <Badge data-testid={`notification-unread-badge-${n.notification_id}`} tone="info">
                      New
                    </Badge>
                  ) : null}
                </div>
                <div data-testid={`notification-message-${n.notification_id}`} className="mt-1 text-sm text-muted-foreground">
                  {n.message}
                </div>
                <div data-testid={`notification-time-${n.notification_id}`} className="mt-2 text-xs text-muted-foreground">
                  {timeAgo(n.created_at)}
                </div>
              </div>

              {!n.read_at ? (
                <Button
                  data-testid={`notification-mark-read-${n.notification_id}`}
                  variant="ghost"
                  onClick={() => markOne(n.notification_id)}
                >
                  Mark read
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
