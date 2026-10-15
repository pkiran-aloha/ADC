import { useMemo, useState } from 'react';
import Dialog from '../ui/Dialog';
import SegmentedControl from '../ui/SegmentedControl';
import { PlusCircle } from '../ui/Icons';
import { Field, FormFeedback } from '../ui/Field';
import { useFormValidation } from '../../utils/useFormValidation';
import { isValidDate, MEASUREMENT_LABELS, PHASES } from '../../utils/formValidation';
import { INITIAL_SESSION_DATA, SEED_AS_OF_DATE } from '../../data/mockData';
import { formatChartDate } from '../../utils/chartTheme';
import {
  fieldsFor, defaultRow, lastRowsByTarget, copyFromLast, rowPreview, rowErrors, buildPoint,
  phaseChangeFor, nextSessionTimestamp, readRecorderPrefs, writeRecorderPrefs
} from '../../utils/recording';

const phaseText = value => value === 'OnHold' ? 'On hold' : value;
const targetByIdFrom = (targets, id) => targets.find(target => target.id === id);

// What the target last measured, so a clinician can see the trend while typing.
function summariseLast(row, target) {
  if (!row) return '';
  const date = formatChartDate(row.timestamp.slice(0, 10));
  if (row.missingDataMode === 'DataNotTracked') return `not tracked · ${date}`;
  if (target.type === 'TrialByTrial' || target.type === 'IntervalData') return `${row.value}% · ${date}`;
  if (target.type === 'Duration') return `${Math.round(row.durationSeconds ?? row.value ?? 0)}s · ${date}`;
  if (target.type === 'Frequency' || target.type === 'FluencyRate') return `${row.occurrenceCount ?? row.value ?? 0} · ${date}`;
  return date;
}

// Fill in any rows the target list does not have yet, keeping what was typed.
function ensureRows(previous, targets, lastRows, minutes) {
  const next = { ...previous };
  let changed = false;
  for (const target of targets) {
    if (next[target.id]) continue;
    next[target.id] = defaultRow(target, { lastRow: lastRows.get(target.id), sharedMinutes: minutes });
    changed = true;
  }
  return changed ? next : previous;
}

