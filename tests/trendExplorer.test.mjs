import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import buildTargetHealth, { deltaText, trendTone, PHASE_LABELS } from '../frontend/src/utils/targetHealth.js';
import {
  EXPLORER_CATEGORIES, buildExplorerCatalog, filterExplorerGroups,
  isExplorerProgramSelected, isExplorerTargetSelected,
  selectExplorerTarget, selectExplorerProgram,
  nextExplorerFocusIndex, explorerSummaryCaption
} from '../frontend/src/utils/trendExplorer.js';

const seedPath = fileURLToPath(new URL('../data/clinicalSeed.json', import.meta.url));
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));

test('EXPLORER_CATEGORIES exposes all, skill and behavior scopes with accessible names', () => {
  assert.deepEqual(EXPLORER_CATEGORIES.map(entry => entry.value), ['All', 'SkillAcquisition', 'Behavior']);
  for (const option of EXPLORER_CATEGORIES) {
    assert.ok(option.label && option.accessibleLabel);
  }
});

test('buildExplorerCatalog groups every client target under its program without mutating inputs', () => {
  const client = seed.clients[0];
  const programs = seed.programs.filter(program => program.clientId === client.id);
  const sessions = seed.sessionData.filter(row => row.clientId === client.id);
  const snapshot = JSON.stringify({ programs, sessions: sessions.slice(0, 5) });

  const catalog = buildExplorerCatalog({ programs, sessions, asOfDate: seed.asOfDate });
  assert.equal(catalog.groups.length, programs.length);
  assert.equal(catalog.counts.programs, 9);
  assert.equal(catalog.counts.targets, 19);
  assert.equal(catalog.counts.skillTargets, 16);
  assert.equal(catalog.counts.behaviorTargets, 3);
  assert.equal(JSON.stringify({ programs, sessions: sessions.slice(0, 5) }), snapshot);
});

test('explorer deltas and tones match buildTargetHealth word for word and include anecdotal notes', () => {
  const client = seed.clients[0];
  const programs = seed.programs.filter(program => program.clientId === client.id);
  const sessions = seed.sessionData.filter(row => row.clientId === client.id);
  const health = buildTargetHealth({ programs, sessions, asOfDate: seed.asOfDate });
  const catalog = buildExplorerCatalog({ programs, sessions, asOfDate: seed.asOfDate });

  const healthById = new Map(health.items.map(item => [item.targetId, item]));
  for (const entry of catalog.items) {
    assert.equal(entry.phaseLabel, PHASE_LABELS[entry.phase] || entry.phase);
    if (entry.measurementType === 'Anecdotal') {
      assert.equal(entry.trend, 'narrative');
      assert.equal(entry.deltaLabel, 'Notes');
      assert.equal(entry.tone, 'neutral');
    } else {
      const expected = healthById.get(entry.targetId);
      assert.ok(expected, `missing health item for ${entry.targetId}`);
      assert.equal(entry.deltaLabel, deltaText(expected));
      assert.equal(entry.tone, trendTone(expected));
      assert.equal(entry.needsReview, expected.needsReview);
    }
  }
});

test('decreasing behavior reduction targets keep positive therapeutic tone in the explorer list', () => {
  const client = seed.clients[0];
  const programs = seed.programs.filter(program => program.clientId === client.id);
  const sessions = seed.sessionData.filter(row => row.clientId === client.id);
  const catalog = buildExplorerCatalog({ programs, sessions, asOfDate: seed.asOfDate });
  const improvingBehavior = catalog.items.find(
    entry => entry.category === 'BehaviorReduction' && entry.trend === 'improving'
  );
  assert.ok(improvingBehavior, 'expected at least one improving behavior target in fixture');
  assert.ok(improvingBehavior.deltaLabel.startsWith('↓'));
  assert.equal(improvingBehavior.tone, 'positive');
});

