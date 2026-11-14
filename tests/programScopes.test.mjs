import test from 'node:test';
import assert from 'node:assert/strict';

// The store is a browser-local service, so the tests give it a localStorage and read back
// what it persisted. These cases cover the three scopes, the copy between them, the
// clearing of client-specific text, the hand-set target order and the bulk edits.
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
const { PUBLIC_PROGRAMS } = await import('../frontend/src/data/publicLibrary.js');
const {
  WIPED_FIELD_LABELS, describeMastery, filterOptions, filterPrograms, historyToCsv, lessonsByProgram, moveInOrder,
  orderedTargets, prepareCopy, statusLabel, validateBehavior, validateProgram
} = await import('../frontend/src/utils/programManagement.js');
const { describeBehaviorChange, weeklyBehaviorSeries } = await import('../frontend/src/utils/behaviorSummary.js');

const CLIENT = 'cli-liam';
const OTHER = 'cli-emma';

function clientProgram(name = 'Scope source') {
  const program = apiService.createProgram({
    clientId: CLIENT, name, status: 'Teaching', treatmentArea: ['Communication'], tags: ['Mand'],
    baseline: 'Asked twice in April.', programObjective: 'Ask for help.', teachingInstructions: 'Wait five seconds, then prompt.'
  });
  apiService.addTarget(program.id, {
    name: 'Asks for help', type: 'Frequency', phase: 'Maintenance', targetInstructions: 'Use the red card.',
    masteryRule: { measure: 'count', comparison: 'atLeast', threshold: 3, consecutiveSessions: 3 },
    manualMastery: { achieved: true, decidedOn: SEED_AS_OF_DATE, note: 'Mastered in the clinic' }
  });
  return apiService.findProgram(program.id);
}

test('an organization program lives in the library, never in a client list or the analytics snapshot', () => {
  const clientsBefore = apiService.listPrograms(CLIENT).length;
  const program = apiService.createProgram({ scope: 'organization', name: 'Library only', status: 'Pending' });
  assert.equal(program.scope, 'organization');
  assert.equal(program.clientId, null);
  assert.equal(apiService.listPrograms(CLIENT).length, clientsBefore, 'no client list gains it');
  assert.ok(apiService.listLibrary('organization').some(item => item.id === program.id));
  assert.equal(apiService.getSnapshot().programs.some(item => item.id === program.id), false, 'the analytics never read it');
  assert.ok(apiService.getSnapshot().orgPrograms.some(item => item.id === program.id));
  assert.ok(JSON.parse(localStorage.getItem('welina_org_programs')).some(item => item.id === program.id), 'saved in the browser');
  // A client program still needs its client.
  assert.equal(apiService.createProgram({ name: 'No client' }), null);
});

test('a library program takes the same edits, targets and cascade as a client program', () => {
  const program = apiService.createProgram({ scope: 'organization', name: 'Library edit', status: 'Teaching' });
  const target = apiService.addTarget(program.id, { name: 'Library target', type: 'Frequency', phase: 'Acquisition' });
  assert.equal(apiService.findTarget(target.id).name, 'Library target');
  apiService.applyProgramStatus(program.id, 'OnHold', { asOf: SEED_AS_OF_DATE });
  assert.equal(apiService.findProgram(program.id).targets[0].phase, 'OnHold', 'the status carries the target');
  assert.equal(apiService.findProgram(program.id).statusHistory.at(-1).status, 'OnHold');
  const copy = apiService.duplicateProgram(program.id);
  assert.equal(copy.scope, 'organization', 'a duplicate stays in the library');
  assert.equal(copy.clientId, null);
  apiService.archiveProgram(program.id);
  assert.equal(apiService.listLibrary('organization').some(item => item.id === program.id), false);
  assert.equal(apiService.listLibrary('organization', { includeArchived: true }).some(item => item.id === program.id), true);
});

