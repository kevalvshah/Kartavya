import React from 'react';

const COLORS = ['#0082c6', '#05b7aa', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function AvatarStack({ users = [], max = 3, size = 22 }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="k-avstack" style={{ '--av-size': size + 'px' }}>
      {shown.map((u, i) => (
        <span
          key={i}
          className="k-avatar k-avatar--ring"
          style={{
            width: size,
            height: size,
            fontSize: Math.round(size * 0.4),
            background: u.color || COLORS[i % COLORS.length],
          }}
          title={u.name || ''}
        >
          {u.initials || initials(u.name || '')}
        </span>
      ))}
      {extra > 0 && (
        <span className="k-avstack__more" style={{ width: size, height: size }}>
          +{extra}
        </span>
      )}
    </span>
  );
}
