import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PROGRAM_SCOPE, DEFAULT_RANGE_ID, PROGRAM_SCOPES, SCOPE_RANGES,
  durationFilterForDate, formatScopeDate, isInScopeWindow, normalizeScope, programScopeById,
  rangeById, rangePhrase, resolveScopeWindow, scopeCaption, scopeIncludesCategory, scopePrograms, weekCountFor
} from '../frontend/src/utils/analyticsScope.js';
import {
  ALL_PROGRAMS_ID, cumulativeMasterySeries, masteryTransitionDate, resolveMasterySelection
} from '../frontend/src/utils/targetAnalytics.js';

const AS_OF = '2026-10-14';
const seedPath = fileURLToPath(new URL('../data/clinicalSeed.json', import.meta.url));
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const liam = seed.clients[0];
const liamPrograms = seed.programs.filter(program => program.clientId === liam.id);
const liamSessions = seed.sessionData.filter(row => row.clientId === liam.id);

function target(overrides = {}) {
  return {
    id: 'tgt-scope', name: 'Scope target', type: 'TrialByTrial', phase: 'Acquisition',
    phaseHistory: [{ phase: 'Baseline', date: '2026-06-01' }, { phase: 'Acquisition', date: '2026-06-15' }],
    ...overrides
  };
}

function program(id, category, targets) {
  return { id, clientId: 'cli-scope', name: `Program ${id}`, category, targets };
}

test('normalizeScope always returns a usable scope and defaults to all programs / 90 days', () => {
  assert.deepEqual(normalizeScope(), { programScope: DEFAULT_PROGRAM_SCOPE, rangeId: DEFAULT_RANGE_ID });
  assert.deepEqual(normalizeScope({ programScope: 'behavior', rangeId: '1Y' }), { programScope: 'behavior', rangeId: '1Y' });
  assert.deepEqual(normalizeScope({ programScope: 'nonsense', rangeId: '5X' }), { programScope: 'all', rangeId: '90D' });
  // The blueprint's five ranges exist and default to 90D.
  assert.deepEqual(SCOPE_RANGES.map(range => range.id), ['30D', '90D', '6M', '1Y', 'ALL']);
  assert.equal(rangeById('ALL').days, null);
  assert.equal(rangeById(DEFAULT_RANGE_ID).days, 90);
  assert.equal(programScopeById('skill').category, 'SkillAcquisition');
  assert.equal(PROGRAM_SCOPES.length, 3);
});

test('scopePrograms filters by the existing program category without mutating the input', () => {
  const programs = [
    program('p-skill', 'SkillAcquisition', [target()]),
    program('p-behavior', 'BehaviorReduction', [target({ id: 'tgt-b' })]),
    program('p-skill-2', 'SkillAcquisition', [target({ id: 'tgt-c' })])
  ];
  assert.deepEqual(scopePrograms(programs, 'skill').map(item => item.id), ['p-skill', 'p-skill-2']);
  assert.deepEqual(scopePrograms(programs, 'behavior').map(item => item.id), ['p-behavior']);
  assert.deepEqual(scopePrograms(programs, 'all').map(item => item.id), ['p-skill', 'p-behavior', 'p-skill-2']);
  assert.equal(scopePrograms(programs, 'unknown').length, 3);
  assert.notEqual(scopePrograms(programs, 'all'), programs);
  assert.equal(programs.length, 3);
  assert.equal(scopeIncludesCategory('skill', 'SkillAcquisition'), true);
  assert.equal(scopeIncludesCategory('skill', 'BehaviorReduction'), false);
  assert.equal(scopeIncludesCategory('all', 'BehaviorReduction'), true);
});