test('filterExplorerGroups narrows by category and case-insensitive search without mutating groups', () => {
  const client = seed.clients[0];
  const programs = seed.programs.filter(program => program.clientId === client.id);
  const sessions = seed.sessionData.filter(row => row.clientId === client.id);
  const catalog = buildExplorerCatalog({ programs, sessions, asOfDate: seed.asOfDate });

  const onlyBehaviors = filterExplorerGroups(catalog.groups, { category: 'Behavior' });
  assert.equal(onlyBehaviors.length, 3);
  assert.ok(onlyBehaviors.every(group => group.category === 'BehaviorReduction'));

  const onlySkills = filterExplorerGroups(catalog.groups, { category: 'SkillAcquisition' });
  assert.equal(onlySkills.length, 6);
  assert.ok(onlySkills.every(group => group.category === 'SkillAcquisition'));

  const byTarget = filterExplorerGroups(catalog.groups, { query: '  community helpers  ' });
  assert.equal(byTarget.length, 1);
  assert.equal(byTarget[0].targets.length, 1);
  assert.equal(byTarget[0].targets[0].targetName, 'Label Community Helpers');
  // Original group retains all of its targets.
  assert.ok(catalog.groups[0].targets.length > 1);

  const byFlag = filterExplorerGroups(catalog.groups, { query: 'regression' });
  assert.ok(byFlag.length >= 1);
  assert.ok(byFlag.every(group => group.targets.some(target =>
    target.flags.some(flag => flag.label.toLowerCase().includes('regression'))
  )));

  const mateo = seed.clients[4];
  const mateoCatalog = buildExplorerCatalog({
    programs: seed.programs.filter(program => program.clientId === mateo.id),
    sessions: seed.sessionData.filter(row => row.clientId === mateo.id),
    asOfDate: seed.asOfDate
  });
  const byPlateau = filterExplorerGroups(mateoCatalog.groups, { query: 'plateau' });
  assert.ok(byPlateau.length >= 1);

  assert.deepEqual(filterExplorerGroups(catalog.groups, { query: 'zzzz-no-such-target' }), []);
});

test('selectExplorerTarget narrows the analysis to the clicked target and its measurement family', () => {
  const client = seed.clients[0];
  const programs = seed.programs.filter(program => program.clientId === client.id);
  const sessions = seed.sessionData.filter(row => row.clientId === client.id);
  const catalog = buildExplorerCatalog({ programs, sessions, asOfDate: seed.asOfDate });
  const target = catalog.items.find(entry => entry.targetName === 'Label Community Helpers');

  const next = selectExplorerTarget(target);
  assert.equal(next.category, 'SkillAcquisition');
  assert.equal(next.selectedProgramId, target.programId);
  assert.equal(next.requestedTargetType, target.familyKey);
  assert.equal(next.analysisTargetId, target.targetId);
  assert.equal(next.annotationTargetId, target.targetId);
  assert.deepEqual(next.selectedTargetIds, [target.targetId]);
});

test('selectExplorerTarget opens a behavior reduction target directly in one click', () => {
  const client = seed.clients[0];
  const programs = seed.programs.filter(program => program.clientId === client.id);
  const sessions = seed.sessionData.filter(row => row.clientId === client.id);
  const catalog = buildExplorerCatalog({ programs, sessions, asOfDate: seed.asOfDate });
  const behavior = catalog.items.find(entry => entry.category === 'BehaviorReduction');

  const next = selectExplorerTarget(behavior);
  assert.equal(next.category, 'Behavior');
  assert.deepEqual(next.selectedBehaviorIds, [behavior.targetId]);
  assert.equal(next.requestedTargetType, behavior.familyKey);
  assert.equal(next.analysisTargetId, behavior.targetId);
});

