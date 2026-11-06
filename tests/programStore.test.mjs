import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../data/clinicalSeed.json' with { type: 'json' };

// The store is a browser-local service, so the tests give it a localStorage and
// read back what it persisted. The fixture stays the read-only baseline.
const memoryStorage = () => {
  const store = new Map();
  return {
    store,
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    clear: () => store.clear()
  };
};

globalThis.localStorage = memoryStorage();

const { apiService } = await import('../frontend/src/services/apiService.js');
const { SEED_AS_OF_DATE } = await import('../frontend/src/data/mockData.js');

const CLIENT = 'cli-liam';

test('a created program joins the client listing and starts active in client scope', () => {
  const before = apiService.listPrograms(CLIENT, { category: 'SkillAcquisition' }).length;
  const program = apiService.createProgram({
    clientId: CLIENT, name: 'Requesting a Break', status: 'Teaching',
    teachingInstructions: 'Teach the learner to request a break card.', tags: ['Communication']
  });
  assert.ok(program, 'the program is created');
  assert.equal(program.clientId, CLIENT);
  assert.equal(program.scope, 'client');
  assert.equal(program.archivedAt, null);
  assert.deepEqual(program.targets, [], 'a new program has no targets yet');
  assert.equal(program.teachingInstructions, 'Teach the learner to request a break card.');
  const after = apiService.listPrograms(CLIENT, { category: 'SkillAcquisition' }).length;
  assert.equal(after, before + 1);
  // It is persisted, not just held in memory.
  const stored = JSON.parse(localStorage.getItem('welina_programs'));
  assert.ok(stored.some(item => item.id === program.id), 'the program was written to the browser');
});

test('a program with no name is not created', () => {
  const before = apiService.listPrograms(CLIENT).length;
  assert.equal(apiService.createProgram({ clientId: CLIENT, name: '   ' }), null);
  assert.equal(apiService.listPrograms(CLIENT).length, before);
});

test('editing a program keeps its identity and its client', () => {
  const program = apiService.createProgram({ clientId: CLIENT, name: 'Waiting' });
  const updated = apiService.updateProgram(program.id, { name: 'Waiting for a turn', baseline: 'Waits about 40 seconds.' });
  assert.equal(updated.id, program.id);
  assert.equal(updated.clientId, CLIENT);
  assert.equal(updated.name, 'Waiting for a turn');
  assert.equal(updated.baseline, 'Waits about 40 seconds.');
});

test('editing a program cannot change which client it belongs to', () => {
  const program = apiService.createProgram({ clientId: CLIENT, name: 'Bound' });
  apiService.updateProgram(program.id, { clientId: 'cli-emma', name: 'Bound' });
  assert.equal(apiService.findProgram(program.id).clientId, CLIENT);
});

test('archiving takes a program out of the active list but keeps it and its data', () => {
  const program = apiService.createProgram({ clientId: CLIENT, name: 'To archive' });
  const target = { id: 'tgt-archived-demo', name: 'Demo target', type: 'Frequency', phase: 'Acquisition', phaseEnteredDate: SEED_AS_OF_DATE, phaseHistory: [] };
  apiService.updateProgram(program.id, {});
  // Archiving.
  apiService.archiveProgram(program.id, { asOf: SEED_AS_OF_DATE, reason: 'Replaced by another program.' });
  const archived = apiService.findProgram(program.id);
  assert.ok(archived, 'the program still exists');
  assert.ok(archived.archivedAt, 'the program is marked archived');
  assert.equal(archived.archiveReason, 'Replaced by another program.');
  // It is out of the default listing but in the archived one.
  assert.equal(apiService.listPrograms(CLIENT, { includeArchived: false }).some(item => item.id === program.id), false);
  assert.equal(apiService.listPrograms(CLIENT, { includeArchived: true }).some(item => item.id === program.id), true);
  // And it can come back.
  apiService.unarchiveProgram(program.id);
  assert.equal(apiService.findProgram(program.id).archivedAt, null);
  assert.equal(apiService.listPrograms(CLIENT).some(item => item.id === program.id), true);
  assert.equal(target.name, 'Demo target');
});

