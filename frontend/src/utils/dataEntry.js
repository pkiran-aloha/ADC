// Manual data entry: probe, school, paper and assessment data recorded straight into the
// workspace without opening a lesson note. Reuses the recording rules for the measurement
// itself so a hand-entered point is validated exactly like a recorded one.
import { fieldsFor, buildPoint, rowPreview } from './recording.js';
import { isValidDate, MEASUREMENT_LABELS } from './formValidation.js';

export const DATA_SOURCES = [
  { value: 'Probe', label: 'Probe / cold probe', hint: 'Brief probe sessions run outside treatment' },
  { value: 'School', label: 'School or classroom', hint: 'Data collected by school staff' },
  { value: 'Paper', label: 'Paper data sheet', hint: 'Offline or paper workflow entered later' },
  { value: 'Assessment', label: 'Assessment', hint: 'Standardized or curriculum-based assessment' },
  { value: 'Historical', label: 'Historical import', hint: 'Transferred from a previous provider or system' },
  { value: 'Session', label: 'Session recording', hint: 'Treatment session data' }
];

export const DEFAULT_DATA_SOURCE = 'Probe';

export function sourceLabel(value) {
  return DATA_SOURCES.find(source => source.value === value)?.label || 'Manual entry';
}

export function sourceOptions({ includeSession = true } = {}) {
  return DATA_SOURCES.filter(source => includeSession || source.value !== 'Session');
}

// A blank entry form: the measurement inputs for the target plus the collection context.
export function manualRow(target, { source = DEFAULT_DATA_SOURCE, date, clinician = '' } = {}) {
  const values = {};
  for (const field of fieldsFor(target?.type)) values[field.key] = '';
  if (target?.type === 'IntervalData' && target.intervalSettings?.numberOfIntervals) {
    values.totalIntervals = String(target.intervalSettings.numberOfIntervals);
  }
  return {
    values,
    source,
    date: date || '',
    time: '09:00',
    clinician,
    note: '',
    missingDataMode: 'Observed',
    programId: target?.programId || ''
  };
}

// Validation for a manual entry: date, clinician, source and the measurement fields.
export function validateManualEntry(row, target) {
  const errors = {};
  if (!isValidDate(row?.date)) errors.date = 'Choose the date the data were collected.';
  if (!/^\d{2}:\d{2}$/.test(row?.time || '') || Number(row.time.slice(0, 2)) > 23 || Number(row.time.slice(3, 5)) > 59) {
    errors.time = 'Enter a time as HH:MM, for example 09:30.';
  }
  if (!row?.clinician?.trim()) errors.clinician = 'Enter who collected the data.';
  if (!sourceOptions().some(option => option.value === row?.source)) errors.source = 'Choose where the data came from.';
  if (!target) errors.targetId = 'Choose a target for this data point.';
  const untracked = target?.category === 'BehaviorReduction' && row?.missingDataMode === 'NotTracked';
  if (target && !untracked) {
    const numeric = (key, min = 0, integer = true, label = key) => {
      const value = row.values?.[key];
      if (value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < min || (integer && !Number.isInteger(Number(value)))) {
        errors[key] = `Enter ${integer ? 'a whole number' : 'a number'} ${min === 0 ? 'of 0 or more' : `of ${min} or more`} for ${label}.`;
        return null;
      }
      return Number(value);
    };
    switch (target.type) {
      case 'TrialByTrial': {
        const correct = numeric('correctCount', 0, true, 'correct trials');
        const total = numeric('totalTrials', 1, true, 'total trials');
        if (correct != null && total != null && correct > total) errors.correctCount = 'Correct trials cannot exceed total trials.';
        if (total != null && total < 3) errors.totalTrials = 'Enter at least three trials, or mark the session as not tracked.';
        break;
      }
      case 'IntervalData': {
        const scored = numeric('occurredIntervals', 0, true, 'intervals scored');
        const total = numeric('totalIntervals', 1, true, 'total intervals');
        if (scored != null && total != null && scored > total) errors.occurredIntervals = 'Scored intervals cannot exceed total intervals.';
        break;
      }
      case 'Duration': numeric('durationSeconds', 0, true, 'duration in seconds'); break;
      case 'Frequency':
      case 'FluencyRate':
        numeric('occurrenceCount', 0, true, 'occurrences');
        numeric('lessonDurationMinutes', 0.1, false, 'observation minutes');
        break;
      case 'Anecdotal':
        if (!row.values?.qualitativeEntry?.trim()) errors.qualitativeEntry = 'Describe what was observed.';
        break;
      default:
        break;
    }
  }
  return errors;
}

// One stored observation: the measurement, its collection context and the audit fields
// that tell the report where the point came from.
export function buildManualPoint(row, target, { clientId, id, sessionNumber } = {}) {
  const point = buildPoint(
    { values: row.values, missingDataMode: target.category === 'BehaviorReduction' && row.missingDataMode === 'NotTracked' ? 'DataNotTracked' : 'Tracked' },
    target,
    { clientId, timestamp: `${row.date}T${row.time}`, therapistName: row.clinician.trim() }
  );
  return {
    ...point,
    id,
    sessionNumber,
    dataSource: row.source,
    collectionContext: sourceLabel(row.source),
    enteredManually: true,
    observationType: 'Primary',
    note: row.note?.trim() || undefined
  };
}

export function entryPreview(point, target) {
  return rowPreview({ values: point }, target) || `${MEASUREMENT_LABELS[target?.type] || 'Observation'} recorded`;
}

// Small helper for the summary line above an entry form.
export function dataSourceCounts(rows = []) {
  const counts = new Map();
  for (const row of rows) {
    const label = row.enteredManually ? sourceLabel(row.dataSource) : 'Session recording';
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}
