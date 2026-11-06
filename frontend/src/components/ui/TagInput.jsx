import { useState } from 'react';
import { X } from './Icons';

// Multi-value input for treatment areas and tags. A value is added by pressing
// Enter or a comma, and a partially typed value is kept when focus leaves the
// field, so a stray click never loses one.
export default function TagInput({ id, label, hint, values = [], onChange, disabled = false, placeholder }) {
  const [draft, setDraft] = useState('');

  function commit(raw = draft) {
    const parts = String(raw || '').split(',').map(part => part.trim()).filter(Boolean);
    if (!parts.length) { setDraft(''); return; }
    let next = values;
    parts.forEach(part => {
      if (!next.some(item => item.toLowerCase() === part.toLowerCase())) next = [...next, part];
    });
    if (next !== values) onChange(next);
    setDraft('');
  }

  function remove(value) {
    onChange(values.filter(item => item !== value));
  }

  return <div className="tag-input">
    <label htmlFor={id}>{label}</label>
    {hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
    {values.length > 0 && <ul className="tag-input-values" aria-label={`${label} added`}>
      {values.map(value => <li key={value}>
        <span>{value}</span>
        {!disabled && <button type="button" className="tag-input-remove" onClick={() => remove(value)}
          aria-label={`Remove ${value}`}><X size={13} aria-hidden="true" /></button>}
      </li>)}
    </ul>}
    <input id={id} name={id} type="text" value={draft} disabled={disabled}
      placeholder={placeholder}
      aria-describedby={hint ? `${id}-hint` : undefined}
      onChange={event => setDraft(event.target.value)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ',') {
          event.preventDefault();
          commit();
          return;
        }
        if (event.key === 'Backspace' && !draft && values.length) {
          onChange(values.slice(0, -1));
        }
      }}
      onBlur={() => commit()} />
  </div>;
}
