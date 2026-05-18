import React from "react";

export default function NumberField({ field, value, onChange, readOnly }) {
  const { prefix, suffix, min, max, step = 1 } = field.config || {};

  if (readOnly) {
    if (value == null) return <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>—</span>;
    return (
      <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", color: "var(--ink-2)" }}>
        {prefix}{value}{suffix}
      </span>
    );
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {prefix && <span style={{ color: "var(--ink-3)", fontSize: 12 }}>{prefix}</span>}
      <input
        type="number" value={value ?? ""}
        onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
        min={min} max={max} step={step}
        className="k-input"
        style={{ width: 90, textAlign: "right" }}
      />
      {suffix && <span style={{ color: "var(--ink-3)", fontSize: 12 }}>{suffix}</span>}
    </div>
  );
}
