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
  const [requests,    setRequests]    = useState([]);
  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [deciding,    setDeciding]    = useState({});
  // Client-send modal state
  const [clientModal, setClientModal] = useState(null); // { approvalId } | null
  const [clientEmail, setClientEmail] = useState('');
  const [sendNotes,   setSendNotes]   = useState('');
  const [rejectModal, setRejectModal] = useState(null); // { approvalId } | null
  const [rejectNote,  setRejectNote]  = useState('');
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

  const decide = async (approvalId, status, extra = {}) => {
    setDeciding(d => ({ ...d, [approvalId]: true }));
    try {
      await api.post(`/approvals/${approvalId}/review`, { status, notes: extra.notes || '', ...extra });
      pushToast({ type: 'success', title: status === 'approved' ? 'Approved ✓' : status === 'rejected' ? 'Rejected' : 'Sent to client ✓' });
      load();
    } catch (e) {
      pushToast({ type: 'error', title: 'Action failed', message: e?.response?.data?.detail || 'Try again' });
    } finally {
      setDeciding(d => { const n = { ...d }; delete n[approvalId]; return n; });
    }
  };

  const openApproveFlow = (approvalId) => {
    // Only task-level approvals get the client-send choice
    if (approvalId.startsWith('task_approval::')) {
      setClientEmail(''); setSendNotes('');
      setClientModal({ approvalId });
    } else {
      decide(approvalId, 'approved');
    }
  };

  const openRejectFlow = (approvalId) => {
    setRejectNote('');
    setRejectModal({ approvalId });
  };

  const confirmApproveWithClient = async () => {
    const { approvalId } = clientModal;
    setClientModal(null);
    if (clientEmail.trim()) {
      await decide(approvalId, 'approved', { send_to_client: true, client_email: clientEmail.trim(), notes: sendNotes });
    } else {
      await decide(approvalId, 'approved', { send_to_client: false, notes: sendNotes });
    }
  };

  const confirmReject = async () => {
    const { approvalId } = rejectModal;
    setRejectModal(null);
    await decide(approvalId, 'rejected', { notes: rejectNote });
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
                        onClick={() => openApproveFlow(r.approval_id)}
                        disabled={isDeciding}
                      >
                        {isDeciding ? '…' : '✓ Approve'}
                      </button>
                      <button
                        className="k-btn k-btn--ghost k-btn--sm"
                        onClick={() => openRejectFlow(r.approval_id)}
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
      {/* Approve modal — option to send to client */}
      {clientModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="k-card" style={{ width: 420, padding: '28px 32px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>Approve task</div>
            <div style={{ fontFamily: 'var(--font-hindi)', fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>स्वीकृत करें</div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>
                Notes (optional)
              </label>
              <textarea
                value={sendNotes}
                onChange={e => setSendNotes(e.target.value)}
                placeholder="Add a note for the requester…"
                rows={2}
                className="k-input"
                style={{ width: '100%', resize: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ padding: '14px 16px', background: 'var(--bg-soft)', borderRadius: 'var(--r-md)', border: '1px solid var(--rule)', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>Send for client approval?</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>
                Leave blank to move task to Done. Enter a client email to send them an approval link.
              </div>
              <input
                type="email"
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="client@example.com (optional)"
                className="k-input"
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="k-btn k-btn--ghost" onClick={() => setClientModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="k-btn k-btn--primary" onClick={confirmApproveWithClient} style={{ flex: 2 }}>
                {clientEmail.trim() ? '✓ Approve & Send to Client' : '✓ Approve & Mark Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="k-card" style={{ width: 380, padding: '28px 32px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>Reject task</div>
            <div style={{ fontFamily: 'var(--font-hindi)', fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>अस्वीकृत करें</div>
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>
              Reason (required)
            </label>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Why is this being rejected?"
              rows={3}
              className="k-input"
              style={{ width: '100%', resize: 'none', boxSizing: 'border-box', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="k-btn k-btn--ghost" onClick={() => setRejectModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button
                className="k-btn k-btn--ghost"
                onClick={confirmReject}
                disabled={!rejectNote.trim()}
                style={{ flex: 2, color: 'var(--k-danger)', borderColor: 'var(--k-danger)' }}
              >
                ✕ Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
