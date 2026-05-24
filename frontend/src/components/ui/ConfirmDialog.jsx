import React, { useEffect, useRef } from "react";

/**
 * Accessible confirm dialog — replaces window.confirm throughout the app.
 *
 * Usage:
 *   const [confirm, setConfirm] = useState(null);
 *   // trigger:  setConfirm({ message: "...", onConfirm: () => doThing() })
 *   // render:   <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
 */
export default function ConfirmDialog({ state, onClose }) {
  const cancelRef = useRef(null);

  // Focus the cancel button when dialog opens (safe default)
  useEffect(() => {
    if (state) cancelRef.current?.focus();
  }, [state]);

  // Close on Escape
  useEffect(() => {
    if (!state) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state, onClose]);

  if (!state) return null;

  const { message, onConfirm, confirmLabel = "Delete", confirmStyle = "danger" } = state;

  const confirmBtnStyle = confirmStyle === "danger"
    ? { background: "var(--k-danger, #dc2626)", color: "#fff", border: "none" }
    : { background: "var(--k-primary)", color: "#fff", border: "none" };

  return (
    <div
      role="presentation"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        aria-describedby="cd-msg"
        style={{
          background: "var(--surface, #fff)",
          borderRadius: "var(--r-lg, 14px)",
          border: "1px solid var(--rule, #e2e8f0)",
          boxShadow: "0 20px 60px -10px rgba(0,0,0,0.25)",
          width: "100%", maxWidth: 400,
          padding: "28px 28px 24px",
          fontFamily: "var(--font-ui)",
        }}
      >
        <p
          id="cd-title"
          style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}
        >
          Are you sure?
        </p>
        <p
          id="cd-msg"
          style={{ margin: "0 0 24px", fontSize: 14, color: "var(--ink-3)", lineHeight: 1.55 }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            ref={cancelRef}
            className="k-btn k-btn--ghost"
            onClick={onClose}
            style={{ minWidth: 80 }}
          >
            Cancel
          </button>
          <button
            className="k-btn"
            style={{ ...confirmBtnStyle, minWidth: 80 }}
            onClick={async () => { await onConfirm(); onClose(); }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