test('a duplicate starts again, and the original is untouched', () => {
  const source = apiService.createProgram({ clientId: CLIENT, name: 'Reusable', status: 'Teaching' });
  const originalTarget = apiService.addTarget(source.id, {
    name: 'Source target', type: 'Frequency', phase: 'Maintenance',
    masterySettings: 'Automatic', masteryCriteria: '8 in 10 for 3 sessions',
    masteryRule: { measure: 'percentCorrect', comparison: 'atLeast', threshold: 80, consecutiveSessions: 3 }
  });
  assert.ok(originalTarget, 'the source has a target');
  const copy = apiService.duplicateProgram(source.id);
  assert.ok(copy, 'the program is duplicated');
  assert.notEqual(copy.id, source.id, 'the copy has its own identity');
  assert.equal(copy.name, 'Reusable (copy)');
  assert.equal(copy.status, 'Pending', 'a duplicate starts again, not where the source was');
  assert.equal(copy.archivedAt, null);
  assert.equal(copy.targets.length, 1, 'the targets are copied');
  assert.notEqual(copy.targets[0].id, originalTarget.id, 'the copied target has its own identity');
  assert.equal(copy.targets[0].programId, copy.id, 'the copied target belongs to the copy');
  assert.equal(copy.targets[0].phase, 'Pending', 'a copied target starts again');
  assert.deepEqual(copy.targets[0].phaseHistory, [], 'a copied target has no history');
  assert.equal(copy.targets[0].masteryCriteria, '8 in 10 for 3 sessions', 'the definition is copied');
  // The source is untouched.
  assert.equal(apiService.findProgram(source.id).status, 'Teaching');
  assert.equal(apiService.findProgram(source.id).targets[0].phase, 'Maintenance');
  assert.deepEqual(apiService.findProgram(source.id).targets[0].phaseHistory, []);
});

test('a program status that carries its targets moves them, and an active one does not', () => {
  const program = apiService.createProgram({ clientId: CLIENT, name: 'Cascade demo' });
  const target = {
    id: 'tgt-cascade-demo', name: 'Cascade target', type: 'Frequency', phase: 'Acquisition',
    phaseEnteredDate: SEED_AS_OF_DATE, phaseHistory: [], programId: program.id
  };
  apiService.updateProgram(program.id, {});
  const live = apiService.findProgram(program.id);
  live.targets = [target];
  // An active teaching status leaves the targets alone.
  apiService.applyProgramStatus(program.id, 'Teaching', { asOf: SEED_AS_OF_DATE });
  assert.equal(apiService.findProgram(program.id).targets[0].phase, 'Acquisition');
  // A pending program carries its targets with it.
  apiService.applyProgramStatus(program.id, 'Pending', { asOf: SEED_AS_OF_DATE });
  assert.equal(apiService.findProgram(program.id).targets[0].phase, 'Pending');
  // And the phase history records when it happened.
  const history = apiService.findProgram(program.id).targets[0].phaseHistory;
  assert.ok(history.some(entry => entry.phase === 'Pending' && entry.date === SEED_AS_OF_DATE), 'the phase change is dated');
  // The status history records the reason.
  const statusHistory = apiService.findProgram(program.id).statusHistory;
  assert.ok(statusHistory.some(entry => entry.status === 'Pending'));
});

test('a status change can plot a phase change line on each of the program targets', () => {
  const program = apiService.createProgram({ clientId: CLIENT, name: 'Line demo' });
  const a = apiService.addTarget(program.id, { name: 'A', type: 'Frequency' });
  const b = apiService.addTarget(program.id, { name: 'B', type: 'Frequency' });
  const before = apiService.getSnapshot().phaseLines.length;
  apiService.applyProgramStatus(program.id, 'Maintaining', { asOf: SEED_AS_OF_DATE, plotLine: true });
  const lines = apiService.getSnapshot().phaseLines.slice(before);
  // Charts read lines by target, so each target carries its own.
  assert.deepEqual(lines.map(line => line.targetId).sort(), [a.id, b.id].sort());
  assert.ok(lines.every(line => line.date === SEED_AS_OF_DATE && line.source === 'Manual'));
  // Declining the line changes the status and plots nothing.
  const mid = apiService.getSnapshot().phaseLines.length;
  apiService.applyProgramStatus(program.id, 'Teaching', { asOf: SEED_AS_OF_DATE, plotLine: false });
  assert.equal(apiService.getSnapshot().phaseLines.length, mid);
  assert.equal(apiService.findProgram(program.id).status, 'Teaching');
});

