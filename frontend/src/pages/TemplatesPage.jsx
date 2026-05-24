/**
 * TemplatesPage.jsx — editorial Templates screen.
 * Layout: tabs (Project / Task) → template card grid → Save as template form
 */
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/ui/toast';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/editorial';
import ConfirmDialog from '../components/ui/ConfirmDialog';

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

  const [applyModal,     setApplyModal]     = useState(null); // { tmplId, tmplName }
  const [applyToProject, setApplyToProject] = useState('');
  const [applying,       setApplying]       = useState(false);
  const [confirmState,   setConfirmState]   = useState(null);

  const [showSaveForm, setShowSaveForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pt, tt, pr] = await Promise.all([
        api.get('/templates/projects'),
        api.get('/templates/tasks'),
        api.get('/teams'),
      ]);
      setProjTemplates(Array.isArray(pt.data) ? pt.data : []);
      setTaskTemplates(Array.isArray(tt.data) ? tt.data : []);
      setProjects(Array.isArray(pr.data) ? pr.data : []);
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

  const applyProjectTemplate = async (tmplId, projectId) => {
    const pid = projectId || applyToProject;
    if (!pid) { pushToast({ type: 'error', title: 'Choose a target project' }); return; }
    setApplying(true);
    try {
      const res = await api.post(`/templates/projects/${tmplId}/apply?team_id=${pid}`);
      pushToast({ type: 'success', title: `Applied — ${res.data.created.columns} columns created` });
      setApplyModal(null); setApplyToProject('');
      navigate(`/projects/${pid}`);
    } catch (_) { pushToast({ type: 'error', title: 'Could not apply template' }); }
    finally { setApplying(false); }
  };

  const deleteProjTmpl = (id, name) => {
    setConfirmState({
      message: `Delete template "${name}"?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try { await api.delete(`/templates/projects/${id}`); load(); pushToast({ type: 'success', title: 'Template deleted' }); }
        catch (_) { pushToast({ type: 'error', title: 'Could not delete' }); }
      },
    });
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
                            if (projects.length === 1) {
                              applyProjectTemplate(t.template_id, projects[0].team_id);
                            } else {
                              setApplyToProject('');
                              setApplyModal({ tmplId: t.template_id, tmplName: t.name });
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
                          title="Delete template"
                          aria-label="Delete template"
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
                          title="Delete task template"
                          aria-label="Delete task template"
                          onClick={() => setConfirmState({
                            message: `Delete template "${t.name}"?`,
                            confirmLabel: 'Delete',
                            onConfirm: async () => {
                              try { await api.delete(`/templates/tasks/${t.template_id}`); load(); } catch (_) {}
                            },
                          })}
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
      {/* Apply template modal */}
      {applyModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setApplyModal(null)}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16,
            border: '1px solid var(--rule)',
            boxShadow: '0 24px 64px rgba(0,0,0,.22)',
            width: 420, padding: '28px 28px 24px',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--k-primary)', marginBottom: 4 }}>
                  USE TEMPLATE · साँचा
                </div>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 22, color: 'var(--ink)', lineHeight: 1.2 }}>
                  {applyModal.tmplName}
                </h2>
              </div>
              <button onClick={() => setApplyModal(null)} style={{
                width: 28, height: 28, borderRadius: 7, border: '1px solid var(--rule)',
                background: 'transparent', cursor: 'pointer', fontSize: 16, color: 'var(--ink-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>×</button>
            </div>

            {/* Project picker */}
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>
              Apply to project
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
              {projects.map(p => (
                <button
                  key={p.team_id}
                  onClick={() => setApplyToProject(p.team_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: applyToProject === p.team_id ? '1.5px solid var(--k-primary)' : '1.5px solid var(--rule)',
                    background: applyToProject === p.team_id ? 'var(--side-active)' : 'var(--bg)',
                    color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontSize: 14, textAlign: 'left',
                    transition: 'border .1s, background .1s',
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: applyToProject === p.team_id ? 'var(--k-primary)' : 'var(--rule-strong)',
                    transition: 'background .1s',
                  }} />
                  {p.name}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="k-btn k-btn--primary"
                style={{ flex: 1 }}
                disabled={!applyToProject || applying}
                onClick={() => applyProjectTemplate(applyModal.tmplId)}
              >
                {applying ? 'Applying…' : 'Apply template'}
              </button>
              <button className="k-btn k-btn--ghost" onClick={() => setApplyModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}