test('Add to organization clears client-specific text, starts the copy again and leaves the source alone', () => {
  const source = clientProgram('Wipeout source');
  const [made] = apiService.copyToOrganization([source.id], { asOf: SEED_AS_OF_DATE });
  const copy = made.program;
  assert.equal(copy.scope, 'organization');
  assert.equal(copy.clientId, null);
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.teachingInstructions, '');
  assert.equal(copy.programObjective, '');
  assert.equal(copy.baseline, '');
  assert.equal(copy.targets[0].targetInstructions, '', 'target instructions are cleared too');
  assert.deepEqual(made.cleared, WIPED_FIELD_LABELS, 'each cleared field is reported, in order');
  // What defines the work is kept; what describes this learner's progress is not.
  assert.equal(copy.name, source.name);
  assert.deepEqual(copy.tags, ['Mand']);
  assert.deepEqual(copy.treatmentArea, ['Communication']);
  assert.equal(copy.targets[0].masteryRule.threshold, 3, 'the mastery rule is kept');
  assert.equal(copy.targets[0].manualMastery, undefined, 'a decision about one learner is not shared');
  assert.equal(copy.status, 'Pending');
  assert.equal(copy.targets[0].phase, 'Pending');
  assert.deepEqual(copy.targets[0].phaseHistory, []);
  assert.notEqual(copy.targets[0].id, source.targets[0].id);
  assert.equal(copy.targets[0].programId, copy.id);
  // The source is untouched.
  const kept = apiService.findProgram(source.id);
  assert.equal(kept.teachingInstructions, 'Wait five seconds, then prompt.');
  assert.equal(kept.baseline, 'Asked twice in April.');
  assert.equal(kept.targets[0].targetInstructions, 'Use the red card.');
  assert.equal(kept.targets[0].phase, 'Maintenance');
  // The clearing is audited against the copy.
  const trail = apiService.getActivity(copy.id).map(entry => entry.kind);
  assert.ok(trail.includes('program.copied'));
  assert.ok(trail.includes('program.wipeout'));
  assert.match(apiService.getActivity(copy.id).find(entry => entry.kind === 'program.wipeout').summary, /Teaching instructions, Program objective, Baseline, Target instructions/);
  // And it persists.
  assert.ok(JSON.parse(localStorage.getItem('welina_org_programs')).some(item => item.id === copy.id));
});

test('the clearing is audited even when there was nothing to clear', () => {
  const bare = apiService.createProgram({ clientId: CLIENT, name: 'Nothing written', status: 'Teaching' });
  const [made] = apiService.copyToOrganization([bare.id]);
  assert.deepEqual(made.cleared, []);
  assert.match(apiService.getActivity(made.program.id).find(entry => entry.kind === 'program.wipeout').summary, /None was present/);
});

test('Add to organization works for behaviors and skips what is already in the library', () => {
  const behavior = apiService.createBehavior({
    clientId: CLIENT, name: 'Shared behavior', status: 'Teaching', measurementTool: 'Duration',
    operationalDefinition: 'Leaving the area.', programObjective: 'Stay in the area.', baseline: 'Four minutes per session.'
  });
  const [made] = apiService.copyToOrganization([behavior.id]);
  assert.equal(made.program.category, 'BehaviorReduction');
  assert.equal(made.program.behaviorPhase, 'Open', 'a library behavior starts open');
  assert.equal(made.program.operationalDefinition, 'Leaving the area.', 'the definition is shared, because it is not about one learner');
  assert.equal(made.program.baseline, '');
  assert.equal(made.program.targets[0].phase, 'Open');
  assert.deepEqual(apiService.copyToOrganization([made.program.id]), [], 'a library program is not copied into the library again');
  assert.deepEqual(apiService.copyToOrganization(['nope']), []);
});

