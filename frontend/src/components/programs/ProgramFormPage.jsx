import { useMemo, useRef, useState } from 'react';
import ConfirmDialog from '../ui/ConfirmDialog';
import { Field } from '../ui/Field';
import TagInput from '../ui/TagInput';
import { ArrowLeft, ArrowRight, Check, Trash2, Upload } from '../ui/Icons';
import {
  BEHAVIOR_PHASES, BEHAVIOR_TOOLS, CAPTURE_LABELS, FIELD_LIMITS, INTERVAL_CAPTURE_TYPES, INTERVAL_START_TYPES, MATERIAL_LIMITS_TEXT,
  PROGRAM_CATEGORIES, PROGRAM_STATUSES, PROGRAM_STATUS_LABELS, SCOPE_LABELS, TARGET_TYPE_LABELS,
  behaviorPhaseOf, materialBytes, programFormComplete, toValueList, validateBehavior, validateMaterial, validateProgram
} from '../../utils/programManagement';
import { CUSTOM_FIELD_DEFINITIONS } from '../../data/mockData';

// The create and edit page for a program or behavior. It is a page, not a drawer: a
// clinician moves between sections from the side, sees which ones still miss a required
// field, and can save only when everything required is filled in.
//
// A skill program has five sections. A behavior is defined in two steps: where it sits in the
// treatment plan, then the behavior itself and how it is measured.

const SKILL_SECTIONS = [
  { id: 'treatment', title: 'Treatment information', blurb: 'What the program is called, where it stands, and what it is trying to achieve.', fields: ['name', 'status'] },
  { id: 'instructions', title: 'Instructions', blurb: 'How the program is run, so anyone can deliver it the same way.', fields: ['teachingInstructions'] },
  { id: 'tags', title: 'Tags', blurb: 'Labels that make the program easy to find, group and filter.', fields: [] },
  { id: 'materials', title: 'Learning materials', blurb: 'Optional files that help staff run the program.', fields: [] },
  { id: 'custom', title: 'Custom data fields', blurb: 'Fields your practice has asked for on every program.', fields: [] }
];

const BEHAVIOR_SECTIONS = [
  { id: 'context', title: 'Treatment information', blurb: 'Where this behavior sits in the treatment plan.', fields: ['treatmentArea', 'programObjective'] },
  { id: 'details', title: 'Behavior details', blurb: 'What the behavior is, exactly, and how it is counted.', fields: ['name', 'measurementTool', 'intervalStartType', 'intervalLength', 'intervalCaptureType', 'numberOfIntervals', 'operationalDefinition', 'behaviorPhase'] }
];

const startLabel = type => (type === 'LessonStart' ? 'Lesson start' : 'Manual');

function Count({ value, limit }) {
  const length = String(value || '').length;
  return <span className={`pm-count${length > limit * 0.9 ? ' pm-count--near' : ''}`} aria-hidden="true">{length} / {limit}</span>;
}

