/**
 * ApprovalsPage.jsx — editorial Approvals screen.
 * Stat row (Pending / Approved today / Rejected today) + pending card.
 * All API calls unchanged.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { currentUser } from '../lib/auth';
import { useToast } from '../components/ui/toast';
import { PageHeader, StatTile, DueChip, PriorityDot } from '../components/editorial';
import { relTime } from '../lib/utils';

const PRIORITY_COLOR = { urgent: '#C0392B', high: '#B06A00', medium: '#0082c6', low: '#6E7B91' };

export default function ApprovalsPage() {
  const { pushToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [deciding, setDeciding] = useState({});
  const user     = currentUser();
  const isClient = user?.role === 'client';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = isClient ? '/client/approvals' : '/approvals/pending';
      const r = await api.get(endpoint);
      setRequests(r.data || []);
      if (!isClient) {
        api.get('/approvals/history').then(h => setHistory(h.data || [])).catch(() => {});
      }
    } catch (_) {
      pushToast({ type: 'error', title: 'Could not load approvals' });
    } finally {
      setLoading(false);
    }
  }, [isClient, pushToast]);

  useEffect(() => { load(); }, [load]);

  const decide = async (approvalId, status) => {
    setDeciding(d => ({ ...d, [approvalId]: true }));
    try {
      await api.post(`/approvals/${approvalId}/review`, { status, notes: '' });
      pushToast({ type: 'success', title: status === 'approved' ? 'Approved ✓' : 'Rejected' });
      load();
    } catch (e) {
      pushToast({ type: 'error', title: 'Action failed', message: e?.response?.data?.detail || 'Try again' });
    } finally {
      setDeciding(d => { const n = { ...d }; delete n[approvalId]; return n; });
    }
  };

  const today   = new Date(); today.setHours(0,0,0,0);
  const approved = history.filter(h => h.status === 'approved' && new Date(h.updated_at) >= today).length;
  const rejected = history.filter(h => h.status === 'rejected' && new Date(h.updated_at) >= today).length;

  return (
    <div className="k-screen">
      <PageHeader
        kicker="REVIEW"
        title={isClient ? 'My Approvals' : 'Approvals'}
        sanskrit="अनुमोदन"
        lede={isClient ? 'Track your requests and their status.' : 'Items waiting on you. Review, approve, or send back.'}
        right={
          !isClient && (
            <div className="k-approvals__counter">
              <div className="k-approvals__counter-num">{requests.length}</div>
              <div className="k-approvals__counter-lbl">awaiting<br/>your nod</div>
            </div>
          )
        }
      />

      {/* Stat row (admin only) */}
      {!isClient && (
        <div className="k-stats">
          <StatTile variant="amber" label="PENDING"  sanskrit="लंबित"    value={requests.length}  sub="awaiting your call" />
          <StatTile variant="teal"  label="APPROVED" sanskrit="स्वीकृत"  value={approved}          sub="today" />
          <StatTile variant="red"   label="REJECTED" sanskrit="अस्वीकृत" value={rejected}          sub="today" />
        </div>
      )}

      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
          Loading approvals…
        </div>
      )}

      {!loading && requests.length === 0 && (
        <div className="k-empty">
          <div className="k-empty__icon">✓</div>
          <div className="k-empty__title">All caught up</div>
          <div className="k-empty__sub">{isClient ? 'No tasks awaiting your review.' : 'Nothing pending right now.'}</div>
        </div>
      )}

      {/* Pending approvals card */}
      {!loading && requests.length > 0 && (
        <section className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
          <header className="k-card__head" style={{ padding: '16px 24px' }}>
            <div className="k-card__titles">
              <h3 className="k-card__title">Pending approval</h3>
              <span className="k-card__sans">लंबित अनुमोदन</span>
            </div>
          </header>
          <div className="k-card__body" style={{ padding: 0 }}>
            {requests.map((r) => {
              const data      = typeof r.request_data === 'string' ? JSON.parse(r.request_data) : (r.request_data || {});
              const title     = data?.title || r.task_title || 'Untitled task';
              const desc      = data?.description || r.notes || '';
              const priority  = data?.priority || r.priority || 'medium';
              const requester = r.requester_name || r.requested_by_name || (isClient ? 'You' : 'Client');
              const isDeciding = deciding[r.approval_id];
              return (
                <div key={r.approval_id} className="k-approval-row">
                  <div className="k-approval-row__main">
                    <PriorityDot priority={priority} />
                    <div className="k-approval-row__body">
                      <div className="k-approval-row__title">{title}</div>
                      {desc && <div className="k-approval-row__desc">{desc}</div>}
                      <div className="k-approval-row__meta">
                        <span className="k-mute">
                          Requested by <strong style={{ color: 'var(--ink-2)' }}>{requester}</strong>
                        </span>
                        {r.created_at && (
                          <span className="k-mute"> · {relTime(r.created_at)}</span>
                        )}
                        {r.task_due_at && (
                          <> · <DueChip date={r.task_due_at} /></>
                        )}
                      </div>
                    </div>
                  </div>
                  {!isClient && (
                    <div className="k-approval-row__actions">
                      <button
                        className="k-btn k-btn--primary k-btn--sm"
                        onClick={() => decide(r.approval_id, 'approved')}
                        disabled={isDeciding}
                      >
                        {isDeciding ? '…' : '✓ Approve'}
                      </button>
                      <button
                        className="k-btn k-btn--ghost k-btn--sm"
                        onClick={() => decide(r.approval_id, 'rejected')}
                        disabled={isDeciding}
                        style={{ color: 'var(--danger)' }}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}
                  {isClient && (
                    <span className="k-statuschip" style={{ '--c': '#f59e0b' }}>
                      <span className="k-statuschip__dot" />
                      Pending
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* History (admin only, if loaded) */}
      {!isClient && history.length > 0 && (
        <section className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
          <header className="k-card__head" style={{ padding: '16px 24px' }}>
            <div className="k-card__titles">
              <h3 className="k-card__title">Recent decisions</h3>
              <span className="k-card__sans">हाल के निर्णय</span>
            </div>
          </header>
          <div className="k-card__body" style={{ padding: 0 }}>
            {history.slice(0, 8).map((h, i) => (
              <div key={h.approval_id || i} className="k-approval-row">
                <div className="k-approval-row__main">
                  <span
                    className="k-statuschip"
                    style={{ '--c': h.status === 'approved' ? '#05b7aa' : '#C0392B' }}
                  >
                    <span className="k-statuschip__dot" />
                    {h.status === 'approved' ? 'Approved' : 'Rejected'}
                  </span>
                  <div className="k-approval-row__body">
                    <div className="k-approval-row__title">{h.task_title || 'Untitled'}</div>
                    <div className="k-approval-row__meta">
                      <span className="k-mute">{relTime(h.updated_at || h.created_at)}</span>
                      {h.notes && <span className="k-mute"> · {h.notes}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