test('Add to client gives each chosen client its own copy and clears nothing', () => {
  const library = apiService.createProgram({
    scope: 'organization', name: 'Library to clients', status: 'Teaching', teachingInstructions: 'Kept as written.', programObjective: 'Kept too.'
  });
  apiService.addTarget(library.id, { name: 'Library step', type: 'Frequency', targetInstructions: 'Also kept.' });
  const before = apiService.listPrograms(OTHER).length;
  const made = apiService.copyToClients([library.id], [OTHER, CLIENT, OTHER, 'cli-nobody']);
  assert.equal(made.length, 2, 'one copy per known client, however often it is chosen');
  assert.deepEqual(made.map(copy => copy.clientId).sort(), [CLIENT, OTHER].sort());
  assert.equal(new Set(made.map(copy => copy.id)).size, 2, 'each copy has its own identity');
  assert.equal(apiService.listPrograms(OTHER).length, before + 1);
  const copy = made.find(item => item.clientId === OTHER);
  assert.equal(copy.scope, 'client');
  assert.equal(copy.status, 'Pending');
  assert.equal(copy.teachingInstructions, 'Kept as written.', 'moving into a client clears nothing');
  assert.equal(copy.targets[0].targetInstructions, 'Also kept.');
  assert.equal(copy.targets[0].phase, 'Pending');
  assert.equal(apiService.getActivity().filter(entry => entry.kind === 'program.wipeout' && entry.entityId === copy.id).length, 0, 'no clearing, so no wipeout entry');
  // A copy is independent of the library.
  apiService.updateProgram(copy.id, { name: 'Changed for one client' });
  assert.equal(apiService.findProgram(library.id).name, 'Library to clients');
  // A client program is not a library source.
  assert.deepEqual(apiService.copyToClients([copy.id], [CLIENT]), []);
});

test('the public library is fixed, complete, and free of learner detail', () => {
  assert.ok(PUBLIC_PROGRAMS.length >= 6);
  assert.ok(PUBLIC_PROGRAMS.some(program => program.category === 'SkillAcquisition'));
  assert.ok(PUBLIC_PROGRAMS.some(program => program.category === 'BehaviorReduction'));
  assert.equal(apiService.listLibrary('public').length, PUBLIC_PROGRAMS.length);
  const ids = new Set();
  for (const program of PUBLIC_PROGRAMS) {
    assert.equal(program.scope, 'public');
    assert.equal(program.clientId, null);
    assert.ok(!ids.has(program.id), 'program ids are unique');
    ids.add(program.id);
    assert.ok(program.targets.length > 0, `${program.name} has targets`);
    for (const target of program.targets) {
      assert.ok(!ids.has(target.id), 'target ids are unique');
      ids.add(target.id);
      assert.equal(target.programId, program.id);
      assert.ok(['Pending', 'Open'].includes(target.phase));
    }
    if (program.category === 'BehaviorReduction') {
      assert.ok(program.operationalDefinition.length > 40, `${program.name} defines the behavior`);
      assert.equal(program.targets.length, 1, 'a behavior carries one target');
    }
  }
  // Every library entry passes the platform's own checks, so a copy is usable at once.
  for (const program of PUBLIC_PROGRAMS.filter(item => item.category === 'BehaviorReduction')) {
    assert.deepEqual(validateBehavior({
      ...program, measurementTool: program.targets[0].type, intervalSettings: program.targets[0].intervalSettings, clientId: null
    }, { scope: 'organization' }), {}, `${program.name} is a valid behavior`);
  }
});

test('a public program can be added to a client or to the library, and the public list never changes', () => {
  const source = PUBLIC_PROGRAMS.find(program => program.category === 'SkillAcquisition');
  const snapshot = JSON.stringify(PUBLIC_PROGRAMS);
  const [toLibrary] = apiService.copyToOrganization([source.id]);
  assert.equal(toLibrary.program.name, source.name);
  assert.equal(toLibrary.program.teachingInstructions, source.teachingInstructions, 'public text is not client text, so it is kept');
  assert.equal(apiService.getActivity(toLibrary.program.id).some(entry => entry.kind === 'program.wipeout'), false);
  const [toClient] = apiService.copyToClients([source.id], [CLIENT]);
  assert.equal(toClient.clientId, CLIENT);
  assert.equal(toClient.targets.length, source.targets.length);
  assert.equal(JSON.stringify(PUBLIC_PROGRAMS), snapshot, 'the public library is read only');
});

