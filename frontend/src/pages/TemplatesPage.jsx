/**
 * TemplatesPage.jsx — k-* design system.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/ui/toast';
import { useNavigate } from 'react-router-dom';

export default function TemplatesPage() {
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const [projTemplates, setProjTemplates] = useState([]);
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [projects,      setProjects]      = useState([]);
  const [loading,       setLoading]       = useState(true);

  const [saveFrom,  setSaveFrom]  = useState('');
  const [ptName,    setPtName]    = useState('');
  const [ptDesc,    setPtDesc]    = useState('');
  const [saving,    setSaving]    = useState(false);

  const [applyTmpl,      setApplyTmpl]      = useState('');
  const [applyToProject, setApplyToProject] = useState('');
  const [applying,       setApplying]       = useState(false);

  const [ttName,    setTtName]    = useState('');
  const [ttTitle,   setTtTitle]   = useState('');
  const [ttDesc,    setTtDesc]    = useState('');
  const [ttPrio,    setTtPrio]    = useState('medium');
  const [ttProject, setTtProject] = useState('');
  const [ttSaving,  setTtSaving]  = useState(false);

  const [quickTmpl,    setQuickTmpl]    = useState('');
  const [quickProject, setQuickProject] = useState('');
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

  const saveProjectAsTemplate = async () => {
    if (!ptName.trim() || !saveFrom) { pushToast({ type: 'error', title: 'Choose a project and enter a name' }); return; }
    setSaving(true);
    try {
      const [colR, fieldR] = await Promise.all([
        api.get(`/projects/${saveFrom}/columns`),
        api.get(`/fields/team/${saveFrom}`).catch(() => ({ data: [] })),
      ]);
      const config = {
        columns: colR.data.map(c => ({ name: c.name, color: c.color, is_done: c.is_done })),
        fields:  fieldR.data.map(f => ({ name: f.name, type: f.type, config: f.config })),
        sample_tasks: [],
      };
      await api.post('/templates/projects', { name: ptName.trim(), description: ptDesc.trim() || null, config });
      pushToast({ type: 'success', title: `Template "${ptName}" saved` });
      setPtName(''); setPtDesc(''); setSaveFrom(''); load();
    } catch (_) { pushToast({ type: 'error', title: 'Could not save template' }); }
    finally { setSaving(false); }
  };

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

  const createTaskTemplate = async () => {
    if (!ttName.trim() || !ttTitle.trim()) { pushToast({ type: 'error', title: 'Template name and task title are required' }); return; }
    setTtSaving(true);
    try {
      await api.post('/templates/tasks', {
        name: ttName.trim(), team_id: ttProject || null,
        config: { title_pattern: ttTitle.trim(), description: ttDesc.trim() || null, priority: ttPrio },
      });
      pushToast({ type: 'success', title: `Task template "${ttName}" created` });
      setTtName(''); setTtTitle(''); setTtDesc(''); setTtPrio('medium'); setTtProject(''); load();
    } catch (_) { pushToast({ type: 'error', title: 'Could not create task template' }); }
    finally { setTtSaving(false); }
  };

  const quickCreateFromTemplate = async () => {
    if (!quickTmpl || !quickProject) { pushToast({ type: 'error', title: 'Choose a template and target project' }); return; }
    setCreating(true);
    try {
      const tmpl = taskTemplates.find(t => t.template_id === quickTmpl);
      if (!tmpl) throw new Error('Template not found');
      const cfg = typeof tmpl.config === 'string' ? JSON.parse(tmpl.config) : tmpl.config;
      await api.post('/tasks', { title: cfg.title_pattern || tmpl.name, description: cfg.description || null, priority: cfg.priority || 'medium', team_id: quickProject });
      pushToast({ type: 'success', title: 'Task created from template' });
      setQuickTmpl(''); setQuickProject('');
      navigate(`/projects/${quickProject}`);
    } catch (_) { pushToast({ type: 'error', title: 'Could not create task' }); }
    finally { setCreating(false); }
  };

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

  if (loading) return (
    <div className="k-page">
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>Loading templates…</div>
    </div>
  );

  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' };

  return (
    <div className="k-page">
      <div className="k-pageh">
        <h1 className="k-pageh__title">Templates</h1>
        <span className="k-pageh__sans">साँचा</span>
      </div>

      {/* ── Project Templates ── */}
      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 'var(--sp-4)', paddingBottom: 'var(--sp-3)', borderBottom: '1px solid var(--rule-soft)' }}>
          Project Templates
        </div>

        <div className="k-card" style={{ marginBottom: 'var(--sp-4)' }}>
          <div className="k-card__head"><span className="k-card__title">Save project as template</span></div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label style={labelStyle}>Source project</label>
              <select className="k-select" style={{ width: '100%' }} value={saveFrom} onChange={e => setSaveFrom(e.target.value)}>
                <option value=''>Choose project…</option>
                {projects.map(p => <option key={p.team_id} value={p.team_id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Template name</label>
              <input className="k-input" value={ptName} onChange={e => setPtName(e.target.value)} placeholder="e.g. Client onboarding" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Description (optional)</label>
              <input className="k-input" value={ptDesc} onChange={e => setPtDesc(e.target.value)} placeholder="What is this template for?" />
            </div>
          </div>
          <div style={{ marginTop: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="k-btn k-btn--primary" disabled={saving || !saveFrom || !ptName.trim()} onClick={saveProjectAsTemplate}>
              {saving ? 'Saving…' : 'Save as Template'}
            </button>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Snapshots columns and field definitions. Tasks are not copied.</span>
          </div>
        </div>

        {projTemplates.length > 0 && (
          <div className="k-card" style={{ marginBottom: 'var(--sp-4)' }}>
            <div className="k-card__head"><span className="k-card__title">Apply template to project</span></div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label style={labelStyle}>Template</label>
                <select className="k-select" style={{ width: '100%' }} value={applyTmpl} onChange={e => setApplyTmpl(e.target.value)}>
                  <option value=''>Choose template…</option>
                  {projTemplates.map(t => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Target project</label>
                <select className="k-select" style={{ width: '100%' }} value={applyToProject} onChange={e => setApplyToProject(e.target.value)}>
                  <option value=''>Choose project…</option>
                  {projects.map(p => <option key={p.team_id} value={p.team_id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 'var(--sp-4)' }}>
              <button className="k-btn k-btn--primary" disabled={applying || !applyTmpl || !applyToProject} onClick={applyProjectTemplate}>
                {applying ? 'Applying…' : 'Apply Template'}
              </button>
            </div>
          </div>
        )}

        {projTemplates.length === 0 ? (
          <div className="k-empty__sub" style={{ textAlign: 'center', padding: 'var(--sp-5)' }}>No project templates yet. Save your first one above.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {projTemplates.map(t => {
              const cfg = typeof t.config === 'string' ? JSON.parse(t.config) : t.config;
              return (
                <div key={t.template_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--rule-soft)', borderRadius: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{t.name}</div>
                    {t.description && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{t.description}</div>}
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4, display: 'flex', gap: 12 }}>
                      <span>{(cfg?.columns||[]).length} columns</span>
                      <span>{(cfg?.fields||[]).length} fields</span>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button className="k-iconbtn" style={{ color: 'var(--danger)' }} onClick={() => deleteProjTmpl(t.template_id, t.name)} title="Delete">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9"/></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Task Templates ── */}
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 'var(--sp-4)', paddingBottom: 'var(--sp-3)', borderBottom: '1px solid var(--rule-soft)' }}>
          Task Templates
        </div>

        <div className="k-card" style={{ marginBottom: 'var(--sp-4)' }}>
          <div className="k-card__head"><span className="k-card__title">New task template</span></div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label style={labelStyle}>Template name</label>
              <input className="k-input" value={ttName} onChange={e => setTtName(e.target.value)} placeholder="e.g. Bug report" />
            </div>
            <div>
              <label style={labelStyle}>Default title</label>
              <input className="k-input" value={ttTitle} onChange={e => setTtTitle(e.target.value)} placeholder="e.g. Bug: [describe issue]" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Default description</label>
              <textarea className="k-input" style={{ resize: 'vertical' }} rows={2} value={ttDesc} onChange={e => setTtDesc(e.target.value)} placeholder="Template description / instructions…" />
            </div>
            <div>
              <label style={labelStyle}>Default priority</label>
              <select className="k-select" style={{ width: '100%' }} value={ttPrio} onChange={e => setTtPrio(e.target.value)}>
                {['low','medium','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Scope to project (optional)</label>
              <select className="k-select" style={{ width: '100%' }} value={ttProject} onChange={e => setTtProject(e.target.value)}>
                <option value=''>All projects (global)</option>
                {projects.map(p => <option key={p.team_id} value={p.team_id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <button className="k-btn k-btn--primary" disabled={ttSaving || !ttName.trim() || !ttTitle.trim()} onClick={createTaskTemplate}>
              {ttSaving ? 'Saving…' : 'Create Template'}
            </button>
          </div>
        </div>

        {taskTemplates.length > 0 && (
          <div className="k-card" style={{ marginBottom: 'var(--sp-4)' }}>
            <div className="k-card__head"><span className="k-card__title">Quick-create from template</span></div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label style={labelStyle}>Template</label>
                <select className="k-select" style={{ width: '100%' }} value={quickTmpl} onChange={e => setQuickTmpl(e.target.value)}>
                  <option value=''>Choose template…</option>
                  {taskTemplates.map(t => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Target project</label>
                <select className="k-select" style={{ width: '100%' }} value={quickProject} onChange={e => setQuickProject(e.target.value)}>
                  <option value=''>Choose project…</option>
                  {projects.map(p => <option key={p.team_id} value={p.team_id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 'var(--sp-4)' }}>
              <button className="k-btn k-btn--primary" disabled={creating || !quickTmpl || !quickProject} onClick={quickCreateFromTemplate}>
                {creating ? 'Creating…' : 'Create Task'}
              </button>
            </div>
          </div>
        )}

        {taskTemplates.length === 0 ? (
          <div className="k-empty__sub" style={{ textAlign: 'center', padding: 'var(--sp-5)' }}>No task templates yet. Create your first one above.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {taskTemplates.map(t => {
              const cfg = typeof t.config === 'string' ? JSON.parse(t.config) : t.config;
              const scope = t.team_id ? projects.find(p => p.team_id === t.team_id)?.name || t.team_id : 'Global';
              return (
                <div key={t.template_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--rule-soft)', borderRadius: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Title: "{cfg?.title_pattern}"</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2, display: 'flex', gap: 10 }}>
                      <span>Priority: {cfg?.priority || 'medium'}</span>
                      <span>Scope: {scope}</span>
                    </div>
                  </div>
                  <button className="k-iconbtn" style={{ color: 'var(--danger)' }} onClick={() => deleteTaskTmpl(t.template_id, t.name)} title="Delete">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9"/></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
