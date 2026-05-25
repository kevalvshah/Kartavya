import React from 'react';
import { priorityColor } from '../../lib/utils';

const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
const AVATAR_COLORS  = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1'];

function relDue(due) {
  if (!due) return null;
  const diff = Math.round((new Date(due) - Date.now()) / 86400000);
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, tone: 'overdue' };
  if (diff === 0) return { label: 'Due today', tone: 'today' };
  if (diff <= 2)  return { label: `In ${diff}d`, tone: 'soon' };
  if (diff < 7)   return { label: `In ${diff}d`, tone: 'normal' };
  return { label: new Date(due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), tone: 'muted' };
}

export default function KanbanCard({ task, onClick, dragging = false }) {
  const priority = task.priority || 'medium';
  const color    = priorityColor(priority);
  const due      = relDue(task.due_at);
  const assignees = task.assignee_user_ids || [];
  const approvalPending = task.approval_status === 'pending' || task.approval_status === 'pending_client';

  const DUE_COLORS = { overdue: 'var(--k-danger)', today: '#d97706', soon: '#d97706', normal: 'var(--ink-3)', muted: 'var(--ink-3)' };

  return (
    <button
      className={`k-bcard${dragging ? ' is-dragging' : ''}`}
      onClick={onClick}
      style={dragging ? { transform: 'rotate(2deg)', boxShadow: 'var(--shadow-lg)' } : undefined}
    >
      {/* Top row: priority dot + task ID + priority label */}
      <div className="k-bcard__top">
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
        <span className="k-bcard__id">#{task.task_id?.slice(-6) || '—'}</span>
        {approvalPending && (
          <span style={{ fontSize: 10.5, color: '#d97706', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 99, padding: '1px 7px', fontWeight: 600 }}>
            {task.approval_status === 'pending_client' ? 'Client review' : 'Needs approval'}
          </span>
        )}
        <span className="k-bcard__priolbl">{PRIORITY_LABEL[priority]}</span>
      </div>

      {/* Title */}
      <div className="k-bcard__title">{task.title}</div>

      {/* Footer: due chip + meta icons + avatars */}
      <div className="k-bcard__foot">
        {due && (
          <span style={{ fontSize: 11, color: DUE_COLORS[due.tone] || 'var(--ink-3)', fontWeight: due.tone === 'overdue' ? 700 : 400 }}>
            {due.tone === 'overdue' && '⚠ '}{due.label}
          </span>
        )}

        <span className="k-bcard__meta">
          {(task.comment_count > 0) && (
            <span title="Comments">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M2 4h12v7H6l-3 3v-3H2V4z"/>
              </svg>
              {task.comment_count}
            </span>
          )}
          {(task.attachments?.length > 0) && (
            <span title="Attachments">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M10 3l-5 5a2.5 2.5 0 003.5 3.5l5-5a4 4 0 00-5.7-5.7L3 5.5"/>
              </svg>
              {task.attachments.length}
            </span>
          )}
        </span>

        {assignees.length > 0 && (
          <div style={{ display: 'flex', marginLeft: 'auto' }}>
            {assignees.slice(0, 3).map((uid, i) => (
              <span key={uid} title={uid} style={{
                marginLeft: i > 0 ? -6 : 0,
                width: 20, height: 20, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                color: '#fff', fontSize: 9, fontWeight: 700,
                border: '2px solid var(--surface)',
              }}>
                {uid.slice(-2).toUpperCase()}
              </span>
            ))}
            {assignees.length > 3 && (
              <span style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 4, alignSelf: 'center' }}>
                +{assignees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
