// Observation records: correction and deletion with an audit trail (including work that
// has already been billed) and the second-observer records a session carries. Supervision
// and IOA observations are stored with the session but excluded from the learner's primary
// chart totals, so agreement checks never move the clinical data.
import { isValidDate } from './formValidation.js';
import { fieldsFor } from './recording.js';

export const EDIT_REASONS = [
  'Recording error',
  'Transcription or typo',
  'Wrong target selected',
  'Duplicate entry',
  'Probe recorded as a session',
  'Data-sheet correction',
  'Post-billing correction',
  'Other'
];

export const OBSERVATION_TYPES = {
  Primary: { label: 'Primary data', hint: 'Counts towards the learner’s graph' },
  IOA: { label: 'Second observer (IOA)', hint: 'Stored with the session, excluded from chart totals' },
  Supervision: { label: 'BCBA supervision observation', hint: 'Stored with the session, excluded from chart totals' }
};

export function observationType(row) {
  return OBSERVATION_TYPES[row?.observationType] ? row.observationType : 'Primary';
}

// Only primary observations feed the graph, the averages and the exports' totals.
export function chartEligible(row) {
  return observationType(row) === 'Primary' && row?.missingDataMode !== 'DataNotTracked';
}

export function eligibleChartSeriesRows(rows = []) {
  return rows.filter(chartEligible);
}

export function secondObserverRows(rows = []) {
  return rows.filter(row => observationType(row) !== 'Primary');
}

// Correction rules: the measurement must stay valid for the target, and every change
// needs a reason so the audit trail explains it later.
export function validateObservationEdit({ values = {}, reason = '', missingDataMode = 'Tracked' }, target) {
  const errors = {};
  if (!EDIT_REASONS.includes(reason)) errors.reason = 'Choose why this record is being corrected.';
  if (!target) errors.targetId = 'This observation no longer matches a target.';
  if (target && missingDataMode !== 'DataNotTracked') {
    const numeric = (key, min = 0, integer = true, label = key) => {
      const value = values[key];
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
        if (!values.qualitativeEntry?.trim()) errors.qualitativeEntry = 'Keep the observation text before saving.';
        break;
      default:
        break;
    }
  }
  return errors;
}

export function valuesFromRow(row, target) {
  const values = {};
  for (const field of fieldsFor(target?.type)) {
    if (field.text) values[field.key] = row?.[field.key] || '';
    else values[field.key] = row?.[field.key] == null ? '' : String(row[field.key]);
  }
  return values;
}

function measurementFromValues(values, target) {
  const number = key => (values[key] === '' || values[key] == null ? null : Number(values[key]));
  switch (target?.type) {
    case 'TrialByTrial': {
      const correct = number('correctCount');
      const total = number('totalTrials');
      return { correctCount: correct, totalTrials: total, value: total ? Math.round((100 * correct) / total) : null };
    }
    case 'IntervalData': {
      const scored = number('occurredIntervals');
      const total = number('totalIntervals');
      return { occurredIntervals: scored, totalIntervals: total, value: total ? Math.round((100 * scored) / total) : null };
    }
    case 'Duration': {
      const seconds = number('durationSeconds');
      return { durationSeconds: seconds, occurrenceCount: seconds > 0 ? 1 : 0, value: seconds };
    }
    case 'Frequency':
    case 'FluencyRate':
      return { occurrenceCount: number('occurrenceCount'), lessonDurationMinutes: number('lessonDurationMinutes'), value: number('occurrenceCount') };
    case 'Anecdotal':
      return { qualitativeEntry: String(values.qualitativeEntry || '').trim() };
    default:
      return { value: number('value') };
  }
}

// Apply a correction, keeping the previous measurement in the audit entry.
export function applyObservationEdit(row, { values, reason, note = '', staffName = '', at = '', billed = false, missingDataMode, target = null }) {
  const previous = { ...row };
  const measurementType = target?.type || row.targetType || row.measurementType || null;
  const measurement = measurementType ? measurementFromValues(values, { type: measurementType }) : {};
  const audit = {
    at: at || row.timestamp,
    action: 'Corrected',
    reason,
    note: note.trim() || undefined,
    staffName: staffName || undefined,
    billedAfterService: Boolean(billed || row.billed),
    before: measurementKeys(previous),
    after: measurement
  };
  return {
    ...row,
    ...measurement,
    missingDataMode: missingDataMode || row.missingDataMode || 'Tracked',
    editHistory: [...(row.editHistory || []), audit],
    correctedAt: audit.at,
    billedAfterService: Boolean(audit.billedAfterService || row.billedAfterService)
  };
}

