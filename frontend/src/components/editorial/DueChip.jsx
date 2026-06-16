import React from 'react';
import { formatTime, hasTimeComponent } from '../../lib/timeFormat';

function relDue(iso) {
  if (!iso) return { label: '—', tone: 'muted' };
  const time = hasTimeComponent(iso) ? `, ${formatTime(iso)}` : '';
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((d - now) / 86400000);
  if (diff < 0)   return { label: `${Math.abs(diff)}d overdue`, tone: 'danger' };
  if (diff === 0) return { label: `Today${time}`,    tone: 'warn' };
  if (diff === 1) return { label: `Tomorrow${time}`, tone: 'warn' };
  if (diff < 7)   return { label: `In ${diff}d${time}`, tone: 'normal' };
  return { label: `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}${time}`, tone: 'muted' };
}

function relCompleted(completedAt) {
  const d = new Date(completedAt);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60)  return `${diffMins || 1}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)   return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7)   return `${diffDays}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const DONE_STATUSES = new Set(['done', 'approved']);

export default function DueChip({ date, flush, status, completedAt }) {
  const { label, tone } = relDue(date);

  // Done within due date → green "Done X ago" pill
  if (DONE_STATUSES.has(status) && completedAt && date) {
    const onTime = new Date(completedAt) <= new Date(date);
    if (onTime) {
      return (
        <span className={`k-due k-due--done${flush ? ' k-due--flush' : ''}`}>
          ✓ Done {relCompleted(completedAt)}
        </span>
      );
    }
    // Completed late — hide overdue, show nothing
    return null;
  }

  // Done but no due date — hide badge
  if (DONE_STATUSES.has(status) && tone === 'danger') return null;

  return (
    <span className={`k-due k-due--${tone}${flush ? ' k-due--flush' : ''}`}>
      {label}
    </span>
  );
}
