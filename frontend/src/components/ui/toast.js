import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "../../lib/utils";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((t) => {
    const id = `toast_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const toast = {
      id,
      type: t.type || "info",
      title: t.title || "",
      message: t.message || "",
    };
    setToasts((prev) => [toast, ...prev].slice(0, 3));
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div data-testid="toast-stack" className="fixed right-5 top-5 z-[60] flex w-[360px] max-w-[calc(100vw-40px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            data-testid={`toast-${t.type}`}
            className={cn(
              "rounded-2xl border border-border/60 bg-card/90 p-4 shadow-lg backdrop-blur",
              t.type === "error" ? "ring-1 ring-rose-500/30" : "ring-1 ring-violet-500/20",
            )}
          >
            <div className="text-sm font-semibold">{t.title}</div>
            {t.message ? <div className="mt-1 text-sm text-muted-foreground">{t.message}</div> : null}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
