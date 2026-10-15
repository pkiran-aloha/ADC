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
const minutesOf = clock => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
const tenths = (part, whole) => Math.round(1000 * part / whole) / 10;
function ruleValue(row, rule) {
  switch (rule.measure) {
    case 'percentCorrect': case 'percentIntervals': return row.value;
    case 'intervalCount': return row.occurredIntervals;
    case 'count': return row.occurrenceCount;
    case 'ratePerHour': return 60 * row.occurrenceCount / row.lessonDurationMinutes;
    case 'correctPerMinute': return row.occurrenceCount / row.lessonDurationMinutes;
    case 'durationSeconds': return row.durationSeconds;
    default: throw new Error(`Unknown mastery measure ${rule.measure}`);
  }
}
const meetsRule = (value, rule) => ({ atLeast: value >= rule.threshold, atMost: value <= rule.threshold,
  below: value < rule.threshold, above: value > rule.threshold })[rule.comparison];
function firstCriterionRow(rows, rule) {
  let streak = 0;
  for (const row of rows) {
    if (row.value == null) continue;
    streak = meetsRule(ruleValue(row, rule), rule) ? streak + 1 : 0;
    if (streak >= rule.consecutiveSessions) return row;
  }
  return null;
}
const phases = ['Baseline', 'Pending', 'Acquisition', 'Maintenance', 'Generalization', 'Completed', 'OnHold', 'Discontinued'];

test('committed fixture is reproducible from the source generator', () => {
  execFileSync('python3', ['scripts/generate_clinical_seed.py', '--check'], { cwd: root });
});

