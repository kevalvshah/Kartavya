/**
 * TemplatesPage.jsx — Week 3: project templates + task templates.
 *
 * Project templates:
 *   - Save any existing project as a template (snapshots columns + field defs)
 *   - Create a new project from a template (applies columns + sample tasks)
 *   - List all templates with delete
 *
 * Task templates:
 *   - Create named task templates with default title, description, priority
 *   - Quick-create a task from a template inside any project
 *   - List + delete
 */
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/ui/toast';
import { useNavigate } from 'react-router-dom';

// ── helpers ────────────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', marginBottom: 16, borderBottom: '1px solid var(--border-default)', paddingBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function EmptyMsg({ children }) {
  return <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: '20px 0', textAlign: 'center' }}>{children}</div>;
}

const inputSt = { border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--bg-default)', color: 'var(--text-default)', outline: 'none', width: '100%', boxSizing: 'border-box' };
const btnPrimary = { border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', background: 'var(--accent-default)', color: '#fff' };
const btnGhost   = { ...btnPrimary, background: 'var(--bg-muted)', color: 'var(--text-default)', border: '1px solid var(--border-default)' };
const btnDanger  = { ...btnGhost, color: '#ef4444', borderColor: '#ef444444' };

export default function TemplatesPage() {
  const { pushToast } = useToast();
  const navigate = useNavigate();

  // data
  const [projTemplates, setProjTemplates] = useState([]);
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [projects,      setProjects]      = useState([]);
  const [loading,       setLoading]       = useState(true);

  // project template form
  const [saveFrom,  setSaveFrom]  = useState('');   // team_id to snapshot
  const [ptName,    setPtName]    = useState('');
  const [ptDesc,    setPtDesc]    = useState('');
  const [saving,    setSaving]    = useState(false);

  // apply project template form
  const [applyTmpl, setApplyTmpl] = useState('');   // template_id
  const [applyToProject, setApplyToProject] = useState(''); // existing team_id
  const [applying,  setApplying]  = useState(false);

  // task template form
  const [ttName,    setTtName]    = useState('');
  const [ttTitle,   setTtTitle]   = useState('');
  const [ttDesc,    setTtDesc]    = useState('');
  const [ttPrio,    setTtPrio]    = useState('medium');
  const [ttProject, setTtProject] = useState(''); // optional scoped project
  const [ttSaving,  setTtSaving]  = useState(false);

  // quick-create from task template
  const [quickTmpl,    setQuickTmpl]    = useState(''); // task template_id
  const [quickProject, setQuickProject] = useState(''); // team_id to create task in
  const [creating,     setCreating]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pt, tt, pr] = await Promise.all([
        api.get('/templates/projects'),
        api.get('/templates/tasks'),
        api.get('/teams'),
      ]);
      setProjTemplates(pt.data);
      setTaskTemplates(tt.data);
      setProjects(pr.data);
    } catch (_) { pushToast({ type: 'error', title: 'Could not load templates' }); }
    finally { setLoading(false); }
  }, [pushToast]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // ── Save project as template ───────────────────────────────────────────────
  const saveProjectAsTemplate = async () => {
    if (!ptName.trim() || !saveFrom) { pushToast({ type: 'error', title: 'Choose a project and enter a name' }); return; }
    setSaving(true);
    try {
      // snapshot current project's columns + field defs
      const [colR, fieldR] = await Promise.all([
        api.get(`/projects/${saveFrom}/columns`),
        api.get(`/fields/team/${saveFrom}`).catch(() => ({ data: [] })),
      ]);
      const config = {
        columns: colR.data.map(c => ({ name: c.name, color: c.color, is_done: c.is_done })),
        fields:  fieldR.data.map(f => ({ name: f.name, type: f.type, config: f.config })),
        sample_tasks: [], // empty by default; user can add later
      };
      await api.post('/templates/projects', { name: ptName.trim(), description: ptDesc.trim() || null, config });
      pushToast({ type: 'success', title: `Template "${ptName}" saved` });
      setPtName(''); setPtDesc(''); setSaveFrom('');
      load();
    } catch (_) { pushToast({ type: 'error', title: 'Could not save template' }); }
    finally { setSaving(false); }
  };

  // ── Apply project template ────────────────────────────────────────────────
  const applyProjectTemplate = async () => {
    if (!applyTmpl || !applyToProject) { pushToast({ type: 'error', title: 'Choose a template and target project' }); return; }
    setApplying(true);
    try {
      const res = await api.post(`/templates/projects/${applyTmpl}/apply?team_id=${applyToProject}`);
      pushToast({ type: 'success', title: `Applied — ${res.data.created.columns} columns, ${res.data.created.tasks} tasks created` });
      setApplyTmpl(''); setApplyToProject('');
      navigate(`/projects/${applyToProject}`);
    } catch (_) { pushToast({ type: 'error', title: 'Could not apply template' }); }
    finally { setApplying(false); }
  };

  // ── Create task template ──────────────────────────────────────────────────
  const createTaskTemplate = async () => {
    if (!ttName.trim() || !ttTitle.trim()) { pushToast({ type: 'error', title: 'Template name and task title are required' }); return; }
    setTtSaving(true);
    try {
      await api.post('/templates/tasks', {
        name: ttName.trim(),
        team_id: ttProject || null,
        config: { title_pattern: ttTitle.trim(), description: ttDesc.trim() || null, priority: ttPrio },
      });
      pushToast({ type: 'success', title: `Task template "${ttName}" created` });
      setTtName(''); setTtTitle(''); setTtDesc(''); setTtPrio('medium'); setTtProject('');
      load();
    } catch (_) { pushToast({ type: 'error', title: 'Could not create task template' }); }
    finally { setTtSaving(false); }
  };

  // ── Quick-create task from template ──────────────────────────────────────
  const quickCreateFromTemplate = async () => {
    if (!quickTmpl || !quickProject) { pushToast({ type: 'error', title: 'Choose a template and target project' }); return; }
    setCreating(true);
    try {
      const tmpl = taskTemplates.find(t => t.template_id === quickTmpl);
      if (!tmpl) throw new Error('Template not found');
      const cfg = typeof tmpl.config === 'string' ? JSON.parse(tmpl.config) : tmpl.config;
      await api.post('/tasks', {
        title: cfg.title_pattern || tmpl.name,
        description: cfg.description || null,
        priority: cfg.priority || 'medium',
        team_id: quickProject,
      });
      pushToast({ type: 'success', title: 'Task created from template' });
      setQuickTmpl(''); setQuickProject('');
      navigate(`/projects/${quickProject}`);
    } catch (_) { pushToast({ type: 'error', title: 'Could not create task' }); }
    finally { setCreating(false); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────────
  const deleteProjTmpl = async (id, name) => {
    if (!window.confirm(`Delete template "${name}"?`)) return;
    try { await api.delete(`/templates/projects/${id}`); load(); pushToast({ type: 'success', title: 'Template deleted' }); }
    catch (_) { pushToast({ type: 'error', title: 'Could not delete' }); }
  };
  const deleteTaskTmpl = async (id, name) => {
    if (!window.confirm(`Delete template "${name}"?`)) return;
    try { await api.delete(`/templates/tasks/${id}`); load(); pushToast({ type: 'success', title: 'Template deleted' }); }
    catch (_) { pushToast({ type: 'error', title: 'Could not delete' }); }
  };

  if (loading) return <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Loading templates…</div>;

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 860 }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-semibold)', marginBottom: 32 }}>📄 Templates</h1>

      {/* ── Project Templates ── */}
      <Section title="Project Templates">
        {/* Save a project as template */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 12 }}>⊕ Save project as template</div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Source project</div>
              <select style={inputSt} value={saveFrom} onChange={e => setSaveFrom(e.target.value)}>
                <option value=''>Choose project…</option>
                {projects.map(p => <option key={p.team_id} value={p.team_id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Template name</div>
              <input style={inputSt} value={ptName} onChange={e => setPtName(e.target.value)} placeholder="e.g. Client onboarding" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Description (optional)</div>
              <input style={inputSt} value={ptDesc} onChange={e => setPtDesc(e.target.value)} placeholder="What is this template for?" />
            </div>
          </div>
          <div style={{ marginTop: 12 }}><button style={btnPrimary} disabled={saving || !saveFrom || !ptName.trim()} onClick={saveProjectAsTemplate}>{saving ? 'Saving…' : 'Save as Template'}</button></div>
          <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Snapshots columns and custom field definitions. Tasks are not copied.</div>
        </div>

        {/* Apply a project template */}
        {projTemplates.length > 0 && (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 12 }}>▶ Apply template to a project</div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Template</div>
                <select style={inputSt} value={applyTmpl} onChange={e => setApplyTmpl(e.target.value)}>
                  <option value=''>Choose template…</option>
                  {projTemplates.map(t => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Target project</div>
                <select style={inputSt} value={applyToProject} onChange={e => setApplyToProject(e.target.value)}>
                  <option value=''>Choose project…</option>
                  {projects.map(p => <option key={p.team_id} value={p.team_id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}><button style={btnPrimary} disabled={applying || !applyTmpl || !applyToProject} onClick={applyProjectTemplate}>{applying ? 'Applying…' : 'Apply Template'}</button></div>
            <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Adds columns and sample tasks to the target project without removing existing data.</div>
          </div>
        )}

        {/* List */}
        {projTemplates.length === 0
          ? <EmptyMsg>No project templates yet. Save your first one above.</EmptyMsg>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {projTemplates.map(t => {
                const cfg = typeof t.config === 'string' ? JSON.parse(t.config) : t.config;
                return (
                  <div key={t.template_id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{t.name}</div>
                      {t.description && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{t.description}</div>}
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12 }}>
                        <span>{(cfg?.columns||[]).length} columns</span>
                        <span>{(cfg?.fields||[]).length} fields</span>
                        <span>Created {new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button style={btnDanger} onClick={() => deleteProjTmpl(t.template_id, t.name)}>✕ Delete</button>
                  </div>
                );
              })}
            </div>
          )
        }
      </Section>

      {/* ── Task Templates ── */}
      <Section title="Task Templates">
        {/* Create task template */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 12 }}>⊕ New task template</div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Template name</div>
              <input style={inputSt} value={ttName} onChange={e => setTtName(e.target.value)} placeholder="e.g. Bug report" />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Default title</div>
              <input style={inputSt} value={ttTitle} onChange={e => setTtTitle(e.target.value)} placeholder="e.g. Bug: [describe issue]" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Default description</div>
              <textarea style={{ ...inputSt, resize: 'vertical' }} rows={2} value={ttDesc} onChange={e => setTtDesc(e.target.value)} placeholder="Template description / instructions…" />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Default priority</div>
              <select style={inputSt} value={ttPrio} onChange={e => setTtPrio(e.target.value)}>
                {['low','medium','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Scope to project (optional)</div>
              <select style={inputSt} value={ttProject} onChange={e => setTtProject(e.target.value)}>
                <option value=''>All projects (global)</option>
                {projects.map(p => <option key={p.team_id} value={p.team_id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}><button style={btnPrimary} disabled={ttSaving || !ttName.trim() || !ttTitle.trim()} onClick={createTaskTemplate}>{ttSaving ? 'Saving…' : 'Create Template'}</button></div>
        </div>

        {/* Quick-create from template */}
        {taskTemplates.length > 0 && (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 12 }}>⚡ Quick-create task from template</div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Template</div>
                <select style={inputSt} value={quickTmpl} onChange={e => setQuickTmpl(e.target.value)}>
                  <option value=''>Choose template…</option>
                  {taskTemplates.map(t => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Target project</div>
                <select style={inputSt} value={quickProject} onChange={e => setQuickProject(e.target.value)}>
                  <option value=''>Choose project…</option>
                  {projects.map(p => <option key={p.team_id} value={p.team_id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}><button style={btnPrimary} disabled={creating || !quickTmpl || !quickProject} onClick={quickCreateFromTemplate}>{creating ? 'Creating…' : 'Create Task'}</button></div>
          </div>
        )}

        {/* List */}
        {taskTemplates.length === 0
          ? <EmptyMsg>No task templates yet. Create your first one above.</EmptyMsg>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {taskTemplates.map(t => {
                const cfg = typeof t.config === 'string' ? JSON.parse(t.config) : t.config;
                const scope = t.team_id ? projects.find(p => p.team_id === t.team_id)?.name || t.team_id : 'Global';
                return (
                  <div key={t.template_id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{t.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>Title: “{cfg?.title_pattern}”</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 10 }}>
                        <span>Priority: {cfg?.priority || 'medium'}</span>
                        <span>Scope: {scope}</span>
                      </div>
                    </div>
                    <button style={btnDanger} onClick={() => deleteTaskTmpl(t.template_id, t.name)}>✕ Delete</button>
                  </div>
                );
              })}
            </div>
          )
        }
      </Section>
    </div>
  );
}

