import React from 'react';
import { AVATAR_COLORS, userInitials, PRIORITY_COLOR as PRIORITY_COLORS } from '../../lib/utils';
import { PRIORITY_LABELS } from './constants';

/**
 * DrawerMeta — props row: priority, board column, due date, category, and assignees.
 */
export default function DrawerMeta({
  task, draft, setDraft, saveTask, onColumnChange,
  columns, members, categories,
  assigneeOpen, setAssigneeOpen, assigneeRef, toggleAssignee,
}) {
  if (!task) return null;

  const selIds     = task.assignee_user_ids || [];
  const selMembers = members.filter(m => selIds.includes(m.user_id || m.member_id));

  return (
    <div className="k-dr__props">

      {/* Priority */}
      <div className="k-prop">
        <span className="k-prop__lbl">
          Priority <span className="k-prop__sans">&#x092A;&#x094D;&#x0930;&#x093E;&#x0925;&#x092E;&#x093F;&#x0915;&#x0924;&#x093E;</span>
        </span>
        <select
          value={draft.priority || 'medium'}
          onChange={e => { setDraft(d => ({ ...d, priority: e.target.value })); saveTask({ priority: e.target.value }); }}
          className="k-input"
          style={{ color: PRIORITY_COLORS[draft.priority || 'medium'], fontWeight: 600, fontSize: 13 }}
        >
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Status (column for project tasks, status field for personal tasks) */}
      {columns.length > 0 ? (
        <div className="k-prop">
          <span className="k-prop__lbl">
            Status <span className="k-prop__sans">&#x0938;&#x094D;&#x0925;&#x093F;&#x0924;&#x093F;</span>
          </span>
          <select
            value={task.column_id || ''}
            onChange={e => { const colId = e.target.value; if (colId) onColumnChange(colId); }}
            className="k-input"
            style={{ fontSize: 13 }}
          >
            {columns
              .filter(c => !(c.name || '').toLowerCase().includes('approval'))
              .map(c => (
                <option key={c.column_id} value={c.column_id}>{c.name}</option>
              ))}
          </select>
        </div>
      ) : (
        <div className="k-prop">
          <span className="k-prop__lbl">
            Status <span className="k-prop__sans">&#x0938;&#x094D;&#x0925;&#x093F;&#x0924;&#x093F;</span>
          </span>
          <select
            value={draft.status || 'todo'}
            onChange={e => { setDraft(d => ({ ...d, status: e.target.value })); saveTask({ status: e.target.value }); }}
            className="k-input"
            style={{ fontSize: 13 }}
          >
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="in_review">In review</option>
            <option value="done">Done</option>
          </select>
        </div>
      )}

      {/* Due date */}
      <div className="k-prop">
        <span className="k-prop__lbl">
          Due date <span className="k-prop__sans">&#x0938;&#x092E;&#x092F;-&#x0938;&#x0940;&#x092E;&#x093E;</span>
        </span>
        <input
          type="date"
          className="k-input"
          value={draft.due_at ? draft.due_at.slice(0, 10) : ''}
          onChange={e => {
            const v = e.target.value ? new Date(e.target.value).toISOString() : null;
            setDraft(d => ({ ...d, due_at: v }));
            saveTask({ due_at: v });
          }}
        />
      </div>

      {/* Category */}
      <div className="k-prop">
        <span className="k-prop__lbl">
          Category <span className="k-prop__sans">&#x0936;&#x094D;&#x0930;&#x0947;&#x0923;&#x0940;</span>
        </span>
        <select
          value={draft.category_id || ''}
          onChange={e => {
            const v = e.target.value || null;
            setDraft(d => ({ ...d, category_id: v }));
            saveTask({ category_id: v });
          }}
          className="k-input"
        >
          <option value="">&ndash; None &ndash;</option>
          {categories.map(c => (
            <option key={c.category_id} value={c.category_id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Assignees */}
      <div className="k-prop" ref={assigneeRef} style={{ position: 'relative' }}>
        <span className="k-prop__lbl">
          Assignees <span className="k-prop__sans">&#x0928;&#x093F;&#x092F;&#x0941;&#x0915;&#x094D;&#x0924;</span>
        </span>
        <button
          type="button"
          onClick={() => setAssigneeOpen(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bg-soft)', border: '1px solid var(--rule)',
            borderRadius: 'var(--r-md)', padding: '6px 10px', cursor: 'pointer',
            fontFamily: 'var(--font-ui)', fontSize: 12,
            color: selMembers.length ? 'var(--ink)' : 'var(--ink-faint)', minHeight: 34,
          }}
        >
          {selMembers.length === 0 ? (
            <span style={{ flex: 1, textAlign: 'left' }}>Pick members&hellip;</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, flexWrap: 'wrap' }}>
              {selMembers.slice(0, 3).map((m, i) => {
                const name = m.display_name || m.full_name || m.name || '';
                return (
                  <span key={m.user_id || m.member_id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    background: 'var(--side-active)', borderRadius: 20,
                    padding: '1px 7px 1px 3px', fontSize: 11, fontWeight: 500,
                  }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%', fontSize: 8, fontWeight: 700,
                      background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: '#fff',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {userInitials(name)}
                    </span>
                    {name.split(' ')[0]}
                  </span>
                );
              })}
              {selMembers.length > 3 && (
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>+{selMembers.length - 3}</span>
              )}
            </div>
          )}
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0, color: 'var(--ink-3)' }}>
            <path d="M2 4l4 4 4-4" />
          </svg>
        </button>

        {assigneeOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
            background: 'var(--surface)', border: '1px solid var(--rule)',
            borderRadius: 'var(--r-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            maxHeight: 200, overflowY: 'auto',
          }}>
            {members.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                No members found
              </div>
            ) : members.map((m, i) => {
              const uid      = m.user_id || m.member_id;
              const name     = m.display_name || m.full_name || m.name || '';
              if (!name) return null;
              const jobTitle = m.member_role || m.position || m.job_title || '';
              const checked  = selIds.includes(uid);
              return (
                <button
                  key={uid}
                  type="button"
                  onClick={() => toggleAssignee(uid)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px',
                    background: checked ? 'var(--side-active)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderBottom: i < members.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                  }}
                >
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                    background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: '#fff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {userInitials(name)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
                    {jobTitle && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{jobTitle}</div>}
                  </div>
                  {checked && (
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="var(--k-primary)" strokeWidth="2">
                      <path d="M2 7l4 4 6-6" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
