/**
 * ReportsPage.jsx — editorial Reports page.
 * Layout: PageHeader → tab bar (On-Demand | Schedules) → content
 */
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { PageHeader } from '../components/editorial';
import { currentUser } from '../lib/auth';

const TODAY      = new Date().toISOString().slice(0, 10);
const WEEK_AGO   = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
const MONTH_AGO  = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

const FREQ_OPTIONS = [
  { value: 'daily',   label: 'Daily',   hi: 'दैनिक',   desc: 'Sent each morning' },
  { value: 'weekly',  label: 'Weekly',  hi: 'साप्ताहिक', desc: 'Sent every Monday' },
  { value: 'monthly', label: 'Monthly', hi: 'मासिक',   desc: 'Sent on the 1st' },
];

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function DownloadIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3v8M5 8l3 3 3-3M3 13h10"/></svg>;
}
function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>;
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5h10M5 5V3h6v2M6 8v4M10 8v4"/></svg>;
}
function CalIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 1.5V4M11 1.5V4M2 7h12"/></svg>;
}
function ReportIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 2.5h7l3 3v8H3z"/><path d="M9.5 2.5V6H13"/><path d="M5.5 9h5M5.5 11h3"/></svg>;
}

// ── On-Demand Tab ─────────────────────────────────────────────────────────────
function OnDemandTab({ teams }) {
  const [teamId,  setTeamId]  = useState(teams[0]?.team_id || '');
  const [from,    setFrom]    = useState(WEEK_AGO);
  const [to,      setTo]      = useState(TODAY);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [prevLoading, setPrevLoading] = useState(false);

  useEffect(() => {
    if (teams.length && !teamId) setTeamId(teams[0].team_id);
  }, [teams, teamId]);

  const loadPreview = useCallback(async () => {
    if (!teamId) return;
    setPrevLoading(true);
    try {
      const r = await api.get(`/reports/data/${teamId}`, { params: { from, to } });
      setPreview(r.data);
    } catch (_) { setPreview(null); }
    finally { setPrevLoading(false); }
  }, [teamId, from, to]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  async function download(fmt) {
    if (!teamId) return;
    setLoading(true);
    try {
      const res = await api.get(`/reports/download/${teamId}`, {
        params: { from, to, fmt },
        responseType: 'blob',
      });
      const url  = URL.createObjectURL(res.data);
      const a    = document.createElement('a');
      const team = teams.find(t => t.team_id === teamId);
      const ext  = fmt === 'excel' ? 'xlsx' : 'pdf';
      a.href     = url;
      a.download = `kartavya-${(team?.name||'report').toLowerCase().replace(/\s+/g,'-')}-${from}-${to}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {
    } finally { setLoading(false); }
  }

  const tasks = preview?.tasks || {};
  const totalMins = preview?.total_minutes || 0;
  const totalH = totalMins ? `${Math.floor(totalMins/60)}h ${totalMins%60}m` : '0h';

  return (
    <>
      {/* Filter card */}
      <section className="k-card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <div className="k-fld-label">PROJECT · योजना</div>
            <select
              className="k-input"
              value={teamId}
              onChange={e => setTeamId(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <div className="k-fld-label">FROM · आरंभ</div>
            <input type="date" className="k-input" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <div className="k-fld-label">TO · अंत</div>
            <input type="date" className="k-input" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="k-btn k-btn--ghost k-btn--sm"
              onClick={() => { setFrom(MONTH_AGO); setTo(TODAY); }}
            >Last 30d</button>
            <button
              className="k-btn k-btn--ghost k-btn--sm"
              onClick={() => { setFrom(WEEK_AGO); setTo(TODAY); }}
            >Last 7d</button>
          </div>
        </div>
      </section>

      {/* Preview stats */}
      {prevLoading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
          Loading preview…
        </div>
      ) : preview && (
        <>
          <div className="k-twocol" style={{ '--k-col-gap': '16px' }}>
            {[
              { num: totalH,                   label: 'Total Time',  hi: 'कुल समय',  color: 'var(--k-teal)' },
              { num: tasks.done || 0,           label: 'Done',        hi: 'पूर्ण',    color: 'var(--k-teal)' },
              { num: tasks.in_progress || 0,    label: 'In Progress', hi: 'प्रगति',   color: 'var(--k-primary)' },
              { num: tasks.overdue || 0,        label: 'Overdue',     hi: 'विलंबित',  color: '#dc2626' },
            ].map(s => (
              <div key={s.label} className="k-card" style={{ padding: '20px 24px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, color: s.color, lineHeight: 1, marginBottom: 4 }}>{s.num}</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--ink-3)' }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--font-hindi)', fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{s.hi}</div>
              </div>
            ))}
          </div>

          {/* Time by member */}
          {preview.entries?.length > 0 && (() => {
            const byMember = {};
            preview.entries.forEach(e => {
              const n = e.user_name || 'Unknown';
              byMember[n] = (byMember[n] || 0) + (e.minutes || 0);
            });
            const sorted = Object.entries(byMember).sort((a,b) => b[1]-a[1]);
            return (
              <section className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="k-card__head" style={{ padding: '16px 24px' }}>
                  <div className="k-card__titles">
                    <h3 className="k-card__title">Time by Member</h3>
                    <span className="k-card__sans">सहयोगी-वार</span>
                  </div>
                </div>
                <div className="k-card__body" style={{ padding: '0 24px 16px' }}>
                  {sorted.map(([name, mins]) => {
                    const pct = Math.round((mins / Math.max(totalMins,1)) * 100);
                    const h = Math.floor(mins/60); const m = mins%60;
                    return (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <span style={{ width: 100, fontSize: 12, fontWeight: 500, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        <div style={{ flex: 1, height: 6, background: 'var(--bg-soft)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,var(--k-teal),var(--k-primary))', borderRadius: 3, transition: 'width 0.4s' }} />
                        </div>
                        <span style={{ width: 48, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{h}h{m>0?` ${m}m`:''}</span>
                        <span style={{ width: 30, textAlign: 'right', fontSize: 11, color: 'var(--ink-3)' }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })()}
        </>
      )}

      {/* Download buttons */}
      <section className="k-card">
        <div className="k-card__head">
          <div className="k-card__titles">
            <h3 className="k-card__title">Generate Report</h3>
            <span className="k-card__sans">रिपोर्ट बनाएं</span>
          </div>
        </div>
        <div className="k-card__body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            className="k-btn k-btn--primary"
            onClick={() => download('pdf')}
            disabled={loading || !teamId}
          >
            <DownloadIcon />
            Download PDF
          </button>
          <button
            className="k-btn k-btn--ghost"
            onClick={() => download('excel')}
            disabled={loading || !teamId}
          >
            <DownloadIcon />
            Download Excel
          </button>
        </div>
        {loading && (
          <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
            Generating report, please wait…
          </div>
        )}
      </section>
    </>
  );
}

// ── Schedules Tab ─────────────────────────────────────────────────────────────
function SchedulesTab({ teams }) {
  const [teamId,     setTeamId]     = useState(teams[0]?.team_id || '');
  const [schedules,  setSchedules]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form,       setForm]       = useState({
    frequency:     'weekly',
    file_formats:  ['pdf'],
    recipients:    '',
    day_of_week:   1,
    day_of_month:  1,
    send_hour_utc: 2,
  });

  useEffect(() => {
    if (teams.length && !teamId) setTeamId(teams[0].team_id);
  }, [teams, teamId]);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    api.get(`/reports/schedules/${teamId}`)
       .then(r => setSchedules(Array.isArray(r.data) ? r.data : []))
       .catch(() => setSchedules([]))
       .finally(() => setLoading(false));
  }, [teamId]);

  function toggleFormat(fmt) {
    setForm(f => ({
      ...f,
      file_formats: f.file_formats.includes(fmt)
        ? f.file_formats.filter(x => x !== fmt)
        : [...f.file_formats, fmt],
    }));
  }

  async function createSchedule(e) {
    e.preventDefault();
    const recipients = form.recipients.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (!recipients.length) return;
    if (!form.file_formats.length) return;
    setSubmitting(true);
    try {
      const payload = {
        frequency:     form.frequency,
        file_formats:  form.file_formats,
        recipients,
        send_hour_utc: Number(form.send_hour_utc),
        day_of_week:   form.frequency === 'weekly'  ? Number(form.day_of_week)  : null,
        day_of_month:  form.frequency === 'monthly' ? Number(form.day_of_month) : null,
      };
      const r = await api.post(`/reports/schedules/${teamId}`, payload);
      setSchedules(s => [r.data, ...s]);
      setShowForm(false);
      setForm(f => ({ ...f, recipients: '' }));
    } catch (_) {}
    finally { setSubmitting(false); }
  }

  async function deleteSchedule(id) {
    try {
      await api.delete(`/reports/schedules/${id}`);
      setSchedules(s => s.filter(x => x.schedule_id !== id));
    } catch (_) {}
  }

  function fmtDate(dt) {
    if (!dt) return '—';
    try { return new Date(dt).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); }
    catch { return dt; }
  }

  return (
    <>
      {/* Project selector */}
      <section className="k-card">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div className="k-fld-label">PROJECT · योजना</div>
            <select className="k-input" value={teamId} onChange={e => setTeamId(e.target.value)} style={{ cursor: 'pointer' }}>
              {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
            </select>
          </div>
          <button className="k-btn k-btn--primary k-btn--sm" onClick={() => setShowForm(s => !s)}>
            <PlusIcon /> New Schedule
          </button>
        </div>
      </section>

      {/* Create form */}
      {showForm && (
        <section className="k-card">
          <div className="k-card__head">
            <div className="k-card__titles">
              <h3 className="k-card__title">New Automated Schedule</h3>
              <span className="k-card__sans">स्वचालित प्रेषण</span>
            </div>
          </div>
          <form onSubmit={createSchedule}>
            <div className="k-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Frequency */}
              <div>
                <div className="k-fld-label">FREQUENCY · आवृत्ति</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {FREQ_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, frequency: opt.value }))}
                      style={{
                        padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        border: form.frequency === opt.value ? '1.5px solid var(--k-teal)' : '1.5px solid var(--rule)',
                        background: form.frequency === opt.value ? 'color-mix(in srgb, var(--k-teal) 10%, transparent)' : 'var(--surface)',
                        color: form.frequency === opt.value ? 'var(--k-teal)' : 'var(--ink-2)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {opt.label}
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 400, color: 'var(--ink-3)', marginTop: 1 }}>{opt.hi}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Day picker */}
              {form.frequency === 'weekly' && (
                <div>
                  <div className="k-fld-label">DAY OF WEEK · दिन</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {DAYS.map((d, i) => (
                      <button
                        key={d} type="button"
                        onClick={() => setForm(f => ({ ...f, day_of_week: i }))}
                        style={{
                          width: 38, height: 38, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          border: form.day_of_week === i ? '1.5px solid var(--k-teal)' : '1.5px solid var(--rule)',
                          background: form.day_of_week === i ? 'color-mix(in srgb, var(--k-teal) 10%, transparent)' : 'var(--surface)',
                          color: form.day_of_week === i ? 'var(--k-teal)' : 'var(--ink-3)',
                        }}
                      >{d}</button>
                    ))}
                  </div>
                </div>
              )}
              {form.frequency === 'monthly' && (
                <div>
                  <div className="k-fld-label">DAY OF MONTH · दिनांक</div>
                  <input
                    type="number" min="1" max="28" className="k-input"
                    style={{ width: 80, marginTop: 6 }}
                    value={form.day_of_month}
                    onChange={e => setForm(f => ({ ...f, day_of_month: e.target.value }))}
                  />
                </div>
              )}

              {/* Send hour */}
              <div>
                <div className="k-fld-label">SEND TIME (UTC) · समय</div>
                <select
                  className="k-input" style={{ width: 120, marginTop: 6, cursor: 'pointer' }}
                  value={form.send_hour_utc}
                  onChange={e => setForm(f => ({ ...f, send_hour_utc: e.target.value }))}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2,'0')}:00 UTC</option>
                  ))}
                </select>
              </div>

              {/* File formats */}
              <div>
                <div className="k-fld-label">FORMAT · प्रारूप</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  {['pdf','excel'].map(fmt => (
                    <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>
                      <input
                        type="checkbox"
                        checked={form.file_formats.includes(fmt)}
                        onChange={() => toggleFormat(fmt)}
                        style={{ accentColor: 'var(--k-teal)' }}
                      />
                      {fmt.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>

              {/* Recipients */}
              <div>
                <div className="k-fld-label">RECIPIENTS · प्राप्तकर्ता</div>
                <textarea
                  className="k-input"
                  placeholder="email@example.com, another@example.com"
                  rows={3}
                  value={form.recipients}
                  onChange={e => setForm(f => ({ ...f, recipients: e.target.value }))}
                  style={{ marginTop: 6, resize: 'vertical' }}
                />
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>Separate multiple addresses with commas or new lines.</div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="k-btn k-btn--primary k-btn--sm" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Create Schedule'}
                </button>
                <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Schedule list */}
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>Loading…</div>
      ) : schedules.length === 0 ? (
        <div className="k-empty">
          <div className="k-empty__icon"><CalIcon /></div>
          <div className="k-empty__title">No schedules yet</div>
          <div className="k-empty__sub">Create a schedule to auto-deliver reports to your inbox.</div>
        </div>
      ) : (
        <section className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="k-card__head" style={{ padding: '16px 24px' }}>
            <div className="k-card__titles">
              <h3 className="k-card__title">Active Schedules</h3>
              <span className="k-card__sans">स्वचालित सूची</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-soft)' }}>
                  {[['FREQUENCY','आवृत्ति'],['FORMAT','प्रारूप'],['RECIPIENTS','प्राप्तकर्ता'],['NEXT RUN','अगला'],['LAST SENT','अंतिम'],['','']].map(([en,hi]) => (
                    <th key={en} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--ink-3)', borderBottom: '1px solid var(--rule-soft)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                      {en} {hi && <span style={{ fontFamily: 'var(--font-hindi)', fontWeight: 400, fontSize: 10, color: 'var(--ink-faint)', textTransform: 'none', letterSpacing: 0 }}>{hi}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedules.map(s => (
                  <tr key={s.schedule_id} style={{ borderBottom: '1px solid var(--rule-soft)' }}>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, background: 'color-mix(in srgb, var(--k-teal) 12%, transparent)', color: 'var(--k-teal)', fontWeight: 700, fontSize: 11, textTransform: 'capitalize' }}>
                        {s.frequency}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', color: 'var(--ink-2)', fontSize: 12 }}>
                      {(s.file_formats || []).map(f => f.toUpperCase()).join(' + ')}
                    </td>
                    <td style={{ padding: '11px 16px', color: 'var(--ink-2)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(s.recipients || []).join(', ')}
                    </td>
                    <td style={{ padding: '11px 16px', color: 'var(--ink-3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {fmtDate(s.next_run_at)}
                    </td>
                    <td style={{ padding: '11px 16px', color: 'var(--ink-3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {s.last_sent_at ? fmtDate(s.last_sent_at) : <span style={{ color: 'var(--ink-faint)' }}>Never</span>}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <button
                        className="k-btn k-btn--ghost k-btn--sm"
                        style={{ color: '#dc2626', borderColor: 'transparent' }}
                        onClick={() => deleteSchedule(s.schedule_id)}
                        title="Delete schedule"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReportsPage({ teams: propTeams }) {
  const [tab,   setTab]   = useState('ondemand');
  const [teams, setTeams] = useState(propTeams || []);

  useEffect(() => {
    if (propTeams?.length) { setTeams(propTeams); return; }
    api.get('/teams').then(r => setTeams(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [propTeams]);

  const user       = currentUser();
  const isAdmin    = user?.role === 'admin';
  const totalTeams = teams.length;

  return (
    <div className="k-screen">
      <PageHeader
        kicker="OPERATIONS"
        title="Reports"
        sanskrit="प्रतिवेदन"
        lede="Generate and schedule project reports with time, task, and member breakdowns."
        right={
          <div className="k-time-total">
            <div className="k-time-total__num">{totalTeams}</div>
            <div className="k-time-total__lbl">PROJECTS · योजना</div>
          </div>
        }
      />

      {teams.length === 0 ? (
        <div className="k-empty">
          <div className="k-empty__icon"><ReportIcon /></div>
          <div className="k-empty__title">No projects found</div>
          <div className="k-empty__sub">Create or join a project to generate reports.</div>
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--rule-soft)', paddingBottom: 0 }}>
            {[
              { id: 'ondemand', en: 'On-Demand',  hi: 'तत्काल' },
              { id: 'schedule', en: 'Scheduled',  hi: 'स्वचालित' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                  color: tab === t.id ? 'var(--k-primary)' : 'var(--ink-3)',
                  borderBottom: tab === t.id ? '2px solid var(--k-primary)' : '2px solid transparent',
                  marginBottom: -1, transition: 'color 0.15s',
                  display: 'flex', gap: 6, alignItems: 'center',
                }}
              >
                {t.en}
                <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 12, fontWeight: 400, color: tab === t.id ? 'var(--k-teal)' : 'var(--ink-faint)' }}>{t.hi}</span>
              </button>
            ))}
          </div>

          {tab === 'ondemand' && <OnDemandTab teams={teams} />}
          {tab === 'schedule' && <SchedulesTab teams={teams} />}

          {/* Sanskrit quote */}
          <div className="k-citation">
            <div className="k-citation__sans">कालः सृजति भूतानि कालः संहरते प्रजाः</div>
            <div className="k-citation__src">— "Time creates beings, time dissolves them." Track it carefully.</div>
          </div>
        </>
      )}
    </div>
  );
}
