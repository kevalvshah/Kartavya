import React from 'react';

export default function Citation({ sanskrit, english, source }) {
  return (
    <div className="k-citation">
      {sanskrit && <div className="k-citation__sans">{sanskrit}</div>}
      <div className="k-citation__src">
        — {source}{english && <> · <em>{english}</em></>}
      </div>
    </div>
  );
}
