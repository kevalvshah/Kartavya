import React from "react";

export default function PageLoader() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "60vh", color: "var(--ink-3)", fontSize: 13,
      fontFamily: "inherit",
    }}>
      <span style={{ opacity: 0.5 }}>Loading…</span>
    </div>
  );
}