test('status and behavior phase move only through their own actions', () => {
  const program = apiService.createProgram({ clientId: CLIENT, name: 'Guarded status', status: 'Teaching' });
  apiService.updateProgram(program.id, { status: 'Completed', behaviorPhase: 'Maintenance', scope: 'public', clientId: OTHER });
  const after = apiService.findProgram(program.id);
  assert.equal(after.status, 'Teaching', 'an edit cannot skip the dated, cascading status change');
  assert.equal(after.behaviorPhase, undefined);
  assert.equal(after.scope, 'client');
  assert.equal(after.clientId, CLIENT);
});

test('targets can be ordered by hand, keep that order, and reset to the default', () => {
  const program = apiService.createProgram({ clientId: CLIENT, name: 'Ordered' });
  const names = ['Charlie', 'Alpha', 'Bravo'];
  const targets = names.map(name => apiService.addTarget(program.id, { name, type: 'Frequency', phase: 'Acquisition' }));
  const byName = Object.fromEntries(targets.map(target => [target.name, target.id]));
  const default_ = () => orderedTargets(apiService.findProgram(program.id)).map(target => target.name);
  assert.deepEqual(default_(), ['Alpha', 'Bravo', 'Charlie'], 'phase, then alphabetical');

  apiService.reorderTargets(program.id, [byName.Charlie, byName.Alpha, byName.Bravo]);
  assert.deepEqual(default_(), ['Charlie', 'Alpha', 'Bravo']);
  // A phase change does not disturb a hand-set order.
  apiService.changeTargetPhase(byName.Alpha, 'Maintenance', { asOf: SEED_AS_OF_DATE });
  assert.deepEqual(default_(), ['Charlie', 'Alpha', 'Bravo']);
  // A target added later joins the end.
  apiService.addTarget(program.id, { name: 'Aardvark', type: 'Frequency', phase: 'Acquisition' });
  assert.deepEqual(default_(), ['Charlie', 'Alpha', 'Bravo', 'Aardvark']);
  // An order can never lose a target, and unknown ids are ignored.
  apiService.reorderTargets(program.id, [byName.Bravo, 'ghost']);
  assert.equal(default_().length, 4);
  assert.equal(default_()[0], 'Bravo');
  // Deleting a target prunes it from the order.
  apiService.deleteTargets(program.id, [byName.Bravo]);
  assert.equal(apiService.findProgram(program.id).targetOrder.includes(byName.Bravo), false);
  // Reset returns the system order.
  apiService.resetTargetOrder(program.id);
  assert.equal(apiService.findProgram(program.id).targetOrder, undefined);
  assert.deepEqual(default_(), ['Aardvark', 'Charlie', 'Alpha'], 'default again: acquisition first, then maintenance');
  assert.equal(apiService.resetTargetOrder(program.id), null, 'there is nothing to reset');
  assert.equal(apiService.reorderTargets('nope', []), null);
});

test('a copy keeps the hand-set order of the targets', () => {
  const source = apiService.createProgram({ clientId: CLIENT, name: 'Order carried' });
  const first = apiService.addTarget(source.id, { name: 'Zed', type: 'Frequency' });
  const second = apiService.addTarget(source.id, { name: 'Ann', type: 'Frequency' });
  apiService.reorderTargets(source.id, [first.id, second.id]);
  const copy = apiService.duplicateProgram(source.id);
  assert.deepEqual(orderedTargets(copy).map(target => target.name), ['Zed', 'Ann']);
  assert.ok(copy.targetOrder.every(id => copy.targets.some(target => target.id === id)), 'the order points at the copy’s own targets');
});

