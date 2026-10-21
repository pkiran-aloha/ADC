import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  TIMELINE_FILTERS, TIMELINE_KINDS, TIMELINE_LIMIT, buildInterventionTimeline, collapsePhaseLines,
  dedupeTimeline, describeTimelineEvent, filterTimelineEvents, groupTimelineByMonth, isPhaseCompanion,
  sortTimelineEvents, timelineCounts, timelineMonthLabel
} from '../frontend/src/utils/interventionTimeline.js';

const AS_OF = '2026-10-14';
const seedPath = fileURLToPath(new URL('../data/clinicalSeed.json', import.meta.url));
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const client = seed.clients[0];
const programs = seed.programs.filter(program => program.clientId === client.id);

function target(id, name, history, overrides = {}) {
  return { id, name, type: 'TrialByTrial', phase: 'Acquisition', phaseHistory: history, ...overrides };
}

function program(id, category, targets) {
  return { id, clientId: 'cli-timeline', name: `Program ${id}`, category, targets };
}

const skillProgram = program('prog-skill', 'SkillAcquisition', [
  target('tgt-a', 'Imitation', [
    { phase: 'Baseline', date: '2026-09-01' },
    { phase: 'Acquisition', date: '2026-09-08' },
    { phase: 'Maintenance', date: '2026-10-05' }
  ])
]);
const behaviorProgram = program('prog-behavior', 'BehaviorReduction', [
  target('tgt-b', 'Aggression', [
    { phase: 'Baseline', date: '2026-09-02' },
    { phase: 'Acquisition', date: '2026-09-09' }
  ])
]);
const programsFixture = [skillProgram, behaviorProgram];

function build(overrides = {}) {
  return buildInterventionTimeline({
    programs: programsFixture, phaseLines: [], phaseRanges: [], graphNotes: [],
    asOfDate: AS_OF, windowStart: '2026-08-01', ...overrides
  });
}

test('phase history, lines, ranges and notes merge into one newest-first feed', () => {
  const timeline = build({
    phaseLines: [{ id: 'l1', targetId: 'tgt-a', date: '2026-09-12', label: 'Intervention: DRA', isAutomated: false }],
    phaseRanges: [{ id: 'r1', targetId: 'tgt-a', startDate: '2026-09-01', endDate: '2026-09-10', label: 'Baseline assessment' }],
    graphNotes: [{ id: 'n1', targetId: 'tgt-b', date: '2026-09-30', noteText: 'Caregiver changed the routine.', staffName: 'Lee, BCBA' }]
  });
  assert.equal(timeline.total, 4 + 3 + 1);
  assert.deepEqual(timeline.counts, { phase: 5, line: 1, range: 1, note: 1 });
  assert.equal(timeline.lastDate, '2026-10-05');
  const dates = timeline.events.map(event => event.date);
  assert.deepEqual([...dates].sort().reverse(), dates, 'events run newest first');
  // Every event carries what the feed and the drilldown need.
  for (const event of timeline.events) {
    assert.ok(TIMELINE_KINDS[event.kind], `known kind ${event.kind}`);
    assert.ok(event.targetId && event.programId && event.targetName && event.programName);
    assert.ok(event.date && event.title);
    assert.ok(Array.isArray(event.companions));
    assert.ok(['positive', 'attention', 'neutral'].includes(event.tone));
  }
});

test('an automated phase line collapses into the phase change on the same target and date', () => {
  const timeline = build({
    phaseLines: [
      { id: 'auto', targetId: 'tgt-a', date: '2026-10-05', label: 'Mastery criterion met', isAutomated: true, source: 'OutcomesPromotions' },
      { id: 'auto-other-day', targetId: 'tgt-a', date: '2026-09-20', label: 'Generalization probes', isAutomated: true, source: 'OutcomesPromotions' }
    ]
  });
  assert.equal(timeline.collapsed, 1);
  const maintenance = timeline.events.find(event => event.kind === 'phase' && event.phase === 'Maintenance');
  assert.equal(maintenance.date, '2026-10-05');
  assert.deepEqual(maintenance.companions.map(companion => companion.label), ['Mastery criterion met']);
  assert.equal(maintenance.companions[0].automated, true);
  // A companion on a different date has no phase change to merge into, so it stays visible.
  assert.ok(timeline.events.some(event => event.kind === 'line' && event.date === '2026-09-20'));
  // And it is never counted twice: one feed row per change.
  assert.equal(timeline.events.filter(event => event.date === '2026-10-05' && event.targetId === 'tgt-a').length, 1);
});

