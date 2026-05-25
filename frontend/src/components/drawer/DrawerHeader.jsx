import React from 'react';
import { Trash2 } from 'lucide-react';
import { STATUS_LABELS, STATUS_COLORS } from './constants';

/**
 * DrawerHeader — breadcrumb / status badge, title input, and action buttons
 * (save indicator, delete task, close).
 */
export default function DrawerHeader({
  task, draft, setDraft, saving,
  canDeleteTask, deletingTask,
  onClose, onDeleteTask, saveTask,
}) {
  return (
    <>
      {/* Breadcrumb / header */}
      <div className="k-dr__head">
        <div className="k-dr__crumb">
          {task?.team_id && (
            <>
              <span style={{ color: 'var(--ink-3)' }}>{task.team_name || 'Project'}</span>
              <span style={{ color: 'var(--rule-strong)' }}>/</span>
            </>
          )}
          <span style={{ padding: '2px 7px', borderRadius: 'var(--r-sm)', fontSize: 11, fontWeight: 600, background: STATUS_COLORS[draft.status] + '18', color: STATUS_COLORS[draft.status] }}>
            {STATUS_LABELS[draft.status] || draft.status}
          </span>
        </div>
        <div className="k-dr__head-actions">
          {saving && (
            <span style={{ fontSize: 11, color: 'var(--ink-3)', marginRight: 6, alignSelf: 'center' }}>
              Saving&hellip;
            </span>
          )}
          {canDeleteTask && task && (
            <button
              onClick={onDeleteTask}
              disabled={deletingTask}
              className="k-iconbtn"
              aria-label="Delete task"
              title="Delete task"
              style={{ color: 'var(--k-danger)' }}
            >
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={onClose} className="k-iconbtn" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="k-dr__title">
        {task ? (
          <input
            value={draft.title || ''}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            onBlur={() => draft.title !== task.title && saveTask({ title: draft.title })}
            style={{
              width: '100%', border: 'none', outline: 'none',
              fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500,
              background: 'transparent', color: 'var(--ink)', padding: 0,
            }}
          />
        ) : (
          <div style={{ height: 28, background: 'var(--rule-soft)', borderRadius: 4, width: '65%' }} />
        )}
        {task && <div className="k-dr__id">#{task.task_id?.slice(-6)}</div>}
      </div>
    </>
  );
}
