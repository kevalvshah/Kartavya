/**
 * KanbanCard.jsx — v2 task card for the kanban board.
 * Shows: title, priority badge, assignee avatars, due date, custom field chips, approval badge.
 */
import React from 'react';
import FieldRenderer from '../fields/FieldRenderer';

const PRIORITY_DOT = { low:'#22c55e', medium:'#f59e0b', high:'#ef4444', urgent:'#dc2626' };

function Avatar({ name, size = 22 }) {
  return (
    <span title={name} style={{
      display:'inline-flex',alignItems:'center',justifyContent:'center',
      width:size,height:size,borderRadius:'50%',
      background:'var(--accent-subtle)',color:'var(--accent-default)',
      fontSize:size*0.45,fontWeight:700,border:'2px solid var(--bg-elevated)',
    }}>{name?.[0]?.toUpperCase()||'?'}</span>
  );
}

export default function KanbanCard({ task, fieldDefs = [], fieldValues = {}, onClick, dragging = false }) {
  const isOverdue = task.due_at && new Date(task.due_at) < new Date() && task.status !== 'done';
  const approvalPending = task.approval_status === 'pending' || task.approval_status === 'pending_client';

  // Only show first 2 custom fields on the card to keep it compact
  const cardFields = fieldDefs.slice(0, 2);

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${approvalPending ? 'var(--warning)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        cursor: 'pointer',
        boxShadow: dragging ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
        transform: dragging ? 'rotate(2deg)' : 'none',
        transition: 'box-shadow 0.15s, transform 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow='var(--shadow-md)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow=dragging?'var(--shadow-lg)':'var(--shadow-sm)'}
    >

      {/* Approval badge */}
      {approvalPending && (
        <div style={{ display:'inline-flex',alignItems:'center',gap:4,background:'#fef3c7',color:'#d97706',border:'1px solid #fbbf24',borderRadius:'var(--radius-full)',padding:'2px 8px',fontSize:'var(--text-xs)',fontWeight:600,marginBottom:8 }}>
          ⏳ {task.approval_status === 'pending_client' ? 'Client review' : 'Needs approval'}
        </div>
      )}

      {/* Title */}
      <div style={{ fontSize:'var(--text-sm)',fontWeight:500,lineHeight:1.4,marginBottom:8,color:'var(--text-default)' }}>
        {task.title}
      </div>

      {/* Custom field chips */}
      {cardFields.length > 0 && (
        <div style={{ display:'flex',flexWrap:'wrap',gap:6,marginBottom:8 }}>
          {cardFields.map(f => (
            <div key={f.field_id} style={{ display:'flex',alignItems:'center',gap:4 }}>
              <span style={{ fontSize:'var(--text-xs)',color:'var(--text-muted)' }}>{f.name}:</span>
              <FieldRenderer field={f} value={fieldValues[f.field_id]??null} onChange={()=>{}} readOnly />
            </div>
          ))}
        </div>
      )}

      {/* Footer: priority dot + due date + assignee avatars */}
      <div style={{ display:'flex',alignItems:'center',gap:8,marginTop:6 }}>
        {/* Priority */}
        <span title={task.priority} style={{ width:8,height:8,borderRadius:'50%',background:PRIORITY_DOT[task.priority]||'#94a3b8',flexShrink:0 }} />

        {/* Due date */}
        {task.due_at && (
          <span style={{ fontSize:'var(--text-xs)',color:isOverdue?'var(--danger)':'var(--text-muted)',fontWeight:isOverdue?700:400 }}>
            {isOverdue ? '⚠ ' : ''}{new Date(task.due_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}
          </span>
        )}

        {/* Assignee avatars */}
        {(task.assignee_user_ids || []).length > 0 && (
          <div style={{ display:'flex',marginLeft:'auto' }}>
            {(task.assignee_user_ids||[]).slice(0,3).map((uid,i) => (
              <span key={uid} style={{ marginLeft: i>0?-6:0 }}>
                <Avatar name={uid} size={22} />
              </span>
            ))}
            {(task.assignee_user_ids||[]).length > 3 && (
              <span style={{ fontSize:'var(--text-xs)',color:'var(--text-muted)',marginLeft:4 }}>+{(task.assignee_user_ids||[]).length-3}</span>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