test('selectExplorerProgram restores all targets in a program to the chart', () => {
  const client = seed.clients[0];
  const programs = seed.programs.filter(program => program.clientId === client.id);
  const sessions = seed.sessionData.filter(row => row.clientId === client.id);
  const catalog = buildExplorerCatalog({ programs, sessions, asOfDate: seed.asOfDate });

  const skillGroup = catalog.groups.find(group => group.category === 'SkillAcquisition');
  const resetSkill = selectExplorerProgram(skillGroup);
  assert.equal(resetSkill.category, 'SkillAcquisition');
  assert.equal(resetSkill.selectedProgramId, skillGroup.id);
  // null means "auto-select the compatible measurement family" for the new program.
  assert.equal(resetSkill.selectedTargetIds, null);
  assert.equal(resetSkill.requestedTargetType, '');

  const behaviorGroup = catalog.groups.find(group => group.category === 'BehaviorReduction');
  const resetBehavior = selectExplorerProgram(behaviorGroup);
  assert.equal(resetBehavior.category, 'Behavior');
  assert.deepEqual(resetBehavior.selectedBehaviorIds, behaviorGroup.targets.map(item => item.targetId));
});

test('selection helpers reflect focused and plotted targets across skill and multi-behavior views', () => {
  const client = seed.clients[0];
  const programs = seed.programs.filter(program => program.clientId === client.id);
  const sessions = seed.sessionData.filter(row => row.clientId === client.id);
  const catalog = buildExplorerCatalog({ programs, sessions, asOfDate: seed.asOfDate });
  const skillGroup = catalog.groups.find(group => group.category === 'SkillAcquisition');
  const [firstSkill, secondSkill] = skillGroup.targets.filter(item => item.measurementType === 'TrialByTrial');

  const skillSelection = {
    activeCategoryTab: 'SkillAcquisition',
    selectedProgramId: skillGroup.id,
    selectedBehaviorIds: [],
    activeTargetType: 'TrialByTrial',
    visibleTargetIds: new Set([firstSkill.targetId, secondSkill.targetId]),
    analysisTargetId: secondSkill.targetId
  };
  assert.equal(isExplorerProgramSelected(skillGroup, skillSelection), true);
  assert.deepEqual(isExplorerTargetSelected(firstSkill, skillSelection), { plotted: true, focused: false });
  assert.deepEqual(isExplorerTargetSelected(secondSkill, skillSelection), { plotted: true, focused: true });

  const behaviors = catalog.items.filter(item => item.category === 'BehaviorReduction');
  const behaviorSelection = {
    activeCategoryTab: 'Behavior',
    selectedProgramId: '',
    selectedBehaviorIds: [behaviors[0].targetId, behaviors[1].targetId],
    activeTargetType: behaviors[0].measurementType,
    visibleTargetIds: new Set([behaviors[0].targetId, behaviors[1].targetId]),
    analysisTargetId: behaviors[1].targetId
  };
  assert.deepEqual(isExplorerTargetSelected(behaviors[0], behaviorSelection), { plotted: true, focused: false });
  assert.deepEqual(isExplorerTargetSelected(behaviors[1], behaviorSelection), { plotted: true, focused: true });
  assert.deepEqual(isExplorerTargetSelected(behaviors[2], behaviorSelection), { plotted: false, focused: false });
});

test('nextExplorerFocusIndex supports ArrowDown, ArrowUp, Home and End wraparound', () => {
  assert.equal(nextExplorerFocusIndex(0, 'ArrowDown', 5), 1);
  assert.equal(nextExplorerFocusIndex(4, 'ArrowDown', 5), 0);
  assert.equal(nextExplorerFocusIndex(0, 'ArrowUp', 5), 4);
  assert.equal(nextExplorerFocusIndex(3, 'Home', 5), 0);
  assert.equal(nextExplorerFocusIndex(1, 'End', 5), 4);
  assert.equal(nextExplorerFocusIndex(1, 'Tab', 5), null);
  assert.equal(nextExplorerFocusIndex(0, 'ArrowDown', 0), -1);
});

test('explorerSummaryCaption formats counts, scopes and active search queries clearly', () => {
  const groups = [{ id: 'p1', targets: [{}, {}] }, { id: 'p2', targets: [{}] }];
  assert.equal(explorerSummaryCaption({ filteredGroups: groups }), '3 targets across 2 programs');
  assert.equal(
    explorerSummaryCaption({ filteredGroups: [{ id: 'p1', targets: [{}] }], category: 'Behavior', query: 'aggression' }),
    '1 target across 1 program · behaviors matching “aggression”'
  );
});

