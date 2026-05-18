import React from 'react';

const STATUS_MAP = {
  todo:        { label: 'To Do',       color: '#94a3b8' },
  in_progress: { label: 'In Progress', color: '#0082c6' },
  in_review:   { label: 'In Review',   color: '#a78bfa' },
  done:        { label: 'Done',        color: '#05b7aa' },
  requested:   { label: 'Requested',   color: '#f59e0b' },
};

export default function StatusChip({ status }) {
  const s = STATUS_MAP[status] || { label: status || '—', color: '#94a3b8' };
  return (
    <span className="k-statuschip" style={{ '--c': s.color }}>
      <span className="k-statuschip__dot" />
      {s.label}
    </span>
  );
}
