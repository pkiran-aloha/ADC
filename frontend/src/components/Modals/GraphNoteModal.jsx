import { useState } from 'react';
import { StickyNote } from '../ui/Icons';
import Dialog from '../ui/Dialog';
import { Field, FormFeedback } from '../ui/Field';
import { useFormValidation } from '../../utils/useFormValidation';
import { validateAnnotation } from '../../utils/formValidation';
import { SEED_AS_OF_DATE } from '../../data/mockData';
import AnnotationScope from '../ui/AnnotationScope';

export default function GraphNoteModal({ isOpen, onClose, onSave, target, initialData, scopeTargets = [] }) {
  const [date, setDate] = useState(initialData?.date || SEED_AS_OF_DATE);
  const [noteText, setNoteText] = useState(initialData?.noteText || '');
  const [staffName, setStaffName] = useState(initialData?.staffName || '');
  const [color, setColor] = useState(initialData?.color?.slice(0, 7) || '#34634c');
  const { errors, formRef, validate } = useFormValidation();
  const [applyToIds, setApplyToIds] = useState([]);
  function submit(event) {
    event.preventDefault();
    if (!validate(validateAnnotation({ date, noteText, staffName, color }, 'note'))) return;
    onSave({ ...initialData, targetId: target.id, date, noteText: noteText.trim(), staffName: staffName.trim(), color, applyToIds });
    onClose();
  }
  return <Dialog isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit graph note' : 'Add graph note'} icon={StickyNote}
    description={`Add context to ${target?.name || 'this target'} without changing the measurement.`}>
    <form ref={formRef} noValidate onSubmit={submit} className="form-layout">
      <FormFeedback errors={errors} />
      <Field id="note-date" label="Observation date" error={errors.date}><input type="date" required value={date} onChange={event => setDate(event.target.value)} data-autofocus /></Field>
      <Field id="note-author" label="Author" error={errors.staffName}><input type="text" required maxLength={100} placeholder="Clinician’s name and role" value={staffName} onChange={event => setStaffName(event.target.value)} /></Field>
      <Field id="note-text" label="Note" error={errors.noteText} hint="Use fictional information only. Don’t enter patient identifiers."><textarea required rows={4} maxLength={2000} placeholder="What changed, or what should the next clinician know?" value={noteText} onChange={event => setNoteText(event.target.value)} /></Field>
      <Field id="note-color" label="Marker color" error={errors.color}><input type="color" value={color} onChange={event => setColor(event.target.value)} /></Field>
      <AnnotationScope targets={scopeTargets} primaryId={target?.id} selectedIds={applyToIds} onChange={setApplyToIds} />
      <div className="form-actions"><button type="button" className="button button--secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button--primary">Save graph note</button></div>
    </form>
  </Dialog>;
}
