import React from 'react';

/**
 * ReminderPicker — pick one or more due-date reminder offsets, each with its
 * own channel toggles (in-app / browser push / email). Used in NewTaskModal
 * (creation) and DrawerMeta (edit anytime). k-* design system, inline styles
 * matching the rest of the drawer (see DrawerMeta's assignee picker).
 *
 * value: [{ offset_minutes, channels: { in_app, push, email } }]
 * onChange(nextValue)
 */
export const OFFSETS = [
  { minutes: 2880, label: '2 days' },
  { minutes: 1440, label: '1 day' },
  { minutes: 240,  label: '4 hours' },
  { minutes: 120,  label: '2 hours' },
  { minutes: 60,   label: '1 hour' },
  { minutes: 30,   label: '30 min' },
  { minutes: 15,   label: '15 min' },
];

// Teams-like default: remind an hour out, then again 15 min before due.
export const DEFAULT_REMINDERS = [
  { offset_minutes: 60, channels: { in_app: true, push: true, email: false } },
  { offset_minutes: 15, channels: { in_app: true, push: true, email: false } },
];

const CHANNELS = [
  { key: 'in_app', label: 'In-app', icon: (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M8 1.5c-2 0-3.5 1.6-3.5 3.6v2.4c0 .5-.2 1-.6 1.4L3 10v1h10v-1l-.9-1.1c-.4-.4-.6-.9-.6-1.4V5.1c0-2-1.5-3.6-3.5-3.6z" />
      <path d="M6.3 13.2a1.8 1.8 0 003.4 0" />
    </svg>
  ) },
  { key: 'push', label: 'Push', icon: (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="2.5" width="12" height="9" rx="1" />
      <path d="M5.5 14h5M8 11.5V14" />
    </svg>
  ) },
  { key: 'email', label: 'Email', icon: (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.5" y="3" width="13" height="10" rx="1" />
      <path d="M2 4l6 4.5L14 4" />
    </svg>
  ) },
];

export default function ReminderPicker({ value = [], onChange, disabled = false }) {
  const find = (mins) => value.find(r => r.offset_minutes === mins);

  const toggleOffset = (mins) => {
    if (disabled) return;
    if (find(mins)) {
      onChange(value.filter(r => r.offset_minutes !== mins));
    } else {
      onChange([...value, { offset_minutes: mins, channels: { in_app: true, push: true, email: false } }].sort((a, b) => a.offset_minutes - b.offset_minutes));
    }
  };

  const toggleChannel = (mins, key) => {
    if (disabled) return;
    onChange(value.map(r => r.offset_minutes === mins
      ? { ...r, channels: { ...r.channels, [key]: !r.channels[key] } }
      : r
    ));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {OFFSETS.map(o => {
          const active = !!find(o.minutes);
          return (
            <button
              key={o.minutes}
              type="button"
              disabled={disabled}
              onClick={() => toggleOffset(o.minutes)}
              style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                fontFamily: 'var(--font-ui)', cursor: disabled ? 'default' : 'pointer',
                border: `1px solid ${active ? 'var(--k-primary)' : 'var(--rule)'}`,
                background: active ? 'var(--side-active)' : 'var(--bg-soft)',
                color: active ? 'var(--k-primary)' : 'var(--ink-3)',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {value.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {value.map(r => {
            const offsetLabel = OFFSETS.find(o => o.minutes === r.offset_minutes)?.label || `${r.offset_minutes}m`;
            return (
              <div key={r.offset_minutes} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px', borderRadius: 'var(--r-md)', background: 'var(--bg-soft)',
              }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 56 }}>{offsetLabel} before</span>
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                  {CHANNELS.map(c => {
                    const on = !!r.channels[c.key];
                    return (
                      <button
                        key={c.key}
                        type="button"
                        title={c.label}
                        disabled={disabled}
                        onClick={() => toggleChannel(r.offset_minutes, c.key)}
                        style={{
                          width: 22, height: 22, borderRadius: 6, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer',
                          border: `1px solid ${on ? 'var(--k-primary)' : 'var(--rule)'}`,
                          background: on ? 'var(--side-active)' : 'transparent',
                          color: on ? 'var(--k-primary)' : 'var(--ink-faint)',
                        }}
                      >
                        {c.icon}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
