import React from 'react';

const STATUS_MAP = {
  todo:           { label: 'To Do',            color: '#94a3b8' },
  in_progress:    { label: 'In Progress',       color: '#0082c6' },
  in_review:      { label: 'In Review',         color: '#a78bfa' },
  done:           { label: 'Done',              color: '#05b7aa' },
  requested:      { label: 'Requested',         color: '#f59e0b' },
  // approval states
  pending:        { label: 'Awaiting Approval', color: '#f59e0b' },
  pending_client: { label: 'Client Review',     color: '#8b5cf6' },
  approved:       { label: 'Approved',          color: '#05b7aa' },
  rejected:       { label: 'Rejected',          color: '#ef4444' },
};

export default function StatusChip({ status, approvalStatus }) {
  // Approval state takes precedence when active
  const key = (approvalStatus && approvalStatus !== 'approved' && approvalStatus !== 'rejected')
    ? approvalStatus
    : (approvalStatus === 'approved' || approvalStatus === 'rejected' ? approvalStatus : status);
  const s = STATUS_MAP[key] || { label: key || '—', color: '#94a3b8' };
  return (
    <span className="k-statuschip" style={{ '--c': s.color }}>
      <span className="k-statuschip__dot" />
      {s.label}
    </span>
  );
}