test('a manually recorded line that repeats the phase change collapses too, unrelated lines do not', () => {
  const timeline = build({
    phaseLines: [
      { id: 'manual-dup', targetId: 'tgt-a', date: '2026-10-05', label: 'Moved to maintenance', isAutomated: false, source: 'Manual' },
      { id: 'manual-real', targetId: 'tgt-a', date: '2026-10-05', label: 'Intervention: DRA', isAutomated: false, source: 'Manual' }
    ]
  });
  assert.equal(timeline.collapsed, 1);
  const maintenance = timeline.events.find(event => event.kind === 'phase' && event.phase === 'Maintenance');
  assert.deepEqual(maintenance.companions.map(companion => companion.label), ['Moved to maintenance']);
  assert.equal(maintenance.companions[0].automated, false);
  const intervention = timeline.events.find(event => event.kind === 'line');
  assert.equal(intervention.title, 'Intervention: DRA');
  assert.equal(isPhaseCompanion('Mastery criterion met', 'Maintenance'), true);
  assert.equal(isPhaseCompanion('mastery criterion met', 'Acquisition'), false);
  assert.equal(isPhaseCompanion('', 'Maintenance'), false);
});

test('graph notes and phase ranges stay distinct even on a phase-change date', () => {
  const timeline = build({
    graphNotes: [{ id: 'n1', targetId: 'tgt-a', date: '2026-10-05', noteText: 'Faded the last prompt.', staffName: 'Nia, RBT' }],
    phaseRanges: [{ id: 'r1', targetId: 'tgt-a', startDate: '2026-10-05', endDate: '2026-10-10', label: 'Probe week' }]
  });
  const onDate = timeline.events.filter(event => event.date === '2026-10-05');
  assert.deepEqual(onDate.map(event => event.kind).sort(), ['note', 'phase', 'range']);
  const note = onDate.find(event => event.kind === 'note');
  assert.equal(note.title, 'Faded the last prompt.');
  assert.equal(note.detail, 'Nia, RBT');
  const range = onDate.find(event => event.kind === 'range');
  assert.equal(range.endDate, '2026-10-10');
});

test('identical events are date-deduped, not repeated', () => {
  const duplicated = [
    { key: 'line|tgt-a|2026-09-12|Intervention: DRA|manual', kind: 'line', date: '2026-09-12', targetName: 'Imitation', title: 'Intervention: DRA', companions: [], detail: '' },
    { key: 'line|tgt-a|2026-09-12|Intervention: DRA|manual', kind: 'line', date: '2026-09-12', targetName: 'Imitation', title: 'Intervention: DRA', companions: [{ label: 'Copy' }], detail: 'Lee' }
  ];
  const deduped = dedupeTimeline(duplicated);
  assert.equal(deduped.length, 1);
  assert.deepEqual(deduped[0].companions.map(companion => companion.label), ['Copy']);
  assert.equal(deduped[0].detail, 'Lee');
  // De-duplication returns new objects; the caller's events are untouched.
  assert.equal(duplicated[0].companions.length, 0);
  assert.notEqual(deduped[0], duplicated[0]);
});

test('the shared window trims the feed and keeps ranges that overlap it', () => {
  const timeline = build({
    phaseRanges: [{ id: 'r-old', targetId: 'tgt-a', startDate: '2026-06-01', endDate: '2026-08-10', label: 'Old range' }],
    graphNotes: [{ id: 'n-old', targetId: 'tgt-a', date: '2026-06-05', noteText: 'Too old' }]
  });
  assert.equal(timeline.events.some(event => event.date === '2026-06-05'), false);
  // The range starts before the window but overlaps it, so it stays.
  assert.ok(timeline.events.some(event => event.kind === 'range'));
  // A window that ends before the data returns nothing rather than throwing.
  const empty = build({ windowStart: '2026-11-01' });
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.counts, { phase: 0, line: 0, range: 0, note: 0 });
  assert.equal(empty.lastDate, null);
});

test('program scope limits the feed to the existing program category', () => {
  const behaviorOnly = build({ programScope: 'behavior' });
  assert.equal(behaviorOnly.total, 2);
  assert.ok(behaviorOnly.events.every(event => event.category === 'BehaviorReduction'));
  const skillOnly = build({ programScope: 'skill' });
  assert.ok(skillOnly.events.every(event => event.category === 'SkillAcquisition'));
  // Events for targets outside the given programs are ignored rather than rendered blank.
  const stray = build({ phaseLines: [{ id: 'x', targetId: 'tgt-missing', date: '2026-09-01', label: 'Stray' }] });
  assert.equal(stray.events.some(event => event.title === 'Stray'), false);
});

