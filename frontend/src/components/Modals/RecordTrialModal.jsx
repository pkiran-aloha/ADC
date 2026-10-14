import { useState } from 'react';
import Dialog from '../ui/Dialog';
import { PlusCircle } from '../ui/Icons';
import { Field, FormFeedback } from '../ui/Field';
import { useFormValidation } from '../../utils/useFormValidation';
import { validateRecording, PHASES, MEASUREMENT_LABELS } from '../../utils/formValidation';
import { INITIAL_SESSION_DATA, SEED_AS_OF_DATE } from '../../data/mockData';

const phaseLabel = value => value === 'OnHold' ? 'On hold' : value;

export default function RecordTrialModal({ isOpen, onClose, programs = [], selectedClientId, initialTargetId = '', onRecordTrial, onUpdatePhase }) {
  const allTargets = programs.flatMap(program => program.targets.map(target => ({ ...target, programName: program.name, category: program.category })));
  const [selectedTargetId, setSelectedTargetId] = useState(initialTargetId || allTargets[0]?.id || '');
  const currentTarget = allTargets.find(target => target.id === selectedTargetId) || allTargets[0];
  const clinicians = [...new Set(INITIAL_SESSION_DATA.filter(session => session.clientId === selectedClientId).map(session => session.therapistName))];
  const [values, setValues] = useState({
    correctCount: '', totalTrials: '', durationSeconds: '', occurrenceCount: '', occurredIntervals: '',
    totalIntervals: currentTarget?.intervalSettings?.numberOfIntervals || '', lessonDurationMinutes: '',
    therapistName: clinicians[0] || '', qualitativeEntry: '', timestamp: `${SEED_AS_OF_DATE}T10:00`,
    missingDataMode: 'ZeroOut', showPhaseChangePrompt: false, newPhase: 'Maintenance', phaseLineLabel: 'Maintenance starts'
  });
  const { errors, formRef, validate } = useFormValidation();
  const setField = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
  const isBehaviorTarget = currentTarget?.category === 'BehaviorReduction';
  const untracked = isBehaviorTarget && values.missingDataMode === 'DataNotTracked';

  function changeTarget(event) {
    const target = allTargets.find(item => item.id === event.target.value);
    setSelectedTargetId(event.target.value);
    setValues(previous => ({ ...previous, correctCount: '', totalTrials: '', durationSeconds: '', occurrenceCount: '',
      occurredIntervals: '', totalIntervals: target?.intervalSettings?.numberOfIntervals || '', lessonDurationMinutes: '',
      qualitativeEntry: '', missingDataMode: 'ZeroOut', showPhaseChangePrompt: false }));
    validate({});
  }
  function submit(event) {
    event.preventDefault();
    if (!validate(validateRecording(values, currentTarget))) return;
    const point = { clientId: selectedClientId, targetId: currentTarget.id, timestamp: `${values.timestamp}:00`, therapistName: values.therapistName };
    if (untracked) {
      point.value = null;
      point.missingDataMode = 'DataNotTracked';
    } else {
      const { correctCount, totalTrials, durationSeconds, occurrenceCount, occurredIntervals, totalIntervals, lessonDurationMinutes } = Object.fromEntries(
        ['correctCount', 'totalTrials', 'durationSeconds', 'occurrenceCount', 'occurredIntervals', 'totalIntervals', 'lessonDurationMinutes'].map(key => [key, Number(values[key])])
      );
      switch (currentTarget.type) {
        case 'TrialByTrial': Object.assign(point, { correctCount, totalTrials, value: Math.round(100 * correctCount / totalTrials) }); break;
        case 'IntervalData': Object.assign(point, { occurredIntervals, totalIntervals, value: Math.round(100 * occurredIntervals / totalIntervals) }); break;
        case 'Duration': Object.assign(point, { durationSeconds, occurrenceCount: durationSeconds > 0 ? 1 : 0, value: durationSeconds }); break;
        case 'Frequency':
        case 'FluencyRate': Object.assign(point, { occurrenceCount, lessonDurationMinutes, value: occurrenceCount }); break;
        case 'Anecdotal': point.qualitativeEntry = values.qualitativeEntry.trim(); break;
      }
      if (isBehaviorTarget && point.value === 0) point.missingDataMode = 'ZeroOut';
    }
    onRecordTrial(point);
    if (values.showPhaseChangePrompt) onUpdatePhase({ targetId: currentTarget.id, newPhase: values.newPhase, addPhaseLine: true,
      phaseLineLabel: values.phaseLineLabel.trim(), phaseDate: values.timestamp.slice(0, 10) });
    onClose();
  }
  function numeric(key, label, props = {}) {
    return <Field id={`record-${key}`} label={label} error={errors[key]}>
      <input type="number" required min={0} step={1} inputMode="numeric" value={values[key]} onChange={event => setField(key, event.target.value)} {...props} />
    </Field>;
  }
  const preview = currentTarget?.type === 'TrialByTrial'
    ? (Number(values.totalTrials) > 0 && values.correctCount !== '' ? `${Math.round(100 * Number(values.correctCount) / Number(values.totalTrials))}% accuracy · ${values.correctCount} / ${values.totalTrials} trials` : '')
    : (Number(values.totalIntervals) > 0 && values.occurredIntervals !== '' ? `${Math.round(100 * Number(values.occurredIntervals) / Number(values.totalIntervals))}% scored · ${values.occurredIntervals} / ${values.totalIntervals} intervals` : '');

  return <Dialog isOpen={isOpen} onClose={onClose} title="Record observation" icon={PlusCircle}
    description="Add a fictional observation to this browser’s demo. Don’t enter patient information.">
    <form ref={formRef} noValidate onSubmit={submit} className="form-layout">
      <FormFeedback errors={errors} />
      <Field id="record-target" label="Program & target" error={errors.targetId}>
        <select value={currentTarget?.id || ''} onChange={changeTarget} required data-autofocus>
          {programs.map(program => <optgroup key={program.id} label={`${program.category === 'SkillAcquisition' ? 'Skill' : 'Behavior'} · ${program.name}`}>
            {program.targets.map(target => <option key={target.id} value={target.id}>{target.name} · {MEASUREMENT_LABELS[target.type]}</option>)}
          </optgroup>)}
        </select>
      </Field>
      <Field id="record-date" label="Observation date & time" error={errors.timestamp} hint="The demo’s date filters use the October 14, 2026 snapshot."><input type="datetime-local" required value={values.timestamp} onChange={event => setField('timestamp', event.target.value)} /></Field>
      <Field id="record-clinician" label="Recording clinician" error={errors.therapistName}><select required value={values.therapistName} onChange={event => setField('therapistName', event.target.value)}>
        <option value="">Choose a clinician</option>{clinicians.map(name => <option key={name} value={name}>{name}</option>)}
      </select></Field>
      <p className="field-hint">Measurement: <strong>{MEASUREMENT_LABELS[currentTarget?.type] || 'Choose a target'}</strong></p>
      {isBehaviorTarget && <fieldset className="recording-decision">
        <legend>Was the behavior observed?</legend>
        <p>Measured zero and an unobserved interval mean different things. Choose before entering the measurement.</p>
        <div className="form-layout gap-2">
          <label className="radio-option"><input type="radio" name="missing-mode" checked={!untracked} onChange={() => { setField('missingDataMode', 'ZeroOut'); validate({}); }} />
            <span><strong>Observed · zero out if none</strong><small>Record the measurement. A measured 0 confirms no occurrence.</small></span>
          </label>
          <label className="radio-option"><input type="radio" name="missing-mode" checked={untracked} onChange={() => { setField('missingDataMode', 'DataNotTracked'); validate({}); }} />
            <span><strong>Data not tracked</strong><small>No observation was made. Save a missing record, not a zero.</small></span>
          </label>
        </div>
      </fieldset>}
      <fieldset className="measurement-inputs" disabled={untracked}>
        <legend className="sr-only">Recorded measurement</legend>
        {currentTarget?.type === 'TrialByTrial' && <>
          <h3>Trial performance</h3><div className="form-row">{numeric('correctCount', 'Correct trials', { max: values.totalTrials || undefined })}{numeric('totalTrials', 'Total trials', { min: 1 })}</div>
          {preview && <p className="measurement-preview">{preview}</p>}
        </>}
        {currentTarget?.type === 'IntervalData' && <>
          <h3>Interval observation</h3><p className="field-hint">{currentTarget.intervalSettings?.captureType} · {currentTarget.intervalSettings?.intervalLength} per interval</p>
          <div className="form-row">{numeric('occurredIntervals', 'Intervals scored', { max: values.totalIntervals || undefined })}{numeric('totalIntervals', 'Total intervals', { min: 1 })}</div>
          {preview && <p className="measurement-preview">{preview}</p>}
        </>}
        {currentTarget?.type === 'Duration' && <>
          <h3>Duration observation</h3>{numeric('durationSeconds', 'Recorded duration (seconds)')}
          {values.durationSeconds !== '' && <p className="measurement-preview">{Math.floor(Number(values.durationSeconds) / 60)} min {Number(values.durationSeconds) % 60} sec</p>}
        </>}
        {['Frequency', 'FluencyRate'].includes(currentTarget?.type) && <>
          <h3>Occurrence count</h3><div className="form-row">{numeric('occurrenceCount', 'Occurrences')}{numeric('lessonDurationMinutes', 'Observation minutes', { min: 0.1, step: 0.1, inputMode: 'decimal' })}</div>
        </>}
        {currentTarget?.type === 'Anecdotal' && <Field id="record-narrative" label="Observation" error={errors.qualitativeEntry}>
          <textarea required maxLength={2000} rows={4} value={values.qualitativeEntry} onChange={event => setField('qualitativeEntry', event.target.value)} placeholder="Describe the response, support given, and relevant context." />
        </Field>}
        {untracked && <p className="field-hint">Measurements aren’t required for an unobserved interval.</p>}
      </fieldset>
      <label className="toggle-control"><input type="checkbox" checked={values.showPhaseChangePrompt} onChange={event => setField('showPhaseChangePrompt', event.target.checked)} />Update target phase on this date</label>
      {values.showPhaseChangePrompt && <div className="measurement-inputs">
        <p className="field-hint">This also adds a solid phase line to the target’s chart.</p>
        <Field id="record-phase" label="New phase" error={errors.newPhase}><select value={values.newPhase} onChange={event => { setField('newPhase', event.target.value); setField('phaseLineLabel', `${phaseLabel(event.target.value)} starts`); }}>{PHASES.map(phase => <option key={phase} value={phase}>{phaseLabel(phase)}</option>)}</select></Field>
        <Field id="record-phase-label" label="Phase line label" error={errors.phaseLineLabel}><input type="text" required maxLength={80} value={values.phaseLineLabel} onChange={event => setField('phaseLineLabel', event.target.value)} /></Field>
      </div>}
      <div className="form-actions"><button type="button" className="button button--secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button--primary" disabled={!currentTarget}>Save observation</button></div>
    </form>
  </Dialog>;
}