export default function ProgramFormPage({
  category = PROGRAM_CATEGORIES.SKILL, scope = 'client', client = null, program = null, existing = [], asOf,
  onSave, onCancel, onOpenTargets
}) {
  const isBehavior = category === PROGRAM_CATEGORIES.BEHAVIOR;
  const isEdit = Boolean(program);
  const library = scope === 'organization';
  const sections = isBehavior ? BEHAVIOR_SECTIONS : SKILL_SECTIONS;
  const noun = isBehavior ? 'behavior' : 'program';

  const initial = useMemo(() => ({
    clientId: library ? null : client?.id || '',
    name: program?.name || '',
    status: program?.status || 'Teaching',
    treatmentArea: toValueList(program?.treatmentArea),
    tags: toValueList(program?.tags),
    baseline: program?.baseline || '',
    programObjective: program?.programObjective || '',
    teachingInstructions: program?.teachingInstructions || '',
    operationalDefinition: program?.operationalDefinition || '',
    behaviorPhase: program ? behaviorPhaseOf(program) : 'Open',
    measurementTool: program?.targets?.[0]?.type || 'Frequency',
    intervalSettings: program?.targets?.[0]?.intervalSettings || { startType: 'Manual', intervalLength: '00:30', captureType: 'Whole', numberOfIntervals: '' },
    customFields: program?.customFields || {},
    learningMaterials: program?.learningMaterials || []
  }), [program, client, library]);

  const [values, setValues] = useState(initial);
  const [active, setActive] = useState(sections[0].id);
  const [touched, setTouched] = useState(() => new Set());
  const [visited, setVisited] = useState(() => new Set([sections[0].id]));
  const [leaving, setLeaving] = useState(null);
  const [materialError, setMaterialError] = useState('');
  const headingRef = useRef(null);

  const set = (key, value) => setValues(current => ({ ...current, [key]: value }));
  const touch = key => setTouched(current => (current.has(key) ? current : new Set(current).add(key)));
  const setInterval_ = patch => set('intervalSettings', { ...values.intervalSettings, ...patch });

  const check = vals => (isBehavior ? validateBehavior(vals, { existing, scope }) : validateProgram(vals, { category, existing, scope }));
  const errors = check(values);
  const complete = programFormComplete(errors);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const sectionOf = key => sections.find(section => section.fields.includes(key))?.id;
  const missingIn = section => section.fields.filter(key => errors[key]);
  const flagged = section => visited.has(section.id) && section.id !== active && missingIn(section).length > 0;
  const showError = key => (touched.has(key) || (visited.has(sectionOf(key)) && sectionOf(key) !== active)) ? errors[key] : undefined;
  // The first required field that is still missing, in the words a clinician would use.
  const FIELD_NAMES = {
    name: isBehavior ? 'Behavior name' : 'Program name', status: 'Status', teachingInstructions: 'Teaching instructions',
    treatmentArea: 'Treatment area', programObjective: 'Objective', measurementTool: 'Measurement tool',
    operationalDefinition: 'Operational definition', behaviorPhase: 'Phase', intervalStartType: 'Interval start type',
    intervalLength: 'Interval length', intervalCaptureType: 'Capture type'
  };
  const missing = Object.keys(errors).filter(key => key !== 'nameWarning' && FIELD_NAMES[key]).map(key => FIELD_NAMES[key]);

  const index = sections.findIndex(section => section.id === active);
  function go(id) {
    setVisited(current => new Set(current).add(active).add(id));
    setActive(id);
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: false }));
  }

  function requestLeave(action) {
    if (dirty) setLeaving(() => action); else action();
  }

  function submit(event) {
    event.preventDefault();
    if (!complete) {
      // Pressing Enter on an incomplete form shows where it is incomplete.
      const first = sections.find(section => missingIn(section).length);
      if (first) {
        setTouched(current => new Set([...current, ...first.fields]));
        go(first.id);
      }
      return;
    }
    const { measurementTool, intervalSettings, operationalDefinition, behaviorPhase, ...shared } = values;
    const behaviorFields = isBehavior ? {
      measurementTool, operationalDefinition, behaviorPhase,
      intervalSettings: measurementTool === 'IntervalData'
        ? { ...intervalSettings, numberOfIntervals: intervalSettings.numberOfIntervals === '' ? undefined : Number(intervalSettings.numberOfIntervals) }
        : undefined
    } : {};
    onSave?.({
      ...shared, ...behaviorFields, name: values.name.trim(),
      customFields: Object.fromEntries(
        CUSTOM_FIELD_DEFINITIONS.map(definition => [definition.key, values.customFields?.[definition.key] || '']).filter(([, value]) => value)
      )
    });
  }

  async function addMaterial(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const content = await file.text();
    const size = new TextEncoder().encode(content).length;
    const result = validateMaterial({ name: file.name, size }, values.learningMaterials);
    if (!result.ok) { setMaterialError(result.reason); return; }
    setMaterialError('');
    set('learningMaterials', [...values.learningMaterials, { fileName: file.name.trim(), contentType: 'text/plain', content, size, addedOn: asOf }]);
  }

  const title = isEdit ? `Edit ${noun}` : `New ${noun}`;
  const where = library ? 'the organization library' : client?.name || 'this client';

  return <form className="pm-form" noValidate onSubmit={submit} aria-labelledby="pm-form-title">
    <header className="pm-form-head">
      <div>
        <nav className="pm-crumbs" aria-label="Breadcrumb">
          <button type="button" className="pm-crumb-link" onClick={() => requestLeave(onCancel)}><ArrowLeft size={15} />Programs</button>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{title}</span>
        </nav>
        <h2 id="pm-form-title" className="pm-form-title">{isEdit ? program.name : title}</h2>
        <p className="pm-form-sub">
          <span className="pm-scope-chip">{SCOPE_LABELS[scope]}</span>
          {isEdit ? `Saved changes show up everywhere ${library ? 'this program is used' : 'in the analytics'} without a reload.` : `This ${noun} will belong to ${where}.`}
        </p>
      </div>
      {isEdit && onOpenTargets && <button type="button" className="button button--secondary"
        onClick={() => requestLeave(() => onOpenTargets(program))}>
        {isBehavior ? 'Go to behavior view' : 'Go to targets'}<ArrowRight size={16} />
      </button>}
    </header>

    <div className="pm-form-layout">
      <nav className="pm-steps" aria-label="Form sections">
        <ol>
          {sections.map((section, number) => {
            const short = flagged(section);
            const done = visited.has(section.id) && section.id !== active && missingIn(section).length === 0;
            return <li key={section.id}>
              <button type="button" className={`pm-step${active === section.id ? ' pm-step--active' : ''}${short ? ' pm-step--missing' : ''}`}
                aria-current={active === section.id ? 'step' : undefined} onClick={() => go(section.id)}>
                <span className="pm-step-mark" aria-hidden="true">{done ? <Check size={13} weight="bold" /> : short ? '!' : number + 1}</span>
                <span className="pm-step-text">{section.title}</span>
                {short && <span className="sr-only"> (a required field is missing)</span>}
                {done && <span className="sr-only"> (complete)</span>}
              </button>
            </li>;
          })}
        </ol>
      </nav>

      <div className="pm-form-body">
        {sections.map(section => section.id === active && <section key={section.id} className="pm-pane" aria-labelledby={`pm-pane-${section.id}`}>
          <h3 id={`pm-pane-${section.id}`} className="pm-pane-title" tabIndex={-1} ref={headingRef}>{section.title}</h3>
          <p className="pm-pane-blurb">{section.blurb}</p>

          {section.id === 'treatment' && <>
            <Field id="pm-name" label="Program name" required error={showError('name')}
              hint={`Up to ${FIELD_LIMITS.programName} characters. The name appears in listings, lessons and analytics.`}>
              <input type="text" required maxLength={FIELD_LIMITS.programName} value={values.name}
                onBlur={() => touch('name')} onChange={event => set('name', event.target.value)} />
            </Field>
            <div className="pm-count-row">
              <p className="field-warning" role="status">{errors.nameWarning && touched.has('name') ? errors.nameWarning : ''}</p>
              <Count value={values.name} limit={FIELD_LIMITS.programName} />
            </div>
            <Field id="pm-status" label="Status" required error={showError('status')}
              hint="Where the program stands. Pending, Completed, On hold and Discontinued also move its targets; the teaching statuses leave them alone.">
              <select required value={values.status} onChange={event => set('status', event.target.value)}>
                {PROGRAM_STATUSES.map(status => <option key={status} value={status}>{PROGRAM_STATUS_LABELS[status]}</option>)}
              </select>
            </Field>
            {isEdit && values.status !== program.status && <p className="pm-note">Saving will ask whether to plot a phase change line, and the change is written to the program history.</p>}
            <TagInput id="pm-treatment-area" label="Treatment area" hint="Press Enter to add each area. Remove one with its cross."
              values={values.treatmentArea} onChange={next => set('treatmentArea', next)} />
            <Field id="pm-baseline" label="Baseline" hint={`The starting point before any teaching. Optional, up to ${FIELD_LIMITS.baseline} characters.`}>
              <textarea rows={4} maxLength={FIELD_LIMITS.baseline} value={values.baseline} onChange={event => set('baseline', event.target.value)} />
            </Field>
            <div className="pm-count-row"><Count value={values.baseline} limit={FIELD_LIMITS.baseline} /></div>
            <Field id="pm-objective" label="Program objective" hint={`What success looks like. Optional, up to ${FIELD_LIMITS.objective} characters.`}>
              <textarea rows={4} maxLength={FIELD_LIMITS.objective} value={values.programObjective} onChange={event => set('programObjective', event.target.value)} />
            </Field>
            <div className="pm-count-row"><Count value={values.programObjective} limit={FIELD_LIMITS.objective} /></div>
          </>}

          {section.id === 'instructions' && <>
            <Field id="pm-teaching" label="Teaching instructions" required={!library} error={showError('teachingInstructions')}
              hint={library
                ? 'Optional here. Text written for one learner is cleared when a program enters the organization library.'
                : `How to present the task, which prompts to use and how to respond. Up to ${FIELD_LIMITS.teachingInstructions} characters.`}>
              <textarea rows={8} required={!library} maxLength={FIELD_LIMITS.teachingInstructions} value={values.teachingInstructions}
                onBlur={() => touch('teachingInstructions')} onChange={event => set('teachingInstructions', event.target.value)} />
            </Field>
            <div className="pm-count-row"><Count value={values.teachingInstructions} limit={FIELD_LIMITS.teachingInstructions} /></div>
          </>}

          {section.id === 'tags' && <TagInput id="pm-tags" label="Tags" hint="Press Enter to add each tag, for example a skill type, a difficulty level or a category."
            values={values.tags} onChange={next => set('tags', next)} />}

          {section.id === 'materials' && <>
            <p className="pm-note">{MATERIAL_LIMITS_TEXT}</p>
            {values.learningMaterials.length === 0
              ? <p className="pm-empty-line">No files attached yet.</p>
              : <ul className="pm-files" aria-label="Attached files">
                {values.learningMaterials.map(material => <li key={material.fileName}>
                  <span className="pm-file-name">{material.fileName}</span>
                  <span className="pm-file-size">{materialBytes(material) ? `${Math.max(1, Math.round(materialBytes(material) / 1024))} KB` : 'Demo file'}</span>
                  <button type="button" className="icon-button" aria-label={`Remove ${material.fileName}`}
                    onClick={() => set('learningMaterials', values.learningMaterials.filter(item => item.fileName !== material.fileName))}><Trash2 size={17} /></button>
                </li>)}
              </ul>}
            <div className="field">
              <label htmlFor="pm-material" className="button button--secondary pm-upload"><Upload size={16} />Choose a text file</label>
              <input id="pm-material" className="sr-only" type="file" accept=".txt,.md,.csv,text/plain" onChange={addMaterial} />
              {materialError && <p className="field-error" role="alert">{materialError}</p>}
            </div>
          </>}

          {section.id === 'custom' && <>
            <p className="pm-note">These fields are set by the practice. Your answers are saved with the program.</p>
            {CUSTOM_FIELD_DEFINITIONS.map(definition => <Field key={definition.key} id={`pm-custom-${definition.key}`} label={definition.label}>
              <input type={definition.inputType || 'text'} value={values.customFields?.[definition.key] || ''}
                onChange={event => set('customFields', { ...values.customFields, [definition.key]: event.target.value })} />
            </Field>)}
          </>}

          {section.id === 'context' && <>
            <TagInput id="pm-treatment-area" label="Treatment area (required)" hint="Press Enter or a comma after each area."
              values={values.treatmentArea} onChange={next => { set('treatmentArea', next); touch('treatmentArea'); }} />
            <div className="pm-error-slot">{showError('treatmentArea') && <p className="field-error">{showError('treatmentArea')}</p>}</div>
            <Field id="pm-baseline" label="Baseline" hint={`How often and how intensely the behavior happens before intervention. Optional, up to ${FIELD_LIMITS.baseline} characters.`}>
              <textarea rows={4} maxLength={FIELD_LIMITS.baseline} value={values.baseline} onChange={event => set('baseline', event.target.value)} />
            </Field>
            <Field id="pm-objective" label="Objective" required error={showError('programObjective')}
              hint={`What change do you expect to see in this behavior? Up to ${FIELD_LIMITS.objective} characters.`}>
              <textarea rows={4} required maxLength={FIELD_LIMITS.objective} value={values.programObjective}
                onBlur={() => touch('programObjective')} onChange={event => set('programObjective', event.target.value)} />
            </Field>
            <div className="pm-count-row"><Count value={values.programObjective} limit={FIELD_LIMITS.objective} /></div>
            <h4 className="pm-subhead">Custom data fields</h4>
            {CUSTOM_FIELD_DEFINITIONS.map(definition => <Field key={definition.key} id={`pm-custom-${definition.key}`} label={definition.label}>
              <input type={definition.inputType || 'text'} value={values.customFields?.[definition.key] || ''}
                onChange={event => set('customFields', { ...values.customFields, [definition.key]: event.target.value })} />
            </Field>)}
          </>}

          {section.id === 'details' && <>
            <Field id="pm-name" label="Behavior name" required error={showError('name')}
              hint={`Up to ${FIELD_LIMITS.programName} characters.`}>
              <input type="text" required maxLength={FIELD_LIMITS.programName} value={values.name}
                onBlur={() => touch('name')} onChange={event => set('name', event.target.value)} />
            </Field>
            <div className="pm-error-slot"><p className="field-warning" role="status">{errors.nameWarning && touched.has('name') ? errors.nameWarning : ''}</p></div>
            <Field id="pm-tool" label="Measurement tool" required error={showError('measurementTool')}
              hint={isEdit ? 'Fixed once the behavior is saved, so collected data stays comparable.' : 'How the behavior is counted. This cannot be changed after you save.'}>
              <select required disabled={isEdit} value={values.measurementTool} onChange={event => set('measurementTool', event.target.value)}>
                {BEHAVIOR_TOOLS.map(tool => <option key={tool} value={tool}>{TARGET_TYPE_LABELS[tool]}</option>)}
              </select>
            </Field>
            <p className="pm-note">{{
              Frequency: 'Frequency counts how many times the behavior happens. It suits discrete actions you can count.',
              Duration: 'Duration measures how long the behavior lasts. It suits behaviors that continue over time.',
              IntervalData: 'Interval recording notes whether the behavior happened within each timed interval. It is more structured and needs the settings below.'
            }[values.measurementTool]}</p>
            {values.measurementTool === 'IntervalData' && <fieldset className="pm-fieldset">
              <legend>Interval settings</legend>
              <Field id="pm-int-start" label="Start type" required error={showError('intervalStartType')}>
                <select value={values.intervalSettings.startType} onChange={event => setInterval_({ startType: event.target.value })}>
                  {INTERVAL_START_TYPES.map(type => <option key={type} value={type}>{startLabel(type)}</option>)}
                </select>
              </Field>
              <Field id="pm-int-length" label="Interval length" required error={showError('intervalLength')} hint="Minutes and seconds, such as 00:30.">
                <input type="text" value={values.intervalSettings.intervalLength} onBlur={() => touch('intervalLength')}
                  onChange={event => setInterval_({ intervalLength: event.target.value })} />
              </Field>
              <Field id="pm-int-count" label="Number of intervals" error={showError('numberOfIntervals')} hint="Optional.">
                <input type="number" min="1" value={values.intervalSettings.numberOfIntervals ?? ''}
                  onChange={event => setInterval_({ numberOfIntervals: event.target.value })} />
              </Field>
              <Field id="pm-int-capture" label="Capture type" required error={showError('intervalCaptureType')}>
                <select value={values.intervalSettings.captureType} onChange={event => setInterval_({ captureType: event.target.value })}>
                  {INTERVAL_CAPTURE_TYPES.map(type => <option key={type} value={type}>{CAPTURE_LABELS[type]}</option>)}
                </select>
              </Field>
            </fieldset>}
            <Field id="pm-operational" label="Operational definition" required error={showError('operationalDefinition')}
              hint="Exactly what counts as this behavior, and what does not, so every person records it the same way.">
              <textarea rows={7} required maxLength={FIELD_LIMITS.operationalDefinition} value={values.operationalDefinition}
                onBlur={() => touch('operationalDefinition')} onChange={event => set('operationalDefinition', event.target.value)} />
            </Field>
            <div className="pm-count-row"><Count value={values.operationalDefinition} limit={FIELD_LIMITS.operationalDefinition} /></div>
            <Field id="pm-phase" label="Phase" required error={showError('behaviorPhase')}
              hint="Open means the behavior is defined but not yet being reduced.">
              <select required value={values.behaviorPhase} onChange={event => set('behaviorPhase', event.target.value)}>
                {BEHAVIOR_PHASES.map(phase => <option key={phase} value={phase}>{phase === 'OnHold' ? 'On hold' : phase}</option>)}
              </select>
            </Field>
            {isEdit && values.behaviorPhase !== behaviorPhaseOf(program) && <p className="pm-note">Saving will ask whether to plot a phase change line, and the change is written to the behavior history.</p>}
            <TagInput id="pm-tags" label="Tags" hint="Press Enter or a comma after each tag."
              values={values.tags} onChange={next => set('tags', next)} />
            <h4 className="pm-subhead">Learning materials</h4>
            <p className="pm-note">{MATERIAL_LIMITS_TEXT}</p>
            {values.learningMaterials.length > 0 && <ul className="pm-files" aria-label="Attached files">
              {values.learningMaterials.map(material => <li key={material.fileName}>
                <span className="pm-file-name">{material.fileName}</span>
                <span className="pm-file-size">{materialBytes(material) ? `${Math.max(1, Math.round(materialBytes(material) / 1024))} KB` : 'Demo file'}</span>
                <button type="button" className="icon-button" aria-label={`Remove ${material.fileName}`}
                  onClick={() => set('learningMaterials', values.learningMaterials.filter(item => item.fileName !== material.fileName))}><Trash2 size={17} /></button>
              </li>)}
            </ul>}
            <div className="field">
              <label htmlFor="pm-material" className="button button--secondary pm-upload"><Upload size={16} />Choose a text file</label>
              <input id="pm-material" className="sr-only" type="file" accept=".txt,.md,.csv,text/plain" onChange={addMaterial} />
              {materialError && <p className="field-error" role="alert">{materialError}</p>}
            </div>
          </>}
        </section>)}
      </div>
    </div>

    <footer className="pm-form-bar">
      <p className={`pm-form-status${complete ? ' pm-form-status--ready' : ''}`} role="status">
        {complete ? 'All required fields are complete.' : `Still needed: ${missing.join(', ')}.`}
      </p>
      <div className="pm-form-actions">
        <button type="button" className="button button--tertiary" onClick={() => requestLeave(onCancel)}>Cancel</button>
        {index > 0 && <button type="button" className="button button--secondary" onClick={() => go(sections[index - 1].id)}>
          <ArrowLeft size={16} />Previous</button>}
        {index < sections.length - 1 && <button type="button" className="button button--secondary" onClick={() => go(sections[index + 1].id)}>
          Next<ArrowRight size={16} /></button>}
        <button type="submit" className="button button--primary" disabled={!complete}>{isEdit ? 'Save changes' : isBehavior ? 'Save behavior' : 'Save program'}</button>
      </div>
    </footer>

    <ConfirmDialog isOpen={Boolean(leaving)} onClose={() => setLeaving(null)} destructive confirmLabel="Discard changes" cancelLabel="Keep editing"
      title="Are you sure you want to cancel these unsaved changes?"
      description="What you entered on this page has not been saved and will be lost."
      onConfirm={() => { const action = leaving; setLeaving(null); action?.(); }} />
  </form>;
}
