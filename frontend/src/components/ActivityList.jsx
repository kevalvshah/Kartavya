import React from "react";

const TYPE_META = {
  created:         { icon: "✨", verb: "created this task" },
  status_changed:  { icon: "🔄", verb: "changed status" },
  assigned:        { icon: "👤", verb: "updated assignees" },
  commented:       { icon: "💬", verb: "commented" },
  comment_edited:  { icon: "✏️", verb: "edited a comment" },
  comment_deleted: { icon: "🗑️", verb: "deleted a comment" },
  field_changed:   { icon: "✏️", verb: "updated a field" },
  approved:        { icon: "✅", verb: "approved" },
  rejected:        { icon: "❌", verb: "rejected" },
  mention:         { icon: "📣", verb: "mentioned someone" },
  time_logged:     { icon: "⏱", verb: "logged time" },
  subtask_added:   { icon: "☑️", verb: "added a subtask" },
  subtask_deleted: { icon: "🗑️", verb: "removed a subtask" },
  default:         { icon: "📋", verb: "" },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)    return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function DiffBadge({ from, to }) {
  if (from === null && to === null) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, marginLeft: 6 }}>
      {from !== null && from !== undefined && <span style={{ background: "#fee2e2", color: "var(--danger)", borderRadius: 4, padding: "1px 5px" }}>{String(from)}</span>}
      {from !== null && from !== undefined && to !== null && to !== undefined && <span style={{ color: "var(--ink-3)" }}>→</span>}
      {to   !== null && to !== undefined && <span style={{ background: "#dcfce7", color: "#16a34a", borderRadius: 4, padding: "1px 5px" }}>{String(to)}</span>}
    </span>
  );
}

function FieldDiff({ data }) {
  if (!data) return null;
  if (data.field) {
    return (
      <span style={{ color: "var(--ink-3)", fontSize: 12 }}>
        {" "}<em>{data.field}</em>
        <DiffBadge from={data.from} to={data.to} />
      </span>
    );
  }
  if (data.from !== undefined || data.to !== undefined) {
    return <DiffBadge from={data.from} to={data.to} />;
  }
  if (data.added?.length || data.removed?.length) {
    return (
      <span style={{ color: "var(--ink-3)", fontSize: 12, marginLeft: 4 }}>
        {data.added?.length  > 0 && <span style={{ background: "#dcfce7", color: "#16a34a", borderRadius: 4, padding: "1px 5px", marginRight: 4 }}>+{data.added.length}</span>}
        {data.removed?.length > 0 && <span style={{ background: "#fee2e2", color: "var(--danger)", borderRadius: 4, padding: "1px 5px" }}>-{data.removed.length}</span>}
      </span>
    );
  }
  return null;
}

export default function ActivityList({ events = [], loading = false, showTask = false }) {
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 0" }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bg-soft)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, background: "var(--bg-soft)", borderRadius: 4, width: "60%", marginBottom: 6 }} />
              <div style={{ height: 10, background: "var(--bg-soft)", borderRadius: 4, width: "35%" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 32, color: "var(--ink-faint)", fontSize: 13 }}>
        No activity yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {events.map(evt => {
        const meta = TYPE_META[evt.type] || TYPE_META.default;
        return (
          <div key={evt.event_id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--rule-soft)" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bg-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
              {meta.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink)" }}>
                <strong>{evt.actor_name || "System"}</strong>
                {" "}
                <span style={{ color: "var(--ink-3)" }}>{meta.verb}</span>
                {showTask && evt.task_title && (
                  <span> on <strong style={{ color: "var(--k-primary)" }}>{evt.task_title}</strong></span>
                )}
                <FieldDiff data={evt.data} />
              </div>
              <div style={{ color: "var(--ink-faint)", fontSize: 11, marginTop: 2 }}>
                {timeAgo(evt.created_at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
