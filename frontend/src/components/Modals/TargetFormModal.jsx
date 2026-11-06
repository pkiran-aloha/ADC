import { useState } from 'react';
import Dialog from '../ui/Dialog';
import { Field, FormFeedback } from '../ui/Field';
import { useFormValidation } from '../../utils/useFormValidation';
import {
  FIELD_LIMITS, FLUENCY_START_TYPES, INTERVAL_CAPTURE_TYPES, INTERVAL_START_TYPES, MASTERY_COMPARISONS,
  MASTERY_MEASURES, PHASE_LABELS, TARGET_PHASES, TARGET_TYPES, TARGET_TYPE_LABELS, validateTarget
} from '../../utils/programManagement';
import { PROMPT_HIERARCHY_TEMPLATES } from '../../data/mockData';

const START_LABELS = {
  Manual: 'Manual', LessonStart: 'Lesson start', LessonStartCountUp: 'Lesson start, count up',
  ManualStartCountUp: 'Manual, count up', ManualStartCountDown: 'Manual, count down'
};
const CAPTURE_LABELS = { Whole: 'Whole interval', Partial: 'Partial interval', MomentaryTimeSampling: 'Momentary time sampling' };
const MEASURE_LABELS = {
  percentCorrect: 'Percent correct', percentIntervals: 'Percent of intervals', durationSeconds: 'Duration in seconds',
  ratePerHour: 'Rate per hour', correctPerMinute: 'Correct per minute', count: 'Count', intervalCount: 'Intervals with occurrence'
};
const COMPARISON_LABELS = { atLeast: 'At least', atMost: 'At most', below: 'Below' };

