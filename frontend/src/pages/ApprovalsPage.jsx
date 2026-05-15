/**
 * ApprovalsPage.jsx — k-* design system.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { currentUser } from '../lib/auth';
import { useToast } from '../components/ui/toast';

export default function ApprovalsPage() {
  const { pushToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const user     = currentUser();
  const isClient = user?.role === 'client';

  const load = async () => {
    setLoading(true);
    try {
      const endpoint = isClient ? '/client/approvals' : '/approvals/pending';
      const r = await api.get(endpoint);
      setRequests(r.data || []);
    } catch (_) {
      pushToast({ type: 'error', title: 'Could not load approvals' });
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const decide = async (approvalId, status) => {
    try {
      await api.post(`/approvals/${approvalId}/review`, { status, notes: '' });
      pushToast({ type: 'success', title: status === 'approved' ? 'Approved' : 'Rejected' });
      load();
    } catch (e) {
      pushToast({ type: 'error', title: 'Action failed', message: e?.response?.data?.detail || 'Try again' });
    }
  };

  return (
    <div className="k-page">
      <div className="k-pageh">
        <h1 className="k-pageh__title">{isClient ? 'My Approvals' : 'Approvals'}</h1>
        <span className="k-pageh__sans">अनुमोदन</span>
      </div>

      {loading && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {requests.map((r) => {
          const data = typeof r.request_data === 'string' ? JSON.parse(r.request_data) : r.request_data;
          return (
            <div key={r.approval_id} className="k-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,130,198,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  📋
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    {data?.title || r.task_title || 'Untitled task'}
                  </div>
                  {data?.description && (
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 4 }}>{data.description}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                    {isClient
                      ? `Submitted by ${r.requested_by_name || r.requested_by_email || 'team'}`
                      : `From ${r.requested_by_name || r.requested_by_email}`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 'var(--sp-4)' }}>
                <button className="k-btn k-btn--primary k-btn--sm" onClick={() => decide(r.approval_id, 'approved')}>
                  Approve
                </button>
                <button className="k-btn k-btn--ghost k-btn--sm" style={{ color: 'var(--danger)' }} onClick={() => decide(r.approval_id, 'rejected')}>
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
