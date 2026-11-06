import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addTagValue, BEHAVIOR_PHASES, CASCADING_STATUSES, countByCategory, duplicateNameWarning,
  isArchived, isMastered, lessonNameByProgram, partitionByArchive,
  programFormComplete, programSummary, PROGRAM_CATEGORIES, PROGRAM_STATUSES, removeTagValue,
  sortPrograms, sortTargets, TARGET_PHASES, usageCount, validateProgram, withinLimit
} from '../frontend/src/utils/programManagement.js';

test('the program status list includes Pending, which the fixture already uses', () => {
  // The older status control left Pending out even though a fixture program
  // carries it, so the vocabulary has to include it or that program is unreachable.
  assert.ok(PROGRAM_STATUSES.includes('Pending'));
  assert.equal(PROGRAM_STATUSES.length, 8);
  ['Baselining', 'Teaching', 'Maintaining', 'Generalizing', 'Completed', 'Pending', 'OnHold', 'Discontinued']
    .forEach(status => assert.ok(PROGRAM_STATUSES.includes(status), `${status} is a program status`));
});

test('a program that is pending, completed, on hold or discontinued carries its targets', () => {
  // The platform's cascade: these four move the targets with them.
  assert.deepEqual(CASCADING_STATUSES, ['Pending', 'Completed', 'OnHold', 'Discontinued']);
});

test('a behavior carries its own phase, separate from its target phase', () => {
  // Open means defined but not yet reducing. Baseline and Acquisition are
  // measurement concepts and stay off the behavior's own vocabulary.
  assert.ok(BEHAVIOR_PHASES.includes('Open'));
  assert.ok(!BEHAVIOR_PHASES.includes('Baseline'));
  assert.ok(!BEHAVIOR_PHASES.includes('Acquisition'));
  assert.ok(TARGET_PHASES.includes('Open'), 'a target can also be open, for a behavior reduction target');
  assert.ok(TARGET_PHASES.includes('Baseline'));
});

test('mastery reads the rule for an automatic target and the decision for a manual one', () => {
  assert.equal(isMastered({ phase: 'Maintenance', masterySettings: 'Automatic' }), true);
  assert.equal(isMastered({ phase: 'Generalization', masterySettings: 'Automatic' }), true);
  assert.equal(isMastered({ phase: 'Completed', masterySettings: 'Automatic' }), true);
  assert.equal(isMastered({ phase: 'Acquisition', masterySettings: 'Automatic' }), false);
  // A paused, ended or pending target is not mastered.
  assert.equal(isMastered({ phase: 'OnHold', masterySettings: 'Automatic' }), false);
  assert.equal(isMastered({ phase: 'Discontinued', masterySettings: 'Automatic' }), false);
  assert.equal(isMastered({ phase: 'Pending', masterySettings: 'Automatic' }), false);
  // A behavior still open is not mastered.
  assert.equal(isMastered({ phase: 'Open', masterySettings: 'Automatic' }), false);
  // A manual target is mastered only when a clinician recorded the decision.
  assert.equal(isMastered({ phase: 'Acquisition', masterySettings: 'Manual' }), false);
  assert.equal(isMastered({ phase: 'Acquisition', masterySettings: 'Manual', manualMastery: { achieved: true } }), true);
  assert.equal(isMastered({ phase: 'Acquisition', masterySettings: 'Manual', manualMastery: { achieved: false } }), false);
});

test('targets are ordered by phase, then alphabetically within a phase', () => {
  const sorted = sortTargets([
    { name: 'Zebra', phase: 'Maintenance' },
    { name: 'Alpha', phase: 'Acquisition' },
    { name: 'Beta', phase: 'Maintenance' },
    { name: 'Apple', phase: 'Baseline' },
    { name: 'Cherry', phase: 'OnHold' }
  ]);
  assert.deepEqual(sorted.map(target => target.name), ['Apple', 'Alpha', 'Beta', 'Zebra', 'Cherry']);
  // A target that has not started sorts first.
  assert.equal(sorted[0].phase, 'Baseline');
  // The paused and ended states sit at the end.
  assert.equal(sorted.at(-1).phase, 'OnHold');
});

test('programs are listed alphabetically', () => {
  const sorted = sortPrograms([{ name: 'Zebra' }, { name: 'apple' }, { name: 'Mango' }]);
  assert.deepEqual(sorted.map(program => program.name), ['apple', 'Mango', 'Zebra']);
});