test('resolveScopeWindow turns each range into a concrete, data-driven window', () => {
  const window90 = resolveScopeWindow({ asOfDate: AS_OF, rangeId: '90D' });
  assert.equal(window90.start, '2026-07-16');
  assert.equal(window90.days, 90);
  assert.equal(window90.bounded, true);
  // Sentences can use the phrase directly: "over the last 90 days", "during all recorded history".
  assert.equal(window90.phrase, 'the last 90 days');
  assert.equal(rangePhrase(window90), 'the last 90 days');
  assert.equal(rangePhrase(null), 'the selected range');
  assert.equal(resolveScopeWindow({ asOfDate: AS_OF, rangeId: '6M' }).days, 183);
  assert.equal(resolveScopeWindow({ asOfDate: AS_OF, rangeId: '1Y' }).start, '2025-10-14');

  const sessions = [
    { timestamp: '2026-04-13T09:00' },
    { timestamp: '2026-09-01T09:00' },
    { timestamp: '2026-10-14T09:00' }
  ];
  const all = resolveScopeWindow({ asOfDate: AS_OF, rangeId: 'ALL', sessions });
  assert.equal(all.start, '2026-04-13');
  assert.equal(all.days, 184);
  assert.equal(all.bounded, false);
  assert.equal(all.phrase, 'all recorded history (13 Apr 2026 – 14 Oct 2026)');
  // Phase histories count too, so a target created before the first observation is included.
  const withHistory = resolveScopeWindow({
    asOfDate: AS_OF, rangeId: 'ALL',
    programs: [program('p1', 'SkillAcquisition', [target({ phaseHistory: [{ phase: 'Baseline', date: '2026-03-02' }] })])]
  });
  assert.equal(withHistory.start, '2026-03-02');
  // No data at all: a one-day window anchored on the as-of date rather than a crash.
  const empty = resolveScopeWindow({ asOfDate: AS_OF, rangeId: 'ALL' });
  assert.equal(empty.start, AS_OF);
  assert.equal(empty.days, 1);
});

test('the shared window is inclusive at both ends and respects the as-of date', () => {
  const window = resolveScopeWindow({ asOfDate: AS_OF, rangeId: '90D' });
  assert.equal(isInScopeWindow('2026-07-16', window), true);
  assert.equal(isInScopeWindow('2026-07-15', window), false);
  assert.equal(isInScopeWindow('2026-10-14', window), true);
  assert.equal(isInScopeWindow('2026-10-15', window), false);
  assert.equal(isInScopeWindow('', window), false);
  assert.equal(isInScopeWindow('2026-09-01T10:00', window), true);
});

test('weekly map columns follow the range and stay inside a readable band', () => {
  assert.equal(weekCountFor({ days: 30 }), 5);
  assert.equal(weekCountFor({ days: 90 }), 13);
  assert.equal(weekCountFor({ days: 183 }), 27);
  assert.equal(weekCountFor({ days: 365 }), 53);
  assert.equal(weekCountFor({ days: 1000 }), 53);
  assert.equal(weekCountFor({ days: 1 }), 4);
  assert.equal(weekCountFor({ days: 90 }, { min: 2, max: 8 }), 8);
});

test('focus dates pick the smallest chart window that still contains the event', () => {
  // The chart always keeps at least two weeks of context around the event it opens on.
  assert.equal(durationFilterForDate(AS_OF, AS_OF), '2 weeks');
  assert.equal(durationFilterForDate('2026-10-10', AS_OF), '1 month');
  assert.equal(durationFilterForDate('2026-09-20', AS_OF), '3 months');
  assert.equal(durationFilterForDate('2026-08-20', AS_OF), '3 months');
  assert.equal(durationFilterForDate('2026-06-01', AS_OF), '6 months');
  assert.equal(durationFilterForDate('2026-01-01', AS_OF), '1 year');
  assert.equal(durationFilterForDate('2024-01-01', AS_OF), '2 years');
  // Missing input stays on the workspace's existing default rather than throwing.
  assert.equal(durationFilterForDate(null, AS_OF), '3 months');
});

test('the scope caption names the range, its size and the programs in scope', () => {
  const window = resolveScopeWindow({ asOfDate: AS_OF, rangeId: '90D' });
  assert.equal(formatScopeDate(window.start), '16 Jul 2026');
  assert.equal(formatScopeDate('2026-10-05'), '5 Oct 2026');
  assert.equal(formatScopeDate(''), '');
  const caption = scopeCaption(window, { programScope: 'all', counts: { total: 9, skill: 6, behavior: 3 } });
  assert.match(caption, /^All programs/);
  assert.match(caption, /16 Jul 2026 – 14 Oct 2026/);
  assert.match(caption, /90 days/);
  assert.match(caption, /9 programs in scope/);
  const allTime = scopeCaption(resolveScopeWindow({ asOfDate: AS_OF, rangeId: 'ALL' }), { programScope: 'behavior', counts: { total: 3, skill: 0, behavior: 3 } });
  assert.match(allTime, /all recorded history/);
  assert.match(allTime, /3 programs in scope/);
});