// The target form. The measurement type is chosen once: editing keeps it fixed so
// data collected one way is never compared against data collected another.
export default function TargetFormModal({ isOpen, onClose, onSave, program, target = null, initialType = 'TrialByTrial', asOf }) {
  const { formRef, validate } = useFormValidation();
  const isEdit = Boolean(target);
  const isBehavior = program?.category === 'BehaviorReduction';
  const [showErrors, setShowErrors] = useState(false);
  const [values, setValues] = useState(() => ({
    name: target?.name || '',
    type: target?.type || initialType,
    phase: target?.phase || (isBehavior ? 'Open' : 'Baseline'),
    discriminativeStimuli: target?.discriminativeStimuli || '',
    masterySettings: target?.masterySettings || 'Automatic',
    masteryRule: target?.masteryRule || { measure: 'percentCorrect', comparison: 'atLeast', threshold: 80, consecutiveSessions: 3 },
    manualMastery: target?.manualMastery || { achieved: false, decidedOn: '', note: '' },
    promptHierarchyId: target?.promptHierarchyId || '',
    intervalSettings: target?.intervalSettings || { startType: 'LessonStart', intervalLength: '00:30', captureType: 'Whole', numberOfIntervals: '' },
    fluencySettings: target?.fluencySettings || { startType: 'ManualStartCountDown' },
    targetInstructions: target?.targetInstructions || ''
  }));

  const set = (key, value) => setValues(current => ({ ...current, [key]: value }));
  const setIn = (key, patch) => setValues(current => ({ ...current, [key]: { ...current[key], ...patch } }));
  const hierarchyIds = PROMPT_HIERARCHY_TEMPLATES.map(item => item.id);
  // After a first attempt the messages follow the values, so they never go stale.
  const live = showErrors ? validateTarget(values, { promptHierarchyIds: hierarchyIds }) : {};
  const shown = key => live[key];

  function submit(event) {
    event.preventDefault();
    const found = validateTarget(values, { promptHierarchyIds: hierarchyIds });
    setShowErrors(true);
    if (!validate(found)) return;
    const payload = { ...values };
    if (payload.type !== 'TrialByTrial') delete payload.promptHierarchyId;
    if (payload.type !== 'IntervalData') delete payload.intervalSettings;
    if (payload.type !== 'FluencyRate') delete payload.fluencySettings;
    if (payload.masterySettings === 'Manual') delete payload.masteryRule;
    else delete payload.manualMastery;
    if (payload.intervalSettings?.numberOfIntervals === '') delete payload.intervalSettings.numberOfIntervals;
    else if (payload.intervalSettings) payload.intervalSettings = { ...payload.intervalSettings, numberOfIntervals: Number(payload.intervalSettings.numberOfIntervals) };
    onSave?.(payload);
  }

  return <Dialog isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit target' : 'Add target'}
    description={`A target is one measurable unit of “${program?.name || 'this program'}”.`}>
    <form ref={formRef} className="program-form" noValidate onSubmit={submit}>
      <FormFeedback errors={live} />

      <Field id="target-type" label="Measurement tool" required error={shown('type')}
        hint={isEdit ? 'Fixed once the target exists, so collected data stays comparable.' : 'How data is recorded during sessions.'}>
        <select id="target-type" name="type" required disabled={isEdit} value={values.type} onChange={event => set('type', event.target.value)}>
          {TARGET_TYPES.map(type => <option key={type} value={type}>{TARGET_TYPE_LABELS[type]}</option>)}
        </select>
      </Field>

      <Field id="target-name" label={isEdit ? 'Target name' : 'Target name or names'} required error={shown('name')}
        hint={isEdit ? undefined : 'Separate several names with commas or new lines. Each becomes its own target.'}>
        {isEdit
          ? <input id="target-name" name="name" type="text" required value={values.name} onChange={event => set('name', event.target.value)} />
          : <textarea id="target-name" name="name" required rows={2} value={values.name} onChange={event => set('name', event.target.value)} />}
      </Field>

      <Field id="target-phase" label="Phase" required error={shown('phase')}>
        <select id="target-phase" name="phase" required value={values.phase} onChange={event => set('phase', event.target.value)}>
          {TARGET_PHASES.filter(phase => isBehavior || phase !== 'Open').map(phase => <option key={phase} value={phase}>{PHASE_LABELS[phase]}</option>)}
        </select>
      </Field>

      <Field id="target-stimuli" label="Discriminative stimuli" hint="The cue or condition under which the behavior should occur.">
        <input id="target-stimuli" name="discriminativeStimuli" type="text" value={values.discriminativeStimuli}
          onChange={event => set('discriminativeStimuli', event.target.value)} />
      </Field>

      {values.type === 'TrialByTrial' && <Field id="target-prompts" label="Prompt hierarchy" required error={shown('promptHierarchyId')}
        hint="The levels of assistance used while teaching.">
        <select id="target-prompts" name="promptHierarchyId" required value={values.promptHierarchyId}
          onChange={event => set('promptHierarchyId', event.target.value)}>
          <option value="">Choose a hierarchy</option>
          {PROMPT_HIERARCHY_TEMPLATES.map(item => <option key={item.id} value={item.id}>{item.name} ({item.levels.join(' to ')})</option>)}
        </select>
      </Field>}

      {values.type === 'IntervalData' && <fieldset className="program-form-fieldset">
        <legend>Interval settings</legend>
        <Field id="target-interval-start" label="Start type" required error={shown('intervalStartType')}>
          <select id="target-interval-start" required value={values.intervalSettings.startType}
            onChange={event => setIn('intervalSettings', { startType: event.target.value })}>
            {INTERVAL_START_TYPES.map(type => <option key={type} value={type}>{START_LABELS[type]}</option>)}
          </select>
        </Field>
        <Field id="target-interval-length" label="Interval length" required error={shown('intervalLength')} hint="Minutes and seconds, such as 00:30.">
          <input id="target-interval-length" type="text" required value={values.intervalSettings.intervalLength}
            onChange={event => setIn('intervalSettings', { intervalLength: event.target.value })} />
        </Field>
        <Field id="target-interval-count" label="Number of intervals" error={shown('numberOfIntervals')} hint="Optional.">
          <input id="target-interval-count" type="number" min="1" value={values.intervalSettings.numberOfIntervals ?? ''}
            onChange={event => setIn('intervalSettings', { numberOfIntervals: event.target.value })} />
        </Field>
        <Field id="target-interval-capture" label="Capture type" required error={shown('intervalCaptureType')}>
          <select id="target-interval-capture" required value={values.intervalSettings.captureType}
            onChange={event => setIn('intervalSettings', { captureType: event.target.value })}>
            {INTERVAL_CAPTURE_TYPES.map(type => <option key={type} value={type}>{CAPTURE_LABELS[type]}</option>)}
          </select>
        </Field>
      </fieldset>}

      {values.type === 'FluencyRate' && <Field id="target-fluency" label="Timer" required error={shown('fluencyStartType')}>
        <select id="target-fluency" required value={values.fluencySettings.startType}
          onChange={event => setIn('fluencySettings', { startType: event.target.value })}>
          {FLUENCY_START_TYPES.map(type => <option key={type} value={type}>{START_LABELS[type]}</option>)}
        </select>
      </Field>}

      <fieldset className="program-form-fieldset">
        <legend>Mastery</legend>
        <Field id="target-mastery" label="Mastery settings" hint="Automatic reads a stated rule from the data. Manual is a clinician’s decision.">
          <select id="target-mastery" value={values.masterySettings} onChange={event => set('masterySettings', event.target.value)}>
            <option value="Automatic">Automatic</option>
            <option value="Manual">Manual</option>
          </select>
        </Field>
        {values.masterySettings === 'Automatic'
          ? <>
            <Field id="target-rule-measure" label="Measure" error={shown('masteryMeasure')}>
              <select id="target-rule-measure" value={values.masteryRule.measure} onChange={event => setIn('masteryRule', { measure: event.target.value })}>
                {MASTERY_MEASURES.map(measure => <option key={measure} value={measure}>{MEASURE_LABELS[measure]}</option>)}
              </select>
            </Field>
            <Field id="target-rule-comparison" label="Comparison" error={shown('masteryComparison')}>
              <select id="target-rule-comparison" value={values.masteryRule.comparison} onChange={event => setIn('masteryRule', { comparison: event.target.value })}>
                {MASTERY_COMPARISONS.map(item => <option key={item} value={item}>{COMPARISON_LABELS[item]}</option>)}
              </select>
            </Field>
            <Field id="target-rule-threshold" label="Threshold" error={shown('masteryThreshold')}>
              <input id="target-rule-threshold" type="number" min="0" value={values.masteryRule.threshold}
                onChange={event => setIn('masteryRule', { threshold: event.target.value })} />
            </Field>
            <Field id="target-rule-sessions" label="Consecutive sessions" error={shown('masterySessions')}>
              <input id="target-rule-sessions" type="number" min="1" value={values.masteryRule.consecutiveSessions}
                onChange={event => setIn('masteryRule', { consecutiveSessions: event.target.value })} />
            </Field>
          </>
          : <>
            <label className="program-form-check">
              <input type="checkbox" checked={Boolean(values.manualMastery.achieved)}
                onChange={event => setIn('manualMastery', { achieved: event.target.checked, decidedOn: event.target.checked && !values.manualMastery.decidedOn ? asOf : values.manualMastery.decidedOn })} />
              <span>A clinician has decided this target is mastered</span>
            </label>
            {values.manualMastery.achieved && <>
              <Field id="target-manual-date" label="Date of the decision" required error={shown('manualDecidedOn')}>
                <input id="target-manual-date" type="date" required value={values.manualMastery.decidedOn}
                  onChange={event => setIn('manualMastery', { decidedOn: event.target.value })} />
              </Field>
              <Field id="target-manual-note" label="Note">
                <input id="target-manual-note" type="text" value={values.manualMastery.note || ''}
                  onChange={event => setIn('manualMastery', { note: event.target.value })} />
              </Field>
            </>}
          </>}
      </fieldset>

      <Field id="target-instructions" label="Target instructions" error={shown('targetInstructions')}
        hint={`Optional. Up to ${FIELD_LIMITS.targetInstructions} characters.`}>
        <textarea id="target-instructions" name="targetInstructions" rows={3} maxLength={FIELD_LIMITS.targetInstructions}
          value={values.targetInstructions} onChange={event => set('targetInstructions', event.target.value)} />
      </Field>

      <div className="dialog-actions">
        <button type="button" className="button button--secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="button button--primary">{isEdit ? 'Save changes' : 'Add'}</button>
      </div>
    </form>
  </Dialog>;
}
