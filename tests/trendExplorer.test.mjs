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

test('selectExplorerTarget isolates a clicked skill target and switches to its measurement tab', () => {
  const client = seed.clients[0];
  const programs = seed.programs.filter(program => program.clientId === client.id);
  const sessions = seed.sessionData.filter(row => row.clientId === client.id);
  const catalog = buildExplorerCatalog({ programs, sessions, asOfDate: seed.asOfDate });
  const target = catalog.items.find(entry => entry.targetName === 'Label Community Helpers');

  const next = selectExplorerTarget(target, programs);
  assert.equal(next.category, 'SkillAcquisition');
  assert.equal(next.selectedProgramId, target.programId);
  assert.equal(next.requestedTargetType, target.measurementType);
  assert.equal(next.analysisTargetId, target.targetId);
  assert.equal(next.annotationTargetId, target.targetId);
  assert.equal(next.hiddenTargetIds.has(target.targetId), false);
  const program = programs.find(item => item.id === target.programId);
  assert.equal(next.hiddenTargetIds.size, program.targets.length - 1);
});

test('selectExplorerTarget opens a behavior reduction target directly in one click', () => {
  const client = seed.clients[0];
  const programs = seed.programs.filter(program => program.clientId === client.id);
  const sessions = seed.sessionData.filter(row => row.clientId === client.id);
  const catalog = buildExplorerCatalog({ programs, sessions, asOfDate: seed.asOfDate });
  const behavior = catalog.items.find(entry => entry.category === 'BehaviorReduction');

  const next = selectExplorerTarget(behavior, programs);
  assert.equal(next.category, 'Behavior');
  assert.deepEqual(next.selectedBehaviorIds, [behavior.targetId]);
  assert.equal(next.requestedTargetType, behavior.measurementType);
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
  assert.equal(resetSkill.hiddenTargetIds.size, 0);

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