test('archived programs leave the working list but are still there', () => {
  // Archiving tidies the list. It never deletes the record.
  const programs = [
    { id: 'a', name: 'Active one' },
    { id: 'b', name: 'Archived one', archivedAt: '2026-10-01' }
  ];
  const { active, archived } = partitionByArchive(programs);
  assert.deepEqual(active.map(program => program.id), ['a']);
  assert.deepEqual(archived.map(program => program.id), ['b']);
  assert.equal(isArchived(programs[1]), true);
  assert.equal(isArchived(programs[0]), false);
  // A program is never both active and archived.
  assert.equal(active.some(program => program.archivedAt), false);
});

test('the program summary counts mastered targets and excludes the paused and ended ones', () => {
  const program = {
    targets: [
      { phase: 'Maintenance', masterySettings: 'Automatic' },
      { phase: 'Acquisition', masterySettings: 'Automatic' },
      { phase: 'OnHold', masterySettings: 'Automatic' },
      { phase: 'Discontinued', masterySettings: 'Automatic' },
      { phase: 'Pending', masterySettings: 'Automatic' }
    ]
  };
  const summary = programSummary(program);
  assert.equal(summary.total, 5);
  assert.equal(summary.mastered, 1, 'a paused, ended or pending target is not an achievement');
  assert.equal(summary.percent, 20);
});

test('a program with no targets has a zero summary, not a division by zero', () => {
  const summary = programSummary({ targets: [] });
  assert.deepEqual(summary, { total: 0, mastered: 0, percent: 0 });
});

test('a duplicate program name warns within a client but not across clients', () => {
  const programs = [
    { id: 'a', clientId: 'cli-one', name: 'Expressive Labeling' },
    { id: 'b', clientId: 'cli-two', name: 'Expressive Labeling' }
  ];
  // The same name for a different client is normal, so no warning.
  assert.equal(duplicateNameWarning(programs, { clientId: 'cli-three', name: 'Expressive Labeling' }), null);
  // The same name for the same client is a likely mistake.
  assert.equal(duplicateNameWarning(programs, { clientId: 'cli-one', name: 'Expressive Labeling' }), 'Expressive Labeling');
  // The warning is case-insensitive.
  assert.equal(duplicateNameWarning(programs, { clientId: 'cli-one', name: 'expressive labeling' }), 'Expressive Labeling');
  // A program does not clash with itself.
  assert.equal(duplicateNameWarning(programs, { clientId: 'cli-one', name: 'Expressive Labeling', excludeId: 'a' }), null);
  // An empty name is not a duplicate.
  assert.equal(duplicateNameWarning(programs, { clientId: 'cli-one', name: '   ' }), null);
});

test('the listing counts only the active programs of one category', () => {
  const programs = [
    { category: 'SkillAcquisition' },
    { category: 'SkillAcquisition' },
    { category: 'BehaviorReduction' },
    { category: 'SkillAcquisition', archivedAt: '2026-10-01' }
  ];
  assert.equal(countByCategory(programs, 'SkillAcquisition'), 2, 'an archived program is not in the active count');
  assert.equal(countByCategory(programs, 'BehaviorReduction'), 1);
});

test('the listing names the lesson a program runs in', () => {
  const lessons = [
    { id: 'l1', name: 'Morning block', programIds: ['p1', 'p2'] },
    { id: 'l2', name: 'Afternoon block', programIds: ['p2'] }
  ];
  const names = lessonNameByProgram(lessons);
  assert.equal(names.get('p1'), 'Morning block');
  // A program in two lessons shows the first one; the listing names one lesson.
  assert.equal(names.get('p2'), 'Morning block');
  assert.equal(names.has('p3'), false);
});

test('treatment areas and tags keep one of each value', () => {
  let list = addTagValue([], 'Communication');
  assert.deepEqual(list, ['Communication']);
  list = addTagValue(list, 'Communication');
  assert.deepEqual(list, ['Communication'], 'the same value is not added twice');
  list = addTagValue(list, '  ');
  assert.deepEqual(list, ['Communication'], 'a blank value is not added');
  list = addTagValue(list, 'Daily living');
  assert.deepEqual(list, ['Communication', 'Daily living']);
  list = removeTagValue(list, 'Communication');
  assert.deepEqual(list, ['Daily living']);
});

test('the field limits are the platform form limits', () => {
  assert.equal(withinLimit('x'.repeat(100), 100), true);
  assert.equal(withinLimit('x'.repeat(101), 100), false);
  assert.equal(withinLimit('x'.repeat(1000), 1000), true);
  assert.equal(withinLimit('x'.repeat(5001), 5000), false);
});

