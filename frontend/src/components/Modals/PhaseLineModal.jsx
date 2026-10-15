import { useState } from 'react';
import { BookmarkPlus } from '../ui/Icons';
import Dialog from '../ui/Dialog';
import { Field, FormFeedback } from '../ui/Field';
import { useFormValidation } from '../../utils/useFormValidation';
import { validateAnnotation } from '../../utils/formValidation';
import { SEED_AS_OF_DATE } from '../../data/mockData';
import AnnotationScope from '../ui/AnnotationScope';

export default function PhaseLineModal({ isOpen, onClose, onSave, target, initialData, scopeTargets = [] }) {
  const [date, setDate] = useState(initialData?.date || SEED_AS_OF_DATE);
  const [label, setLabel] = useState(initialData?.label || '');
  const [style, setStyle] = useState(initialData?.style || 'Solid');
  const [color, setColor] = useState(initialData?.color?.slice(0, 7) || '#34634c');
  const { errors, formRef, validate } = useFormValidation();
  const [applyToIds, setApplyToIds] = useState([]);
  function submit(event) {
    event.preventDefault();
    if (!validate(validateAnnotation({ date, label, color }, 'line'))) return;
    onSave({ ...initialData, targetId: target.id, date, label: label.trim(), style, color, isAutomated: false, source: 'Manual', applyToIds });
    onClose();
  }
  return <Dialog isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit phase line' : 'Add phase line'} icon={BookmarkPlus}
    description={`Mark a phase transition for ${target?.name || 'this target'}.`}>
    <form ref={formRef} noValidate onSubmit={submit} className="form-layout">
      <FormFeedback errors={errors} />
      <Field id="line-date" label="Transition date" error={errors.date}><input type="date" required value={date} onChange={event => setDate(event.target.value)} data-autofocus /></Field>
      <Field id="line-label" label="Phase label" error={errors.label} hint="Use a short label that will fit on the chart."><input type="text" required maxLength={80} placeholder="For example, maintenance starts" value={label} onChange={event => setLabel(event.target.value)} /></Field>
      <Field id="line-style" label="Line style" hint="Solid lines also break the data series at the transition."><select value={style} onChange={event => setStyle(event.target.value)}><option value="Solid">Solid · visual break</option><option value="Dotted">Dotted · continuous series</option></select></Field>
      <Field id="line-color" label="Line color" error={errors.color}><input type="color" value={color} onChange={event => setColor(event.target.value)} /></Field>
      <AnnotationScope targets={scopeTargets} primaryId={target?.id} selectedIds={applyToIds} onChange={setApplyToIds} />
      <div className="form-actions"><button type="button" className="button button--secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button--primary">Save phase line</button></div>
    </form>
  </Dialog>;
}