test('masteryTransitionDate uses the first mastery phase and falls back to the current phase', () => {
  const phased = target({ phaseHistory: [
    { phase: 'Baseline', date: '2026-05-01' },
    { phase: 'Acquisition', date: '2026-05-10' },
    { phase: 'Maintenance', date: '2026-07-01' },
    { phase: 'Completed', date: '2026-09-01' }
  ] });
  assert.equal(masteryTransitionDate(phased), '2026-07-01');
  assert.equal(masteryTransitionDate({ phase: 'Completed', phaseEnteredDate: '2026-08-08' }), '2026-08-08');
  assert.equal(masteryTransitionDate({ phase: 'Acquisition', phaseEnteredDate: '2026-08-08' }), null);
  assert.equal(masteryTransitionDate({}), null);
});

test('cumulativeMasterySeries aggregates programs by date and honours the shared range', () => {
  const a = program('p-a', 'SkillAcquisition', [
    target({ id: 't1', name: 'Alpha', phaseHistory: [{ phase: 'Maintenance', date: '2026-07-01' }] }),
    target({ id: 't2', name: 'Beta', phaseHistory: [{ phase: 'Completed', date: '2026-07-01' }] })
  ]);
  const b = program('p-b', 'SkillAcquisition', [
    target({ id: 't3', name: 'Gamma', phaseHistory: [{ phase: 'Generalization', date: '2026-09-02' }] })
  ]);
  const series = cumulativeMasterySeries([a, b]);
  assert.deepEqual(series.map(row => row.date), ['2026-07-01', '2026-09-02']);
  assert.equal(series[0].cumulativeCount, 2);
  assert.deepEqual(series[0].newlyMastered, ['Alpha', 'Beta']);
  assert.equal(series.at(-1).cumulativeCount, 3);

  const windowed = cumulativeMasterySeries([a, b], { from: '2026-08-01', to: AS_OF });
  assert.deepEqual(windowed, [{ date: '2026-09-02', cumulativeCount: 1, newlyMastered: ['Gamma'] }]);
  assert.deepEqual(cumulativeMasterySeries([], {}), []);
  // One program's series matches the same program computed through the aggregate.
  const playing = liamPrograms.find(item => item.id === 'prog-playing');
  const single = cumulativeMasterySeries([playing]);
  assert.equal(single.at(-1).cumulativeCount, 2);
  const share = playing.targets.find(item => item.id === 'tgt-play-share');
  assert.equal(single[0].date, share.phaseHistory.find(entry => entry.phase === 'Maintenance').date);
});

test('the mastery picker defaults to the all-programs aggregate, not the first program', () => {
  const skill = liamPrograms.filter(item => item.category === 'SkillAcquisition');
  assert.equal(resolveMasterySelection(undefined, skill), ALL_PROGRAMS_ID);
  assert.equal(resolveMasterySelection('', skill), ALL_PROGRAMS_ID);
  assert.equal(resolveMasterySelection(ALL_PROGRAMS_ID, skill), ALL_PROGRAMS_ID);
  assert.equal(resolveMasterySelection(skill[1].id, skill), skill[1].id);
  assert.equal(resolveMasterySelection('prog-not-in-scope', skill), ALL_PROGRAMS_ID);
  assert.equal(resolveMasterySelection(undefined, []), '');
});

test('deterministic fixture: the 90-day window and all-time window agree with the seed', () => {
  const window = resolveScopeWindow({ asOfDate: seed.asOfDate, rangeId: '90D', sessions: liamSessions, programs: liamPrograms });
  assert.equal(window.start, '2026-07-16');
  const scopedSkill = scopePrograms(liamPrograms, 'skill');
  assert.equal(scopedSkill.length, 6);
  assert.equal(scopedSkill.every(item => item.category === 'SkillAcquisition'), true);
  const mastery = cumulativeMasterySeries(scopedSkill, { from: window.start, to: window.asOfDate });
  assert.ok(mastery.length > 0, 'the default 90-day range shows recent mastery transitions');
  assert.equal(mastery.at(-1).cumulativeCount, mastery.reduce((total, row) => total + row.newlyMastered.length, 0));
  const allTime = resolveScopeWindow({ asOfDate: seed.asOfDate, rangeId: 'ALL', sessions: liamSessions, programs: liamPrograms });
  assert.equal(allTime.start, '2026-04-13');
  assert.equal(weekCountFor(window), 13);
});
