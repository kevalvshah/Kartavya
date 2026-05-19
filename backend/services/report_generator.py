"""report_generator.py — PDF (WeasyPrint) and Excel (openpyxl) generation for Kartavya reports."""
import io
from datetime import datetime

# ── Design tokens (match email_service.py baked-hex palette) ──────────────────
_BG       = "#F6F3EC"
_SURFACE  = "#FCFAF5"
_RULE     = "#E2DCC9"
_INK      = "#1A2230"
_INK2     = "#4A5468"
_INK3     = "#6E7B91"
_TEAL     = "#05b7aa"
_MID      = "#03a1b6"
_DEEP     = "#0082c6"

_FONT_DISP  = '"Newsreader", Georgia, "Times New Roman", serif'
_FONT_UI    = 'Inter, -apple-system, "Helvetica Neue", Arial, sans-serif'
_FONT_HINDI = '"Tiro Devanagari Hindi", "Noto Serif Devanagari", serif'
_FONT_MONO  = '"JetBrains Mono", "Fira Code", "Courier New", monospace'


def _build_html(data: dict, team_name: str, period_from: str, period_to: str) -> str:
    tasks      = data.get("tasks",   {})
    entries    = data.get("entries", [])
    total_mins = data.get("total_minutes", 0)

    todo        = tasks.get("todo", 0)
    in_progress = tasks.get("in_progress", 0)
    done        = tasks.get("done", 0)
    overdue     = tasks.get("overdue", 0)
    total_tasks = todo + in_progress + done

    total_h = f"{total_mins // 60}h {total_mins % 60}m" if total_mins else "0h"

    # ── By-member aggregation ──────────────────────────────────────────────────
    by_member: dict[str, int] = {}
    for e in entries:
        name = e.get("user_name") or "Unknown"
        by_member[name] = by_member.get(name, 0) + (e.get("minutes") or 0)
    by_member_sorted = sorted(by_member.items(), key=lambda x: -x[1])

    def fmt_mins(m: int) -> str:
        if not m: return "0h"
        h = m // 60; mn = m % 60
        return f"{h}h {mn}m" if mn else f"{h}h"

    member_rows = ""
    for nm, mins in by_member_sorted:
        pct = round((mins / max(total_mins, 1)) * 100)
        member_rows += f"""
        <tr>
          <td style="padding:9px 14px;font-family:{_FONT_UI};font-size:12px;color:{_INK};font-weight:500;border-bottom:1px solid {_RULE};">{nm}</td>
          <td style="padding:9px 14px;border-bottom:1px solid {_RULE};">
            <div style="height:6px;background:{_RULE};border-radius:3px;overflow:hidden;width:140px;">
              <div style="height:100%;width:{pct}%;background:linear-gradient(90deg,{_TEAL},{_DEEP});border-radius:3px;"></div>
            </div>
          </td>
          <td style="padding:9px 14px;font-family:{_FONT_MONO};font-size:12px;color:{_DEEP};font-weight:700;text-align:right;border-bottom:1px solid {_RULE};">{fmt_mins(mins)}</td>
          <td style="padding:9px 14px;font-family:{_FONT_UI};font-size:11px;color:{_INK3};text-align:right;border-bottom:1px solid {_RULE};">{pct}%</td>
        </tr>"""

    entry_rows = ""
    for e in entries[:200]:  # cap at 200 rows for PDF size
        date_str = ""
        if e.get("started_at"):
            try:
                date_str = datetime.fromisoformat(str(e["started_at"])).strftime("%-d %b")
            except Exception:
                date_str = str(e["started_at"])[:10]
        entry_rows += f"""
        <tr>
          <td style="padding:7px 12px;font-family:{_FONT_UI};font-size:11px;color:{_INK3};border-bottom:1px solid {_RULE};white-space:nowrap;">{date_str}</td>
          <td style="padding:7px 12px;font-family:{_FONT_UI};font-size:11px;color:{_INK};font-weight:500;border-bottom:1px solid {_RULE};">{e.get('user_name','—')}</td>
          <td style="padding:7px 12px;font-family:{_FONT_UI};font-size:11px;color:{_INK2};border-bottom:1px solid {_RULE};max-width:220px;overflow:hidden;">{(e.get('task_title') or '—')[:60]}</td>
          <td style="padding:7px 12px;font-family:{_FONT_UI};font-size:11px;color:{_INK3};border-bottom:1px solid {_RULE};max-width:160px;overflow:hidden;">{(e.get('description') or '—')[:50]}</td>
          <td style="padding:7px 12px;font-family:{_FONT_MONO};font-size:11px;color:{_DEEP};font-weight:700;text-align:right;border-bottom:1px solid {_RULE};white-space:nowrap;">{fmt_mins(e.get('minutes') or 0)}</td>
        </tr>"""

    generated = datetime.utcnow().strftime("%-d %b %Y, %H:%M UTC")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500;600;700&family=Tiro+Devanagari+Hindi&family=JetBrains+Mono:wght@400;700&display=swap');
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ background: {_BG}; font-family: {_FONT_UI}; color: {_INK}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  @page {{ size: A4; margin: 0; }}

  /* ── Cover page ── */
  .cover {{
    width: 210mm; height: 297mm;
    background: {_INK};
    display: flex; flex-direction: column;
    page-break-after: always;
    padding: 0;
  }}
  .cover__band {{
    height: 6px;
    background: linear-gradient(90deg, {_TEAL} 0%, {_MID} 50%, {_DEEP} 100%);
  }}
  .cover__body {{
    flex: 1; display: flex; flex-direction: column;
    padding: 60px 56px 40px;
    justify-content: space-between;
  }}
  .cover__mark {{
    width: 44px; height: 44px;
    background: linear-gradient(135deg,{_DEEP},{_TEAL});
    border-radius: 11px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 48px;
  }}
  .cover__kicker {{
    font-family: {_FONT_UI}; font-size: 11px; font-weight: 700;
    letter-spacing: 0.25em; text-transform: uppercase;
    color: {_TEAL}; margin-bottom: 16px;
  }}
  .cover__title {{
    font-family: {_FONT_DISP}; font-size: 56px; font-weight: 400;
    line-height: 1.05; letter-spacing: -0.02em;
    color: #fff; margin-bottom: 8px;
  }}
  .cover__sanskrit {{
    font-family: {_FONT_HINDI}; font-size: 22px;
    color: {_TEAL}; margin-bottom: 32px;
  }}
  .cover__meta {{
    display: flex; flex-direction: column; gap: 8px;
  }}
  .cover__meta-row {{
    display: flex; gap: 16px;
    font-family: {_FONT_UI}; font-size: 13px; color: rgba(255,255,255,0.55);
  }}
  .cover__meta-label {{
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;
    font-size: 10px; color: rgba(255,255,255,0.28); width: 80px;
  }}
  .cover__meta-val {{ color: rgba(255,255,255,0.72); }}
  .cover__foot {{
    display: flex; align-items: flex-end; justify-content: space-between;
  }}
  .cover__brand {{
    font-family: {_FONT_DISP}; font-size: 18px; font-weight: 500;
    color: rgba(255,255,255,0.4);
  }}
  .cover__gita {{
    font-family: {_FONT_HINDI}; font-size: 12px;
    color: rgba(255,255,255,0.22); text-align: right; max-width: 260px; line-height: 1.6;
  }}

  /* ── Content pages ── */
  .page {{
    width: 210mm; min-height: 297mm;
    background: {_BG};
    padding: 40px 44px;
    page-break-after: always;
  }}
  .page__header {{
    border-bottom: 1px solid {_RULE}; padding-bottom: 18px; margin-bottom: 28px;
    display: flex; justify-content: space-between; align-items: flex-end;
  }}
  .page__brand {{
    font-family: {_FONT_DISP}; font-size: 14px; color: {_INK3}; font-weight: 400;
  }}
  .page__period {{
    font-family: {_FONT_UI}; font-size: 10px; font-weight: 700;
    letter-spacing: 0.15em; text-transform: uppercase; color: {_INK3};
  }}
  .section {{ margin-bottom: 32px; }}
  .section__title {{
    font-family: {_FONT_UI}; font-size: 10px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: {_TEAL}; margin-bottom: 12px;
  }}
  .section__hi {{
    font-family: {_FONT_HINDI}; font-weight: 400;
    font-size: 12px; color: rgba(26,34,48,0.35); margin-left: 8px; letter-spacing: 0;
  }}

  /* ── Stat pills ── */
  .stats {{ display: flex; gap: 12px; margin-bottom: 28px; }}
  .stat {{
    flex: 1; background: {_SURFACE}; border: 1px solid {_RULE};
    border-radius: 10px; padding: 16px 18px;
  }}
  .stat__num {{
    font-family: {_FONT_DISP}; font-size: 34px; font-weight: 400;
    color: {_INK}; line-height: 1; margin-bottom: 4px;
  }}
  .stat__num--teal {{ color: {_TEAL}; }}
  .stat__num--blue {{ color: {_DEEP}; }}
  .stat__label {{
    font-family: {_FONT_UI}; font-size: 9px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.18em; color: {_INK3};
  }}
  .stat__hi {{
    font-family: {_FONT_HINDI}; font-size: 10px;
    color: rgba(26,34,48,0.32); margin-top: 2px;
  }}

  /* ── Tables ── */
  table {{ width: 100%; border-collapse: collapse; }}
  .card-table {{
    background: {_SURFACE}; border: 1px solid {_RULE};
    border-radius: 10px; overflow: hidden;
  }}
  thead th {{
    padding: 9px 12px; font-family: {_FONT_UI}; font-size: 9px;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;
    color: {_INK3}; background: {_BG}; text-align: left;
    border-bottom: 1px solid {_RULE};
  }}

  /* ── Footer ── */
  .page__foot {{
    margin-top: 32px; padding-top: 16px; border-top: 1px solid {_RULE};
    display: flex; justify-content: space-between; align-items: center;
  }}
  .page__foot-gita {{
    font-family: {_FONT_HINDI}; font-size: 11px; color: {_INK3}; font-style: italic;
  }}
  .page__foot-gen {{
    font-family: {_FONT_UI}; font-size: 9px; color: {_INK3};
    letter-spacing: 0.08em;
  }}
