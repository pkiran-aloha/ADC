import { useState } from 'react';
import { Layers } from '../ui/Icons';
import Dialog from '../ui/Dialog';
import { Field, FormFeedback } from '../ui/Field';
import { useFormValidation } from '../../utils/useFormValidation';
import { validateAnnotation } from '../../utils/formValidation';
import { SEED_AS_OF_DATE } from '../../data/mockData';

export default function PhaseRangeModal({ isOpen, onClose, onSave, target, initialData }) {
  const [startDate, setStartDate] = useState(initialData?.startDate || SEED_AS_OF_DATE);
  const [endDate, setEndDate] = useState(initialData?.endDate || SEED_AS_OF_DATE);
  const [label, setLabel] = useState(initialData?.label || '');
  const [color, setColor] = useState(initialData?.color?.slice(0, 7) || '#71957f');
  const { errors, formRef, validate } = useFormValidation();
  function submit(event) {
    event.preventDefault();
    if (!validate(validateAnnotation({ startDate, endDate, label, color }, 'range'))) return;
    onSave({ ...initialData, targetId: target.id, startDate, endDate, label: label.trim(), color: `${color}${initialData?.color?.length === 9 ? initialData.color.slice(7) : '33'}` });
    onClose();
  }
  return <Dialog isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit phase range' : 'Add phase range'} icon={Layers}
    description={`Highlight a period of time for ${target?.name || 'this target'}.`}>
    <form ref={formRef} noValidate onSubmit={submit} className="form-layout">
      <FormFeedback errors={errors} />
      <div className="form-row">
        <Field id="range-start" label="Start date" error={errors.startDate}><input type="date" required value={startDate} onChange={event => setStartDate(event.target.value)} data-autofocus /></Field>
        <Field id="range-end" label="End date" error={errors.endDate}><input type="date" required value={endDate} onChange={event => setEndDate(event.target.value)} /></Field>
      </div>
      <Field id="range-label" label="Range label" error={errors.label}><input type="text" required maxLength={80} placeholder="For example, prompt fading" value={label} onChange={event => setLabel(event.target.value)} /></Field>
      <Field id="range-color" label="Highlight color" error={errors.color} hint="The chart applies a translucent tint so observations stay readable."><input type="color" value={color} onChange={event => setColor(event.target.value)} /></Field>
      <div className="form-actions"><button type="button" className="button button--secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button--primary">Save phase range</button></div>
    </form>
  </Dialog>;
}