test('several targets can be edited together as one action with one history entry', () => {
  const program = apiService.createProgram({ clientId: CLIENT, name: 'Bulk edit' });
  const targets = ['One', 'Two', 'Three'].map(name => apiService.addTarget(program.id, { name, type: 'Frequency', phase: 'Baseline' }));
  const ids = targets.slice(0, 2).map(target => target.id);
  const before = apiService.getActivity(program.id).length;
  const changed = apiService.updateTargets(program.id, ids, { discriminativeStimuli: 'A new cue', ignored: 'x', targetInstructions: 'Wait.' });
  assert.equal(changed.length, 2);
  const live = apiService.findProgram(program.id).targets;
  assert.equal(live[0].discriminativeStimuli, 'A new cue');
  assert.equal(live[1].targetInstructions, 'Wait.');
  assert.equal(live[2].discriminativeStimuli, '', 'a target that was not chosen is untouched');
  assert.equal(live[0].ignored, undefined, 'only the editable fields change');
  assert.equal(apiService.getActivity(program.id).length, before + 1, 'one action, one history entry');
  assert.deepEqual(apiService.updateTargets(program.id, ids, {}), []);

  const lines = apiService.getSnapshot().phaseLines.length;
  const moved = apiService.changeTargetPhases(program.id, ids, 'Acquisition', { plotLine: true, asOf: SEED_AS_OF_DATE });
  assert.equal(moved.length, 2);
  assert.equal(apiService.findProgram(program.id).targets[0].phase, 'Acquisition');
  assert.equal(apiService.findProgram(program.id).targets[2].phase, 'Baseline');
  assert.equal(apiService.getSnapshot().phaseLines.length, lines + 2, 'one line per target when plotted');
  assert.equal(apiService.getActivity(program.id).length, before + 2);
  assert.deepEqual(apiService.changeTargetPhases(program.id, ids, 'Acquisition'), [], 'targets already there are not changed again');
  const noLine = apiService.getSnapshot().phaseLines.length;
  apiService.changeTargetPhases(program.id, ids, 'Maintenance', { plotLine: false });
  assert.equal(apiService.getSnapshot().phaseLines.length, noLine, 'No plots nothing');
  // A library program has no charts, so it never plots.
  const library = apiService.createProgram({ scope: 'organization', name: 'Library bulk' });
  const libraryTarget = apiService.addTarget(library.id, { name: 'L', type: 'Frequency' });
  const linesBefore = apiService.getSnapshot().phaseLines.length;
  apiService.changeTargetPhases(library.id, [libraryTarget.id], 'Acquisition', { plotLine: true });
  assert.equal(apiService.getSnapshot().phaseLines.length, linesBefore);
});

test('a lesson note can plan more targets, including behaviors, until it is approved', () => {
  const skill = apiService.createProgram({ clientId: CLIENT, name: 'Note skill', status: 'Teaching' });
  const skillTarget = apiService.addTarget(skill.id, { name: 'Skill step', type: 'Frequency' });
  const behavior = apiService.createBehavior({
    clientId: CLIENT, name: 'Note behavior', status: 'Teaching', measurementTool: 'Frequency',
    operationalDefinition: 'Calling out.', programObjective: 'Raise a hand.'
  });
  const lesson = apiService.createLesson({ clientId: CLIENT, name: 'Note lesson', programIds: [skill.id] });
  const note = apiService.createLessonNote({ clientId: CLIENT, lessonId: lesson.id, date: SEED_AS_OF_DATE, title: 'Plan more' });
  assert.deepEqual(note.targetIds, [skillTarget.id]);

  const added = apiService.addTargetsToLessonNote(note.id, [behavior.targets[0].id, skillTarget.id, 'ghost']);
  assert.equal(added.length, 1, 'only the new, known target is added; nothing is planned twice');
  const live = apiService.getLessonNotes(CLIENT).find(item => item.id === note.id);
  assert.ok(live.targetIds.includes(behavior.targets[0].id));
  assert.ok(live.programIds.includes(behavior.id), 'the behavior comes along with its target');
  assert.equal(apiService.addTargetsToLessonNote(note.id, [behavior.targets[0].id]).length, 0);
  // Another client's target is refused.
  const foreign = apiService.listPrograms(OTHER)[0].targets[0].id;
  assert.equal(apiService.addTargetsToLessonNote(note.id, [foreign]).length, 0);
  // Data can be recorded against the behavior through the note.
  const points = apiService.recordIntoLessonNote(note.id, [{ targetId: behavior.targets[0].id, timestamp: `${SEED_AS_OF_DATE}T09:00:00`, value: 2, occurrenceCount: 2 }]);
  assert.equal(points.length, 1);
  // An approved note takes no more targets.
  apiService.setLessonNoteStatus(note.id, 'Unapproved');
  apiService.setLessonNoteStatus(note.id, 'Approved');
  const other = apiService.createProgram({ clientId: CLIENT, name: 'Late addition' });
  const late = apiService.addTarget(other.id, { name: 'Late', type: 'Frequency' });
  assert.equal(apiService.addTargetsToLessonNote(note.id, [late.id]).length, 0);
});

