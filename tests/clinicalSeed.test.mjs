import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import seed from '../data/clinicalSeed.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = value => typeof value === 'string' && value.trim().length > 0;
const unique = (rows, label) => {
  const ids = rows.map(row => row.id);
  assert.equal(new Set(ids).size, ids.length, `${label} IDs must be unique`);
};
const targets = seed.programs.flatMap(program => program.targets);
const byTarget = new Map(targets.map(target => [target.id, target]));
const byProgram = new Map(seed.programs.map(program => [program.id, program]));
const byClient = new Set(seed.clients.map(client => client.id));
const byConfig = new Map(seed.abcConfigurations.map(config => [config.clientId, config]));
const hierarchyIds = new Set(seed.promptHierarchyTemplates.map(template => template.id));
const customKeys = new Set(seed.customFieldDefinitions.map(field => field.key));
const saTypes = ['TrialByTrial', 'Frequency', 'Duration', 'IntervalData', 'Anecdotal', 'FluencyRate'];
const brTypes = ['Frequency', 'Duration', 'IntervalData'];
const statuses = ['Baselining', 'Teaching', 'Maintaining', 'Generalizing', 'Pending', 'Completed', 'OnHold', 'Discontinued'];
const phases = ['Baseline', 'Pending', 'Acquisition', 'Maintenance', 'Generalization', 'Completed', 'OnHold', 'Discontinued'];

test('committed fixture is reproducible from the source generator', () => {
  execFileSync('python3', ['scripts/generate_clinical_seed.py', '--check'], { cwd: root });
});

test('all clients have diverse, fully described Skill Acquisition and unitary Behavior Reduction programs', () => {
  assert.equal(seed.asOfDate, '2026-10-14');
  assert.match(seed.revision, /^[a-f0-9]{16}$/);
  assert.equal(seed.clients.length, 3);
  assert.ok(seed.programs.length >= 20);
  assert.ok(targets.length >= 35);
  unique(seed.clients, 'client');
  unique(seed.programs, 'program');
  unique(targets, 'target');
  assert.deepEqual(new Set(seed.programs.map(program => program.status)), new Set(statuses));
  assert.deepEqual(new Set(targets.map(target => target.phase)), new Set(phases));
  assert.deepEqual(new Set(seed.programs.filter(p => p.category === 'SkillAcquisition')
    .flatMap(p => p.targets.map(t => t.type))), new Set(saTypes));
  assert.deepEqual(new Set(seed.programs.filter(p => p.category === 'BehaviorReduction')
    .flatMap(p => p.targets.map(t => t.type))), new Set(brTypes));
  assert.ok(seed.programs.some(p => p.category === 'SkillAcquisition' && p.targets.length >= 3));
  for (const field of ['tags', 'treatmentArea', 'baseline', 'learningMaterials', 'customFields']) {
    assert.ok(seed.programs.some(p => field in p), `Missing optional ${field} example`);
    assert.ok(seed.programs.some(p => !(field in p)), `No omitted optional ${field} example`);
  }

  for (const client of seed.clients) {
    assert.ok(text(client.name) && text(client.supervisingBcba));
    const programs = seed.programs.filter(p => p.clientId === client.id);
    assert.ok(programs.filter(p => p.category === 'SkillAcquisition').length >= 3, client.name);
    const behaviors = programs.filter(p => p.category === 'BehaviorReduction');
    assert.equal(behaviors.length, 3, `${client.name} should cover all BR measurement tools`);
    assert.deepEqual(new Set(behaviors.map(p => p.targets[0].type)), new Set(brTypes));
  }

  for (const program of seed.programs) {
    assert.ok(byClient.has(program.clientId));
    assert.ok(text(program.name) && text(program.status));
    assert.ok(text(program.programObjective) && text(program.teachingInstructions));
    assert.ok(program.targets.length > 0);
    if (program.category === 'BehaviorReduction') {
      assert.equal(program.targets.length, 1, `BR ${program.name} must be unitary`);
      assert.equal(program.name, program.targets[0].name);
    } else {
      assert.equal(program.category, 'SkillAcquisition');
    }
    if (program.tags) assert.ok(program.tags.every(text));
    if (program.treatmentArea) assert.ok(text(program.treatmentArea));
    if (program.baseline) assert.ok(text(program.baseline));
    for (const [key, value] of Object.entries(program.customFields || {})) {
      assert.ok(customKeys.has(key), `Unknown master-defined custom field ${key}`);
      assert.ok(text(value));
    }
    for (const material of program.learningMaterials || []) {
      assert.ok(text(material.fileName) && text(material.contentType));
      assert.ok(material.path.startsWith('learning-materials/'));
      assert.ok(existsSync(path.join(root, 'frontend/public', material.path)), material.path);
    }
  }
});