</style>
</head>
<body>

<!-- ══ COVER PAGE ══════════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover__band"></div>
  <div class="cover__body">
    <div>
      <div class="cover__mark">
        <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
          <path d="M4 11L11 4L18 11L11 18L4 11Z" stroke="white" stroke-width="1.8"/>
          <path d="M7.5 11L11 7.5L14.5 11L11 14.5L7.5 11Z" fill="white" opacity=".85"/>
        </svg>
      </div>
      <div class="cover__kicker">Project Report · प्रतिवेदन</div>
      <div class="cover__title">{team_name}</div>
      <div class="cover__sanskrit">कार्य प्रतिवेदन</div>
      <div class="cover__meta">
        <div class="cover__meta-row">
          <span class="cover__meta-label">Period</span>
          <span class="cover__meta-val">{period_from} — {period_to}</span>
        </div>
        <div class="cover__meta-row">
          <span class="cover__meta-label">Tasks</span>
          <span class="cover__meta-val">{total_tasks} total · {done} done · {overdue} overdue</span>
        </div>
        <div class="cover__meta-row">
          <span class="cover__meta-label">Time</span>
          <span class="cover__meta-val">{total_h} logged across {len(entries)} entries</span>
        </div>
        <div class="cover__meta-row">
          <span class="cover__meta-label">Members</span>
          <span class="cover__meta-val">{len(by_member_sorted)} active</span>
        </div>
      </div>
    </div>
    <div class="cover__foot">
      <div class="cover__brand">Kartavya · by Aekam Inc</div>
      <div class="cover__gita">
        कर्मण्येवाधिकारस्ते मा फलेषु कदाचन<br>
        <span style="font-family:{_FONT_UI};font-size:10px;font-style:italic;">— Bhagavad Gita 2.47</span>
      </div>
    </div>
  </div>