function measurementKeys(row) {
  const keys = ['value', 'correctCount', 'totalTrials', 'occurredIntervals', 'totalIntervals', 'durationSeconds', 'occurrenceCount', 'lessonDurationMinutes', 'qualitativeEntry'];
  return Object.fromEntries(keys.filter(key => row[key] !== undefined).map(key => [key, row[key]]));
}

export function validateDeletion({ reason = '', note = '' }) {
  const errors = {};
  if (!EDIT_REASONS.includes(reason)) errors.reason = 'Choose why this record is being removed.';
  if (reason === 'Other' && !note.trim()) errors.note = 'Describe the reason so the audit trail is complete.';
  return errors;
}

// Deletion keeps an audit entry in the client's history instead of erasing the fact that
// a record existed and was removed.
export function deletionAudit(row, { reason, note = '', staffName = '', at = '', billed = false }) {
  return {
    id: row.id,
    action: 'Deleted',
    at: at || row.timestamp,
    reason,
    note: note.trim() || undefined,
    staffName: staffName || undefined,
    billedAfterService: Boolean(billed || row.billed),
    before: measurementKeys(row),
    after: {}
  };
}

export function auditTrail(rows = []) {
  return rows
    .flatMap(row => (row.editHistory || []).map(entry => ({ ...entry, observationId: row.id, targetId: row.targetId })))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export function auditSummary(entries = []) {
  const billed = entries.filter(entry => entry.billedAfterService).length;
  return {
    total: entries.length,
    corrected: entries.filter(entry => entry.action === 'Corrected').length,
    deleted: entries.filter(entry => entry.action === 'Deleted').length,
    billed,
    note: billed
      ? `${billed} of these changes corrected or removed data for an appointment that was already billed. The appointment does not need to be released and rebilled; the audit entry documents the change.`
      : 'No change in this range touched a billed appointment.'
  };
}

// Second-observer and supervision observations for a session. These are derived from the
// appointment record (IOA observer, supervision overlap, fidelity checklist) so they can be
// shown with the session without entering the learner's primary totals.
export function supervisorObservations(serviceSessions = [], rows = [], { targetNameById = new Map() } = {}) {
  const byService = new Map();
  for (const row of rows) {
    if (!row.serviceSessionId) continue;
    if (!byService.has(row.serviceSessionId)) byService.set(row.serviceSessionId, []);
    byService.get(row.serviceSessionId).push(row);
  }
  return serviceSessions.flatMap(service => {
    const records = [];
    const observed = byService.get(service.id) || [];
    if (service.ioaObserver) {
      const checks = observed.filter(row => row.ioa);
      records.push({
        id: `${service.id}-ioa`,
        kind: 'IOA',
        label: 'Independent second observer',
        observer: service.ioaObserver,
        serviceId: service.id,
        date: service.date,
        targets: checks.map(row => targetNameById.get(row.targetId) || row.targetId),
        agreement: checks.length ? Math.round(checks.reduce((sum, row) => sum + row.ioa.percent, 0) / checks.length) : null,
        method: checks[0]?.ioa?.method || null,
        excludedFromTotals: true,
        detail: checks.length
          ? `${checks.length} agreement check${checks.length === 1 ? '' : 's'} recorded alongside the session`
          : 'Observer assigned to this appointment; agreement recorded in the session note'
      });
    }
    if (service.supervision) {
      records.push({
        id: `${service.id}-supervision`,
        kind: 'Supervision',
        label: 'BCBA supervision observation',
        observer: service.supervision.supervisor,
        minutes: service.supervision.minutes,
        serviceId: service.id,
        date: service.date,
        targets: [...new Set(observed.map(row => targetNameById.get(row.targetId) || row.targetId))],
        fidelity: service.fidelity ? { percent: service.fidelity.percent, correct: service.fidelity.correct, total: service.fidelity.total } : null,
        excludedFromTotals: true,
        detail: service.fidelity
          ? `${service.supervision.minutes} min overlap · procedural fidelity ${service.fidelity.percent}%`
          : `${service.supervision.minutes} min overlap with the RBT`
      });
    }
    return records;
  });
}

export function observationNote(row) {
  return row?.note || row?.qualitativeEntry || '';
}

export function hasNote(row) {
  return Boolean(observationNote(row));
}

export function billingNote(row) {
  return row?.billedAfterService || row?.billed
    ? 'This appointment was already billed. The correction is documented without releasing and rebilling the claim.'
    : '';
}

export function describeAuditEntry(entry) {
  const parts = [entry.action === 'Deleted' ? 'Removed' : 'Corrected', entry.reason];
  if (entry.billedAfterService) parts.push('post-billing');
  return parts.filter(Boolean).join(' · ');
}

export function isValidObservationTimestamp(timestamp) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timestamp || '') && isValidDate(timestamp.slice(0, 10));
}