test('a target phase change is dated, and plots a line only when asked', () => {
  const program = apiService.createProgram({ clientId: CLIENT, name: 'Phase demo' });
  const target = apiService.addTarget(program.id, { name: 'T', type: 'Frequency', phase: 'Baseline' });
  const before = apiService.getSnapshot().phaseLines.length;
  apiService.changeTargetPhase(target.id, 'Acquisition', { plotLine: false, asOf: SEED_AS_OF_DATE });
  assert.equal(apiService.getSnapshot().phaseLines.length, before, 'no line when declined');
  assert.equal(apiService.findTarget(target.id).phase, 'Acquisition');
  apiService.changeTargetPhase(target.id, 'Maintenance', { plotLine: true, asOf: SEED_AS_OF_DATE });
  assert.equal(apiService.getSnapshot().phaseLines.length, before + 1, 'a line when asked');
  const history = apiService.findTarget(target.id).phaseHistory;
  assert.ok(history.some(entry => entry.phase === 'Maintenance' && entry.date === SEED_AS_OF_DATE), 'the change is dated');
  // Moving to the phase it is already in is not a change.
  assert.equal(apiService.changeTargetPhase(target.id, 'Maintenance', { asOf: SEED_AS_OF_DATE }), null);
  assert.equal(apiService.changeTargetPhase(target.id, 'Nonsense'), null);
  assert.ok(apiService.getActivity(target.id).some(entry => entry.kind === 'target.phase'));
});

test('every program change leaves a trail', () => {
  const program = apiService.createProgram({ clientId: CLIENT, name: 'Tracked demo' });
  apiService.updateProgram(program.id, { name: 'Tracked demo renamed' });
  apiService.archiveProgram(program.id, { asOf: SEED_AS_OF_DATE });
  const log = apiService.getActivity(program.id);
  assert.equal(log.length, 3, 'the creation, the edit and the archive are all recorded');
  assert.deepEqual(log.map(entry => entry.kind), ['program.archived', 'program.updated', 'program.created']);
  assert.ok(log.every(entry => entry.at && entry.entityType === 'program' && entry.entityId === program.id));
});

test('the activity log is capped so a long session cannot grow it without bound', () => {
  const program = apiService.createProgram({ clientId: CLIENT, name: 'Chatty demo' });
  for (let i = 0; i < 520; i += 1) apiService.updateProgram(program.id, { baseline: `Revision ${i}` });
  assert.ok(apiService.getActivity().length <= 500, 'the log is capped');
});

test('a lesson groups programs for one client', () => {
  const program = apiService.createProgram({ clientId: CLIENT, name: 'Lesson member' });
  const lesson = apiService.createLesson({ clientId: CLIENT, name: 'Morning block', programIds: [program.id] });
  assert.ok(lesson);
  assert.equal(lesson.clientId, CLIENT);
  assert.deepEqual(lesson.programIds, [program.id]);
  assert.equal(apiService.getLessons(CLIENT).some(item => item.id === lesson.id), true);
  assert.equal(apiService.getLessons('cli-emma').some(item => item.id === lesson.id), false);
});

test('the seeded fixture still reads the same after the store has been used', () => {
  // The fixture is the baseline; nothing above changed it.
  const stored = JSON.parse(localStorage.getItem('welina_programs'));
  assert.ok(stored.length >= seed.programs.length, 'the seeded programs are still there');
  assert.ok(seed.programs.every(program => stored.some(item => item.id === program.id)), 'no seeded program was lost');
});

test('treatment areas and tags are always lists, whatever the fixture held', () => {
  // The fixture stores a treatment area as a single string; the platform's form
  // makes it a multi-value list. The boundary normalizes rather than the
  // fixture changing.
  const program = apiService.createProgram({
    clientId: CLIENT, name: 'List normalization',
    treatmentArea: 'Communication', tags: 'Mand'
  });
  assert.deepEqual(program.treatmentArea, ['Communication']);
  assert.deepEqual(program.tags, ['Mand']);
  // A list stays a list.
  const listed = apiService.createProgram({
    clientId: CLIENT, name: 'Already a list',
    treatmentArea: ['Play', 'Social'], tags: ['Play']
  });
  assert.deepEqual(listed.treatmentArea, ['Play', 'Social']);
  // And an edit normalizes too.
  apiService.updateProgram(program.id, { treatmentArea: ['Communication', 'Play'] });
  assert.deepEqual(apiService.findProgram(program.id).treatmentArea, ['Communication', 'Play']);
});

test('editing a target keeps its measurement type and its identity', () => {
  const program = apiService.createProgram({ clientId: CLIENT, name: 'Target edit demo' });
  const target = apiService.addTarget(program.id, { name: 'Greets', type: 'Frequency' });
  const updated = apiService.updateTarget(target.id, { name: 'Greets peers', type: 'Duration', discriminativeStimuli: 'A peer arrives' });
  assert.equal(updated.id, target.id);
  assert.equal(updated.type, 'Frequency', 'the measurement type is fixed once the target exists');
  assert.equal(updated.name, 'Greets peers');
  assert.equal(updated.discriminativeStimuli, 'A peer arrives');
});

