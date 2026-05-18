import React, { useState } from "react";

export default function PersonField({ field, value, onChange, readOnly }) {
  const members = field.config?.members || [];
  const current = members.find(m => m.user_id === value);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = q ? members.filter(m => m.display_name.toLowerCase().includes(q.toLowerCase())) : members;

  const avatar = (name) => (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 24, height: 24, borderRadius: "50%",
      background: "color-mix(in srgb, var(--k-primary) 15%, transparent)",
      color: "var(--k-primary)", fontSize: 11, fontWeight: 700,
    }}>{name?.[0]?.toUpperCase() || "?"}</span>
  );

  if (readOnly) {
    return current ? (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        {avatar(current.display_name)}{current.display_name}
      </span>
    ) : <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>Unassigned</span>;
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
          border: "1px solid var(--rule)", borderRadius: "var(--r-sm)",
          padding: "4px 10px", background: "var(--surface)", fontSize: 13,
          minWidth: 140,
        }}
      >
        {current
          ? <>{avatar(current.display_name)}<span style={{ color: "var(--ink)" }}>{current.display_name}</span></>
          : <span style={{ color: "var(--ink-3)" }}>Assign person…</span>
        }
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 100, marginTop: 4,
          background: "var(--surface)", border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)", width: 220,
        }}>
          <div style={{ padding: 8 }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search name…"
              className="k-input"
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            <div onClick={() => { onChange(null); setOpen(false); }}
              style={{ padding: "6px 12px", cursor: "pointer", color: "var(--ink-faint)", fontSize: 13 }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-soft)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >Clear</div>
            {filtered.map(m => (
              <div key={m.user_id}
                onClick={() => { onChange(m.user_id); setOpen(false); setQ(""); }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, color: "var(--ink)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-soft)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {avatar(m.display_name)}{m.display_name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
