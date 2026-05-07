/**
 * FilesField — file list with upload button.
 * value: [{name, url}]
 */
import React, { useRef } from 'react';
import { api } from '../../lib/api';

export default function FilesField({ field, value, onChange, readOnly }) {
  const files = Array.isArray(value) ? value : [];
  const inputRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post('/api/upload', form);
      onChange([...files, { name: res.data.name, url: res.data.url }]);
    } catch (err) {
      console.error('Upload failed', err);
    }
    e.target.value = '';
  };

  const removeFile = (idx) => onChange(files.filter((_, i) => i !== idx));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {files.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
          <span style={{ fontSize: 16 }}>📎</span>
          <a href={f.url} target="_blank" rel="noreferrer"
            style={{ color: 'var(--accent-default)', textDecoration: 'none', flex: 1 }}
          >{f.name}</a>
          {!readOnly && (
            <button onClick={() => removeFile(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14 }}
            >✕</button>
          )}
        </div>
      ))}
      {!readOnly && (
        <>
          <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
          <button
            onClick={() => inputRef.current?.click()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-sm)',
              padding: '5px 12px', background: 'transparent', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontFamily: 'inherit',
            }}
          >+ Attach file</button>
        </>
      )}
    </div>
  );
}
