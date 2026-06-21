export const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
export const STATUS_LABELS   = { todo: 'To do', in_progress: 'In progress', in_review: 'In review', done: 'Done', requested: 'Requested', rejected: 'Declined' };
export const STATUS_COLORS   = { todo: '#64748b', in_progress: '#0082c6', in_review: '#8b5cf6', done: '#16a34a', requested: '#9333ea', rejected: '#ef4444' };

export const APPROVAL_STATUS_LABEL = {
  pending:        'Awaiting Approval',
  pending_client: 'Awaiting Client Approval',
  approved:       'Approved',
  rejected:       'Rejected',
};
export const APPROVAL_STATUS_COLOR = {
  pending:        '#d97706',
  pending_client: '#7c3aed',
  approved:       '#16a34a',
  rejected:       '#dc2626',
};

export const lbl = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-3)',
  marginBottom: 5, display: 'block',
};

export function fmtMinutes(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