test('an ABC observation can be removed from an editable note, and the removal is written down', () => {
  const lesson = apiService.createLesson({ clientId: CLIENT, name: 'ABC removal lesson', programIds: [] });
  const note = apiService.createLessonNote({ clientId: CLIENT, lessonId: lesson.id, date: SEED_AS_OF_DATE, title: 'ABC removal' });
  const entry = apiService.recordAbcIntoLessonNote(note.id, { antecedents: ['Tabletop demand'], timestamp: `${SEED_AS_OF_DATE}T10:15:00` });
  assert.equal(entry.timestamp, `${SEED_AS_OF_DATE}T10:15:00`, 'the time the clinician chose is the time saved');
  assert.equal(apiService.removeAbcFromLessonNote(note.id, 'not-an-entry'), null);
  assert.ok(apiService.removeAbcFromLessonNote(note.id, entry.id));
  assert.equal(apiService.getSnapshot().abcEntries.some(item => item.id === entry.id), false);
  assert.ok(apiService.getActivity(note.id).some(item => item.kind === 'note.abc.removed'));
  const kept = apiService.recordAbcIntoLessonNote(note.id, { behaviors: ['Elopement / Leaving Area'] });
  apiService.setLessonNoteStatus(note.id, 'Unapproved');
  apiService.setLessonNoteStatus(note.id, 'Approved');
  assert.equal(apiService.removeAbcFromLessonNote(note.id, kept.id), null, 'an approved note is locked');
});

test('resetting the demo data empties the organization library', () => {
  apiService.createProgram({ scope: 'organization', name: 'Gone after reset' });
  assert.ok(apiService.getSnapshot().orgPrograms.length > 0);
  apiService.resetToDefault();
  assert.deepEqual(apiService.getSnapshot().orgPrograms, []);
  assert.deepEqual(JSON.parse(localStorage.getItem('welina_org_programs')), []);
});

// ---- Pure rules ---------------------------------------------------------------------------

test('the organization library does not require client-specific teaching instructions', () => {
  const values = { clientId: null, name: 'Library program', status: 'Pending' };
  assert.equal(validateProgram(values, { scope: 'organization' }).teachingInstructions, undefined);
  assert.ok(validateProgram(values, { scope: 'client' }).teachingInstructions, 'a client program still needs them');
});

test('a behavior needs a treatment area and an objective as well as its definition', () => {
  const base = { name: 'Biting', status: 'Teaching', operationalDefinition: 'Teeth on skin.', behaviorPhase: 'Open', measurementTool: 'Frequency' };
  const errors = validateBehavior(base);
  assert.ok(errors.treatmentArea, 'the treatment area is required');
  assert.ok(errors.programObjective, 'the objective is required');
  assert.deepEqual(validateBehavior({ ...base, treatmentArea: ['Safety'], programObjective: 'Reduce biting.' }), {});
});