test('target settings are complete and conditional fields only appear for their measurement tool', () => {
  assert.equal(hierarchyIds.size, 3);
  assert.ok(seed.promptHierarchyTemplates.every(t => text(t.name) && t.levels.length >= 3 && t.levels.every(text)));
  const captureTypes = new Set();
  const intervalStarts = new Set();
  const fluencyStarts = new Set();
  for (const target of targets) {
    assert.ok(byProgram.has(target.programId));
    assert.ok(text(target.name) && text(target.discriminativeStimuli));
    assert.ok(text(target.masteryCriteria) && ['Manual', 'Automatic'].includes(target.masterySettings));
    assert.ok(phases.includes(target.phase));
    assert.ok(/^2026-\d\d-\d\d$/.test(target.phaseEnteredDate));
    if (target.type === 'TrialByTrial') {
      assert.ok(hierarchyIds.has(target.promptHierarchyId));
    } else {
      assert.ok(!('promptHierarchyId' in target), target.id);
    }
    if (target.type === 'IntervalData') {
      const { startType, intervalLength, captureType, numberOfIntervals } = target.intervalSettings;
      intervalStarts.add(startType);
      captureTypes.add(captureType);
      assert.match(intervalLength, /^\d{2}:\d{2}$/);
      const [minutes, seconds] = intervalLength.split(':').map(Number);
      assert.ok(minutes * 60 + seconds > 0 && seconds < 60);
      if (numberOfIntervals != null) assert.ok(Number.isInteger(numberOfIntervals) && numberOfIntervals > 0);
    } else {
      assert.ok(!('intervalSettings' in target), target.id);
    }
    if (target.type === 'FluencyRate') {
      fluencyStarts.add(target.fluencySettings.startType);
    } else {
      assert.ok(!('fluencySettings' in target), target.id);
    }
  }
  assert.deepEqual(captureTypes, new Set(['Whole', 'Partial', 'MomentaryTimeSampling']));
  assert.deepEqual(intervalStarts, new Set(['LessonStart', 'Manual']));
  assert.ok(targets.some(target => target.type === 'IntervalData' &&
    !('numberOfIntervals' in target.intervalSettings)), 'Interval count can be omitted');
  assert.deepEqual(fluencyStarts, new Set(['LessonStartCountUp', 'ManualStartCountUp', 'ManualStartCountDown']));
  assert.deepEqual(new Set(targets.map(target => target.masterySettings)), new Set(['Manual', 'Automatic']));
});

test('recordings match their type, client and measured values; zero is distinct from not tracked', () => {
  assert.ok(seed.sessionData.length >= 290);
  unique(seed.sessionData, 'recording');
  let trackedZero = 0;
  let untracked = 0;
  let multiSessionDay = false;
  const datesByTarget = new Map();
  for (const row of seed.sessionData) {
    const target = byTarget.get(row.targetId);
    assert.ok(target, `Unknown recording target ${row.targetId}`);
    const program = byProgram.get(target.programId);
    assert.equal(row.clientId, program.clientId);
    assert.ok(text(row.therapistName) && Number.isInteger(row.sessionNumber));
    assert.match(row.timestamp, /^2026-\d\d-\d\dT\d\d:\d\d:\d\d$/);
    assert.ok(!Number.isNaN(Date.parse(row.timestamp)) && row.timestamp.slice(0, 10) <= seed.asOfDate);
    const key = `${row.targetId}/${row.timestamp.slice(0, 10)}`;
    if (datesByTarget.has(key)) multiSessionDay = true;
    datesByTarget.set(key, true);

    if (row.missingDataMode === 'DataNotTracked') {
      assert.equal(program.category, 'BehaviorReduction');
      assert.equal(row.value, null);
      for (const field of ['correctCount', 'totalTrials', 'occurredIntervals', 'totalIntervals',
        'durationSeconds', 'occurrenceCount', 'lessonDurationMinutes', 'qualitativeEntry']) {
        assert.ok(!(field in row), `Untracked ${row.id} cannot contain ${field}`);
      }
      untracked++;
      continue;
    }
    if (row.missingDataMode === 'ZeroOut') {
      assert.equal(program.category, 'BehaviorReduction');
      assert.equal(row.value, 0);
      trackedZero++;
    }
    switch (target.type) {
      case 'TrialByTrial':
        assert.ok(row.totalTrials > 0 && row.correctCount >= 0 && row.correctCount <= row.totalTrials);
        assert.equal(row.value, Math.round(100 * row.correctCount / row.totalTrials));
        break;
      case 'IntervalData':
        assert.ok(row.totalIntervals > 0 && row.occurredIntervals >= 0 && row.occurredIntervals <= row.totalIntervals);
        assert.equal(row.value, Math.round(100 * row.occurredIntervals / row.totalIntervals));
        if (target.intervalSettings.numberOfIntervals) {
          assert.equal(row.totalIntervals, target.intervalSettings.numberOfIntervals);
        }
        assert.ok(!('correctCount' in row) && !('totalTrials' in row));
        break;
      case 'Duration':
        assert.ok(row.durationSeconds >= 0);
        assert.equal(row.value, row.durationSeconds);
        assert.equal(row.occurrenceCount, row.durationSeconds > 0 ? 1 : 0);
        break;
      case 'Frequency':
      case 'FluencyRate':
        assert.ok(row.occurrenceCount >= 0 && row.lessonDurationMinutes > 0);
        assert.equal(row.value, row.occurrenceCount);
        break;
      case 'Anecdotal':
        assert.ok(text(row.qualitativeEntry));
        assert.ok(!('value' in row));
        break;
      default:
        assert.fail(`Unexpected tool ${target.type}`);
    }
  }
  assert.ok(multiSessionDay, 'Exercise same-day aggregation');
  assert.ok(trackedZero >= 9 && untracked >= 9);
  for (const target of targets) {
    const rows = seed.sessionData.filter(row => row.targetId === target.id);
    assert.ok(rows.length > 0 || target.phase === 'Pending', target.id);
    if (target.phase === 'Pending') assert.equal(rows.length, 0);
  }
});

