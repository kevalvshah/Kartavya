/**
 * ApprovalsPage.jsx
 * - admin/member: see all pending approvals, can approve or reject.
 * - client: sees only approval requests on THEIR tasks (tasks where
 *   they are the requester or the task is shared with them), and can
 *   approve/reject those.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { currentUser } from '../lib/auth';
import { Button } from '../components/ui/button';
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
      // Clients hit /client/approvals which returns only approvals on
      // tasks visible to them. Members/admins hit /approvals/pending.
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
      pushToast({ type: 'success', title: status === 'approved' ? 'Approved ✓' : 'Rejected' });
      load();
    } catch (e) {
      pushToast({ type: 'error', title: 'Action failed', message: e?.response?.data?.detail || 'Try again' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-sm font-bold">
        {isClient ? 'Tasks Awaiting Your Review' : 'Approvals'}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!loading && requests.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {isClient ? 'No tasks awaiting your review.' : 'All caught up — nothing pending.'}
        </div>
      )}

      {requests.map((r) => {
        const data = typeof r.request_data === 'string' ? JSON.parse(r.request_data) : r.request_data;
        return (
          <div key={r.approval_id} className="rounded-3xl border border-border/70 bg-card/50 p-5">
            <div className="text-sm font-bold">{data?.title || r.task_title || 'Untitled task'}</div>
            {data?.description && (
              <div className="text-xs text-muted-foreground mt-1">{data.description}</div>
            )}
            <div className="text-xs text-muted-foreground mt-2">
              {isClient
                ? `Submitted by ${r.requested_by_name || r.requested_by_email || 'team'}`
                : `From ${r.requested_by_name || r.requested_by_email}`}
            </div>
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
