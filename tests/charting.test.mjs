import test from 'node:test';
import assert from 'node:assert/strict';
import { niceStep, axisTicks, resolveAxisBounds, validateAxisBounds, describeAxisBounds, CHART_TYPES } from '../frontend/src/utils/chartScale.js';
import { conditionSpans, conditionBoundaries, firstConditionLabel } from '../frontend/src/utils/targetAnalytics.js';

const target = {
  id: 'tgt-1',
  phase: 'Maintenance',
  phaseHistory: [
    { phase: 'Baseline', date: '2026-04-13' },
    { phase: 'Acquisition', date: '2026-04-27' },
    { phase: 'Maintenance', date: '2026-07-21' }
  ]
};

test('gridline steps round up to readable 1 / 2 / 2.5 / 5 decades', () => {
  assert.equal(niceStep(25), 25);
  assert.equal(niceStep(21.75), 25);
  assert.equal(niceStep(3), 5);
  assert.equal(niceStep(0.4), 0.5);
  assert.equal(niceStep(0), 1);
  assert.equal(niceStep(Number.NaN), 1);
});

test('axis ticks stay inside the range and keep a whole-number look', () => {
  assert.deepEqual(axisTicks(0, 100, 5), [0, 25, 50, 75, 100]);
  assert.deepEqual(axisTicks(40, 100, 5), [40, 60, 80, 100]);
  assert.deepEqual(axisTicks(0, 87, 5), [0, 25, 50, 75]);
  assert.deepEqual(axisTicks(0, 1.2, 5), [0, 0.5, 1]);
  for (const value of axisTicks(20, 20.5, 5)) assert.ok(value >= 20 && value <= 20.5, String(value));
});

test('automatic bounds keep percentages at 0-100 and pad counts above the peak', () => {
  assert.deepEqual(resolveAxisBounds({}, { dataMax: 92, percent: true }), { min: 0, max: 100 });
  assert.equal(resolveAxisBounds({}, { dataMax: 40 }).max, 46);
  assert.equal(resolveAxisBounds({}, { dataMax: 0 }).max, 10);
  // Overlays (goal, projection band) stay inside the automatic range.
  assert.equal(resolveAxisBounds({}, { dataMax: 10, include: [60] }).max, 69);
});

test('a clinician can fix either end of the axis without hiding the other', () => {
  assert.deepEqual(resolveAxisBounds({ min: 40 }, { dataMax: 92, percent: true }), { min: 40, max: 100 });
  assert.deepEqual(resolveAxisBounds({ max: 30 }, { dataMax: 92 }), { min: 0, max: 30 });
  assert.deepEqual(resolveAxisBounds({ min: 20, max: 80 }, { dataMax: 92 }), { min: 20, max: 80 });
  // A reversed range keeps the clinician's minimum and puts the maximum just above it,
  // instead of collapsing the scale to zero height.
  const recovered = resolveAxisBounds({ min: 50, max: 10 }, { dataMax: 40 });
  assert.equal(recovered.min, 50);
  assert.equal(recovered.max, 51);
});

test('axis controls reject reversed, negative and non-numeric ranges', () => {
  assert.deepEqual(validateAxisBounds({ min: '', max: '' }), { error: '', bounds: { min: null, max: null } });
  assert.deepEqual(validateAxisBounds({ min: '0', max: '120' }), { error: '', bounds: { min: 0, max: 120 } });
  assert.match(validateAxisBounds({ min: '80', max: '40' }).error, /greater than/);
  assert.match(validateAxisBounds({ min: '-5', max: '' }).error, /zero/);
  assert.match(validateAxisBounds({ min: 'abc', max: '' }).error, /number/);
  assert.equal(validateAxisBounds({ min: '80', max: '40' }).bounds, null);
  assert.equal(describeAxisBounds({ min: null, max: null }), 'automatic');
  assert.equal(describeAxisBounds({ min: 20, max: null }), '20–auto');
});

test('every measurement type offers the shared plot types', () => {
  assert.deepEqual(CHART_TYPES.map(option => option.value), ['line', 'bars', 'points', 'cumulative']);
  for (const option of CHART_TYPES) assert.ok(option.label.length, option.value);
});

test('condition spans label each phase across the visible range', () => {
  const spans = conditionSpans(target, [], '2026-04-01', '2026-08-01');
  assert.deepEqual(spans.map(span => span.label), ['Baseline', 'Acquisition', 'Maintenance']);
  assert.equal(spans[0].startDate, '2026-04-01');
  assert.equal(spans.at(-1).endDate, '2026-08-01');
  // Boundaries outside the window are not drawn; the first span uses the phase running
  // when the window opens, not the first phase in the history.
  assert.deepEqual(conditionSpans(target, [], '2026-05-01', '2026-06-01').map(span => span.label), ['Acquisition']);
  assert.deepEqual(conditionSpans(target, [], '2026-07-25', '2026-08-05').map(span => span.label), ['Maintenance']);
  assert.deepEqual(conditionSpans(target, [], '2026-08-01', '2026-04-01'), []);
});

test('manual phase lines join the condition bar alongside phase history', () => {
  const lines = [{ id: 'pcl-1', targetId: 'tgt-1', date: '2026-05-10', label: 'Prompt fading', style: 'Solid', color: '#294f3d' }];
  const spans = conditionSpans(target, lines, '2026-04-01', '2026-08-01');
  assert.deepEqual(spans.map(span => span.label), ['Baseline', 'Acquisition', 'Prompt fading', 'Maintenance']);
  assert.equal(conditionBoundaries(target, lines).filter(boundary => boundary.kind === 'line').length, 1);
  assert.equal(firstConditionLabel(target), 'Baseline');
});
