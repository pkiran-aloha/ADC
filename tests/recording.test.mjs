import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fieldsFor, defaultRow, lastRowsByTarget, copyFromLast, rowPreview, rowErrors, buildPoint,
  phaseChangeFor, nextSessionTimestamp
} from '../frontend/src/utils/recording.js';

const trialTarget = { id: 'tgt-trials', name: 'Requests', type: 'TrialByTrial', category: 'SkillAcquisition' };
const intervalTarget = { id: 'tgt-intervals', name: 'Sharing', type: 'IntervalData', category: 'SkillAcquisition', intervalSettings: { numberOfIntervals: 12 } };
const durationTarget = { id: 'tgt-duration', name: 'Elopement', type: 'Duration', category: 'BehaviorReduction' };
const frequencyTarget = { id: 'tgt-frequency', name: 'Screaming', type: 'Frequency', category: 'BehaviorReduction' };
const anecdotalTarget = { id: 'tgt-notes', name: 'Preferences', type: 'Anecdotal', category: 'SkillAcquisition' };
const session = { clientId: 'cli-1', timestamp: '2026-10-14T10:00', therapistName: 'Maya Patel, RBT' };

test('every measurement type lists the inputs a clinician fills in', () => {
  assert.deepEqual(fieldsFor('TrialByTrial').map(field => field.key), ['correctCount', 'totalTrials']);
  assert.deepEqual(fieldsFor('IntervalData').map(field => field.key), ['occurredIntervals', 'totalIntervals']);
  assert.deepEqual(fieldsFor('Duration').map(field => field.key), ['durationSeconds']);
  assert.deepEqual(fieldsFor('Frequency').map(field => field.key), ['occurrenceCount', 'lessonDurationMinutes']);
  assert.deepEqual(fieldsFor('FluencyRate').map(field => field.key), ['occurrenceCount', 'lessonDurationMinutes']);
  assert.deepEqual(fieldsFor('Anecdotal').map(field => field.key), ['qualitativeEntry']);
  assert.deepEqual(fieldsFor('Unknown'), []);
});

test('blank rows still carry the values that repeat every session', () => {
  assert.deepEqual(defaultRow(trialTarget).values, { correctCount: '', totalTrials: '' });
  assert.equal(defaultRow(intervalTarget).values.totalIntervals, '12');
  assert.equal(defaultRow(frequencyTarget, { sharedMinutes: '30' }).values.lessonDurationMinutes, '30');
  assert.equal(defaultRow(trialTarget, { lastRow: { totalTrials: 15 } }).values.totalTrials, '15');
  assert.equal(defaultRow(trialTarget).missingDataMode, 'ZeroOut');
  assert.equal(defaultRow(trialTarget).phaseChange, '');
});

test('last recorded rows are picked per target by timestamp, not array order', () => {
  const sessions = [
    { targetId: 'tgt-trials', timestamp: '2026-10-14T10:00', totalTrials: 10, value: 80 },
    { targetId: 'tgt-trials', timestamp: '2026-10-07T10:00', totalTrials: 8, value: 60 },
    { targetId: 'other', timestamp: '2026-10-14T10:00', value: 1 }
  ];
  const map = lastRowsByTarget(sessions, ['tgt-trials', 'other']);
  assert.equal(map.get('tgt-trials').totalTrials, 10);
  assert.equal(map.get('other').value, 1);
  assert.equal(map.size, 2);
});

test('copying the last session repeats the trial count without inventing a score', () => {
  const row = defaultRow(trialTarget);
  const filled = copyFromLast(row, trialTarget, { correctCount: 8, totalTrials: 10 });
  assert.deepEqual(filled.values, { correctCount: '8', totalTrials: '10' });
  assert.deepEqual(copyFromLast(row, trialTarget, null), row);
});

test('inline previews show the value a row will save', () => {
  const row = values => ({ values, missingDataMode: 'ZeroOut', phaseChange: '' });
  assert.equal(rowPreview(row({ correctCount: '7', totalTrials: '10' }), trialTarget), '70% accuracy · 7 / 10 trials');
  assert.equal(rowPreview(row({ occurredIntervals: '3', totalIntervals: '12' }), intervalTarget), '25% scored · 3 / 12 intervals');
  assert.equal(rowPreview(row({ durationSeconds: '137' }), durationTarget), '2 min 17 sec recorded');
  assert.equal(rowPreview(row({ occurrenceCount: '7', lessonDurationMinutes: '7' }), frequencyTarget), '7 in 7 min · 1 per minute');
  assert.equal(rowPreview(row({ correctCount: '', totalTrials: '' }), trialTarget), '');
});