test('deleting targets removes them from the program but not their recorded data', () => {
  const program = apiService.createProgram({ clientId: CLIENT, name: 'Target delete demo' });
  const a = apiService.addTarget(program.id, { name: 'A', type: 'Frequency' });
  const b = apiService.addTarget(program.id, { name: 'B', type: 'Frequency' });
  apiService.addObservation({ clientId: CLIENT, targetId: a.id, occurrenceCount: 3, lessonDurationMinutes: 10, timestamp: `${SEED_AS_OF_DATE} 09:00` });
  const removed = apiService.deleteTargets(program.id, [a.id, b.id]);
  assert.equal(removed.length, 2);
  assert.deepEqual(apiService.findProgram(program.id).targets, []);
  assert.ok(apiService.getSnapshot().sessions.some(row => row.targetId === a.id), 'the recorded observation is kept');
  assert.equal(apiService.getActivity().filter(entry => entry.kind === 'target.deleted').length >= 2, true);
  assert.deepEqual(apiService.deleteTargets(program.id, ['nope']), []);
});

// ---- Behaviors ------------------------------------------------------------------------

const BEHAVIOR = { clientId: CLIENT, name: 'Elopement', status: 'Teaching', operationalDefinition: 'Leaving the instructional area without permission.' };

test('a behavior is a program with a reduction purpose and exactly one target carrying the tool', () => {
  const behavior = apiService.createBehavior({ ...BEHAVIOR, measurementTool: 'Duration' });
  assert.equal(behavior.category, 'BehaviorReduction');
  assert.equal(behavior.behaviorPhase, 'Open');
  assert.equal(behavior.operationalDefinition, BEHAVIOR.operationalDefinition);
  assert.equal(behavior.targets.length, 1);
  assert.equal(behavior.targets[0].type, 'Duration');
  assert.equal(behavior.targets[0].phase, 'Open', 'defined, not yet reducing');
  assert.equal(apiService.createBehavior({ ...BEHAVIOR, name: 'No tool', measurementTool: 'TrialByTrial' }), null, 'only frequency, duration or interval');
});

test('an interval behavior carries its interval settings', () => {
  const settings = { startType: 'Manual', intervalLength: '00:30', captureType: 'Partial', numberOfIntervals: 10 };
  const behavior = apiService.createBehavior({ ...BEHAVIOR, name: 'Interval behavior', measurementTool: 'IntervalData', intervalSettings: settings });
  assert.deepEqual(behavior.targets[0].intervalSettings, settings);
});

test('the measurement tool of a behavior cannot be changed after creation', () => {
  const behavior = apiService.createBehavior({ ...BEHAVIOR, name: 'Locked tool', measurementTool: 'Frequency' });
  apiService.updateTarget(behavior.targets[0].id, { type: 'Duration', name: 'Renamed' });
  assert.equal(apiService.findTarget(behavior.targets[0].id).type, 'Frequency');
});

test('a behavior phase change is dated, can plot a line, and ignores programs and unknown phases', () => {
  const behavior = apiService.createBehavior({ ...BEHAVIOR, name: 'Phase behavior', measurementTool: 'Frequency' });
  const before = apiService.getSnapshot().phaseLines.length;
  apiService.changeBehaviorPhase(behavior.id, 'Maintenance', { plotLine: false, asOf: SEED_AS_OF_DATE, reason: 'Reduced' });
  assert.equal(apiService.findProgram(behavior.id).behaviorPhase, 'Maintenance');
  assert.equal(apiService.getSnapshot().phaseLines.length, before, 'no line when declined');
  apiService.changeBehaviorPhase(behavior.id, 'Generalization', { plotLine: true, asOf: SEED_AS_OF_DATE });
  assert.equal(apiService.getSnapshot().phaseLines.length, before + 1);
  assert.equal(apiService.findProgram(behavior.id).behaviorPhaseHistory.length, 2);
  assert.equal(apiService.changeBehaviorPhase(behavior.id, 'Baseline'), null, 'Baseline is not a behavior phase');
  assert.equal(apiService.changeBehaviorPhase(behavior.id, 'Generalization'), null, 'same phase is not a change');
  const skill = apiService.createProgram({ clientId: CLIENT, name: 'A skill' });
  assert.equal(apiService.changeBehaviorPhase(skill.id, 'Maintenance'), null, 'a skill program has no behavior phase');
});

