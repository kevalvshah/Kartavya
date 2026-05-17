import React from 'react';
import FieldRenderer from '../fields/FieldRenderer';

const PRIORITY_COLOR = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444', urgent: '#dc2626' };

function Avatar({ name, size = 22 }) {
  return (
    <span title={name} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%',
      background: 'color-mix(in srgb, var(--k-primary) 15%, var(--surface))',
      color: 'var(--k-primary)', fontSize: size * 0.45, fontWeight: 700,
      border: '2px solid var(--surface)',
    }}>{name?.[0]?.toUpperCase() || '?'}</span>
  );
}

export default function KanbanCard({ task, fieldDefs = [], fieldValues = {}, onClick, dragging = false }) {
  const isOverdue = task.due_at && new Date(task.due_at) < new Date() && task.status !== 'done';
  const approvalPending = task.approval_status === 'pending' || task.approval_status === 'pending_client';
  const cardFields = fieldDefs.slice(0, 2);

  return (
    <div
      className={`k-bcard${dragging ? ' is-dragging' : ''}`}
      onClick={onClick}
      style={dragging ? { transform: 'rotate(2deg)', boxShadow: 'var(--shadow-lg)' } : undefined}
    >
      <div className="k-bcard__top">
        <span className="k-bcard__id">#{task.id?.toString().slice(-4) || '—'}</span>
        {approvalPending && (
          <span style={{ fontSize: 11, color: '#d97706', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 99, padding: '1px 7px', fontWeight: 600 }}>
            {task.approval_status === 'pending_client' ? 'Client review' : 'Needs approval'}
          </span>
        )}
      </div>

      <div className="k-bcard__title">{task.title}</div>

      {cardFields.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {cardFields.map(f => (
            <div key={f.field_id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{f.name}:</span>
              <FieldRenderer field={f} value={fieldValues[f.field_id] ?? null} onChange={() => {}} readOnly />
            </div>
          ))}
        </div>
      )}

      <div className="k-bcard__foot">
        <span
          className={`k-pri--${task.priority || 'medium'}`}
          style={{ '--c': PRIORITY_COLOR[task.priority] || '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--c)' }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c)', display: 'inline-block' }} />
          {task.priority || 'medium'}
        </span>

        {task.due_at && (
          <span style={{ fontSize: 11, color: isOverdue ? 'var(--k-danger)' : 'var(--ink-3)', fontWeight: isOverdue ? 700 : 400 }}>
            {isOverdue ? '⚠ ' : ''}{new Date(task.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}

        {(task.assignee_user_ids || []).length > 0 && (
          <div style={{ display: 'flex', marginLeft: 'auto' }}>
            {(task.assignee_user_ids || []).slice(0, 3).map((uid, i) => (
              <span key={uid} style={{ marginLeft: i > 0 ? -6 : 0 }}>
                <Avatar name={uid} size={20} />
              </span>
            ))}
            {(task.assignee_user_ids || []).length > 3 && (
              <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>
                +{(task.assignee_user_ids || []).length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
