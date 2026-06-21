import React from 'react';
import { priorityColor, avatarColor, userInitials } from '../../lib/utils';
import { formatTime, hasTimeComponent } from '../../lib/timeFormat';
import { PRIORITY_LABELS } from '../drawer/constants';

function relDue(due) {
  if (!due) return null;
  const time = hasTimeComponent(due) ? `, ${formatTime(due)}` : '';
  const d = new Date(due); d.setHours(0, 0, 0, 0); // compare calendar dates, ignore time-of-day
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((d - now) / 86400000);
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, tone: 'overdue' };
  if (diff === 0) return { label: `Due today${time}`, tone: 'today' };
  if (diff <= 2)  return { label: `In ${diff}d${time}`, tone: 'soon' };
  if (diff < 7)   return { label: `In ${diff}d${time}`, tone: 'normal' };
  return { label: `${new Date(due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}${time}`, tone: 'muted' };
}


export default function KanbanCard({ task, onClick, dragging = false, draggable = false, onDragStart, onDragEnd }) {
  const priority = task.priority || 'medium';
  const color    = priorityColor(priority);
  const due      = relDue(task.due_at);
  const assignees = task.assignee_user_ids || [];
  const names     = task.assignee_names || [];
  const approvalPending = task.approval_status === 'pending' || task.approval_status === 'pending_client';
  const isDone = task.status === 'done' || task.status === 'approved';
  const completedOnTime = isDone && task.completed_at && task.due_at && new Date(task.completed_at) <= new Date(task.due_at);

  const DUE_COLORS = { overdue: 'var(--k-danger)', today: '#d97706', soon: '#d97706', normal: 'var(--ink-3)', muted: 'var(--ink-3)' };

  return (
    <button
      className={`k-bcard${dragging ? ' is-dragging' : ''}`}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
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
        <span className="k-bcard__priolbl">{PRIORITY_LABELS[priority]}</span>
      </div>

      {/* Title */}
      <div className="k-bcard__title">{task.title}</div>

      {/* Footer: due chip + meta icons + avatars */}
      <div className="k-bcard__foot">
        {completedOnTime ? (
          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Done on time</span>
        ) : isDone && task.completed_at && task.due_at ? (() => {
          const dueDay  = new Date(task.due_at);       dueDay.setHours(0,0,0,0);
          const doneDay = new Date(task.completed_at); doneDay.setHours(0,0,0,0);
          const lateDays = Math.round((doneDay - dueDay) / 86400000);
          return lateDays <= 0
            ? <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Done on time</span>
            : <span style={{ fontSize: 11, color: 'var(--k-danger)', fontWeight: 600 }}>{`✓ Done · ${lateDays}d late`}</span>;
        })()
        : due && !isDone && (
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
          <div style={{ display: 'flex', marginLeft: 'auto', alignItems: 'center' }}>
            {assignees.slice(0, 3).map((uid, i) => (
              <span key={uid} title={names[i] || uid} style={{
                marginLeft: i > 0 ? -8 : 0,
                width: 26, height: 26, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: avatarColor(names[i]),
                color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '-0.3px',
                border: '2px solid var(--surface)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                flexShrink: 0,
              }}>
                {userInitials(names[i])}
              </span>
            ))}
            {assignees.length > 3 && (
              <span style={{
                marginLeft: -8, width: 26, height: 26, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-soft)', border: '2px solid var(--surface)',
                fontSize: 10, fontWeight: 700, color: 'var(--ink-2)',
              }}>
                +{assignees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
