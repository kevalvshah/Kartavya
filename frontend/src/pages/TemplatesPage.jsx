import React, { useEffect, useState } from 'react';

export default function TemplatesPage() {
  const [projectTemplates, setProjectTemplates] = useState([]);
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const API = process.env.REACT_APP_API_URL || 'https://kartavya-production.up.railway.app';

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/templates/projects`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API}/api/templates/tasks`, { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([pt, tt]) => {
        setProjectTemplates(Array.isArray(pt) ? pt : []);
        setTaskTemplates(Array.isArray(tt) ? tt : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [API]);

  const TemplateCard = ({ t, onDelete }) => (
    <div style={{ border: '1px solid var(--border-default)', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
        {t.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t.description}</div>}
      </div>
      <button onClick={() => onDelete(t.template_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, padding: '4px 8px' }}>Delete</button>
    </div>
  );

  const deleteProject = async id => {
    await fetch(`${API}/api/templates/projects/${id}`, { method: 'DELETE', credentials: 'include' });
    setProjectTemplates(p => p.filter(t => t.template_id !== id));
  };
  const deleteTask = async id => {
    await fetch(`${API}/api/templates/tasks/${id}`, { method: 'DELETE', credentials: 'include' });
    setTaskTemplates(p => p.filter(t => t.template_id !== id));
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 860 }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>Templates</h2>
      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}

      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, marginTop: 24 }}>Project Templates</h3>
      {!loading && projectTemplates.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No project templates yet.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {projectTemplates.map(t => <TemplateCard key={t.template_id} t={t} onDelete={deleteProject} />)}
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, marginTop: 32 }}>Task Templates</h3>
      {!loading && taskTemplates.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No task templates yet.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {taskTemplates.map(t => <TemplateCard key={t.template_id} t={t} onDelete={deleteTask} />)}
      </div>
    </div>
  );
}