test('all clients have diverse, fully described Skill Acquisition and unitary Behavior Reduction programs', () => {
  assert.equal(seed.asOfDate, '2026-10-14');
  assert.match(seed.revision, /^[a-f0-9]{16}$/);
  assert.equal(seed.clients.length, 5);
  assert.ok(seed.programs.length >= 35);
  assert.ok(targets.length >= 60);
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
        'durationSeconds', 'occurrenceCount', 'lessonDurationMinutes', 'qualitativeEntry', 'trialSequence',
        'intervalScores', 'episodeDurations', 'errorCount', 'ioa']) {
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
      case 'TrialByTrial': {
        assert.ok(row.totalTrials > 0 && row.correctCount >= 0 && row.correctCount <= row.totalTrials);
        assert.equal(row.value, Math.round(100 * row.correctCount / row.totalTrials));
        // Trial-by-trial prompt codes come from the target's prompt hierarchy.
        const codes = new Set(seed.promptHierarchyTemplates.find(item => item.id === target.promptHierarchyId).codes);
        assert.equal(row.trialSequence.length, row.totalTrials, row.id);
        assert.ok([...row.trialSequence].every(code => codes.has(code)), row.id);
        assert.equal([...row.trialSequence].filter(code => code === 'I').length, row.correctCount, row.id);
        break;
      }
      case 'IntervalData':
        assert.ok(row.totalIntervals > 0 && row.occurredIntervals >= 0 && row.occurredIntervals <= row.totalIntervals);
        assert.equal(row.value, Math.round(100 * row.occurredIntervals / row.totalIntervals));
        if (target.intervalSettings.numberOfIntervals) {
          assert.equal(row.totalIntervals, target.intervalSettings.numberOfIntervals);
        }
        assert.ok(!('correctCount' in row) && !('totalTrials' in row));
        assert.match(row.intervalScores, /^[01]+$/);
        assert.equal(row.intervalScores.length, row.totalIntervals, row.id);
        assert.equal([...row.intervalScores].filter(score => score === '1').length, row.occurredIntervals, row.id);
        break;
      case 'Duration': {
        assert.ok(row.durationSeconds >= 0);
        assert.equal(row.value, row.durationSeconds);
        // Each episode (bout) is kept so average duration and count stay truthful.
        const episodes = row.episodeDurations || [];
        assert.equal(row.occurrenceCount, episodes.length, row.id);
        assert.equal(episodes.reduce((sum, seconds) => sum + seconds, 0), row.durationSeconds, row.id);
        assert.ok(episodes.every(seconds => Number.isInteger(seconds) && seconds > 0));
        assert.equal(row.occurrenceCount === 0, row.durationSeconds === 0);
        break;
      }
      case 'Frequency':
      case 'FluencyRate':
        assert.ok(row.occurrenceCount >= 0 && row.lessonDurationMinutes > 0);
        assert.equal(row.value, row.occurrenceCount);
        if (target.type === 'FluencyRate') assert.ok(Number.isInteger(row.errorCount) && row.errorCount >= 0, row.id);
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

test('phase histories are chronological and automatic promotions agree with structured mastery rules', () => {
  const mastered = new Set(['Maintenance', 'Generalization', 'Completed']);
  for (const target of targets) {
    const history = target.phaseHistory;
    assert.ok(history.length >= 1 && history.every(entry => phases.includes(entry.phase) && /^2026-\d\d-\d\d$/.test(entry.date)), target.id);
    for (let index = 1; index < history.length; index++) assert.ok(history[index - 1].date < history[index].date, target.id);
    assert.equal(history.at(-1).phase, target.phase);
    assert.equal(history.at(-1).date, target.phaseEnteredDate);
    const rows = seed.sessionData.filter(row => row.targetId === target.id);
    if (rows.length) assert.ok(history[0].date <= rows[0].timestamp.slice(0, 10), `${target.id} has data before its first phase`);
    const closed = history.find(entry => ['Completed', 'OnHold', 'Discontinued'].includes(entry.phase));
    if (closed) assert.ok(rows.every(row => row.timestamp.slice(0, 10) < closed.date), `${target.id} has data after ${closed.phase}`);
    if (target.masteryRule) {
      assert.ok(['atLeast', 'atMost', 'below', 'above'].includes(target.masteryRule.comparison));
      assert.ok(Number.isInteger(target.masteryRule.consecutiveSessions) && target.masteryRule.consecutiveSessions > 0);
    }
    if (target.masterySettings !== 'Automatic' || !target.masteryRule) continue;
    const start = history.findIndex(entry => entry.phase === 'Acquisition');
    if (start < 0) continue;
    const next = history[start + 1];
    const teaching = rows.filter(row => row.timestamp.slice(0, 10) >= history[start].date && (!next || row.timestamp.slice(0, 10) < next.date));
    const met = firstCriterionRow(teaching, target.masteryRule);
    if (next && mastered.has(next.phase)) {
      assert.equal(met, teaching.at(-1), `${target.id} must be promoted the day after first meeting its rule`);
      const promoted = new Date(`${met.timestamp.slice(0, 10)}T12:00:00Z`);
      promoted.setUTCDate(promoted.getUTCDate() + 1);
      assert.equal(next.date, promoted.toISOString().slice(0, 10), target.id);
    } else {
      assert.equal(met, null, `${target.id} met an automatic rule without a promotion`);
    }
  }
  const brTargets = targets.filter(target => byProgram.get(target.programId).category === 'BehaviorReduction');
  assert.ok(brTargets.every(target => ['Escape', 'Attention', 'Tangible', 'Automatic'].includes(target.functionHypothesis) && text(target.intervention)));
});

test('service sessions explain every observation: schedule, setting, staff, supervision and fidelity', () => {
  unique(seed.serviceSessions, 'service session');
  const sessions = new Map(seed.serviceSessions.map(session => [session.id, session]));
  const roles = new Map(seed.staff.map(person => [person.name, person.role]));
  for (const session of seed.serviceSessions) {
    assert.ok(byClient.has(session.clientId));
    assert.match(session.date, /^2026-\d\d-\d\d$/);
    assert.ok(session.date <= seed.asOfDate);
    assert.ok(['Clinic', 'Home', 'School', 'Community', 'Telehealth'].includes(session.setting));
    assert.ok(['97153', '97155', '97156'].includes(session.serviceCode));
    assert.equal(roles.get(session.therapistName), session.role, session.id);
    assert.equal(session.minutes, minutesOf(session.end) - minutesOf(session.start));
    if (session.status === 'Cancelled') assert.ok(text(session.cancelReason));
    else assert.equal(session.status, 'Completed');
    for (const event of session.settingEvents || []) assert.ok(byConfig.get(session.clientId).settingEvents.includes(event));
    if (session.supervision) {
      assert.ok(['BCBA', 'BCaBA'].includes(roles.get(session.supervision.supervisor)));
      assert.equal(session.role, 'RBT');
      assert.ok(session.supervision.minutes > 0 && session.supervision.minutes <= session.minutes);
    }
    if (session.fidelity) {
      assert.ok(session.supervision, 'Procedural fidelity is scored during supervision');
      assert.equal(session.fidelity.percent, tenths(session.fidelity.correct, session.fidelity.total));
    }
  }
  for (const row of seed.sessionData) {
    const session = sessions.get(row.serviceSessionId);
    assert.ok(session, row.id);
    assert.equal(session.clientId, row.clientId);
    assert.equal(session.status, 'Completed');
    assert.notEqual(session.serviceCode, '97156', 'Caregiver guidance does not produce client data');
    assert.equal(session.date, row.timestamp.slice(0, 10));
    const minute = minutesOf(row.timestamp.slice(11, 16));
    assert.ok(minute >= minutesOf(session.start) && minute < minutesOf(session.end), row.id);
    assert.equal(row.therapistName, session.therapistName);
  }
  for (const client of seed.clients) {
    const direct = seed.serviceSessions.filter(item => item.clientId === client.id && item.status === 'Completed' && item.serviceCode !== '97156');
    assert.ok(direct.filter(item => item.ioaObserver).length / direct.length >= 0.2, `${client.id} IOA coverage`);
    assert.ok(direct.some(item => item.fidelity) && direct.some(item => item.settingEvents));
  }
});

test('interobserver agreement uses the method that matches each measurement tool', () => {
  const methods = { TrialByTrial: 'TrialByTrial', IntervalData: 'IntervalByInterval', Duration: 'TotalDuration', Frequency: 'TotalCount', FluencyRate: 'TotalCount' };
  const sessions = new Map(seed.serviceSessions.map(session => [session.id, session]));
  const withIoa = seed.sessionData.filter(row => row.ioa);
  assert.ok(withIoa.length > 500);
  for (const row of withIoa) {
    const target = byTarget.get(row.targetId);
    assert.equal(row.ioa.method, methods[target.type], row.id);
    assert.notEqual(row.ioa.observer, row.therapistName);
    assert.equal(sessions.get(row.serviceSessionId).ioaObserver, row.ioa.observer);
    if ('agreements' in row.ioa) {
      assert.equal(row.ioa.total, row.totalTrials ?? row.totalIntervals);
      assert.ok(row.ioa.agreements >= 0 && row.ioa.agreements <= row.ioa.total);
      assert.equal(row.ioa.percent, tenths(row.ioa.agreements, row.ioa.total));
    } else {
      assert.equal(row.ioa.primary, row.durationSeconds ?? row.occurrenceCount);
      const { primary, secondary } = row.ioa;
      assert.equal(row.ioa.percent, primary === secondary ? 100 : tenths(Math.min(primary, secondary), Math.max(primary, secondary)));
    }
  }
  assert.ok(withIoa.some(row => row.ioa.percent < 80), 'Low-agreement sessions exist for data-quality review');
});

test('ABC narratives sample measured episodes and use the documented function catalogs', () => {
  const measured = new Map();
  for (const row of seed.sessionData) {
    const target = byTarget.get(row.targetId);
    if (byProgram.get(target.programId).category !== 'BehaviorReduction' || row.value == null) continue;
    const episodes = target.type === 'IntervalData' ? (row.intervalScores.match(/1+/g) || []).length : row.occurrenceCount;
    measured.set(`${row.serviceSessionId}/${target.name}`, episodes);
  }
  const recorded = new Map();
  for (const entry of seed.abcEntries) {
    for (const behavior of entry.behaviors) {
      const key = `${entry.serviceSessionId}/${behavior}`;
      recorded.set(key, (recorded.get(key) || 0) + 1);
    }
  }
  for (const [key, count] of recorded) assert.ok(count <= (measured.get(key) ?? 0), `${key} has more ABC records than measured episodes`);
  const sessions = new Map(seed.serviceSessions.map(session => [session.id, session]));
  for (const entry of seed.abcEntries) {
    const session = sessions.get(entry.serviceSessionId);
    assert.equal(session.clientId, entry.clientId);
    assert.equal(session.therapistName, entry.therapist);
    assert.deepEqual(entry.settingEvents || [], session.settingEvents || []);
  }
  const functions = new Set(['Escape', 'Attention', 'Tangible', 'Sensory', 'None']);
  for (const config of seed.abcConfigurations) {
    assert.deepEqual(Object.keys(config.antecedentCategories), config.antecedents);
    assert.deepEqual(Object.keys(config.consequenceFunctions), config.consequences);
    assert.ok(Object.values(config.consequenceFunctions).every(value => functions.has(value)));
    assert.ok(Object.values(config.antecedentCategories).every(text));
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
  assert.equal(apiService.getClients().length, seed.clients.length);
  assert.equal(apiService.getPrograms('cli-noah', 'BehaviorReduction').length, 3);
  assert.equal(apiService.getAbcConfiguration('cli-emma').behaviors.length, 3);

  // Independent date arithmetic: one calendar month before the snapshot day's end.
  const since = months => {
    const date = new Date(`${seed.asOfDate}T23:59:59`);
    date.setMonth(date.getMonth() - months);
    return date;
  };
  const emma = seed.abcEntries.filter(entry => entry.clientId === 'cli-emma');
  assert.equal(apiService.getAbcData('cli-emma', 'Past 1 Month').length, emma.filter(entry => new Date(entry.timestamp) >= since(1)).length);
  assert.equal(apiService.getAbcData('cli-emma', 'All').length, emma.length);
  assert.ok(apiService.getAbcData('cli-emma', 'Past 1 Month').length >= 12);

  const vocal = seed.sessionData.filter(row => row.targetId === 'br-vocal' && new Date(row.timestamp) >= since(1));
  const observed = apiService.getTargetData({ clientId: 'cli-liam', targetIds: ['br-vocal'] }).rawRecords;
  assert.equal(observed.length, vocal.filter(row => row.missingDataMode !== 'DataNotTracked').length);
  const zeros = vocal.filter(row => row.missingDataMode === 'ZeroOut').length;
  assert.ok(zeros >= 1, 'The default month includes measured zero sessions');
  assert.equal(observed.filter(point => point.missingDataMode === 'ZeroOut').length, zeros);
  const withoutZero = apiService.getTargetData({ clientId: 'cli-liam', targetIds: ['br-vocal'],
    zeroOutBehavior: false }).rawRecords;
  assert.equal(withoutZero.length, observed.length - zeros);

  // Mastery accumulates from the first mastered phase in each target's history.
  const playing = apiService.getCumulativeMastery('cli-liam', 'prog-playing');
  assert.equal(playing.at(-1).cumulativeCount, 2);
  const share = INITIAL_PROGRAMS.flatMap(program => program.targets).find(target => target.id === 'tgt-play-share');
  assert.equal(playing[0].date, share.phaseHistory.find(entry => entry.phase === 'Maintenance').date);

  apiService.updateTargetPhase({ targetId: 'tgt-expr-food', newPhase: 'Baseline', addPhaseLine: false, phaseDate: '2026-10-14' });
  const updated = apiService.getPrograms('cli-liam')[0].targets[0];
  assert.equal(updated.phase, 'Baseline');
  assert.deepEqual(updated.phaseHistory.at(-1), { phase: 'Baseline', date: '2026-10-14' });
  assert.equal(INITIAL_PROGRAMS[0].targets[0].phase, 'Generalization');
  apiService.resetToDefault();
  assert.equal(apiService.getPrograms('cli-liam')[0].targets[0].phase, 'Generalization');
  assert.ok(apiService.getServiceSessions('cli-liam').length > 100);
  delete globalThis.localStorage;
});
