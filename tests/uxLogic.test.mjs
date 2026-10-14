import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidDate, validateAnnotation, validateRecording } from '../frontend/src/utils/formValidation.js';
import { calculateMetricPoint, processAggregation, getObservationKey, chartStatistics } from '../frontend/src/utils/analyticsMetrics.js';
import { formatChartDate, seriesColor, chartMarkerInk } from '../frontend/src/utils/chartTheme.js';

const values = {
  therapistName: 'Maya Patel, RBT', timestamp: '2026-10-14T10:13', correctCount: '7', totalTrials: '11',
  durationSeconds: '137', occurrenceCount: '6', occurredIntervals: '7', totalIntervals: '12',
  lessonDurationMinutes: '8.5', qualitativeEntry: 'Requested help with a model prompt.',
  missingDataMode: 'ZeroOut', showPhaseChangePrompt: false
};
const target = (type, category = 'SkillAcquisition', extra = {}) => ({ id: 'test-target', type, category, ...extra });
const metric = (records, type, view = 'Total Duration', rate = 'Rate per Day', frequency = 'Raw Frequency') => calculateMetricPoint('2026-10-14', records, type, view, rate, frequency);

test('calendar validation rejects impossible dates and accepts leap days', () => {
  assert.ok(isValidDate('2024-02-29'));
  for (const date of ['', '2026-02-29', '2026-13-01', '2026-04-31', '14/10/2026']) assert.equal(isValidDate(date), false, date);
});

test('phase ranges validate required labels, order, and six-digit picker colors', () => {
  assert.deepEqual(validateAnnotation({ startDate: '2026-10-01', endDate: '2026-10-14', label: 'Prompt fading', color: '#34634c' }, 'range'), {});
  const errors = validateAnnotation({ startDate: '2026-10-14', endDate: '2026-10-01', label: ' ', color: '#34634c33' }, 'range');
  assert.ok(errors.endDate && errors.label && errors.color);
});

test('graph notes cannot save blank authors or whitespace-only content', () => {
  const errors = validateAnnotation({ date: '2026-10-14', staffName: ' ', noteText: '\n', color: '#34634c' }, 'note');
  assert.ok(errors.staffName && errors.noteText);
});

test('all quantitative measurement types accept valid observations', () => {
  for (const type of ['TrialByTrial', 'Duration', 'Frequency', 'IntervalData', 'FluencyRate']) assert.deepEqual(validateRecording(values, target(type)), {}, type);
});

test('blank and non-finite measurements do not silently become zero', () => {
  const errors = validateRecording({ ...values, correctCount: '', totalTrials: 'NaN' }, target('TrialByTrial'));
  assert.ok(errors.correctCount && errors.totalTrials);
  assert.ok(validateRecording({ ...values, correctCount: '   ' }, target('TrialByTrial')).correctCount);
  assert.ok(validateRecording({ ...values, occurrenceCount: 'Infinity' }, target('Frequency')).occurrenceCount);
});

test('trial numerators, negative values and fractional counts are rejected', () => {
  assert.ok(validateRecording({ ...values, correctCount: '12' }, target('TrialByTrial')).correctCount);
  assert.ok(validateRecording({ ...values, occurrenceCount: '-1' }, target('Frequency')).occurrenceCount);
  assert.ok(validateRecording({ ...values, occurrenceCount: '1.5' }, target('Frequency')).occurrenceCount);
  assert.ok(validateRecording({ ...values, totalTrials: '0' }, target('TrialByTrial')).totalTrials);
});

test('interval observations honor configured counts and numerator limits', () => {
  assert.ok(validateRecording(values, target('IntervalData', 'SkillAcquisition', { intervalSettings: { numberOfIntervals: 10 } })).totalIntervals);
  assert.ok(validateRecording({ ...values, occurredIntervals: '13' }, target('IntervalData')).occurredIntervals);
});

test('measured behavior zero is valid; untracked records bypass measurement fields only', () => {
  assert.deepEqual(validateRecording({ ...values, occurrenceCount: '0' }, target('Frequency', 'BehaviorReduction')), {});
  const untracked = { ...values, missingDataMode: 'DataNotTracked', occurrenceCount: '', lessonDurationMinutes: '' };
  assert.deepEqual(validateRecording(untracked, target('Frequency', 'BehaviorReduction')), {});
  assert.ok(validateRecording({ ...untracked, timestamp: '' }, target('Frequency', 'BehaviorReduction')).timestamp);
  assert.ok(validateRecording(untracked, target('Frequency', 'SkillAcquisition')).occurrenceCount);
});

test('narrative and phase-change fields validate conditionally', () => {
  assert.ok(validateRecording({ ...values, qualitativeEntry: ' ' }, target('Anecdotal')).qualitativeEntry);
  const errors = validateRecording({ ...values, showPhaseChangePrompt: true, newPhase: 'Unknown', phaseLineLabel: ' ' }, target('Duration'));
  assert.ok(errors.newPhase && errors.phaseLineLabel);
});

test('invalid observation times and non-positive probe duration are rejected', () => {
  assert.ok(validateRecording({ ...values, timestamp: '2026-10-14T24:01' }, target('Duration')).timestamp);
  assert.ok(validateRecording({ ...values, timestamp: '2026-10-14T10:77' }, target('Duration')).timestamp);
  assert.ok(validateRecording({ ...values, lessonDurationMinutes: '0' }, target('FluencyRate')).lessonDurationMinutes);
});