test('ABC configurations are textual lists and all event selections belong to their client catalog', () => {
  assert.equal(seed.abcConfigurations.length, seed.clients.length);
  assert.ok(seed.abcEntries.length >= 40);
  unique(seed.abcEntries, 'ABC entry');
  assert.equal(byConfig.size, seed.clients.length);
  for (const config of seed.abcConfigurations) {
    assert.ok(byClient.has(config.clientId));
    assert.ok(text(config.treatmentArea) && text(config.teachingInstructions));
    for (const field of ['antecedents', 'behaviors', 'consequences', 'locations']) {
      assert.ok(config[field].length >= 3 && config[field].every(text));
    }
    const brNames = seed.programs.filter(p => p.clientId === config.clientId &&
      p.category === 'BehaviorReduction').map(p => p.targets[0].name);
    assert.deepEqual(new Set(config.behaviors), new Set(brNames));
  }
  for (const client of seed.clients) {
    assert.ok(seed.abcEntries.filter(entry => entry.clientId === client.id).length >= 12);
  }
  assert.ok(seed.abcEntries.some(entry => entry.antecedents.length > 1 && entry.behaviors.length > 1));
  for (const entry of seed.abcEntries) {
    const config = byConfig.get(entry.clientId);
    assert.ok(config && text(entry.notes) && text(entry.therapist));
    assert.ok(entry.timestamp.slice(0, 10) <= seed.asOfDate);
    for (const field of ['antecedents', 'behaviors', 'consequences']) {
      assert.ok(entry[field].length > 0 && entry[field].every(value => config[field].includes(value)));
    }
    assert.ok(config.locations.includes(entry.location));
    assert.ok(entry.intensity >= 1 && entry.durationMinutes > 0);
  }
});

test('browser demo reseeds old localStorage and filters analytics without losing raw seed semantics', async () => {
  const store = new Map([['welina_programs', JSON.stringify([{ id: 'outdated' }])]]);
  globalThis.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value)
  };
  const { apiService } = await import('../frontend/src/services/apiService.js');
  const { INITIAL_PROGRAMS, SEED_VERSION } = await import('../frontend/src/data/mockData.js');
  assert.equal(store.get('welina_seed_version'), JSON.stringify(SEED_VERSION));
  assert.equal(apiService.getClients().length, 3);
  assert.equal(apiService.getPrograms('cli-noah', 'BehaviorReduction').length, 3);
  assert.equal(apiService.getAbcConfiguration('cli-emma').behaviors.length, 3);
  assert.equal(apiService.getAbcData('cli-emma', 'Past 1 Month').length, 12);
  assert.equal(apiService.getAbcData('cli-emma', 'All').length, 14);

  const observed = apiService.getTargetData({ clientId: 'cli-liam', targetIds: ['br-vocal'] }).rawRecords;
  assert.equal(observed.length, 11); // 12 recorded dates, 1 untracked date
  assert.equal(observed.filter(point => point.missingDataMode === 'ZeroOut').length, 2);
  const withoutZero = apiService.getTargetData({ clientId: 'cli-liam', targetIds: ['br-vocal'],
    zeroOutBehavior: false }).rawRecords;
  assert.equal(withoutZero.length, 9);
  assert.equal(apiService.getCumulativeMastery('cli-liam', 'prog-playing').at(-1).cumulativeCount, 2);

  apiService.updateTargetPhase({ targetId: 'tgt-expr-food', newPhase: 'Baseline', addPhaseLine: false });
  assert.equal(apiService.getPrograms('cli-liam')[0].targets[0].phase, 'Baseline');
  assert.equal(INITIAL_PROGRAMS[0].targets[0].phase, 'Generalization');
  apiService.resetToDefault();
  assert.equal(apiService.getPrograms('cli-liam')[0].targets[0].phase, 'Generalization');
  delete globalThis.localStorage;
});