</div>

<!-- ══ PAGE 2: SUMMARY ═════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page__header">
    <div class="page__brand">Kartavya &nbsp;·&nbsp; {team_name}</div>
    <div class="page__period">{period_from} – {period_to}</div>
  </div>

  <div class="section">
    <div class="section__title">Summary <span class="section__hi">सारांश</span></div>
    <div class="stats">
      <div class="stat">
        <div class="stat__num stat__num--teal">{total_h}</div>
        <div class="stat__label">Total Time</div>
        <div class="stat__hi">कुल समय</div>
      </div>
      <div class="stat">
        <div class="stat__num">{total_tasks}</div>
        <div class="stat__label">Tasks</div>
        <div class="stat__hi">कार्य</div>
      </div>
      <div class="stat">
        <div class="stat__num stat__num--teal">{done}</div>
        <div class="stat__label">Done</div>
        <div class="stat__hi">पूर्ण</div>
      </div>
      <div class="stat">
        <div class="stat__num stat__num--blue">{in_progress}</div>
        <div class="stat__label">In Progress</div>
        <div class="stat__hi">प्रगति</div>
      </div>
      <div class="stat">
        <div class="stat__num" style="color:#dc2626;">{overdue}</div>
        <div class="stat__label">Overdue</div>
        <div class="stat__hi">विलंबित</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section__title">Time by Member <span class="section__hi">सहयोगी-वार</span></div>
    <div class="card-table">
      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Distribution</th>
            <th style="text-align:right;">Hours</th>
            <th style="text-align:right;">Share</th>
          </tr>
        </thead>
        <tbody>
          {member_rows if member_rows else f'<tr><td colspan="4" style="padding:16px 14px;color:{_INK3};font-size:12px;">No time entries for this period.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  <div class="page__foot">
    <div class="page__foot-gita">कालः सृजति भूतानि — Time creates all things.</div>
    <div class="page__foot-gen">Generated {generated}</div>
  </div>
</div>

<!-- ══ PAGE 3: TIME ENTRIES ════════════════════════════════════════════════ -->
<div class="page">
  <div class="page__header">
    <div class="page__brand">Kartavya &nbsp;·&nbsp; {team_name}</div>
    <div class="page__period">Time Entries</div>
  </div>

  <div class="section">
    <div class="section__title">All Entries <span class="section__hi">विवरण</span></div>
    <div class="card-table">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Member</th>
            <th>Task</th>
            <th>Note</th>
            <th style="text-align:right;">Hours</th>
          </tr>
        </thead>
        <tbody>
          {entry_rows if entry_rows else f'<tr><td colspan="5" style="padding:16px 14px;color:{_INK3};font-size:12px;">No entries.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  <div class="page__foot">
    <div class="page__foot-gita">कर्मण्येवाधिकारस्ते — You have a right only to action.</div>
    <div class="page__foot-gen">Generated {generated}</div>
  </div>
</div>

</body>
</html>"""


def generate_pdf(data: dict, team_name: str, period_from: str, period_to: str) -> bytes:
    from weasyprint import HTML, CSS
    html = _build_html(data, team_name, period_from, period_to)
    return HTML(string=html, base_url=None).write_pdf()


def generate_excel(data: dict, team_name: str, period_from: str, period_to: str) -> bytes:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    tasks   = data.get("tasks", {})
    entries = data.get("entries", [])

    # ── Colors (openpyxl uses ARGB hex) ────────────────────────────────────
    C_INK    = "FF1A2230"
    C_INK3   = "FF6E7B91"
    C_TEAL   = "FF05b7aa"
    C_DEEP   = "FF0082c6"
    C_BG     = "FFF6F3EC"
    C_SURF   = "FFFCFAF5"
    C_HDR    = "FF1A2230"

    thin = Border(bottom=Side(style="thin", color="FFE2DCC9"))

    wb = openpyxl.Workbook()

    # ── Sheet 1: Summary ──────────────────────────────────────────────────
    ws1 = wb.active
    ws1.title = "Summary"

    def hdr_row(ws, row, *values):
        for col, v in enumerate(values, 1):
            c = ws.cell(row=row, column=col, value=v)
            c.font = Font(name="Calibri", bold=True, color="FFFFFFFF", size=10)
            c.fill = PatternFill("solid", fgColor=C_HDR)
            c.alignment = Alignment(horizontal="left", vertical="center")
            c.border = thin

    def data_row(ws, row, *values, bold=False):
        for col, v in enumerate(values, 1):
            c = ws.cell(row=row, column=col, value=v)
            c.font = Font(name="Calibri", bold=bold, size=10,
                          color=C_INK if not bold else C_DEEP)
            c.fill = PatternFill("solid", fgColor=C_SURF if row % 2 == 0 else C_BG)
            c.alignment = Alignment(horizontal="left", vertical="center")
            c.border = thin

    ws1.column_dimensions["A"].width = 28
    ws1.column_dimensions["B"].width = 18

    ws1["A1"] = f"Kartavya — {team_name} Report"
    ws1["A1"].font = Font(name="Georgia", bold=True, size=16, color=C_INK)
    ws1["A2"] = f"Period: {period_from} – {period_to}"
    ws1["A2"].font = Font(name="Calibri", size=10, color=C_INK3)
    ws1["A3"] = f"Generated: {datetime.utcnow().strftime('%d %b %Y %H:%M UTC')}"
    ws1["A3"].font = Font(name="Calibri", size=10, italic=True, color=C_INK3)

    ws1.row_dimensions[5].height = 20
    hdr_row(ws1, 5, "Metric", "Value")
    total_mins = data.get("total_minutes", 0)
    total_h = f"{total_mins // 60}h {total_mins % 60}m" if total_mins else "0h"

    summary_data = [
        ("Total Time Logged", total_h),
        ("Total Tasks", tasks.get("todo", 0) + tasks.get("in_progress", 0) + tasks.get("done", 0)),
        ("Done", tasks.get("done", 0)),
        ("In Progress", tasks.get("in_progress", 0)),
        ("To Do", tasks.get("todo", 0)),
        ("Overdue", tasks.get("overdue", 0)),
        ("Time Entries", len(entries)),
    ]
    for i, (label, val) in enumerate(summary_data, 6):
        data_row(ws1, i, label, val)

    # ── Sheet 2: Time Entries ─────────────────────────────────────────────
    ws2 = wb.create_sheet("Time Entries")
    ws2.column_dimensions["A"].width = 12
    ws2.column_dimensions["B"].width = 22
    ws2.column_dimensions["C"].width = 40
    ws2.column_dimensions["D"].width = 36
    ws2.column_dimensions["E"].width = 12

    hdr_row(ws2, 1, "Date", "Member", "Task", "Note", "Hours")
    for i, e in enumerate(entries, 2):
        date_str = ""
        if e.get("started_at"):
            try:
                date_str = datetime.fromisoformat(str(e["started_at"])).strftime("%d %b %Y")
            except Exception:
                date_str = str(e["started_at"])[:10]
        mins = e.get("minutes") or 0
        h = round(mins / 60, 2)
        data_row(ws2, i,
                 date_str,
                 e.get("user_name") or "",
                 (e.get("task_title") or "")[:100],
                 (e.get("description") or "")[:120],
                 h)

    # ── Sheet 3: By Member ────────────────────────────────────────────────
    ws3 = wb.create_sheet("By Member")
    ws3.column_dimensions["A"].width = 26
    ws3.column_dimensions["B"].width = 14
    ws3.column_dimensions["C"].width = 14

    hdr_row(ws3, 1, "Member", "Hours", "% Share")
    by_member: dict[str, int] = {}
    for e in entries:
        name = e.get("user_name") or "Unknown"
        by_member[name] = by_member.get(name, 0) + (e.get("minutes") or 0)
    sorted_members = sorted(by_member.items(), key=lambda x: -x[1])
    for i, (nm, mins) in enumerate(sorted_members, 2):
        pct = round((mins / max(total_mins, 1)) * 100, 1)
        data_row(ws3, i, nm, round(mins / 60, 2), f"{pct}%", bold=True)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
