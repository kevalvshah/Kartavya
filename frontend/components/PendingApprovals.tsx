import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface PendingApprovalsProps {
  userId: string;
  userRole: string;
}

interface Task {
  task_id: string;
  title: string;
  description: string;
  created_by_name: string;
  created_by_email: string;
  team_name: string;
  approval_notes?: string;
  approval_requested_at: string;
}

export function PendingApprovals({ userId, userRole }: PendingApprovalsProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Fetch pending approvals
  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tasks/pending-approval', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Failed to fetch pending approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if user is owner or admin
    if (userRole === 'owner' || userRole === 'admin') {
      fetchPendingApprovals();
    }
  }, [userRole]);

  // Approve task
  const handleApprove = async (taskId: string, notes?: string) => {
    setActioningId(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (response.ok) {
        toast.success('Task approved successfully');
        // Remove from list
        setTasks(prev => prev.filter(t => t.task_id !== taskId));
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to approve task');
      }
    } catch (error) {
      toast.error('Failed to approve task');
    } finally {
      setActioningId(null);
    }
  };

  // Reject task
  const handleReject = async (taskId: string, reason: string) => {
    if (!reason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }

    setActioningId(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: reason }),
      });

      if (response.ok) {
        toast.success('Task rejected');
        // Remove from list
        setTasks(prev => prev.filter(t => t.task_id !== taskId));
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to reject task');
      }
    } catch (error) {
      toast.error('Failed to reject task');
    } finally {
      setActioningId(null);
    }
  };

  // Don't show component if user doesn't have permission
  if (userRole !== 'owner' && userRole !== 'admin') {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Pending Approvals</h2>
        <p className="text-gray-500 text-center py-8">No pending approvals</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold">Pending Approvals ({tasks.length})</h2>
      </div>

      <div className="divide-y divide-gray-200">
        {tasks.map((task) => (
          <TaskApprovalCard
            key={task.task_id}
            task={task}
            onApprove={handleApprove}
            onReject={handleReject}
            isActioning={actioningId === task.task_id}
          />
        ))}
      </div>
    </div>
  );
}

// Individual task approval card
interface TaskApprovalCardProps {
  task: Task;
  onApprove: (taskId: string, notes?: string) => void;
  onReject: (taskId: string, reason: string) => void;
  isActioning: boolean;
}

function TaskApprovalCard({ task, onApprove, onReject, isActioning }: TaskApprovalCardProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const handleQuickApprove = () => {
    onApprove(task.task_id);
  };

  const handleApproveWithNotes = () => {
    onApprove(task.task_id, notes);
    setShowApproveForm(false);
    setNotes('');
  };

  const handleRejectWithReason = () => {
    onReject(task.task_id, rejectReason);
    setShowRejectForm(false);
    setRejectReason('');
  };

  return (
    <div className="p-6 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-medium text-gray-900 mb-1">{task.title}</h3>
          {task.description && (
            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span>From: {task.created_by_name}</span>
            {task.team_name && <span>• {task.team_name}</span>}
            <span>• {new Date(task.approval_requested_at).toLocaleDateString()}</span>
          </div>
          {task.approval_notes && (
            <div className="mt-2 p-2 bg-gray-100 rounded text-sm text-gray-700 italic">
              Note: {task.approval_notes}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleQuickApprove}
            disabled={isActioning}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isActioning ? 'Processing...' : '✔ Approve'}
          </button>
          <button
            onClick={() => setShowApproveForm(!showApproveForm)}
            className="px-4 py-2 bg-green-100 text-green-700 text-sm font-medium rounded-lg hover:bg-green-200 transition-colors"
          >
            Approve with note
          </button>
          <button
            onClick={() => setShowRejectForm(!showRejectForm)}
            disabled={isActioning}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ✖ Reject
          </button>
        </div>
      </div>

      {/* Approve with notes form */}
      {showApproveForm && (
        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Approval Note (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note for the task creator..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            rows={2}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleApproveWithNotes}
              disabled={isActioning}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Confirm Approval
            </button>
            <button
              onClick={() => setShowApproveForm(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reject with reason form */}
      {showRejectForm && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rejection Reason (Required)
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why this task needs revision..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            rows={3}
            required
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleRejectWithReason}
              disabled={isActioning || !rejectReason.trim()}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Confirm Rejection
            </button>
            <button
              onClick={() => setShowRejectForm(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