test('row validation keeps the recording rules and never coerces blanks to zero', () => {
  assert.deepEqual(rowErrors({ values: { correctCount: '7', totalTrials: '10' }, missingDataMode: 'ZeroOut' }, trialTarget, session), {});
  assert.ok(rowErrors({ values: { correctCount: '', totalTrials: '10' }, missingDataMode: 'ZeroOut' }, trialTarget, session).correctCount);
  assert.ok(rowErrors({ values: { correctCount: '11', totalTrials: '10' }, missingDataMode: 'ZeroOut' }, trialTarget, session).correctCount);
  assert.ok(rowErrors({ values: { durationSeconds: '' }, missingDataMode: 'ZeroOut' }, durationTarget, session).durationSeconds);
  // Interval counts must match the target's own interval setting.
  assert.ok(rowErrors({ values: { occurredIntervals: '3', totalIntervals: '10' }, missingDataMode: 'ZeroOut' }, intervalTarget, session).totalIntervals);
  // Session-level problems are reported once, not on every row.
  assert.deepEqual(rowErrors({ values: { correctCount: '7', totalTrials: '10' }, missingDataMode: 'ZeroOut' }, trialTarget, { ...session, therapistName: '' }), {});
});

test('an untracked behavior row is valid without a measurement', () => {
  const row = { values: { occurrenceCount: '', lessonDurationMinutes: '' }, missingDataMode: 'DataNotTracked', phaseChange: '' };
  assert.deepEqual(rowErrors(row, frequencyTarget, session), {});
  const point = buildPoint(row, frequencyTarget, session);
  assert.equal(point.value, null);
  assert.equal(point.missingDataMode, 'DataNotTracked');
  assert.equal(Object.hasOwn(point, 'occurrenceCount'), false);
});

test('rows become the same records the service stores', () => {
  const trial = buildPoint({ values: { correctCount: '7', totalTrials: '10' }, missingDataMode: 'ZeroOut' }, trialTarget, session);
  assert.deepEqual(trial, { clientId: 'cli-1', targetId: 'tgt-trials', timestamp: '2026-10-14T10:00:00', therapistName: 'Maya Patel, RBT', correctCount: 7, totalTrials: 10, value: 70 });
  const duration = buildPoint({ values: { durationSeconds: '137' }, missingDataMode: 'ZeroOut' }, durationTarget, session);
  assert.equal(duration.value, 137);
  assert.equal(duration.occurrenceCount, 1);
  const rate = buildPoint({ values: { occurrenceCount: '7', lessonDurationMinutes: '8.5' }, missingDataMode: 'ZeroOut' }, frequencyTarget, session);
  assert.equal(rate.lessonDurationMinutes, 8.5);
  const note = buildPoint({ values: { qualitativeEntry: '  Used a model prompt.  ' }, missingDataMode: 'ZeroOut' }, anecdotalTarget, session);
  assert.equal(note.qualitativeEntry, 'Used a model prompt.');
});

test('a measured zero stays a zero, not a missing record', () => {
  const point = buildPoint({ values: { occurrenceCount: '0', lessonDurationMinutes: '10' }, missingDataMode: 'ZeroOut' }, frequencyTarget, session);
  assert.equal(point.value, 0);
  assert.equal(point.missingDataMode, undefined);
});

test('phase changes create a labelled phase line on the session date', () => {
  assert.equal(phaseChangeFor({ phaseChange: '' }, trialTarget, session), null);
  assert.deepEqual(phaseChangeFor({ phaseChange: 'Maintenance' }, trialTarget, session), {
    targetId: 'tgt-trials', newPhase: 'Maintenance', addPhaseLine: true, phaseLineLabel: 'Maintenance starts', phaseDate: '2026-10-14'
  });
  assert.equal(phaseChangeFor({ phaseChange: 'OnHold' }, trialTarget, session).phaseLineLabel, 'On hold starts');
});

test('"next session" moves to the client’s next appointment when it is known', () => {
  assert.equal(nextSessionTimestamp('2026-10-14T09:00', [{ date: '2026-10-16' }, { date: '2026-10-20' }]), '2026-10-16T09:00');
  // Without appointments it advances one day and keeps the time of day.
  assert.equal(nextSessionTimestamp('2026-10-14T13:30', []), '2026-10-15T13:30');
  assert.equal(nextSessionTimestamp('2026-10-14T09:00', [{ date: '2026-10-01' }]), '2026-10-15T09:00');
});
