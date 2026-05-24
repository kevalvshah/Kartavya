import React, { useRef } from "react";
import { api } from "../../lib/api";
import { logger } from '../../lib/utils';

export default function FilesField({ field, value, onChange, readOnly }) {
  const files = Array.isArray(value) ? value : [];
  const inputRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post("/upload", form);
      onChange([...files, { name: res.data.name, url: res.data.url }]);
    } catch (err) {
      logger.error("Upload failed", err);
    }
    e.target.value = "";
  };

  const removeFile = (idx) => onChange(files.filter((_, i) => i !== idx));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {files.map((f, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <span style={{ fontSize: 16 }}>📎</span>
          <a href={f.url} target="_blank" rel="noreferrer"
            style={{ color: "var(--k-primary)", textDecoration: "none", flex: 1 }}
          >{f.name}</a>
          {!readOnly && (
            <button onClick={() => removeFile(i)}
              className="k-iconbtn"
              aria-label="Remove file"
              style={{ color: "var(--danger)", fontSize: 14 }}
            >✕</button>
          )}
        </div>
      ))}
      {!readOnly && (
        <>
          <input ref={inputRef} type="file" style={{ display: "none" }} onChange={handleUpload} />
          <button
            onClick={() => inputRef.current?.click()}
            className="k-btn k-btn--ghost k-btn--sm"
            style={{ alignSelf: "flex-start", borderStyle: "dashed" }}
          >+ Attach file</button>
        </>
      )}
    </div>
  );
}