test('trial accuracy remains weighted by raw trial counts, with the fraction visible', () => {
  const point = metric([{ correctCount: 5, totalTrials: 8 }, { correctCount: 2, totalTrials: 5 }], 'TrialByTrial');
  assert.equal(point.val, 54);
  assert.equal(point.displayVal, '54% (7/13)');
});

test('duration total, occurrence count, and average remain distinct', () => {
  const rows = [{ durationSeconds: 61, occurrenceCount: 1 }, { durationSeconds: 64, occurrenceCount: 1 }, { durationSeconds: 0, occurrenceCount: 0 }];
  assert.equal(metric(rows, 'Duration').displayVal, '02 min 05 sec');
  assert.equal(metric(rows, 'Duration', 'Total Count').val, 2);
  assert.equal(metric(rows, 'Duration', 'Average Duration').val, 63);
});

test('frequency and fluency rate views use observation minutes rather than fake rates', () => {
  const rows = [{ occurrenceCount: 7, lessonDurationMinutes: 19 }, { occurrenceCount: 10, lessonDurationMinutes: 23 }];
  assert.equal(metric(rows, 'Frequency').val, 17);
  assert.equal(metric(rows, 'Frequency', undefined, undefined, 'Rate per Minute').val, 0.4);
  assert.equal(metric(rows, 'Frequency', undefined, undefined, 'Rate per Hour').val, 24.29);
  assert.equal(metric(rows, 'FluencyRate', undefined, 'Rate per Minute').val, 0.4);
});

test('interval percentages preserve the scored and total count', () => {
  const point = metric([{ occurredIntervals: 4, totalIntervals: 8 }, { occurredIntervals: 3, totalIntervals: 5 }], 'IntervalData');
  assert.equal(point.val, 54);
  assert.equal(point.displayVal, '54% (7/13 intervals)');
});

test('weekly grouping uses Monday calendar dates, including Sunday near midnight', () => {
  assert.equal(getObservationKey({ timestamp: '2026-10-04T00:30:00' }, 'Weekly'), '2026-09-28');
  assert.equal(getObservationKey({ timestamp: '2026-10-05T00:30:00' }, 'Weekly'), '2026-10-05');
  assert.equal(formatChartDate('2026-09-28', 'Weekly'), 'Sep 28–Oct 4');
});

test('session keys sort numerically and aggregation does not mutate its inputs', () => {
  const rows = [10, 2, 1].map(sessionNumber => ({ sessionNumber, timestamp: '2026-10-14T10:00:00', occurrenceCount: sessionNumber }));
  const result = processAggregation(rows, 'Per Session', 'Frequency');
  assert.deepEqual(result.map(point => point.xKey), ['1', '2', '10']);
  assert.deepEqual(rows.map(row => row.sessionNumber), [10, 2, 1]);
  assert.equal(result[0].date, '2026-10-14');
});

test('unobserved records remain missing rather than becoming measured zero', () => {
  const rows = [{ timestamp: '2026-10-13T10:00:00', value: null, missingDataMode: 'DataNotTracked' }, { timestamp: '2026-10-14T10:00:00', occurrenceCount: 0, value: 0, missingDataMode: 'ZeroOut' }];
  const result = processAggregation(rows, 'Per Day', 'Frequency');
  assert.equal(result.length, 1);
  assert.equal(result[0].val, 0);
  assert.equal(result[0].xKey, '2026-10-14');
});

test('regression aligns simultaneous series by x position, not concatenation order', () => {
  const stats = chartStatistics([
    { points: [{ xKey: '1', val: 1 }, { xKey: '2', val: 2 }] },
    { points: [{ xKey: '1', val: 3 }, { xKey: '2', val: 4 }] }
  ], 'Per Session');
  assert.equal(stats.averageValue, 2.5);
  assert.deepEqual(stats.regressionParams, { slope: '1.00', intercept: '2.00' });
  assert.equal(stats.regressionPoints.start.val, 2);
  assert.equal(stats.regressionPoints.end.val, 3);
});

test('missing date categories affect regression x spacing without adding fake observations', () => {
  const stats = chartStatistics([{ points: [{ xKey: '2026-10-01', val: 1 }, { xKey: '2026-10-03', val: 6 }] }], 'Per Day', ['2026-10-01', '2026-10-02', '2026-10-03']);
  assert.equal(stats.regressionParams.slope, '2.50');
  assert.equal(stats.averageValue, 3.5);
});

test('a single measured date never produces an invalid regression, even with missing dates', () => {
  const stats = chartStatistics([{ points: [{ xKey: '2026-10-01', val: 7 }] }], 'Per Day', ['2026-10-01', '2026-10-02']);
  assert.equal(stats.regressionParams, null);
  assert.equal(stats.averageValue, 7);
});

test('data palette stays stable and monochrome is a deliberate state', () => {
  assert.notEqual(seriesColor(0), seriesColor(1));
  assert.equal(seriesColor(2, true), seriesColor(0, true));
  assert.equal(formatChartDate('2026-10', 'Monthly'), 'Oct 2026');
});

test('CSV serialization preserves quotes, commas, line breaks, zero, and missing measurements', async () => {
  const { csvRow } = await import('../frontend/src/utils/csvUtils.js');
  assert.equal(csvRow(['Maya, RBT', 'Said "help"\nthen waited', 0, null]), '"Maya, RBT","Said ""help""\nthen waited",0,');
});

test('annotation markers use legible ink on bright, dark, and translucent colors', () => {
  assert.equal(chartMarkerInk('#f59e0b'), '#000000');
  assert.equal(chartMarkerInk('#34634c'), '#ffffff');
  assert.equal(chartMarkerInk('#ffffff'), '#000000');
  assert.equal(chartMarkerInk('#34634c33'), '#000000');
});
