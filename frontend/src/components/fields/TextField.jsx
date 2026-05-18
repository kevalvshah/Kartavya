import React, { useState } from "react";

export default function TextField({ field, value, onChange, readOnly }) {
  const multiline = field.config?.multiline || false;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  const commit = () => { onChange(draft); setEditing(false); };

  if (readOnly || !editing) {
    const display = value || "";
    return (
      <span
        onClick={() => !readOnly && setEditing(true)}
        style={{
          display: "inline-block", fontSize: 13,
          color: display ? "var(--ink)" : "var(--ink-faint)",
          cursor: readOnly ? "default" : "text",
          minWidth: 80,
          borderBottom: readOnly ? "none" : "1px dashed var(--rule)",
        }}
      >
        {display || (readOnly ? "—" : "Click to edit…")}
      </span>
    );
  }

  return multiline ? (
    <textarea rows={3} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} autoFocus className="k-input" style={{ resize: "vertical", width: "100%" }}
    />
  ) : (
    <input type="text" value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()}
      autoFocus className="k-input" style={{ width: "100%" }}
    />
  );
}
