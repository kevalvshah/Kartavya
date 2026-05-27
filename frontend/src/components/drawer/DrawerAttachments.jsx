import React, { useRef, useState } from 'react';
import { Paperclip, ExternalLink, Trash2, Upload, Image, FileText } from 'lucide-react';

const MAX_FILES = 5;
const MAX_MB    = 5;

function FileChip({ file, onRemove }) {
  const name = file.name || file.url?.split('/').pop() || 'File';
  const isImage = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px',
      background: 'var(--bg)', border: '1px solid var(--rule)',
      borderRadius: 'var(--r-md)', fontSize: 13,
    }}>
      {isImage
        ? <Image size={13} style={{ color: 'var(--k-primary)', flexShrink: 0 }} />
        : <FileText size={13} style={{ color: 'var(--k-primary)', flexShrink: 0 }} />
      }
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        style={{ color: 'var(--ink-2)', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {name}
      </a>
      <ExternalLink size={11} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
      {onRemove && (
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 0, display: 'flex', marginLeft: 2 }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

export default function DrawerAttachments({ attachments, uploading, fileRef, handleFileChange, removeAttachment }) {
  const dropRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (!fileRef.current) return;
    // Create a synthetic change event with the dropped files
    const dt = e.dataTransfer;
    if (!dt?.files?.length) return;
    const synth = { target: { files: dt.files, value: '' } };
    handleFileChange(synth);
  };

  const full = attachments.length >= MAX_FILES;

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.gif,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button
          className="k-btn k-btn--ghost k-btn--sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || full}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Paperclip size={13} />
          {uploading ? 'Uploading…' : 'Attach files'}
        </button>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {attachments.length}/{MAX_FILES} · max {MAX_MB} MB
        </span>
      </div>

      {/* Drop zone / empty state */}
      {attachments.length === 0 && !uploading && (
        <div
          ref={dropRef}
          onClick={() => !full && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `1.5px dashed ${dragging ? 'var(--k-primary)' : 'var(--rule-strong)'}`,
            borderRadius: 10,
            padding: '32px 20px',
            textAlign: 'center',
            cursor: full ? 'default' : 'pointer',
            background: dragging ? 'var(--k-primary-dim, rgba(0,130,198,0.06))' : 'transparent',
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          <Upload size={22} style={{ color: 'var(--ink-3)', marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>
            Drop files or click to browse
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            Computer · Google Drive · OneDrive · Dropbox<br />
            Images, PDF, Word, Excel, PowerPoint · max 5 MB
          </div>
        </div>
      )}

      {/* Upload spinner */}
      {uploading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>
          <div className="k-spinner" style={{ width: 14, height: 14 }} />
          Uploading…
        </div>
      )}

      {/* File list */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachments.map((f, i) => (
            <FileChip key={i} file={f} onRemove={() => removeAttachment(i)} />
          ))}
          {!full && !uploading && (
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 8,
                border: '1.5px dashed var(--rule-strong)',
                background: 'transparent', cursor: 'pointer',
                color: 'var(--ink-3)', fontSize: 12, fontWeight: 600,
                marginTop: 2,
              }}
            >
              <Paperclip size={12} /> Add more files
            </button>
          )}
        </div>
      )}
    </div>
  );
}
