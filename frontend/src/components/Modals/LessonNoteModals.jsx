import { useState } from 'react';
import Dialog from '../ui/Dialog';
import { Field } from '../ui/Field';
import {
  ABC_LISTS, SIGNATURE_ROLES, validateAbcEntry, validateLessonNote, validateSignature
} from '../../utils/programManagement';

// A lesson note is one dated run of a lesson. Choosing the lesson fixes which targets
// the note plans, so the recorder opens already loaded with them.
export function NewLessonNoteDialog({ isOpen, onClose, onSave, lessons = [], asOf }) {
  const [values, setValues] = useState({ lessonId: lessons[0]?.id || '', date: asOf, title: '' });
  const [attempted, setAttempted] = useState(false);
  const errors = attempted ? validateLessonNote(values, { lessons }) : {};
  const set = (key, value) => setValues(current => ({ ...current, [key]: value }));
  return <Dialog isOpen={isOpen} onClose={onClose} title="New lesson note"
    description="A dated run of a lesson: what was planned, what was recorded and who signed.">
    <form className="program-form" noValidate onSubmit={event => {
      event.preventDefault();
      setAttempted(true);
      if (Object.keys(validateLessonNote(values, { lessons })).length) return;
      onSave?.({ ...values, title: values.title.trim() });
    }}>
      {lessons.length === 0 && <p className="program-form-note">There are no lessons yet. Group programs into a lesson on the Skill acquisition tab first.</p>}
      <Field id="note-lesson" label="Lesson" required error={errors.lessonId}>
        <select required value={values.lessonId} onChange={event => set('lessonId', event.target.value)}>
          <option value="">Choose a lesson</option>
          {lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.name}</option>)}
        </select>
      </Field>
      <Field id="note-date" label="Date" required error={errors.date}>
        <input type="date" required value={values.date} onChange={event => set('date', event.target.value)} />
      </Field>
      <Field id="note-title" label="Title" required error={errors.title}>
        <input type="text" required maxLength={100} value={values.title} onChange={event => set('title', event.target.value)} />
      </Field>
      <div className="dialog-actions">
        <button type="button" className="button button--secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="button button--primary">Create lesson note</button>
      </div>
    </form>
  </Dialog>;
}

export function SignatureDialog({ isOpen, onClose, onSave }) {
  const [values, setValues] = useState({ signedBy: '', role: 'Staff' });
  const [attempted, setAttempted] = useState(false);
  const errors = attempted ? validateSignature(values) : {};
  return <Dialog isOpen={isOpen} onClose={onClose} title="Sign lesson note"
    description="The signature records who signed, in what role, and on which demo date. It does not capture a location.">
    <form className="program-form" noValidate onSubmit={event => {
      event.preventDefault();
      setAttempted(true);
      if (Object.keys(validateSignature(values)).length) return;
      onSave?.(values);
    }}>
      <Field id="sign-name" label="Name" required error={errors.signedBy}>
        <input type="text" required value={values.signedBy} onChange={event => setValues(current => ({ ...current, signedBy: event.target.value }))} />
      </Field>
      <Field id="sign-role" label="Role" required error={errors.role}>
        <select required value={values.role} onChange={event => setValues(current => ({ ...current, role: event.target.value }))}>
          {SIGNATURE_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
        </select>
      </Field>
      <div className="dialog-actions">
        <button type="button" className="button button--secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="button button--primary">Sign</button>
      </div>
    </form>
  </Dialog>;
}

// An ABC observation: pick from the client's vocabulary. At least one part is needed.
export function AbcEntryDialog({ isOpen, onClose, onSave, configuration }) {
  const [values, setValues] = useState({ antecedents: [], behaviors: [], consequences: [], location: '', notes: '' });
  const [attempted, setAttempted] = useState(false);
  const errors = attempted ? validateAbcEntry(values) : {};
  const toggle = (key, value) => setValues(current => ({
    ...current,
    [key]: current[key].includes(value) ? current[key].filter(item => item !== value) : [...current[key], value]
  }));
  return <Dialog isOpen={isOpen} onClose={onClose} title="Record an ABC observation"
    description="Choose what happened before, what the behavior was, what followed, and where. Intensity and duration are left unrecorded.">
    <form className="program-form" noValidate onSubmit={event => {
      event.preventDefault();
      setAttempted(true);
      if (Object.keys(validateAbcEntry(values)).length) return;
      onSave?.(values);
    }}>
      {errors.entry && <p className="field-error" role="alert">{errors.entry}</p>}
      {ABC_LISTS.filter(list => list.key !== 'locations').map(list => <fieldset key={list.key} className="program-form-fieldset">
        <legend>{list.label}</legend>
        {(configuration?.[list.key] || []).length === 0 && <p className="program-form-note">No values are configured.</p>}
        {(configuration?.[list.key] || []).map(value => <label key={value} className="program-form-check">
          <input type="checkbox" checked={values[list.key].includes(value)} onChange={() => toggle(list.key, value)} /><span>{value}</span>
        </label>)}
      </fieldset>)}
      <Field id="abc-location" label="Location">
        <select value={values.location} onChange={event => setValues(current => ({ ...current, location: event.target.value }))}>
          <option value="">Not recorded</option>
          {(configuration?.locations || []).map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </Field>
      <Field id="abc-notes" label="Notes">
        <textarea rows={3} value={values.notes} onChange={event => setValues(current => ({ ...current, notes: event.target.value }))} />
      </Field>
      <div className="dialog-actions">
        <button type="button" className="button button--secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="button button--primary">Save observation</button>
      </div>
    </form>
  </Dialog>;
}