test('filtering, grouping and descriptions stay in sync with the feed', () => {
  const timeline = build({
    phaseLines: [{ id: 'l1', targetId: 'tgt-a', date: '2026-09-12', label: 'Intervention: DRA', isAutomated: false }],
    graphNotes: [{ id: 'n1', targetId: 'tgt-b', date: '2026-09-30', noteText: 'Caregiver changed the routine.' }]
  });
  assert.equal(filterTimelineEvents(timeline.events, 'all').length, timeline.total);
  const phasesOnly = filterTimelineEvents(timeline.events, 'phases');
  assert.ok(phasesOnly.length > 0 && phasesOnly.every(event => event.kind === 'phase'));
  const context = filterTimelineEvents(timeline.events, 'context');
  assert.deepEqual(context.map(event => event.kind).sort(), ['line', 'note']);
  assert.equal(filterTimelineEvents(timeline.events, 'unknown').length, timeline.total);
  assert.deepEqual(TIMELINE_FILTERS.map(entry => entry.id), ['all', 'phases', 'context']);

  const groups = groupTimelineByMonth(timeline.events);
  assert.deepEqual(groups.map(group => group.label), ['October 2026', 'September 2026']);
  assert.equal(groups.reduce((total, group) => total + group.events.length, 0), timeline.total);
  assert.equal(timelineMonthLabel('2026-10-05'), 'October 2026');
  assert.equal(timelineMonthLabel('not-a-date'), 'not-a-date');

  const note = timeline.events.find(event => event.kind === 'note');
  const description = describeTimelineEvent(note);
  assert.match(description, /Graph note: Caregiver changed the routine\./);
  assert.match(description, /Aggression, Program prog-behavior/);
  assert.match(description, /Open in target analysis/);
  const phase = timeline.events.find(event => event.kind === 'phase');
  assert.match(describeTimelineEvent(phase), /moved to/);
});

test('sorting and counts are deterministic for equal dates and titles', () => {
  const events = [
    { kind: 'note', date: '2026-10-01', targetName: 'B', title: 'Note', companions: [] },
    { kind: 'phase', date: '2026-10-01', targetName: 'B', title: 'Completed', companions: [] },
    { kind: 'line', date: '2026-10-01', targetName: 'A', title: 'Line', companions: [] }
  ];
  assert.deepEqual(sortTimelineEvents(events).map(event => event.kind), ['phase', 'line', 'note']);
  assert.deepEqual(timelineCounts(events), { phase: 1, line: 1, range: 0, note: 1 });
  assert.deepEqual(timelineCounts([]), { phase: 0, line: 0, range: 0, note: 0 });
});

test('collapsing never mutates the incoming event list', () => {
  const phase = { key: 'phase|t|2026-10-05|Completed', kind: 'phase', phase: 'Completed', date: '2026-10-05', targetId: 't', targetName: 'T', title: 'Completed', companions: [] };
  const line = { key: 'line|t|2026-10-05|Target completed|manual', kind: 'line', date: '2026-10-05', targetId: 't', targetName: 'T', title: 'Target completed', automated: false, companions: [] };
  const events = [phase, line];
  const result = collapsePhaseLines(events);
  assert.equal(result.collapsed, 1);
  assert.equal(result.events.length, 1);
  assert.equal(phase.companions.length, 0, 'the input event is untouched');
  assert.equal(result.events[0].companions.length, 1);
  assert.equal(result.events[0] !== phase, true);
});

test('the builder tolerates empty input and limits without throwing', () => {
  const empty = buildInterventionTimeline();
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.events, []);
  const limited = build({ limit: 2 });
  assert.equal(limited.events.length, 2);
  assert.ok(limited.total > 2);
  assert.ok(TIMELINE_LIMIT >= 5);
});

test('deterministic fixture: Liam’s merged timeline is ordered, deduped and drillable', () => {
  const windowStart = '2026-07-16';
  const timeline = buildInterventionTimeline({
    programs,
    phaseLines: seed.phaseLines, phaseRanges: seed.phaseRanges, graphNotes: seed.graphNotes,
    asOfDate: seed.asOfDate, windowStart
  });
  assert.equal(timeline.total, 19);
  assert.deepEqual(timeline.counts, { phase: 16, line: 1, range: 1, note: 1 });
  assert.equal(timeline.firstDate, '2026-07-20');
  assert.equal(timeline.lastDate, '2026-10-05');
  // The documented sample row: completion on 5 October with its companion line folded in.
  const completion = timeline.events[0];
  assert.equal(completion.kind, 'phase');
  assert.equal(completion.date, '2026-10-05');
  assert.equal(completion.targetName, 'Respond to Hello');
  assert.deepEqual(completion.companions.map(companion => companion.label), ['Target completed']);
  // One row per target and date for phase changes; no duplicated event keys.
  const keys = timeline.events.map(event => event.key);
  assert.equal(new Set(keys).size, keys.length);
  const phaseTargetDates = timeline.events.filter(event => event.kind === 'phase').map(event => `${event.targetId}|${event.date}`);
  assert.equal(new Set(phaseTargetDates).size, phaseTargetDates.length);
  // Every event resolves back to a target the workspace can open.
  const targetIds = new Set(programs.flatMap(item => item.targets).map(item => item.id));
  for (const event of timeline.events) {
    assert.ok(targetIds.has(event.targetId), `${event.targetName} exists`);
    assert.ok(event.programId.startsWith('prog-'));
  }
  // All time includes the earlier history and never double counts an automated pair.
  const allTime = buildInterventionTimeline({
    programs,
    phaseLines: seed.phaseLines, phaseRanges: seed.phaseRanges, graphNotes: seed.graphNotes,
    asOfDate: seed.asOfDate, windowStart: '2026-04-13'
  });
  assert.equal(allTime.total, 57);
  assert.deepEqual(allTime.counts, { phase: 47, line: 5, range: 3, note: 2 });
  assert.ok(allTime.collapsed > 10);
});
