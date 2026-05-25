import React from 'react';
import { Paperclip, ExternalLink, Trash2 } from 'lucide-react';

const MAX_FILES = 5;
const MAX_MB    = 5;

/** Single file chip with link + optional remove button. */
function FileChip({ file, onRemove }) {
  const name = file.name || file.url?.split('/').pop() || 'File';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 10px',
      background: 'var(--bg-soft)', border: '1px solid var(--rule)',
      borderRadius: 'var(--r-md)', fontSize: 12,
    }}>
      <Paperclip size={11} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        style={{ color: 'var(--ink-2)', textDecoration: 'none', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {name}
      </a>
      <ExternalLink size={10} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
      {onRemove && (
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 0, display: 'flex' }}
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

/**
 * DrawerAttachments — file upload button, file chip list, and empty state.
 */
export default function DrawerAttachments({ attachments, uploading, fileRef, handleFileChange, removeAttachment }) {
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button
          className="k-btn k-btn--ghost k-btn--sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || attachments.length >= MAX_FILES}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Paperclip size={13} />
          {uploading ? 'Uploading…' : 'Attach files'}
        </button>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {attachments.length}/{MAX_FILES} &middot; max {MAX_MB} MB each
        </span>
      </div>

      {attachments.length === 0 && !uploading && (
        <div className="k-empty" style={{ paddingTop: 40 }}>
          <div className="k-empty__icon"><Paperclip size={24} /></div>
          <div className="k-empty__title">No files yet</div>
          <div className="k-empty__sub">Attach documents, images, or any file to this task.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {attachments.map((f, i) => (
          <FileChip key={i} file={f} onRemove={() => removeAttachment(i)} />
        ))}
      </div>
    </div>
  );
}
