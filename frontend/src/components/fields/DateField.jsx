import React from "react";

export default function DateField({ field, value, onChange, readOnly }) {
  const formatRelative = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    const diff = d.getTime() - Date.now();
    const days = Math.round(diff / 86400000);
    if (days === 0)  return "Today";
    if (days === 1)  return "Tomorrow";
    if (days === -1) return "Yesterday";
    if (days > 0 && days < 7) return `In ${days} days`;
    if (days < 0 && days > -7) return `${Math.abs(days)} days ago`;
    return d.toLocaleDateString();
  };

  const isOverdue = value && new Date(value) < new Date();

  if (readOnly) {
    if (!value) return <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>No date</span>;
    return (
      <span style={{ fontSize: 12, color: isOverdue ? "var(--danger)" : "var(--ink-2)" }}>
        {formatRelative(value)}
      </span>
    );
  }

  return (
    <input
      type="date"
      value={value ? value.slice(0, 10) : ""}
      onChange={e => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
      className="k-input"
      style={{ color: isOverdue ? "var(--danger)" : undefined }}
    />
  );
}