test('removing an ABC value warns how many observations use it', () => {
  const entries = [
    { antecedents: ['Tabletop demand'], behaviors: ['Screaming'], consequences: ['Break'], location: 'Table' },
    { antecedents: ['Tabletop demand', 'Transition'], behaviors: ['Screaming'], consequences: [], location: 'Hallway' },
    { antecedents: ['Noise'], behaviors: [], consequences: [], location: 'Table' }
  ];
  assert.equal(usageCount(entries, 'antecedents', 'Tabletop demand'), 2);
  assert.equal(usageCount(entries, 'antecedents', 'Transition'), 1);
  assert.equal(usageCount(entries, 'antecedents', 'Never used'), 0);
  assert.equal(usageCount(entries, 'behaviors', 'Screaming'), 2);
  // The location is a single value, not a list.
  assert.equal(usageCount(entries, 'location', 'Table'), 2);
  assert.equal(usageCount(entries, 'location', 'Hallway'), 1);
});

// ---- The program form's validation ----------------------------------------------------

const validSkillProgram = {
  clientId: 'cli-one', name: 'Expressive Labeling', status: 'Teaching',
  teachingInstructions: 'Present one picture at a time and wait five seconds.'
};

test('a skill acquisition program needs a name, a status and teaching instructions', () => {
  const errors = validateProgram({ clientId: 'cli-one', name: '', status: '', teachingInstructions: '' },
    { category: PROGRAM_CATEGORIES.SKILL, existing: [] });
  assert.ok(errors.name, 'the name is required');
  assert.ok(errors.status, 'the status is required');
  assert.ok(errors.teachingInstructions, 'the teaching instructions are required');
  assert.equal(validateProgram(validSkillProgram, { category: PROGRAM_CATEGORIES.SKILL, existing: [] }).name, undefined);
});

test('a behavior needs an operational definition and a behavior phase', () => {
  const errors = validateProgram({ clientId: 'cli-one', name: 'Elopement', status: 'Teaching', teachingInstructions: 'x' },
    { category: PROGRAM_CATEGORIES.BEHAVIOR, existing: [] });
  assert.ok(errors.operationalDefinition, 'the operational definition is required for a behavior');
  assert.ok(errors.behaviorPhase, 'the behavior phase is required');
  // A behavior that has an operational definition passes.
  const ok = validateProgram({
    clientId: 'cli-one', name: 'Elopement', status: 'Teaching',
    operationalDefinition: 'Leaving the instructional area without permission.', behaviorPhase: 'Open'
  }, { category: PROGRAM_CATEGORIES.BEHAVIOR, existing: [] });
  assert.equal(ok.operationalDefinition, undefined);
  assert.equal(ok.behaviorPhase, undefined);
});

test('a status from outside the platform list is refused', () => {
  const errors = validateProgram({ ...validSkillProgram, status: 'In progress' },
    { category: PROGRAM_CATEGORIES.SKILL, existing: [] });
  assert.ok(errors.status, 'an unknown status is refused');
});

test('the platform character limits are enforced on the free-text fields', () => {
  const errors = validateProgram({
    ...validSkillProgram, baseline: 'x'.repeat(1001), programObjective: 'y'.repeat(1001)
  }, { category: PROGRAM_CATEGORIES.SKILL, existing: [] });
  assert.ok(errors.baseline, 'the baseline limit is enforced');
  assert.ok(errors.programObjective, 'the objective limit is enforced');
  // The teaching instructions are checked against their own limit.
  const over = validateProgram({ ...validSkillProgram, teachingInstructions: 'x'.repeat(1001) },
    { category: PROGRAM_CATEGORIES.SKILL, existing: [] });
  assert.ok(over.teachingInstructions);
});

test('a duplicate name warns but does not block the form', () => {
  const existing = [{ id: 'p1', clientId: 'cli-one', name: 'Expressive Labeling' }];
  const errors = validateProgram(validSkillProgram, { category: PROGRAM_CATEGORIES.SKILL, existing });
  assert.ok(errors.nameWarning, 'the duplicate warns');
  assert.equal(errors.name, undefined, 'the duplicate does not block the name field');
  // A warning alone does not make the form incomplete.
  assert.equal(programFormComplete(errors), true);
});

test('the form is incomplete while any required field is missing', () => {
  assert.equal(programFormComplete(validateProgram({ name: '' }, { category: PROGRAM_CATEGORIES.SKILL, existing: [] })), false);
  assert.equal(programFormComplete(validateProgram(validSkillProgram, { category: PROGRAM_CATEGORIES.SKILL, existing: [] })), true);
});

// ---- Target definition ----------------------------------------------------------------