test('filters combine across groups, match any choice within a group, and count what they would leave', () => {
  const mk = (id, status, tags) => ({ id, name: id, category: 'SkillAcquisition', status, tags });
  const programs = [mk('a', 'Teaching', ['Play']), mk('b', 'Teaching', ['Social']), mk('c', 'Pending', ['Play', 'Social']), mk('d', 'Completed', [])];
  const lessons = [{ id: 'L1', name: 'Morning', programIds: ['a', 'c'] }, { id: 'L2', name: 'Noon', programIds: ['b'] }];
  const memberships = lessonsByProgram(lessons);
  const ids = filters => filterPrograms(programs, { ...filters, memberships }).map(program => program.id);
  assert.deepEqual(ids({}), ['a', 'b', 'c', 'd'], 'no choice, no filtering');
  assert.deepEqual(ids({ statuses: ['Teaching', 'Pending'] }), ['a', 'b', 'c'], 'any status in the group');
  assert.deepEqual(ids({ statuses: ['Teaching'], tags: ['Play'] }), ['a'], 'groups combine');
  assert.deepEqual(ids({ tags: ['Play', 'Social'] }), ['a', 'b', 'c']);
  assert.deepEqual(ids({ lessonIds: ['L1'] }), ['a', 'c']);
  assert.deepEqual(ids({ statuses: ['Teaching'], lessonIds: ['L1'], tags: ['Play'] }), ['a']);
  assert.deepEqual(ids({ query: 'morning' }), ['a', 'c'], 'search still finds a lesson by name');
  assert.deepEqual(ids({ statuses: ['Discontinued'] }), []);
  const options = filterOptions(programs, { memberships, lessons });
  assert.equal(options.statuses.find(option => option.value === 'Teaching').count, 2);
  assert.equal(options.statuses.find(option => option.value === 'OnHold').count, 0, 'a status with nothing still lists, with zero');
  assert.deepEqual(options.tags, [{ value: 'Play', count: 2 }, { value: 'Social', count: 2 }]);
  assert.deepEqual(options.lessons.map(option => [option.label, option.count]), [['Morning', 2], ['Noon', 1]]);
});

test('behaviors filter by phase, and the words match the interface', () => {
  const behavior = { id: 'x', name: 'x', category: 'BehaviorReduction', behaviorPhase: 'OnHold', targets: [{ type: 'Frequency', phase: 'OnHold' }] };
  assert.equal(filterPrograms([behavior], { statuses: ['OnHold'] }).length, 1);
  assert.equal(statusLabel('OnHold', true), 'On hold');
  assert.equal(statusLabel('OnHold', false), 'On hold');
  assert.equal(statusLabel('Teaching', false), 'Teaching');
});

test('prepareCopy resets progress and never leaves the source changed', () => {
  const source = { id: 'p1', clientId: CLIENT, category: 'SkillAcquisition', name: 'S', status: 'Maintaining', teachingInstructions: 'T', targets: [{ id: 't1', programId: 'p1', phase: 'Completed', phaseHistory: [{ phase: 'Completed', date: 'x' }], manualMastery: { achieved: true }, masteryRule: { threshold: 1 } }], targetOrder: ['t1'] };
  let n = 0;
  const { copy, cleared } = prepareCopy(source, { scope: 'client', clientId: OTHER, asOf: '2026-10-14', makeId: prefix => `${prefix}-${++n}` });
  assert.deepEqual(cleared, []);
  assert.equal(copy.clientId, OTHER);
  assert.equal(copy.teachingInstructions, 'T', 'not wiped unless asked');
  assert.deepEqual(copy.targetOrder, [copy.targets[0].id]);
  assert.equal(copy.targets[0].phase, 'Pending');
  assert.equal(source.targets[0].phase, 'Completed');
  assert.equal(source.status, 'Maintaining');
  assert.equal(source.targetOrder[0], 't1');
});

