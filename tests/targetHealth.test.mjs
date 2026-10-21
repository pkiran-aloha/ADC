import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import buildTargetHealth, {
  classifyTargetTrend, targetLifecycle, summarizeKpis, filterHealthItems,
  forecastLabel, deltaText, trendTone, HEALTH_FILTERS, MASTERED_PHASES
} from '../frontend/src/utils/targetHealth.js';

const AS_OF = '2026-10-14';
const seedPath = fileURLToPath(new URL('../data/clinicalSeed.json', import.meta.url));
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));

// One session per week, `weeks` entries ending at the as-of date. Percent rows carry both
// the aggregate value (mastery evaluation) and trial counts (weekly metric aggregation).
function weeklyRows(targetId, values, { type = 'TrialByTrial', totalTrials = 10, endOffsetDays = 7 } = {}) {
  return values.map((value, index) => {
    const date = new Date(`${AS_OF}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (values.length - 1 - index) * 7 - endOffsetDays);
    const timestamp = date.toISOString().slice(0, 10);
    const base = {
      id: `row-${targetId}-${index}`, clientId: 'cli-test', targetId,
      timestamp: `${timestamp}T10:00`, value, missingDataMode: 'ZeroOut', therapistName: 'Tester, RBT'
    };
    if (type === 'TrialByTrial') {
      return { ...base, correctCount: Math.round((value / 100) * totalTrials), totalTrials };
    }
    return { ...base, occurrenceCount: value, lessonDurationMinutes: 60 };
  });
}

function skillTarget(overrides = {}) {
  return {
    id: 'tgt-skill', name: 'Test skill target', type: 'TrialByTrial', phase: 'Acquisition',
    masteryRule: { measure: 'percentCorrect', comparison: 'atLeast', threshold: 80, consecutiveSessions: 3 },
    phaseHistory: [{ phase: 'Baseline', date: '2026-07-01' }, { phase: 'Acquisition', date: '2026-07-15' }],
    ...overrides
  };
}

function behaviorTarget(overrides = {}) {
  return {
    id: 'tgt-behavior', name: 'Test behavior target', type: 'Frequency', phase: 'Acquisition',
    masteryRule: { measure: 'count', comparison: 'atMost', threshold: 2, consecutiveSessions: 4 },
    phaseHistory: [{ phase: 'Baseline', date: '2026-07-01' }, { phase: 'Acquisition', date: '2026-07-15' }],
    ...overrides
  };
}

function programWith(target, category = 'SkillAcquisition') {
  return { id: `prog-${target.id}`, clientId: 'cli-test', name: `Program for ${target.name}`, category, targets: [target] };
}

test('lifecycle groups phases without inventing new statuses', () => {
  assert.equal(targetLifecycle({ phase: 'Acquisition' }), 'active');
  for (const phase of MASTERED_PHASES) assert.equal(targetLifecycle({ phase }), 'mastered');
  assert.equal(targetLifecycle({ phase: 'OnHold' }), 'paused');
  assert.equal(targetLifecycle({ phase: 'Discontinued' }), 'ended');
});

test('a rising skill target is classified improving, not declining', () => {
  const rows = weeklyRows('tgt-skill', [40, 45, 55, 60, 70, 78, 85, 90]);
  const health = buildTargetHealth({
    programs: [programWith(skillTarget())], sessions: rows, asOfDate: AS_OF
  });
  const item = health.items[0];
  assert.equal(item.trend, 'improving');
  assert.ok(item.deltaPct > 0);
  assert.equal(trendTone(item), 'positive');
  assert.equal(item.flags.some(flag => flag.id === 'declining'), false);
  assert.equal(health.kpis.improving.count, 1);
  assert.equal(health.kpis.improving.percent, 100);
});

test('a decreasing problem behavior is improving because direction flips for reduction targets', () => {
  const target = behaviorTarget();
  const rows = weeklyRows('tgt-behavior', [12, 11, 9, 8, 7, 6, 4, 3], { type: 'Frequency' });
  const health = buildTargetHealth({
    programs: [programWith(target, 'BehaviorReduction')], sessions: rows, asOfDate: AS_OF
  });
  const item = health.items[0];
  assert.equal(item.direction, 'decrease');
  assert.equal(item.trend, 'improving');
  assert.ok(deltaText(item).startsWith('↓'));
  assert.equal(trendTone(item), 'positive');
});

test('flat acquisition data with enough points is a plateau attention flag, not a trend', () => {
  const rows = weeklyRows('tgt-skill', [60, 60, 61, 59, 60, 60, 61, 60]);
  const health = buildTargetHealth({
    programs: [programWith(skillTarget())], sessions: rows, asOfDate: AS_OF
  });
  const item = health.items[0];
  assert.equal(item.trend, 'stable');
  assert.ok(item.flags.some(flag => flag.id === 'plateau'));
  assert.equal(health.kpis.stable.count, 1);
  assert.equal(health.kpis.declining.count, 0);
});

test('targets with fewer than four weekly points get insufficient history and stay out of KPI math', () => {
  const rows = weeklyRows('tgt-skill', [50, 60, 70]);
  const health = buildTargetHealth({
    programs: [programWith(skillTarget())], sessions: rows, asOfDate: AS_OF
  });
  const item = health.items[0];
  assert.equal(item.trend, 'insufficient');
  assert.equal(item.needsReview, false);
  assert.equal(health.kpis.classifiableTotal, 0);
  assert.equal(health.kpis.insufficient, 1);
  assert.equal(forecastLabel(item), 'Collect more data');
});

test('mastered targets never enter the trend KPI denominator and staleness is not a decline', () => {
  const target = skillTarget({
    id: 'tgt-done', name: 'Mastered skill', phase: 'Completed',
    phaseHistory: [
      { phase: 'Baseline', date: '2026-06-01' },
      { phase: 'Acquisition', date: '2026-06-15' },
      { phase: 'Completed', date: '2026-08-20' }
    ]
  });
  // Last measurement 30 days before the as-of date, stable values.
  const rows = weeklyRows('tgt-done', [88, 89, 88, 90, 89, 90, 89, 90], { endOffsetDays: 30 });
  const health = buildTargetHealth({
    programs: [programWith(target)], sessions: rows, asOfDate: AS_OF
  });
  const item = health.items[0];
  assert.equal(item.lifecycle, 'mastered');
  assert.ok(item.flags.some(flag => flag.id === 'stale-mastered'));
  assert.equal(health.kpis.activeTotal, 0);
  assert.equal(health.kpis.mastered, 1);
  assert.equal(health.kpis.declining.count, 0);
});

test('a mastered target whose recent data turns downward is flagged as regression', () => {
  const target = skillTarget({
    id: 'tgt-regression', name: 'Slipping skill', phase: 'Maintenance',
    phaseHistory: [
      { phase: 'Baseline', date: '2026-06-01' },
      { phase: 'Acquisition', date: '2026-06-15' },
      { phase: 'Maintenance', date: '2026-08-20' }
    ]
  });
  const rows = weeklyRows('tgt-regression', [95, 92, 88, 82, 76, 70, 62, 55]);
  const health = buildTargetHealth({
    programs: [programWith(target)], sessions: rows, asOfDate: AS_OF
  });
  const item = health.items[0];
  assert.equal(item.lifecycle, 'mastered');
  assert.ok(item.flags.some(flag => flag.id === 'regression'));
  assert.equal(health.kpis.needsReview, 1);
});

test('a target one session short of its mastery streak counts as near mastery', () => {
  const target = skillTarget();
  // Two of the required three criterion sessions at the end.
  const rows = weeklyRows('tgt-skill', [50, 55, 60, 66, 70, 72, 84, 86]);
  const health = buildTargetHealth({
    programs: [programWith(target)], sessions: rows, asOfDate: AS_OF
  });
  const item = health.items[0];
  assert.equal(item.nearMastery, true);
  assert.equal(item.streak, 2);
  assert.equal(item.required, 3);
  assert.match(forecastLabel(item), /criterion|2\/3/);
});

test('successes only include mastery transitions inside the trailing 30 days', () => {
  const recent = skillTarget({
    id: 'tgt-recent', name: 'Recently mastered', phase: 'Maintenance',
    phaseHistory: [
      { phase: 'Baseline', date: '2026-06-01' },
      { phase: 'Acquisition', date: '2026-06-15' },
      { phase: 'Maintenance', date: '2026-10-04' }
    ]
  });
  const old = skillTarget({
    id: 'tgt-old', name: 'Mastered long ago', phase: 'Completed',
    phaseHistory: [
      { phase: 'Baseline', date: '2026-05-01' },
      { phase: 'Acquisition', date: '2026-05-15' },
      { phase: 'Completed', date: '2026-08-15' }
    ]
  });
  const health = buildTargetHealth({
    programs: [programWith(recent), programWith(old)],
    sessions: [...weeklyRows('tgt-recent', [80, 85, 90]), ...weeklyRows('tgt-old', [85, 90, 92])],
    asOfDate: AS_OF
  });
  assert.equal(health.successes.length, 1);
  assert.equal(health.successes[0].targetId, 'tgt-recent');
});

test('a target with no observations is flagged as no-data and never breaks the rollup', () => {
  const health = buildTargetHealth({
    programs: [programWith(skillTarget({ id: 'tgt-empty' }))], sessions: [], asOfDate: AS_OF
  });
  const item = health.items[0];
  assert.equal(item.hasRows, false);
  assert.equal(item.trend, 'insufficient');
  assert.ok(item.flags.some(flag => flag.id === 'no-data'));
  assert.equal(forecastLabel(item), 'No data yet');
});

test('KPI card filters return the matching matrix rows and unknown filters return everything', () => {
  const target = skillTarget();
  const rows = weeklyRows('tgt-skill', [40, 45, 55, 60, 70, 78, 85, 90]);
  const health = buildTargetHealth({
    programs: [programWith(target)], sessions: rows, asOfDate: AS_OF
  });
  for (const filter of HEALTH_FILTERS) {
    const filtered = filterHealthItems(health.items, filter.id);
    assert.ok(filtered.every(item => filter.match(item)));
  }
  assert.equal(filterHealthItems(health.items, null).length, health.items.length);
  assert.equal(filterHealthItems(health.items, 'does-not-exist').length, health.items.length);
});

test('classifyTargetTrend rejects degenerate input without throwing', () => {
  assert.equal(classifyTargetTrend([], { direction: 'increase' }).trend, 'insufficient');
  const result = classifyTargetTrend(
    [{ val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }], { direction: 'increase' }
  );
  assert.equal(result.trend, 'stable');
  assert.equal(result.deltaPct, 0);
});

test('summarizeKpis percentages share one classifiable denominator', () => {
  const kpis = summarizeKpis([
    { lifecycle: 'active', trend: 'improving', nearMastery: false, needsReview: false },
    { lifecycle: 'active', trend: 'improving', nearMastery: true, needsReview: false },
    { lifecycle: 'active', trend: 'declining', nearMastery: false, needsReview: true },
    { lifecycle: 'active', trend: 'insufficient', nearMastery: false, needsReview: false },
    { lifecycle: 'mastered', trend: 'stable', nearMastery: false, needsReview: false }
  ]);
  assert.equal(kpis.classifiableTotal, 3);
  assert.equal(kpis.improving.percent, 67);
  assert.equal(kpis.declining.count, 1);
  assert.equal(kpis.insufficient, 1);
  assert.equal(kpis.mastered, 1);
  assert.equal(kpis.nearMastery, 1);
  assert.equal(kpis.needsReview, 1);
});

test('deterministic fixture rollup stays stable for the default client', () => {
  const client = seed.clients[0];
  const programs = seed.programs.filter(program => program.clientId === client.id);
  const sessions = seed.sessionData.filter(row => row.clientId === client.id);
  const health = buildTargetHealth({ programs, sessions, asOfDate: seed.asOfDate });
  assert.equal(health.items.length, 18); // 19 targets minus the single anecdotal target
  assert.equal(health.kpis.nearMastery, 6);
  assert.equal(health.kpis.mastered, 8);
  assert.equal(health.kpis.insufficient, 2);
  assert.ok(health.attention.length > 0);
  assert.ok(health.successes.length > 0);
  // Every row carries the fields the matrix and attention cards render.
  for (const item of health.items) {
    assert.ok(item.targetId && item.programId && item.measurementType && item.phase);
    assert.ok(['active', 'mastered', 'paused', 'ended'].includes(item.lifecycle));
    assert.ok(['improving', 'stable', 'declining', 'insufficient'].includes(item.trend));
    assert.ok(Array.isArray(item.flags) && Array.isArray(item.points));
    assert.ok(typeof deltaText(item) === 'string');
  }
});