test('every target across all 5 clients in clinicalSeed is accounted for in buildExplorerCatalog', () => {
  let totalPrograms = 0;
  let totalTargets = 0;
  for (const client of seed.clients) {
    const programs = seed.programs.filter(program => program.clientId === client.id);
    const sessions = seed.sessionData.filter(row => row.clientId === client.id);
    const catalog = buildExplorerCatalog({ programs, sessions, asOfDate: seed.asOfDate });
    totalPrograms += catalog.counts.programs;
    totalTargets += catalog.counts.targets;
  }
  assert.equal(totalPrograms, 37);
  assert.equal(totalTargets, 66);
});

// ---------------------------------------------------------------------------
// Selection hierarchy: Programs / Behaviors / ABC, measurement families and the
// rule that incompatible data types never share one analysis.
// ---------------------------------------------------------------------------
import {
  ANALYSIS_CATEGORIES, measurementFamilyFor, measurementFamilyOptions, defaultFamilyKey,
  isCompatibleWithFamily, pruneSelectionToFamily, selectionScopeCaption, familyChangeNotice,
  incompatibilityReason, familyKeyOf, familyTypeOf
} from '../frontend/src/utils/measurementFamilies.js';
import { toggleExplorerSelection } from '../frontend/src/utils/trendExplorer.js';

test('ANALYSIS_CATEGORIES exposes Programs, Behaviors and ABC Data with spoken names', () => {
  assert.deepEqual(ANALYSIS_CATEGORIES.map(entry => entry.value), ['Programs', 'Behaviors', 'Abc']);
  assert.deepEqual(ANALYSIS_CATEGORIES.map(entry => entry.label), ['Programs', 'Behaviors', 'ABC Data']);
  for (const option of ANALYSIS_CATEGORIES) assert.ok(option.accessibleLabel);
});

test('measurementFamilyFor separates interval schedules and trial-by-trial variants', () => {
  assert.equal(measurementFamilyFor({ type: 'Frequency' }).key, 'Frequency');
  assert.equal(measurementFamilyFor({ type: 'Frequency' }).label, 'Frequency');
  assert.equal(measurementFamilyFor({ type: 'IntervalData', intervalType: 'Partial' }).key, 'IntervalData|Partial');
  assert.equal(measurementFamilyFor({ type: 'IntervalData', intervalType: 'Whole' }).label, 'Interval data · Whole');
  assert.notEqual(
    measurementFamilyFor({ type: 'IntervalData', intervalType: 'Momentary' }).key,
    measurementFamilyFor({ type: 'IntervalData', intervalType: 'Whole' }).key
  );
  // Binary and prompt-based trials are the same percent-correct axis, so they share a family.
  assert.equal(measurementFamilyFor({ type: 'TrialByTrial' }).key, 'TrialByTrial');
  assert.equal(measurementFamilyFor({ type: 'TrialByTrial' }).variant, 'Binary');
  assert.equal(measurementFamilyFor({ type: 'TrialByTrial', promptHierarchyId: 'most-to-least' }).variant, 'Customized');
  assert.equal(familyTypeOf('IntervalData|Whole'), 'IntervalData');
  assert.equal(familyKeyOf({ measurementType: 'Duration' }), 'Duration');
});