import {
  splitTargetNames, targetTypeTabs, validateTarget, validateTypeConfig
} from '../frontend/src/utils/programManagement.js';

const baseTarget = { name: 'Food items', type: 'Frequency', phase: 'Baseline' };

test('several target names entered together each become their own target', () => {
  assert.deepEqual(splitTargetNames('Apple, Banana,Cherry'), ['Apple', 'Banana', 'Cherry']);
  assert.deepEqual(splitTargetNames('Apple\nBanana\n\n'), ['Apple', 'Banana']);
  assert.deepEqual(splitTargetNames('   '), []);
});

test('a target needs a name, a measurement type and a phase', () => {
  const errors = validateTarget({});
  assert.ok(errors.name && errors.type && errors.phase);
  assert.deepEqual(validateTarget(baseTarget), {});
});

test('a trial by trial target requires a prompt hierarchy', () => {
  const errors = validateTarget({ ...baseTarget, type: 'TrialByTrial' }, { promptHierarchyIds: ['least-to-most'] });
  assert.ok(errors.promptHierarchyId);
  assert.deepEqual(validateTarget({ ...baseTarget, type: 'TrialByTrial', promptHierarchyId: 'least-to-most' },
    { promptHierarchyIds: ['least-to-most'] }), {});
  assert.ok(validateTarget({ ...baseTarget, type: 'TrialByTrial', promptHierarchyId: 'made-up' },
    { promptHierarchyIds: ['least-to-most'] }).promptHierarchyId, 'an unknown hierarchy is refused');
});

test('an interval target requires a start type, a length and a capture type', () => {
  const errors = validateTypeConfig({ type: 'IntervalData' });
  assert.ok(errors.intervalStartType && errors.intervalLength && errors.intervalCaptureType);
  const ok = { type: 'IntervalData', intervalSettings: { startType: 'LessonStart', intervalLength: '00:30', captureType: 'Whole' } };
  assert.deepEqual(validateTypeConfig(ok), {});
  // The interval count is optional, but must be a whole number when given.
  assert.deepEqual(validateTypeConfig({ ...ok, intervalSettings: { ...ok.intervalSettings, numberOfIntervals: 20 } }), {});
  assert.ok(validateTypeConfig({ ...ok, intervalSettings: { ...ok.intervalSettings, numberOfIntervals: 2.5 } }).numberOfIntervals);
  assert.ok(validateTypeConfig({ ...ok, intervalSettings: { ...ok.intervalSettings, intervalLength: '00:00' } }).intervalLength);
});

test('a fluency target requires a timer setting', () => {
  assert.ok(validateTypeConfig({ type: 'FluencyRate' }).fluencyStartType);
  assert.deepEqual(validateTypeConfig({ type: 'FluencyRate', fluencySettings: { startType: 'ManualStartCountDown' } }), {});
});

test('mastery is an automatic rule or a recorded clinician decision', () => {
  const rule = { measure: 'percentCorrect', comparison: 'atLeast', threshold: 80, consecutiveSessions: 3 };
  assert.deepEqual(validateTarget({ ...baseTarget, masterySettings: 'Automatic', masteryRule: rule }), {});
  assert.ok(validateTarget({ ...baseTarget, masterySettings: 'Automatic', masteryRule: { ...rule, consecutiveSessions: 0 } }).masterySessions);
  assert.ok(validateTarget({ ...baseTarget, masterySettings: 'Automatic', masteryRule: { ...rule, threshold: -1 } }).masteryThreshold);
  // A manual decision carries its date.
  assert.ok(validateTarget({ ...baseTarget, masterySettings: 'Manual', manualMastery: { achieved: true } }).manualDecidedOn);
  assert.deepEqual(validateTarget({ ...baseTarget, masterySettings: 'Manual', manualMastery: { achieved: true, decidedOn: '2026-10-01' } }), {});
});

test('only measurement types that exist get a tab, and none when there are no targets', () => {
  assert.deepEqual(targetTypeTabs([]), []);
  assert.deepEqual(targetTypeTabs([{ type: 'Duration' }, { type: 'Frequency' }, { type: 'Duration' }]), ['All', 'Frequency', 'Duration']);
});

test('every target in the fixture passes target validation, so none is refused on edit', async () => {
  const { default: seed } = await import('../data/clinicalSeed.json', { with: { type: 'json' } });
  const hierarchyIds = seed.promptHierarchyTemplates.map(item => item.id);
  const refused = [];
  for (const program of seed.programs) {
    for (const target of program.targets) {
      const errors = validateTarget(target, { promptHierarchyIds: hierarchyIds });
      if (Object.keys(errors).length) refused.push({ id: target.id, errors });
    }
  }
  assert.deepEqual(refused, []);
});

