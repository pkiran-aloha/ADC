import { useState } from 'react';
import Dialog from '../ui/Dialog';
import { Field, FormFeedback } from '../ui/Field';
import TagInput from '../ui/TagInput';
import { useFormValidation } from '../../utils/useFormValidation';
import {
  BEHAVIOR_PHASES, FIELD_LIMITS, PROGRAM_CATEGORIES, PROGRAM_STATUSES, PROGRAM_STATUS_LABELS,
  BEHAVIOR_TOOLS, INTERVAL_CAPTURE_TYPES, INTERVAL_START_TYPES, TARGET_TYPE_LABELS,
  programFormComplete, toValueList, validateBehavior, validateProgram
} from '../../utils/programManagement';
import { CUSTOM_FIELD_DEFINITIONS } from '../../data/mockData';

// The program form. The platform's sections are kept as fieldsets so a missing
// required field is visible both in the field and against its section.
const SECTIONS = [
  { id: 'treatment', title: 'Treatment information' },
  { id: 'instructions', title: 'Instructions' },
  { id: 'tags', title: 'Tags' },
  { id: 'custom', title: 'Custom data fields' }
];

export default function ProgramFormModal({
  isOpen, onClose, onSave, client, category = PROGRAM_CATEGORIES.SKILL, program = null, existing = []
}) {
  const isBehavior = category === PROGRAM_CATEGORIES.BEHAVIOR;
  const { errors, formRef, validate } = useFormValidation();

  const [values, setValues] = useState(() => ({
    clientId: client?.id || '',
    name: program?.name || '',
    status: program?.status || 'Teaching',
    treatmentArea: toValueList(program?.treatmentArea),
    tags: toValueList(program?.tags),
    baseline: program?.baseline || '',
    programObjective: program?.programObjective || '',
    teachingInstructions: program?.teachingInstructions || '',
    operationalDefinition: program?.operationalDefinition || '',
    behaviorPhase: program?.behaviorPhase || 'Open',
    measurementTool: program?.targets?.[0]?.type || 'Frequency',
    intervalSettings: program?.targets?.[0]?.intervalSettings || { startType: 'Manual', intervalLength: '00:30', captureType: 'Whole', numberOfIntervals: '' },
    customFields: program?.customFields || {}
  }));
  const [showErrors, setShowErrors] = useState(false);

  const isEdit = Boolean(program);
  const check = vals => (isBehavior ? validateBehavior(vals, { existing }) : validateProgram(vals, { category, existing }));
  const title = isEdit
    ? `Edit ${isBehavior ? 'behavior' : 'program'}`
    : `New ${isBehavior ? 'behavior' : 'program'}`;

  // Which sections still hold something missing, so the sidebar can mark them.
  const incompleteSections = (() => {
    const marked = new Set();
    const all = check(values);
    if (all.name) marked.add('treatment');
    if (all.status) marked.add('treatment');
    if (all.teachingInstructions) marked.add('instructions');
    if (all.operationalDefinition || all.behaviorPhase) marked.add('treatment');
    return marked;
  })();

  // After a first attempt the messages follow the values, so they never go stale as
  // fields are corrected or cleared.
  const live = showErrors ? check(values) : {};
  const shown = key => live[key];

  function set(key, value) {
    setValues(current => ({ ...current, [key]: value }));
  }

  function submit(event) {
    event.preventDefault();
    const found = check(values);
    setShowErrors(true);
    if (!validate(found)) return;
    // Behavior fields belong to a behavior only; a skill program must not carry them.
    const { measurementTool, intervalSettings, operationalDefinition, behaviorPhase, ...shared } = values;
    const behaviorFields = isBehavior ? {
      measurementTool, operationalDefinition, behaviorPhase,
      intervalSettings: measurementTool === 'IntervalData'
        ? { ...intervalSettings, numberOfIntervals: intervalSettings.numberOfIntervals === '' ? undefined : Number(intervalSettings.numberOfIntervals) }
        : undefined
    } : {};
    onSave?.({
      ...shared,
      ...behaviorFields,
      name: values.name.trim(),
      customFields: Object.fromEntries(
        CUSTOM_FIELD_DEFINITIONS
          .map(definition => [definition.key, values.customFields?.[definition.key] || ''])
          .filter(([, value]) => value)
      )
    });
  }

  function cancel() {
    if (Object.keys(errors).length) {
      // An unsaved form asks before it is thrown away.
      if (!window.confirm('Are you sure you want to cancel these unsaved changes?')) return;
    }
    onClose?.();
  }

  const complete = programFormComplete(check(values));

  return <Dialog isOpen={isOpen} onClose={cancel} title={title}
    description={isBehavior
      ? 'Define what qualifies as the behavior and how it is measured.'
      : 'Define what is taught, how it is taught, and what it is trying to achieve.'}>
    <form ref={formRef} className="program-form" noValidate onSubmit={submit}>
      <FormFeedback errors={Object.fromEntries(Object.entries(live).filter(([key]) => key !== 'nameWarning'))} />

      <nav className="program-form-sections" aria-label="Program form sections">
        {SECTIONS.map(section => <span key={section.id}
          className={`program-form-section${incompleteSections.has(section.id) ? ' program-form-section--incomplete' : ''}`}>
          {section.title}
          {incompleteSections.has(section.id) && <span className="sr-only"> (has a required field that is missing)</span>}
        </span>)}
      </nav>

      <fieldset className="program-form-fieldset">
        <legend>Treatment information</legend>
        <Field id="program-name" label="Program name" required error={shown('name')}
          hint={`Up to ${FIELD_LIMITS.programName} characters. The name appears in listings, lessons and analytics.`}>
          <input id="program-name" name="name" type="text" required maxLength={FIELD_LIMITS.programName}
            value={values.name} onChange={event => set('name', event.target.value)} />
        </Field>
        {shown('nameWarning') && <p className="field-warning" role="status">{shown('nameWarning')}</p>}

        <Field id="program-status" label="Status" required error={shown('status')}
          hint="The status drives how the program behaves across the platform.">
          <select id="program-status" name="status" required value={values.status} onChange={event => set('status', event.target.value)}>
            {PROGRAM_STATUSES.map(status => <option key={status} value={status}>{PROGRAM_STATUS_LABELS[status]}</option>)}
          </select>
        </Field>

        {isBehavior && <>
          <Field id="program-operational" label="Operational definition" required error={shown('operationalDefinition')}
            hint={`Exactly what qualifies as the behavior. Up to ${FIELD_LIMITS.operationalDefinition} characters.`}>
            <textarea id="program-operational" name="operationalDefinition" required rows={4}
              maxLength={FIELD_LIMITS.operationalDefinition}
              value={values.operationalDefinition} onChange={event => set('operationalDefinition', event.target.value)} />
          </Field>
          <Field id="program-behavior-phase" label="Behavior phase" required error={shown('behaviorPhase')}
            hint="Open means the behavior is defined but not yet being reduced.">
            <select id="program-behavior-phase" name="behaviorPhase" required value={values.behaviorPhase}
              onChange={event => set('behaviorPhase', event.target.value)}>
              {BEHAVIOR_PHASES.map(phase => <option key={phase} value={phase}>{phase}</option>)}
            </select>
          </Field>
          <Field id="program-tool" label="Measurement tool" required error={shown('measurementTool')}
            hint={isEdit ? 'Fixed once the behavior is saved, so collected data stays comparable.' : 'How the behavior is counted during sessions.'}>
            <select id="program-tool" name="measurementTool" required disabled={isEdit} value={values.measurementTool}
              onChange={event => set('measurementTool', event.target.value)}>
              {BEHAVIOR_TOOLS.map(tool => <option key={tool} value={tool}>{TARGET_TYPE_LABELS[tool]}</option>)}
            </select>
          </Field>
          {values.measurementTool === 'IntervalData' && <fieldset className="program-form-fieldset">
            <legend>Interval settings</legend>
            <Field id="program-int-start" label="Start type" required error={shown('intervalStartType')}>
              <select id="program-int-start" value={values.intervalSettings.startType}
                onChange={event => set('intervalSettings', { ...values.intervalSettings, startType: event.target.value })}>
                {INTERVAL_START_TYPES.map(type => <option key={type} value={type}>{type === 'LessonStart' ? 'Lesson start' : 'Manual'}</option>)}
              </select>
            </Field>
            <Field id="program-int-length" label="Interval length" required error={shown('intervalLength')} hint="Minutes and seconds, such as 00:30.">
              <input id="program-int-length" type="text" value={values.intervalSettings.intervalLength}
                onChange={event => set('intervalSettings', { ...values.intervalSettings, intervalLength: event.target.value })} />
            </Field>
            <Field id="program-int-count" label="Number of intervals" error={shown('numberOfIntervals')} hint="Optional.">
              <input id="program-int-count" type="number" min="1" value={values.intervalSettings.numberOfIntervals ?? ''}
                onChange={event => set('intervalSettings', { ...values.intervalSettings, numberOfIntervals: event.target.value })} />
            </Field>
            <Field id="program-int-capture" label="Capture type" required error={shown('intervalCaptureType')}>
              <select id="program-int-capture" value={values.intervalSettings.captureType}
                onChange={event => set('intervalSettings', { ...values.intervalSettings, captureType: event.target.value })}>
                {INTERVAL_CAPTURE_TYPES.map(type => <option key={type} value={type}>{({ Whole: 'Whole interval', Partial: 'Partial interval', MomentaryTimeSampling: 'Momentary time sampling' })[type]}</option>)}
              </select>
            </Field>
          </fieldset>}
        </>}

        <Field id="program-baseline" label="Baseline" error={shown('baseline')}
          hint={`The starting point before any teaching. Up to ${FIELD_LIMITS.baseline} characters.`}>
          <textarea id="program-baseline" name="baseline" rows={3} maxLength={FIELD_LIMITS.baseline}
            value={values.baseline} onChange={event => set('baseline', event.target.value)} />
        </Field>

        <Field id="program-objective" label="Program objective" error={shown('programObjective')}
          hint={`What the program is trying to achieve. Up to ${FIELD_LIMITS.objective} characters.`}>
          <textarea id="program-objective" name="programObjective" rows={3} maxLength={FIELD_LIMITS.objective}
            value={values.programObjective} onChange={event => set('programObjective', event.target.value)} />
        </Field>
      </fieldset>

      <fieldset className="program-form-fieldset">
        <legend>Instructions</legend>
        <Field id="program-teaching" label="Teaching instructions" required error={shown('teachingInstructions')}
          hint={`How the program is run. Up to ${FIELD_LIMITS.teachingInstructions} characters.`}>
          <textarea id="program-teaching" name="teachingInstructions" required rows={4}
            maxLength={FIELD_LIMITS.teachingInstructions}
            value={values.teachingInstructions} onChange={event => set('teachingInstructions', event.target.value)} />
        </Field>
      </fieldset>

      <fieldset className="program-form-fieldset">
        <legend>Tags</legend>
        <TagInput id="program-treatment-area" label="Treatment area" hint="Press Enter to add a value."
          values={values.treatmentArea} onChange={next => set('treatmentArea', next)} />
        <TagInput id="program-tags" label="Tags" hint="Press Enter to add a value."
          values={values.tags} onChange={next => set('tags', next)} />
      </fieldset>

      <fieldset className="program-form-fieldset">
        <legend>Custom data fields</legend>
        <p className="program-form-note">These fields are set by the practice. Your answers are saved with the program.</p>
        {CUSTOM_FIELD_DEFINITIONS.map(definition => <Field key={definition.key}
          id={`program-custom-${definition.key}`} label={definition.label}>
          <input id={`program-custom-${definition.key}`} name={definition.key} type={definition.inputType || 'text'}
            value={values.customFields?.[definition.key] || ''}
            onChange={event => set('customFields', { ...values.customFields, [definition.key]: event.target.value })} />
        </Field>)}
      </fieldset>

      <div className="dialog-actions">
        <button type="button" className="button button--secondary" onClick={cancel}>Cancel</button>
        <button type="submit" className="button button--primary" disabled={showErrors && !complete}>
          {isEdit ? 'Save changes' : 'Create'}
        </button>
      </div>
    </form>
  </Dialog>;
}
