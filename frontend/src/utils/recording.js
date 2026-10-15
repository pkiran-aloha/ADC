// Session recording helpers: one shared session header plus one row per target.
// Pure functions so a whole session can be validated and converted without a DOM.
import { validateRecording } from './formValidation.js';
import { addDays } from './stats.js';

// Inputs for each measurement type, in the order a clinician records them.
export const MEASUREMENT_INPUTS = {
  TrialByTrial: [
    { key: 'correctCount', label: 'Correct trials', integer: true, min: 0, placeholder: '8' },
    { key: 'totalTrials', label: 'Total trials', integer: true, min: 1, placeholder: '10' }
  ],
  IntervalData: [
    { key: 'occurredIntervals', label: 'Intervals scored', integer: true, min: 0, placeholder: '6' },
    { key: 'totalIntervals', label: 'Total intervals', integer: true, min: 1, placeholder: '12' }
  ],
  Duration: [
    { key: 'durationSeconds', label: 'Recorded duration (seconds)', integer: true, min: 0, placeholder: '137' }
  ],
  Frequency: [
    { key: 'occurrenceCount', label: 'Occurrences', integer: true, min: 0, placeholder: '7' },
    { key: 'lessonDurationMinutes', label: 'Observation minutes', integer: false, min: 0.1, placeholder: '30' }
  ],
  FluencyRate: [
    { key: 'occurrenceCount', label: 'Occurrences', integer: true, min: 0, placeholder: '7' },
    { key: 'lessonDurationMinutes', label: 'Observation minutes', integer: false, min: 0.1, placeholder: '1' }
  ],
  Anecdotal: [
    { key: 'qualitativeEntry', label: 'Observation', text: true }
  ]
};

export function fieldsFor(type) {
  return MEASUREMENT_INPUTS[type] || [];
}

export function phaseLabel(value) {
  return value === 'OnHold' ? 'On hold' : value;
}

// A blank row with the values that repeat every session already filled in.
export function defaultRow(target, { lastRow = null, sharedMinutes = '' } = {}) {
  const values = {};
  for (const field of fieldsFor(target?.type)) values[field.key] = '';
  if (target?.type === 'IntervalData' && target.intervalSettings?.numberOfIntervals) {
    values.totalIntervals = String(target.intervalSettings.numberOfIntervals);
  }
  if (target?.type === 'TrialByTrial' && lastRow?.totalTrials != null) values.totalTrials = String(lastRow.totalTrials);
  if (['Frequency', 'FluencyRate'].includes(target?.type)) {
    const minutes = sharedMinutes !== '' ? sharedMinutes : (lastRow?.lessonDurationMinutes ?? '');
    if (minutes !== '' && minutes != null) values.lessonDurationMinutes = String(minutes);
  }
  return { values, missingDataMode: 'ZeroOut', phaseChange: '' };
}

// Most recent recorded row per target (sorted by timestamp, not by array order).
export function lastRowsByTarget(sessions = [], targetIds = []) {
  const wanted = new Set(targetIds);
  const rows = sessions.filter(row => wanted.has(row.targetId)).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const map = new Map();
  for (const row of rows) map.set(row.targetId, row);
  return map;
}

// Fill a row from the target's previous observation: one click for a repeat session.
export function copyFromLast(row, target, lastRow, sharedMinutes = '') {
  if (!lastRow) return row;
  const values = { ...row.values };
  for (const field of fieldsFor(target.type)) {
    if (field.text) continue;
    const value = lastRow[field.key];
    if (value != null && value !== '') values[field.key] = String(value);
  }
  if (sharedMinutes !== '' && values.lessonDurationMinutes !== undefined) values.lessonDurationMinutes = String(sharedMinutes);
  return { ...row, values };
}