test('moving a target up or down never leaves the list', () => {
  assert.deepEqual(moveInOrder(['a', 'b', 'c'], 'c', -1), ['a', 'c', 'b']);
  assert.deepEqual(moveInOrder(['a', 'b', 'c'], 'a', 1), ['b', 'a', 'c']);
  const same = ['a', 'b'];
  assert.equal(moveInOrder(same, 'a', -1), same, 'the first cannot move earlier');
  assert.equal(moveInOrder(same, 'b', 1), same, 'the last cannot move later');
  assert.equal(moveInOrder(same, 'z', 1), same);
});

test('a card says what mastered means for its target', () => {
  assert.equal(describeMastery({ masterySettings: 'Automatic', masteryRule: { measure: 'percentCorrect', comparison: 'atLeast', threshold: 80, consecutiveSessions: 3 } }),
    'At least 80 percent correct, 3 sessions in a row');
  assert.equal(describeMastery({ masterySettings: 'Automatic', masteryRule: { measure: 'count', comparison: 'atMost', threshold: 1, consecutiveSessions: 1 } }),
    'At most 1 per session, 1 session');
  assert.equal(describeMastery({ masterySettings: 'Manual' }), 'Manual: a clinician decides.');
  assert.match(describeMastery({ masterySettings: 'Manual', manualMastery: { achieved: true, decidedOn: '2026-10-01' } }), /Decided on 2026-10-01/);
  assert.equal(describeMastery({ masterySettings: 'Automatic', masteryCriteria: '8 of 10' }), '8 of 10');
});

test('the history exports as a spreadsheet-safe CSV', () => {
  const csv = historyToCsv([{ at: '2026-10-14', summary: 'Said "hello", then left', kind: 'program.updated' }]);
  assert.equal(csv, '"Date","Change","Kind"\r\n"2026-10-14","Said ""hello"", then left","program.updated"');
  assert.equal(historyToCsv([]), '"Date","Change","Kind"');
});

test('a behavior summary keeps a blank apart from a zero', () => {
  const day = offset => `${new Date(Date.UTC(2026, 9, 14 - offset)).toISOString().slice(0, 10)}T09:00:00`;
  const rows = [
    { timestamp: day(0), value: 4 },
    { timestamp: day(1), value: 0, missingDataMode: 'ZeroOut' },
    { timestamp: day(2), value: null, missingDataMode: 'DataNotTracked' },
    { timestamp: day(30), value: 10 }
  ];
  const series = weeklyBehaviorSeries(rows, '2026-10-14', 8);
  assert.equal(series.length, 8);
  const latest = series.at(-1);
  assert.equal(latest.sessions, 2, 'the untracked session is left out');
  assert.equal(latest.notTracked, 1);
  assert.equal(latest.mean, 2, 'a recorded zero is a zero: (4 + 0) / 2');
  assert.equal(series[5].mean, null, 'a week with nothing tracked is a blank, never zero');
  assert.equal(series[3].mean, 10, 'a session from a month back lands in its own week');
});

test('a behavior change is described in neutral words and ignores weeks with no data', () => {
  const week = mean => ({ mean, sessions: mean == null ? 0 : 1 });
  assert.equal(describeBehaviorChange([week(10), week(10), week(5), week(5)]).direction, 'lower');
  assert.equal(describeBehaviorChange([week(5), week(5), week(10), week(10)]).direction, 'higher');
  assert.equal(describeBehaviorChange([week(10), week(10), week(10.4), week(10.4)]).direction, 'similar');
  assert.equal(describeBehaviorChange([week(null), week(null), week(5), week(5)]).direction, 'unknown');
  assert.equal(describeBehaviorChange([week(0), week(0), week(0), week(0)]).direction, 'similar');
  assert.equal(describeBehaviorChange([week(0), week(0), week(3), week(3)]).direction, 'higher');
  assert.equal(describeBehaviorChange([]).direction, 'unknown');
});
