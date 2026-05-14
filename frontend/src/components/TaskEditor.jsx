/**
 * TaskEditor.jsx — reusable create/edit task modal.
 * Used by TasksListPage and any other page needing quick task creation.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toLocal, fromLocal } from '../lib/auth';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Modal } from './ui/modal';
import { useToast } from './ui/toast';

// Hoisted outside component so identity is stable across renders
function FieldRow({ label, children }) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</div>
      {children}
    </div>
  );
}

export default function TaskEditor({
  open,
  onOpenChange,
  editing,
  categories = [],
  teams = [],
  defaultTeamId,
  /** When set on create, sent as `column_id` so the task lands in the correct board column. */
  defaultColumnId = null,
  /** On project board: hide project picker and always use `defaultTeamId` on save. */
  lockToProject = false,
  onSaved,
}) {
  const { pushToast } = useToast();
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', team_id: defaultTeamId || '', due_at: '',
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title:       editing.title       || '',
        description: editing.description || '',
        priority:    editing.priority    || 'medium',
        team_id:     editing.team_id     || defaultTeamId || '',
        due_at:      editing.due_at ? toLocal(editing.due_at) : '',
      });
    } else {
      setForm({
        title: '',
        description: '',
        priority: 'medium',
        team_id: lockToProject ? (defaultTeamId || '') : (defaultTeamId || ''),
        due_at: '',
      });
    }
  }, [open, editing, defaultTeamId, lockToProject]);

  const save = async () => {
    if (!form.title.trim()) { pushToast({ type: 'error', title: 'Missing title' }); return; }
    const teamId = lockToProject ? (defaultTeamId || null) : (form.team_id || null);
    const payload = {
      title:       form.title.trim(),
      description: form.description?.trim() || null,
      priority:    form.priority,
      team_id:     teamId,
      due_at:      fromLocal(form.due_at),
    };
    if (!editing && defaultColumnId) {
      payload.column_id = defaultColumnId;
    }
    try {
      const r = editing
        ? await api.put(`/tasks/${editing.task_id}`, payload)
        : await api.post('/tasks', payload);
      pushToast({ type: 'success', title: 'Saved' });
      onSaved(r.data);
    } catch (e) {
      pushToast({ type: 'error', title: 'Could not save', message: e?.response?.data?.detail || 'Try again.' });
    }
  };

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit task' : 'New task'}
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save task</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FieldRow label="Title">
          <Input value={form.title} onChange={upd('title')} placeholder="Task title…" autoFocus />
        </FieldRow>
        <FieldRow label="Notes">
          <textarea
            value={form.description}
            onChange={upd('description')}
            placeholder="Context, links, notes…"
            className="w-full rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none"
            rows={3}
          />
        </FieldRow>
        <div className={`grid gap-3 ${lockToProject ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {!lockToProject && (
            <FieldRow label="Project">
              <Select
                value={form.team_id}
                onChange={upd('team_id')}
                options={[
                  { value: '', label: 'Personal' },
                  ...teams.filter(t => t.team_id && t.name).map((t) => ({ value: t.team_id, label: t.name })),
                ]}
              />
            </FieldRow>
          )}
          <FieldRow label="Priority">
            <Select
              value={form.priority}
              onChange={upd('priority')}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'urgent', label: 'Urgent' },
              ]}
            />
          </FieldRow>
          <FieldRow label="Due date">
            <Input type="datetime-local" value={form.due_at} onChange={upd('due_at')} />
          </FieldRow>
        </div>
      </div>
    </Modal>
  );
}
