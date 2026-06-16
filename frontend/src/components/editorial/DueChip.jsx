import React from 'react';
import { formatTime, hasTimeComponent } from '../../lib/timeFormat';

function relDue(iso) {
  if (!iso) return { label: '—', tone: 'muted' };
  const time = hasTimeComponent(iso) ? `, ${formatTime(iso)}` : '';
  const d = new Date(iso); d.setHours(0, 0, 0, 0); // compare calendar dates, ignore time-of-day
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((d - now) / 86400000);
  if (diff < 0)   return { label: `${Math.abs(diff)}d overdue`, tone: 'danger' };
  if (diff === 0) return { label: `Today${time}`,    tone: 'warn' };
  if (diff === 1) return { label: `Tomorrow${time}`, tone: 'warn' };
  if (diff < 7)   return { label: `In ${diff}d${time}`, tone: 'normal' };
  return { label: `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}${time}`, tone: 'muted' };
}

export default function DueChip({ date, flush }) {
  const { label, tone } = relDue(date);
  return (
    <span className={`k-due k-due--${tone}${flush ? ' k-due--flush' : ''}`}>
      {label}
    </span>
  );
}