// Short inline feedback so a clinician can check what they typed without saving.
export function rowPreview(row, target) {
  const number = key => (row?.values?.[key] === '' || row?.values?.[key] == null ? null : Number(row.values[key]));
  if (target?.type === 'TrialByTrial') {
    const correct = number('correctCount');
    const total = number('totalTrials');
    if (total == null || total <= 0 || correct == null) return '';
    return `${Math.round((100 * correct) / total)}% accuracy · ${correct} / ${total} trials`;
  }
  if (target?.type === 'IntervalData') {
    const scored = number('occurredIntervals');
    const total = number('totalIntervals');
    if (total == null || total <= 0 || scored == null) return '';
    return `${Math.round((100 * scored) / total)}% scored · ${scored} / ${total} intervals`;
  }
  if (target?.type === 'Duration') {
    const seconds = number('durationSeconds');
    if (seconds == null) return '';
    return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} sec recorded`;
  }
  if (['Frequency', 'FluencyRate'].includes(target?.type)) {
    const count = number('occurrenceCount');
    const minutes = number('lessonDurationMinutes');
    if (count == null) return '';
    if (minutes == null || minutes <= 0) return `${count} occurrences`;
    const perMinute = Math.round((100 * count) / minutes) / 100;
    return `${count} in ${minutes} min · ${perMinute} per minute`;
  }
  return '';
}

// Per-row validation, reusing the shared recording rules for the measurement itself.
export function rowErrors(row, target, session) {
  const untracked = target?.category === 'BehaviorReduction' && row.missingDataMode === 'DataNotTracked';
  const found = untracked ? {} : validateRecording({
    ...row.values,
    therapistName: session.therapistName,
    timestamp: session.timestamp,
    missingDataMode: row.missingDataMode
  }, target);
  const errors = {};
  for (const [key, message] of Object.entries(found)) {
    if (key === 'therapistName' || key === 'timestamp') continue;
    errors[key] = message;
  }
  return errors;
}

// Convert one row into the observation record the service stores.
export function buildPoint(row, target, session) {
  const base = {
    clientId: session.clientId,
    targetId: target.id,
    timestamp: `${session.timestamp}:00`,
    therapistName: session.therapistName
  };
  const untracked = target.category === 'BehaviorReduction' && row.missingDataMode === 'DataNotTracked';
  if (untracked) return { ...base, value: null, missingDataMode: 'DataNotTracked' };
  const numbers = {};
  for (const field of fieldsFor(target.type)) {
    if (!field.text) numbers[field.key] = Number(row.values[field.key]);
  }
  switch (target.type) {
    case 'TrialByTrial':
      return { ...base, correctCount: numbers.correctCount, totalTrials: numbers.totalTrials, value: Math.round((100 * numbers.correctCount) / numbers.totalTrials) };
    case 'IntervalData':
      return { ...base, occurredIntervals: numbers.occurredIntervals, totalIntervals: numbers.totalIntervals, value: Math.round((100 * numbers.occurredIntervals) / numbers.totalIntervals) };
    case 'Duration':
      return { ...base, durationSeconds: numbers.durationSeconds, occurrenceCount: numbers.durationSeconds > 0 ? 1 : 0, value: numbers.durationSeconds };
    case 'Frequency':
    case 'FluencyRate':
      return { ...base, occurrenceCount: numbers.occurrenceCount, lessonDurationMinutes: numbers.lessonDurationMinutes, value: numbers.occurrenceCount };
    case 'Anecdotal':
      return { ...base, qualitativeEntry: String(row.values.qualitativeEntry || '').trim() };
    default:
      return { ...base, value: numbers.value ?? null };
  }
}

// Phase line label created alongside a phase change recorded from the session sheet.
export function phaseChangeFor(row, target, session) {
  if (!row.phaseChange) return null;
  return {
    targetId: target.id,
    newPhase: row.phaseChange,
    addPhaseLine: true,
    phaseLineLabel: `${phaseLabel(row.phaseChange)} starts`,
    phaseDate: session.timestamp.slice(0, 10)
  };
}

// "Save and start the next session" moves to the client's next appointment when known.
export function nextSessionTimestamp(timestamp, appointments = []) {
  const date = timestamp.slice(0, 10);
  const time = timestamp.slice(11, 16) || '09:00';
  const upcoming = [...new Set(appointments.map(appointment => appointment.date))]
    .filter(candidate => candidate > date)
    .sort()[0];
  return upcoming ? `${upcoming}T${time}` : `${addDays(date, 1)}T${time}`;
}

const PREF_KEY = 'welina_recorder_prefs';

// Remember the clinician, program and target set: the second session is one click.
export function readRecorderPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function writeRecorderPrefs(prefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* Recording still works when browser storage is unavailable. */
  }
}