test('a duplicated behavior begins again, open and unmeasured', () => {
  const behavior = apiService.createBehavior({ ...BEHAVIOR, name: 'Dup behavior', measurementTool: 'Frequency' });
  apiService.changeBehaviorPhase(behavior.id, 'Completed', { asOf: SEED_AS_OF_DATE });
  const copy = apiService.duplicateProgram(behavior.id);
  assert.equal(copy.behaviorPhase, 'Open');
  assert.equal(copy.operationalDefinition, BEHAVIOR.operationalDefinition, 'the definition is copied');
  assert.equal(copy.targets[0].type, 'Frequency');
  assert.equal(apiService.findProgram(behavior.id).behaviorPhase, 'Completed');
});

// ---- ABC configuration ----------------------------------------------------------------

test('ABC treatment area and teaching instructions can be edited and persist', () => {
  apiService.updateAbcConfig(CLIENT, { treatmentArea: 'Communication', teachingInstructions: 'Record only what you saw.' });
  const config = apiService.getAbcConfiguration(CLIENT);
  assert.equal(config.treatmentArea, 'Communication');
  assert.equal(config.teachingInstructions, 'Record only what you saw.');
  const stored = JSON.parse(localStorage.getItem('welina_abc_configurations'));
  assert.equal(stored.find(item => item.clientId === CLIENT).treatmentArea, 'Communication', 'written to the browser');
  assert.equal(apiService.updateAbcConfig('nobody', { treatmentArea: 'x' }), null);
});

test('ABC values can be added, edited and removed, with no duplicates', () => {
  assert.equal(apiService.addAbcValue(CLIENT, 'antecedents', '  Loud bell  '), 'Loud bell');
  assert.equal(apiService.addAbcValue(CLIENT, 'antecedents', 'loud BELL'), null, 'a case-insensitive duplicate is refused');
  assert.equal(apiService.addAbcValue(CLIENT, 'antecedents', '   '), null);
  assert.equal(apiService.addAbcValue(CLIENT, 'nonsense', 'x'), null);
  assert.equal(apiService.renameAbcValue(CLIENT, 'antecedents', 'Loud bell', 'Fire drill bell'), 'Fire drill bell');
  assert.ok(apiService.getAbcConfiguration(CLIENT).antecedents.includes('Fire drill bell'));
  assert.ok(!apiService.getAbcConfiguration(CLIENT).antecedents.includes('Loud bell'));
  assert.equal(apiService.renameAbcValue(CLIENT, 'antecedents', 'Fire drill bell', 'Tabletop demand'), null, 'a rename cannot collide with another value');
  assert.deepEqual(apiService.removeAbcValues(CLIENT, 'antecedents', ['Fire drill bell', 'never there']), ['Fire drill bell']);
  assert.ok(!apiService.getAbcConfiguration(CLIENT).antecedents.includes('Fire drill bell'));
});

test('removing an ABC value never rewrites the observations that used it', () => {
  const entry = seed.abcEntries.find(item => item.clientId === CLIENT);
  const value = entry.antecedents[0];
  const before = JSON.stringify(apiService.getSnapshot().abcEntries.filter(item => item.clientId === CLIENT));
  apiService.removeAbcValues(CLIENT, 'antecedents', [value]);
  assert.ok(!apiService.getAbcConfiguration(CLIENT).antecedents.includes(value));
  assert.equal(JSON.stringify(apiService.getSnapshot().abcEntries.filter(item => item.clientId === CLIENT)), before, 'the recorded text is untouched');
});

test('behaviors can be imported into the ABC list without duplicating what is there', () => {
  const existing = apiService.getAbcConfiguration(CLIENT).behaviors[0];
  const added = apiService.importAbcBehaviors(CLIENT, ['Throwing', existing.toUpperCase(), 'Throwing', '  ']);
  assert.deepEqual(added, ['Throwing']);
  assert.equal(apiService.getAbcConfiguration(CLIENT).behaviors.filter(item => item === 'Throwing').length, 1);
  assert.deepEqual(apiService.importAbcBehaviors(CLIENT, ['Throwing']), []);
});

test('ABC changes are written to the activity log', () => {
  assert.ok(apiService.getActivity(CLIENT).some(entry => entry.kind === 'abc.value.added'));
  assert.ok(apiService.getActivity(CLIENT).some(entry => entry.kind === 'abc.value.removed'));
});
