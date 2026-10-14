import { cloneElement } from 'react';

export function Field({ id, label, hint, error, children, className = '' }) {
  const description = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}{children.props.required && <span className="required-mark" aria-hidden="true"> *</span>}</label>
      {cloneElement(children, {
        id,
        name: children.props.name || id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': description || undefined
      })}
      {hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

export function FormFeedback({ errors }) {
  return Object.keys(errors).length > 0 ? <p className="form-error" role="alert">Review the marked fields before saving.</p> : null;
}
