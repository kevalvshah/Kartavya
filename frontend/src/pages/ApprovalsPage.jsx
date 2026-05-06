import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { useToast } from '../components/ui/toast';

export default function ApprovalsPage() {
  const { pushToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/approvals/pending');
      setRequests(r.data || []);
    } catch (_) { pushToast({ type: 'error', title: 'Could not load approvals' }); }
    finally { setLoading(false); }
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
    <div className="space-y-5">
      <div className="text-sm font-bold">Approvals</div>
      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && requests.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          All caught up — nothing pending.
        </div>
      )}
      {requests.map((r) => {
        const data = typeof r.request_data === 'string' ? JSON.parse(r.request_data) : r.request_data;
        return (
          <div key={r.approval_id} className="rounded-3xl border border-border/70 bg-card/50 p-5">
            <div className="text-sm font-bold">{data?.title}</div>
            {data?.description && <div className="text-xs text-muted-foreground mt-1">{data.description}</div>}
            <div className="text-xs text-muted-foreground mt-2">From {r.requested_by_name || r.requested_by_email}</div>
            <div className="flex gap-2 mt-3">
              <Button onClick={() => decide(r.approval_id, 'approved')}>Approve</Button>
              <Button variant="ghost" onClick={() => decide(r.approval_id, 'rejected')}>Reject</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