test('measurementFamilyOptions orders skill types clinically and marks families without data', () => {
  const targets = [
    { id: 'a', type: 'Anecdotal' },
    { id: 'b', type: 'TrialByTrial' },
    { id: 'c', type: 'TrialByTrial', promptHierarchyId: 'verbal-fading' },
    { id: 'd', type: 'Frequency' },
    { id: 'e', type: 'IntervalData', intervalType: 'Partial' }
  ];
  const options = measurementFamilyOptions(targets, { typesWithData: new Set(['TrialByTrial', 'Frequency', 'Anecdotal']) });
  assert.deepEqual(options.map(option => option.type), ['TrialByTrial', 'Frequency', 'IntervalData', 'Anecdotal']);
  assert.equal(options[0].count, 2);
  assert.deepEqual(options[0].variants, ['Binary', 'Customized']);
  assert.equal(options[2].hasData, false);
  assert.equal(defaultFamilyKey(options), 'TrialByTrial');
  assert.equal(defaultFamilyKey(measurementFamilyOptions([{ id: 'x', type: 'Duration' }], { typesWithData: new Set() })), 'Duration');
});

test('behavior measurement options exclude skill-only data types', () => {
  const targets = [
    { id: 'a', type: 'Frequency' }, { id: 'b', type: 'Duration' },
    { id: 'c', type: 'IntervalData', intervalType: 'Whole' }, { id: 'd', type: 'TrialByTrial' }
  ];
  const options = measurementFamilyOptions(targets, { order: ['Frequency', 'Duration', 'IntervalData'] });
  assert.deepEqual(options.map(option => option.key), ['Frequency', 'Duration', 'IntervalData|Whole']);
});

test('incompatible targets can never be selected together and pruning explains what was dropped', () => {
  const targets = [
    { id: 'tbt-1', name: 'Receptive ID', type: 'TrialByTrial' },
    { id: 'tbt-2', name: 'Expressive ID', type: 'TrialByTrial' },
    { id: 'frq-1', name: 'Requests', type: 'Frequency' }
  ];
  const options = measurementFamilyOptions(targets);
  const family = 'TrialByTrial';

  let selected = new Set();
  for (const target of targets) selected = toggleExplorerSelection(selected, target, family);
  assert.deepEqual([...selected], ['tbt-1', 'tbt-2'], 'frequency target is never added to a trial-by-trial selection');

  const { kept, removed, removedLabels } = pruneSelectionToFamily(['tbt-1', 'tbt-2', 'frq-1'], targets, 'Frequency');
  assert.deepEqual(kept, ['frq-1']);
  assert.deepEqual(removed, ['tbt-1', 'tbt-2']);
  assert.deepEqual(removedLabels, ['Receptive ID', 'Expressive ID']);

  assert.equal(isCompatibleWithFamily({ type: 'Frequency' }, family), false);
  assert.equal(isCompatibleWithFamily({ type: 'TrialByTrial' }, family), true);
  assert.match(incompatibilityReason({ measurementType: 'Frequency' }, family, options), /can’t be plotted with trial by trial/i);

  const notice = familyChangeNotice({ familyLabel: 'Frequency', removedLabels });
  assert.match(notice, /2 incompatible targets were cleared/);
  assert.match(notice, /different data types can’t share one analysis/);
});

test('selectionScopeCaption states program, measurement type and plotted count', () => {
  assert.equal(
    selectionScopeCaption({ category: 'Programs', programName: 'Expressive Language', familyLabel: 'Trial by trial', selectedCount: 2, totalCount: 4 }),
    'Expressive Language · Trial by trial · 2 of 4 targets plotted'
  );
  assert.equal(
    selectionScopeCaption({ category: 'Behaviors', familyLabel: 'Frequency', selectedCount: 1, totalCount: 3 }),
    'Behavior reduction · Frequency · 1 of 3 targets plotted'
  );
});

test('explorer catalog entries carry their measurement family for compatibility checks', () => {
  const client = seed.clients[0];
  const programs = seed.programs.filter(program => program.clientId === client.id);
  const sessions = seed.sessionData.filter(row => row.clientId === client.id);
  const catalog = buildExplorerCatalog({ programs, sessions, asOfDate: seed.asOfDate });
  for (const entry of catalog.items) {
    assert.ok(entry.familyKey, `missing family key for ${entry.targetName}`);
    assert.ok(entry.familyLabel);
    assert.equal(entry.familyKey, measurementFamilyFor({ type: entry.measurementType }).key);
  }
});