// ---- Behaviors and the analytics --------------------------------------------------------

import { BEHAVIOR_TOOLS, validateBehavior } from '../frontend/src/utils/programManagement.js';
import { masteryDate } from '../frontend/src/utils/programManagement.js';
import { introducedOn, targetMilestones } from '../frontend/src/utils/targetAnalytics.js';
import { PHASE_LABELS as HEALTH_LABELS, targetLifecycle } from '../frontend/src/utils/targetHealth.js';

const validBehavior = {
  clientId: 'c', name: 'Elopement', status: 'Teaching', behaviorPhase: 'Open',
  operationalDefinition: 'Leaving the area without permission.', measurementTool: 'Frequency'
};

test('a behavior needs a measurement tool of frequency, duration or interval', () => {
  assert.deepEqual(BEHAVIOR_TOOLS, ['Frequency', 'Duration', 'IntervalData']);
  assert.equal(validateBehavior(validBehavior).measurementTool, undefined);
  assert.ok(validateBehavior({ ...validBehavior, measurementTool: '' }).measurementTool);
  assert.ok(validateBehavior({ ...validBehavior, measurementTool: 'Anecdotal' }).measurementTool);
});

test('an interval behavior must say how its intervals run', () => {
  const errors = validateBehavior({ ...validBehavior, measurementTool: 'IntervalData' });
  assert.ok(errors.intervalStartType && errors.intervalLength && errors.intervalCaptureType);
  const ok = validateBehavior({ ...validBehavior, measurementTool: 'IntervalData',
    intervalSettings: { startType: 'Manual', intervalLength: '00:30', captureType: 'Whole' } });
  assert.equal(ok.intervalLength, undefined);
});

test('Open reads as defined but not yet reducing: never mastered, introduced when it opened', () => {
  const open = { phase: 'Open', masterySettings: 'Automatic', phaseHistory: [{ phase: 'Open', date: '2026-09-01' }] };
  assert.equal(isMastered(open), false);
  assert.equal(masteryDate(open), null);
  assert.equal(targetLifecycle(open), 'active', 'an open behavior is eligible for the attention flag');
  assert.equal(HEALTH_LABELS.Open, 'Open');
  assert.equal(introducedOn(open), '2026-09-01');
  assert.equal(targetMilestones(open)[0].label, 'Behavior opened');
});

import { behaviorPhaseOf } from '../frontend/src/utils/programManagement.js';

test('a behavior without a stored phase reads from its target, and open when the target is still being established', () => {
  assert.equal(behaviorPhaseOf({ behaviorPhase: 'Completed', targets: [{ phase: 'Open' }] }), 'Completed', 'a stored phase wins');
  assert.equal(behaviorPhaseOf({ targets: [{ phase: 'Maintenance' }] }), 'Maintenance');
  assert.equal(behaviorPhaseOf({ targets: [{ phase: 'Acquisition' }] }), 'Open');
  assert.equal(behaviorPhaseOf({ targets: [{ phase: 'Baseline' }] }), 'Open');
  assert.equal(behaviorPhaseOf({ targets: [] }), 'Open');
});

test('the location list counts observations through their single location', () => {
  const entries = [{ location: 'Hallway' }, { location: 'Hallway' }, { location: 'Table' }];
  assert.equal(usageCount(entries, 'locations', 'Hallway'), 2);
  assert.equal(usageCount(entries, 'location', 'Table'), 1);
});

import { intensityTrend } from '../frontend/src/utils/abcAnalytics.js';

test('an ABC observation recorded without an intensity is not averaged as zero', () => {
  const entries = [
    { timestamp: '2026-10-05T09:00:00', behaviors: ['Screaming'], intensity: 4, durationMinutes: 6 },
    { timestamp: '2026-10-06T09:00:00', behaviors: ['Screaming'] },
    { timestamp: '2026-10-07T09:00:00', behaviors: ['Screaming'], intensity: 2, durationMinutes: null }
  ];
  const [point] = intensityTrend(entries, ['Screaming']).series[0].points;
  assert.equal(point.n, 3, 'all three observations count');
  assert.equal(point.intensity, 3, 'only the two measured intensities are averaged');
  assert.equal(point.duration, 6, 'only the one measured duration');
  const none = intensityTrend([{ timestamp: '2026-10-05T09:00:00', behaviors: ['X'] }], ['X']).series[0].points[0];
  assert.equal(none.intensity, null, 'no measurement is null, never zero');
});
