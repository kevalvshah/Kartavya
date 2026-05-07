/**
 * ApprovalsPage.jsx — review client requests + tasks pending sign-off.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { K } from '../lib/brand';
import { Button } from '../components/ui/button';
import { Modal }  from '../components/ui/modal';
import { useToast } from '../components/ui/toast';
import { CheckCircle2 } from 'lucide-react';

export default function ApprovalsPage() {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [items,     setItems]     = useState([]);
  const [requests,  setRequests]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [notes,     setNotes]     = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, rRes] = await Promise.all([
        api.get('/tasks/pending-approval').catch(() => ({ data: [] })),
        api.get('/approvals/pending').catch(() => ({ data: [] })),
      ]);
      setItems(tRes.data || []); setRequests(rRes.data || []);
    } catch (_) { pushToast({ type: 'error', title: 'Could not load approvals' }); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const decideTask = async (taskId, action) => {
    try { await api.post(`/tasks/${taskId}/${action}`, { notes }); pushToast({ type: 'success', title: action === 'approve' ? 'Approved' : 'Rejected' }); setReviewing(null); setNotes(''); load(); }
    catch (e) { pushToast({ type: 'error', title: 'Action failed', message: e?.response?.data?.detail }); }
  };
  const decideRequest = async (approvalId, status) => {
    try { await api.post(`/approvals/${approvalId}/review`, { status, notes }); pushToast({ type: 'success', title: status === 'approved' ? 'Approved' : 'Rejected' }); setReviewing(null); setNotes(''); load(); }
    catch (e) { pushToast({ type: 'error', title: 'Action failed', message: e?.response?.data?.detail }); }
  };

  return (
    <div className="content-wrapper">
      <div className="page-header">
        <h1 className="page-title">Approvals</h1>
        <p className="text-sm text-muted-foreground">Review client requests and tasks waiting for sign-off.</p>
      </div>
      {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted-foreground)' }}>Loading…</div>}
      {!loading && requests.length === 0 && items.length === 0 && (
        <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
          <CheckCircle2 size={48} style={{ color: K.teal, opacity: 0.4, margin: '0 auto' }} />
          <p style={{ marginTop: 16, fontSize: 15, color: 'var(--color-muted-foreground)' }}>All caught up — nothing pending.</p>
        </div>
      )}
      {requests.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--color-muted-foreground)', marginBottom: 12 }}>New requests from clients ({requests.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map(r => {
              const data = typeof r.request_data === 'string' ? JSON.parse(r.request_data) : r.request_data;
              return (
                <div key={r.approval_id} className="elevated-card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 500 }}>{data?.title}</div>
                      {data?.description && <div style={{ fontSize: 13, color: 'var(--color-muted-foreground)', marginTop: 4 }}>{data.description}</div>}
                      <div style={{ fontSize: 11, color: 'var(--color-muted-foreground)', marginTop: 8 }}>From {r.requested_by_name || r.requested_by_email}{r.created_at && ` · ${new Date(r.created_at).toLocaleString()}`}</div>
                    </div>
                    <Button variant="ghost" onClick={() => { setReviewing({ kind: 'request', id: r.approval_id, title: data?.title }); setNotes(''); }}>Review</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {items.length > 0 && (
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--color-muted-foreground)', marginBottom: 12 }}>Tasks pending sign-off ({items.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map(t => (
              <div key={t.task_id} className="elevated-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/projects/${t.team_id}`)}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{t.title}</div>
                    {t.description && <div style={{ fontSize: 13, color: 'var(--color-muted-foreground)', marginTop: 4 }}>{t.description}</div>}
                    <div style={{ fontSize: 11, color: 'var(--color-muted-foreground)', marginTop: 8 }}>{t.team_name && `${t.team_name} · `}Submitted by {t.created_by_name}{t.approval_requested_at && ` · ${new Date(t.approval_requested_at).toLocaleString()}`}</div>
                    {t.approval_notes && <div style={{ fontSize: 12, marginTop: 8, padding: '6px 10px', background: 'var(--color-muted)', borderRadius: 6 }}>Note: {t.approval_notes}</div>}
                  </div>
                  <Button variant="ghost" onClick={() => { setReviewing({ kind: 'task', id: t.task_id, title: t.title }); setNotes(''); }}>Review</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <Modal open={!!reviewing} onOpenChange={o => !o && setReviewing(null)}
        title={reviewing?.title ? `Review: ${reviewing.title}` : 'Review'}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setReviewing(null)}>Cancel</Button>
            <Button variant="ghost" onClick={() => reviewing.kind === 'task' ? decideTask(reviewing.id, 'reject') : decideRequest(reviewing.id, 'rejected')} style={{ color: '#ef4444' }}>Reject</Button>
            <Button onClick={() => reviewing.kind === 'task' ? decideTask(reviewing.id, 'approve') : decideRequest(reviewing.id, 'approved')}>Approve</Button>
          </div>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-muted-foreground)' }}>Notes (required if rejecting)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Optional context for approval, required reason for rejection…"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-input)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
        </div>
      </Modal>
    </div>
  );
}
