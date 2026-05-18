/**
 * TemplatesPage.jsx — editorial Templates screen.
 * Layout: tabs (Project / Task) → template card grid → Save as template form
 */
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/ui/toast';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/editorial';

const KICKER_COLORS = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1'];
const KICKER_SANS   = ['राज्यस्व', 'स्वागत', 'विपणन', 'कार्यालय', 'विधि', 'सेवा', 'परियोजना'];

function getKicker(t, idx) {
  // Use description first word, or template name's first word uppercased
  const word = (t.description || t.name || '').split(/\s+/)[0];
  return word.slice(0, 10).toUpperCase();
}

export default function TemplatesPage() {
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const [projTemplates, setProjTemplates] = useState([]);
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [projects,      setProjects]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState('project');

  const [saveFrom,  setSaveFrom]  = useState('');
  const [ptName,    setPtName]    = useState('');
  const [ptDesc,    setPtDesc]    = useState('');
  const [saving,    setSaving]    = useState(false);

  const [applyTmpl,      setApplyTmpl]      = useState('');
  const [applyToProject, setApplyToProject] = useState('');
  const [applying,       setApplying]       = useState(false);

  const [showSaveForm, setShowSaveForm] = useState(false);

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

  useEffect(() => { load(); }, [load]);

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
      setPtName(''); setPtDesc(''); setSaveFrom(''); setShowSaveForm(false); load();
    } catch (_) { pushToast({ type: 'error', title: 'Could not save template' }); }
    finally { setSaving(false); }
  };

  const applyProjectTemplate = async (tmplId) => {
    if (!applyToProject) { pushToast({ type: 'error', title: 'Choose a target project' }); return; }
    setApplying(true);
    try {
      const res = await api.post(`/templates/projects/${tmplId}/apply?team_id=${applyToProject}`);
      pushToast({ type: 'success', title: `Applied — ${res.data.created.columns} columns created` });
      navigate(`/projects/${applyToProject}`);
    } catch (_) { pushToast({ type: 'error', title: 'Could not apply template' }); }
    finally { setApplying(false); }
  };

  const deleteProjTmpl = async (id, name) => {
    if (!window.confirm(`Delete template "${name}"?`)) return;
    try { await api.delete(`/templates/projects/${id}`); load(); pushToast({ type: 'success', title: 'Template deleted' }); }
    catch (_) { pushToast({ type: 'error', title: 'Could not delete' }); }
  };

  const currentTemplates = tab === 'project' ? projTemplates : taskTemplates;

  return (
    <div className="k-screen">
      <PageHeader
        kicker="OPERATIONS"
        title="Templates"
        sanskrit="साँचा"
        lede="Bootstrap a new project or task from something that worked before."
      />

      {/* Tabs */}
      <div className="k-tmpl-tabs">
        <button
          className={'k-tmpl-tab' + (tab === 'project' ? ' is-active' : '')}
          onClick={() => setTab('project')}
        >
          Project templates
          <span className="k-tmpl-tab__sans">परियोजना</span>
          <span className="k-tmpl-tab__count">{projTemplates.length}</span>
        </button>
        <button
          className={'k-tmpl-tab' + (tab === 'task' ? ' is-active' : '')}
          onClick={() => setTab('task')}
        >
          Task templates
          <span className="k-tmpl-tab__sans">कार्य</span>
          <span className="k-tmpl-tab__count">{taskTemplates.length}</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
          Loading templates…
        </div>
      ) : (
        <>
          {/* Template cards grid */}
          <div className="k-tmpl-grid">
            {currentTemplates.map((t, idx) => {
              const cfg     = typeof t.config === 'string' ? JSON.parse(t.config) : (t.config || {});
              const color   = KICKER_COLORS[idx % KICKER_COLORS.length];
              const sans    = KICKER_SANS[idx % KICKER_SANS.length];
              const kicker  = getKicker(t, idx);
              const cols    = (cfg.columns || []).length;
              const fields  = (cfg.fields  || []).length;
              const used    = t.use_count || 0;
              return (
                <div key={t.template_id} className="k-tmpl-card">
                  <div className="k-tmpl-card__head">
                    <div className="k-tmpl-card__body">
                      <div className="k-tmpl-card__kicker" style={{ color }}>{kicker}</div>
                      <div className="k-tmpl-card__name">{t.name}</div>
                      {t.description && <div className="k-tmpl-card__desc">{t.description}</div>}
                    </div>
                    <div className="k-tmpl-card__sans" style={{ color }}>{sans}</div>
                  </div>

                  {tab === 'project' && (
                    <div className="k-tmpl-card__stats">
                      <div className="k-tmpl-card__stat"><b>{cols}</b><span>COLUMNS</span></div>
                      <div className="k-tmpl-card__stat"><b>{fields}</b><span>FIELDS</span></div>
                      <div className="k-tmpl-card__stat"><b>{used}</b><span>USED</span></div>
                    </div>
                  )}

                  <div className="k-tmpl-card__foot">
                    {tab === 'project' ? (
                      <>
                        <button
                          className="k-btn k-btn--primary k-btn--sm"
                          onClick={() => {
                            setApplyTmpl(t.template_id);
                            if (projects.length === 1) { applyProjectTemplate(t.template_id); }
                            else {
                              const target = window.prompt(`Apply "${t.name}" to which project?\n${projects.map((p,i) => `${i+1}. ${p.name}`).join('\n')}\n\nEnter number:`);
                              const p = projects[parseInt(target, 10) - 1];
                              if (p) { setApplyToProject(p.team_id); applyProjectTemplate(t.template_id); }
                            }
                          }}
                          disabled={applying}
                        >
                          Use template
                        </button>
                        <button
                          className="k-btn k-btn--ghost k-btn--sm"
                          onClick={() => pushToast({ type: 'info', title: `"${t.name}" — ${cols} columns, ${fields} fields` })}
                        >
                          Preview
                        </button>
                        <button
                          className="k-iconbtn"
                          style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}
                          title="Delete"
                          onClick={() => deleteProjTmpl(t.template_id, t.name)}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                            <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9"/>
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                          {cfg?.priority || 'medium'}{' priority'}
                        </span>
                        <button
                          className="k-iconbtn"
                          style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}
                          title="Delete"
                          onClick={async () => {
                            if (!window.confirm(`Delete template "${t.name}"?`)) return;
                            try { await api.delete(`/templates/tasks/${t.template_id}`); load(); } catch (_) {}
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                            <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9"/>
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Save as template card (project tab) */}
            {tab === 'project' && (
              <button className="k-tmpl-card k-tmpl-card--new" onClick={() => setShowSaveForm(v => !v)}>
                <div className="k-tmpl-card__plus">+</div>
                <div className="k-tmpl-card__new-title">Save current project as template</div>
                <div className="k-tmpl-card__new-sub">Captures columns and custom fields. Tasks are not copied.</div>
              </button>
            )}
          </div>

          {/* Save as template form */}
          {tab === 'project' && showSaveForm && (
            <section className="k-card">
              <div className="k-card__head">
                <div className="k-card__titles">
                  <h3 className="k-card__title">Save as template</h3>
                  <span className="k-card__sans">संरक्षित</span>
                </div>
              </div>
              <div className="k-card__body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label className="k-label">Source project</label>
                    <select className="k-input" style={{ width: '100%', cursor: 'pointer' }} value={saveFrom} onChange={e => setSaveFrom(e.target.value)}>
                      <option value=''>Choose project…</option>
                      {projects.map(p => <option key={p.team_id} value={p.team_id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="k-label">Template name</label>
                    <input className="k-input" value={ptName} onChange={e => setPtName(e.target.value)} placeholder="e.g. Quarterly client review" />
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label className="k-label">Description (optional)</label>
                  <input className="k-input" style={{ width: '100%' }} value={ptDesc} onChange={e => setPtDesc(e.target.value)} placeholder="What is this template for?" />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="k-btn k-btn--primary" disabled={saving || !saveFrom || !ptName.trim()} onClick={saveProjectAsTemplate}>
                    {saving ? 'Saving…' : 'Save template'}
                  </button>
                  <button className="k-btn k-btn--ghost" onClick={() => setShowSaveForm(false)}>Cancel</button>
                </div>
              </div>
            </section>
          )}

          {currentTemplates.length === 0 && tab !== 'project' && (
            <div className="k-empty">
              <div className="k-empty__icon">📋</div>
              <div className="k-empty__title">No task templates yet</div>
              <div className="k-empty__sub">Create task templates from the API or TaskEditor.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