// Session recording: one shared header (date, clinician) and one row per target, so a
// whole program can be recorded in a single pass instead of target by target.
export default function RecordSessionModal({ isOpen, onClose, programs = [], selectedClientId, initialTargetId = '',
  sessions = [], serviceSessions = [], onSaveSession }) {
  const allTargets = useMemo(() => programs.flatMap(program => program.targets.map(target => ({
    ...target, programId: program.id, programName: program.name, category: program.category
  }))), [programs]);
  const lastRows = useMemo(() => lastRowsByTarget(sessions, allTargets.map(target => target.id)), [sessions, allTargets]);
  const clinicians = useMemo(() => [...new Set(INITIAL_SESSION_DATA.filter(session => session.clientId === selectedClientId).map(session => session.therapistName))], [selectedClientId]);
  const prefs = useMemo(() => readRecorderPrefs(), []);
  const saved = prefs[selectedClientId] || {};

  const [mode, setMode] = useState(initialTargetId ? 'single' : 'session');
  const [programId, setProgramId] = useState(() => {
    const program = programs.find(item => item.targets.some(target => target.id === initialTargetId));
    if (program) return program.id;
    return programs.some(item => item.id === saved.programId) ? saved.programId : programs[0]?.id || 'all';
  });
  const [singleTargetId, setSingleTargetId] = useState(initialTargetId || allTargets[0]?.id || '');
  // Narrative targets are occasional, so a new program starts with the measured ones only.
  const starterIds = targets => targets.filter(target => target.type !== 'Anecdotal').map(target => target.id);
  const [selectedIds, setSelectedIds] = useState(() => {
    if (initialTargetId) return [initialTargetId];
    const remembered = (saved.targetIds || []).filter(id => allTargets.some(target => target.id === id));
    if (remembered.length) return remembered;
    const program = programs.find(item => item.id === programId);
    return program ? starterIds(program.targets) : [];
  });
  const [timestamp, setTimestamp] = useState(`${SEED_AS_OF_DATE}T10:00`);
  const [therapistName, setTherapistName] = useState(clinicians.includes(saved.therapistName) ? saved.therapistName : clinicians[0] || '');
  const [sharedMinutes, setSharedMinutes] = useState(saved.minutes ?? '');
  const [status, setStatus] = useState('');

  const visibleTargets = useMemo(() => {
    if (mode === 'single') return allTargets.filter(target => target.id === singleTargetId);
    if (programId === 'all') return allTargets;
    return allTargets.filter(target => target.programId === programId);
  }, [mode, singleTargetId, programId, allTargets]);

  const [rows, setRows] = useState(() => ensureRows({}, visibleTargets, lastRows, sharedMinutes));
  const { errors, formRef, validate } = useFormValidation();
  const targetsFor = id => (id === 'all' ? allTargets : allTargets.filter(target => target.programId === id));

  function updateRow(targetId, patch) {
    setRows(previous => ({ ...previous, [targetId]: { ...previous[targetId], ...patch } }));
  }
  function updateValue(targetId, key, value) {
    setRows(previous => ({ ...previous, [targetId]: { ...previous[targetId], values: { ...previous[targetId].values, [key]: value } } }));
  }
  function switchMode(nextMode) {
    setMode(nextMode);
    setStatus('');
    if (nextMode === 'session') {
      const targets = targetsFor(programId);
      setSelectedIds(starterIds(targets));
      setRows(previous => ensureRows(previous, targets, lastRows, sharedMinutes));
      return;
    }
    if (!singleTargetId) setSingleTargetId(allTargets[0]?.id || '');
    setSelectedIds(singleTargetId ? [singleTargetId] : []);
    setRows(previous => ensureRows(previous, allTargets.filter(target => target.id === singleTargetId), lastRows, sharedMinutes));
  }
  function changeProgram(nextId) {
    setProgramId(nextId);
    const targets = targetsFor(nextId);
    setSelectedIds(starterIds(targets));
    setRows(previous => ensureRows(previous, targets, lastRows, sharedMinutes));
  }
  function changeTarget(nextId) {
    setSingleTargetId(nextId);
    setSelectedIds([nextId]);
    setRows(previous => ensureRows(previous, allTargets.filter(target => target.id === nextId), lastRows, sharedMinutes));
  }
  function toggleTarget(targetId, included) {
    setSelectedIds(previous => included ? [...new Set([...previous, targetId])] : previous.filter(id => id !== targetId));
  }
  function copyLastSession() {
    setRows(previous => {
      const next = { ...previous };
      for (const target of visibleTargets) {
        if (!selectedIds.includes(target.id)) continue;
        next[target.id] = copyFromLast(previous[target.id] || defaultRow(target), target, lastRows.get(target.id), '');
      }
      return next;
    });
    setStatus('Filled from each target’s last observation. Check the values before saving.');
  }
  function applySharedMinutes() {
    if (sharedMinutes === '') return;
    setRows(previous => {
      const next = { ...previous };
      for (const target of visibleTargets) {
        if (!next[target.id] || !('lessonDurationMinutes' in next[target.id].values)) continue;
        next[target.id] = { ...next[target.id], values: { ...next[target.id].values, lessonDurationMinutes: String(sharedMinutes) } };
      }
      return next;
    });
    setStatus(`Applied ${sharedMinutes} minutes to every frequency and fluency row.`);
  }
  function persistPrefs() {
    writeRecorderPrefs({ ...readRecorderPrefs(), [selectedClientId]: { programId, targetIds: selectedIds, therapistName, minutes: sharedMinutes } });
  }
  function submit(event, keepOpen) {
    event.preventDefault();
    setStatus('');
    const session = { clientId: selectedClientId, timestamp, therapistName };
    const included = allTargets.filter(target => includedIds.includes(target.id));
    const nextErrors = {};
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(timestamp) || !isValidDate(timestamp.slice(0, 10))
      || Number(timestamp.slice(11, 13)) > 23 || Number(timestamp.slice(14, 16)) > 59) {
      nextErrors.timestamp = 'Choose a valid session date and time.';
    }
    if (!therapistName.trim()) nextErrors.therapistName = 'Choose a recording clinician.';
    if (!included.length) nextErrors.targets = 'Select at least one target to record.';
    const points = [];
    const phases = [];
    for (const target of included) {
      const row = rows[target.id];
      if (!row) continue;
      const found = rowErrors(row, target, session);
      for (const [key, message] of Object.entries(found)) nextErrors[`${target.id}:${key}`] = message;
      if (Object.keys(found).length) continue;
      points.push(buildPoint(row, target, session));
      const phase = phaseChangeFor(row, target, session);
      if (phase) phases.push(phase);
    }
    if (!validate(nextErrors)) return;
    onSaveSession({ points, phases, keepOpen });
    persistPrefs();
    if (!keepOpen) {
      onClose();
      return;
    }
    const justSaved = new Map(points.map(point => [point.targetId, point]));
    setRows(Object.fromEntries(allTargets.map(target => [target.id,
      defaultRow(target, { lastRow: justSaved.get(target.id) || lastRows.get(target.id), sharedMinutes })])));
    setTimestamp(nextSessionTimestamp(timestamp, serviceSessions));
    setStatus(`Saved ${points.length} observation${points.length === 1 ? '' : 's'}. Ready for the next session.`);
  }

  const selectedCount = mode === 'single' ? (singleTargetId ? 1 : 0) : selectedIds.length;
  const includedIds = (mode === 'single' ? allTargets.filter(target => target.id === singleTargetId) : allTargets.filter(target => selectedIds.includes(target.id))).map(target => target.id);
  // When the clinician and date are already right, land on the first measurement instead.
  const readyToType = Boolean(therapistName) && includedIds.length > 0;
  const autofocusFieldId = (() => {
    if (!readyToType) return null;
    const target = targetByIdFrom(allTargets, includedIds[0]);
    if (!target) return null;
    return target.type === 'Anecdotal' ? `rec-${target.id}-note` : `rec-${target.id}-${fieldsFor(target.type)[0]?.key}`;
  })();

  return <Dialog isOpen={isOpen} onClose={onClose} title="Record observation" icon={PlusCircle}
    description="Record a whole session at once — choose the program, then fill in every target you worked on. Fictional demo data only; don’t enter patient information.">
    <form ref={formRef} noValidate onSubmit={event => submit(event, false)} className="form-layout record-session">
      <FormFeedback errors={errors} />
      <SegmentedControl label="Recording mode" value={mode} onChange={switchMode}
        options={[{ value: 'session', label: 'Whole program' }, { value: 'single', label: 'Single target' }]} />

      <div className="record-session-head">
        <Field id="record-date" label="Session date & time" error={errors.timestamp} hint="Shared by every target in this session.">
          <input type="datetime-local" required value={timestamp} onChange={event => setTimestamp(event.target.value)} data-autofocus={readyToType ? undefined : true} />
        </Field>
        <Field id="record-clinician" label="Recording clinician" error={errors.therapistName}>
          <select required value={therapistName} onChange={event => setTherapistName(event.target.value)}>
            <option value="">Choose a clinician</option>{clinicians.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <Field id="record-minutes" label="Session length (minutes)" hint="Optional. One click applies it to every frequency and fluency row.">
          <input type="number" min="0.1" step="0.1" inputMode="decimal" value={sharedMinutes} onChange={event => setSharedMinutes(event.target.value)} />
        </Field>
      </div>
      <button type="button" className="button button--tertiary align-self-start" onClick={applySharedMinutes} disabled={sharedMinutes === ''}>Apply minutes to all rows</button>

      {mode === 'session' ? <div className="record-program">
        <Field id="record-program" label="Program" hint="Every target in the program appears below; untick any you didn’t work on.">
          <select value={programId} onChange={event => changeProgram(event.target.value)}>
            <option value="all">All programs</option>
            {programs.map(program => <option key={program.id} value={program.id}>{program.name} · {program.targets.length} targets</option>)}
          </select>
        </Field>
        <div className="record-program-actions">
          <button type="button" className="button button--tertiary" onClick={() => { setSelectedIds(visibleTargets.map(target => target.id)); setRows(previous => ensureRows(previous, visibleTargets, lastRows, sharedMinutes)); }}>Select all</button>
          <button type="button" className="button button--tertiary" onClick={() => setSelectedIds([])}>Clear</button>
          <button type="button" className="button button--tertiary" onClick={copyLastSession} disabled={!selectedCount}>Copy last session</button>
        </div>
      </div> : <Field id="record-target" label="Program & target" error={errors.targetId}>
        <select value={singleTargetId} onChange={event => changeTarget(event.target.value)} required>
          {programs.map(program => <optgroup key={program.id} label={`${program.category === 'SkillAcquisition' ? 'Skill' : 'Behavior'} · ${program.name}`}>
            {program.targets.map(target => <option key={target.id} value={target.id}>{target.name} · {MEASUREMENT_LABELS[target.type]}</option>)}
          </optgroup>)}
        </select>
      </Field>}

      {errors.targets && <p className="field-error" role="alert">{errors.targets}</p>}
      <p className="field-hint">{selectedCount} of {visibleTargets.length} targets selected.</p>

      <ul className="record-targets">
        {visibleTargets.map(target => {
          const row = rows[target.id];
          if (!row) return null;
          const included = mode === 'single' || selectedIds.includes(target.id);
          const untracked = target.category === 'BehaviorReduction' && row.missingDataMode === 'DataNotTracked';
          const preview = rowPreview(row, target);
          return <li key={target.id} className={`record-target${included ? ' record-target--on' : ''}`}>
            <div className="record-target-head">
              {mode === 'session' && <label className="record-target-toggle">
                <input type="checkbox" checked={included} onChange={event => toggleTarget(target.id, event.target.checked)} />
                <span>{target.name}</span>
              </label>}
              {mode === 'single' && <span className="record-target-name">{target.name}</span>}
              <span className="record-target-meta">{programId === 'all' && mode === 'session' ? `${target.programName} · ` : ''}{MEASUREMENT_LABELS[target.type]}{lastRows.has(target.id)
                ? ` · last ${summariseLast(lastRows.get(target.id), target)}` : ' · no records yet'}</span>
            </div>
            {included && <div className="record-target-body">
              {target.type === 'Anecdotal'
                ? <Field id={`rec-${target.id}-note`} label={<>Observation<span className="sr-only"> · {target.name}</span></>} error={errors[`${target.id}:qualitativeEntry`]}>
                  <textarea required maxLength={2000} rows={3} value={row.values.qualitativeEntry}
                    onChange={event => updateValue(target.id, 'qualitativeEntry', event.target.value)}
                    placeholder="Describe the response, support given, and relevant context."
                    data-autofocus={autofocusFieldId === `rec-${target.id}-note` ? true : undefined} />
                </Field>
                : <div className="record-fields">
                  {fieldsFor(target.type).map(field => <Field key={field.key} id={`rec-${target.id}-${field.key}`}
                    label={<>{field.label}<span className="sr-only"> · {target.name}</span></>} error={errors[`${target.id}:${field.key}`]}>
                    <input type={field.text ? 'text' : 'number'} required={!untracked} min={field.min} step={field.integer ? 1 : 'any'}
                      inputMode={field.text ? 'text' : 'decimal'} placeholder={field.placeholder} disabled={untracked}
                      value={row.values[field.key] ?? ''} onChange={event => updateValue(target.id, field.key, event.target.value)}
                      data-autofocus={autofocusFieldId === `rec-${target.id}-${field.key}` ? true : undefined} />
                  </Field>)}
                </div>}
              {preview && <p className="measurement-preview">{preview}</p>}
              {target.category === 'BehaviorReduction' && <fieldset className="record-tracking">
                <legend>Was {target.name} observed?</legend>
                <div className="record-tracking-options">
                  <label className="radio-option radio-option--compact">
                    <input type="radio" name={`track-${target.id}`} checked={!untracked} onChange={() => updateRow(target.id, { missingDataMode: 'ZeroOut' })} />
                    <span><strong>Observed</strong><small>Record the count; 0 means none occurred.</small></span>
                  </label>
                  <label className="radio-option radio-option--compact">
                    <input type="radio" name={`track-${target.id}`} checked={untracked} onChange={() => updateRow(target.id, { missingDataMode: 'DataNotTracked' })} />
                    <span><strong>Not tracked</strong><small>No observation was made. Saved as missing, not zero.</small></span>
                  </label>
                </div>
              </fieldset>}
              <div className="record-phase">
                <Field id={`rec-${target.id}-phase`} label={<>Phase change<span className="sr-only"> · {target.name}</span></>} hint="Optional. Also adds a solid phase line on this date.">
                  <select value={row.phaseChange} onChange={event => updateRow(target.id, { phaseChange: event.target.value })}>
                    <option value="">No phase change</option>
                    {PHASES.map(phase => <option key={phase} value={phase}>{phaseText(phase)}</option>)}
                  </select>
                </Field>
              </div>
            </div>}
          </li>;
        })}
      </ul>

      {status && <p className="record-status" role="status">{status}</p>}
      <div className="form-actions">
        <button type="button" className="button button--secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="button button--secondary" onClick={event => submit(event, true)} disabled={!selectedCount}>Save &amp; next session</button>
        <button type="submit" className="button button--primary" disabled={!selectedCount}>
          Save {selectedCount} observation{selectedCount === 1 ? '' : 's'}
        </button>
      </div>
    </form>
  </Dialog>;
}
