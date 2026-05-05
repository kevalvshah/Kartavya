/**
 * FieldRenderer.jsx — dispatches to the right field component by type.
 * Used in TaskDrawer (edit mode) and KanbanCard (read mode).
 */
import React from 'react';
import StatusField   from './StatusField';
import PersonField   from './PersonField';
import DateField     from './DateField';
import NumberField   from './NumberField';
import DropdownField from './DropdownField';
import TextField     from './TextField';
import FilesField    from './FilesField';

export default function FieldRenderer({ field, value, onChange, readOnly = false }) {
  const props = { field, value, onChange, readOnly };
  switch (field.type) {
    case 'status':   return <StatusField   {...props} />;
    case 'person':   return <PersonField   {...props} />;
    case 'date':     return <DateField     {...props} />;
    case 'number':   return <NumberField   {...props} />;
    case 'dropdown': return <DropdownField {...props} />;
    case 'text':     return <TextField     {...props} />;
    case 'files':    return <FilesField    {...props} />;
    default:
      return <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)' }}>Unknown field type: {field.type}</span>;
  }
}
