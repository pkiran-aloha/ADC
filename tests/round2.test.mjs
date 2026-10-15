// Round-2 feature tests: grouped graphs, manual entry and import, observation audit,
// graphing policy, view-only access, behaviour-reduction mastery, milestones, live
// activity, time-of-day patterns and the print-ready report builder.
import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../data/clinicalSeed.json' with { type: 'json' };
import {
  GRAPH_PREFERENCE_DEFAULTS, normalizeGraphPreferences, graphStandards, minimumTrialsFor, isLowTrialRow,
  isShortObservationRow, eligibleChartRows, preferenceSummary, readGraphPreferences, writeGraphPreferences,
  storageKeyFor
} from '../frontend/src/utils/graphPreferences.js';
import { MARKER_LIBRARY, resolveMarkerShape, shapesForSeries, markerElement, describeMarker } from '../frontend/src/utils/markerShapes.js';
import {
  availableSummaryModes, resolveSummaryMode, summarySeries, withSummarySeries, behaviorPresets, stageOf, groupTargetsByStage
} from '../frontend/src/utils/groupSeries.js';
import { permissionsFor, canDo, deniedMessage, normalizeAccessLevel, accessLevelLabel, viewOnlyNotice } from '../frontend/src/utils/permissions.js';
import { manualRow, validateManualEntry, buildManualPoint, sourceLabel, sourceOptions, dataSourceCounts } from '../frontend/src/utils/dataEntry.js';
import {
  parseCsv, suggestMapping, requiredFieldsMissing, importSpreadsheet, importSummary, pointsFromImport,
  importErrorCsv, importTemplateCsv, matchSource, valuesForTarget
} from '../frontend/src/utils/dataImport.js';
import {
  EDIT_REASONS, validateObservationEdit, applyObservationEdit, validateDeletion, deletionAudit, auditTrail, auditSummary,
  chartEligible, observationType, supervisorObservations, describeAuditEntry, billingNote, valuesFromRow
} from '../frontend/src/utils/observations.js';
import { activitySnapshot, weeklyActivity, demoClock, lastRecordedTarget, DOCUMENTATION_STATUSES } from '../frontend/src/utils/sessionActivity.js';
import {
  reductionCriterion, evaluateReductionMastery, reductionRuleFor, describeReductionRule, evaluateMastery
} from '../frontend/src/utils/visualAnalysis.js';
import {
  targetMilestones, introducedOn, masteredOn, acquisitionRate, programProgress, programProgressLabel, graphRowsForTarget
} from '../frontend/src/utils/targetAnalytics.js';
import { timeOfDayPattern, timeOfDayShares, clockMinutes } from '../frontend/src/utils/abcAnalytics.js';
import {
  REPORT_TEMPLATES, templateById, rangeStart, targetRoster, rosterCsv, buildReportModel, reportHtml, renderReportCharts,
  reportFileName, reportSummarySentence, rosterStatus, chartForTarget
} from '../frontend/src/utils/reportBuilder.js';
import { escapeXml, reportChartSvg } from '../frontend/src/utils/reportChart.js';

const clients = seed.clients;
const liam = clients.find(client => client.id === 'cli-liam');
const liamPrograms = seed.programs.filter(program => program.clientId === 'cli-liam');
const liamTargets = liamPrograms.flatMap(program => program.targets.map(target => ({ ...target, category: program.category, programName: program.name })));
const liamSessions = seed.sessionData.filter(row => row.clientId === 'cli-liam');
const liamServices = seed.serviceSessions.filter(row => row.clientId === 'cli-liam');
const byId = new Map(liamTargets.map(target => [target.id, target]));
const series = (id, points) => ({ id, name: id, color: '#333', points: points.map(([xKey, val]) => ({ xKey, val })) });

test('graph preferences default to measured dates and the organisation trial minimum', () => {
  const defaults = normalizeGraphPreferences();
  assert.equal(defaults.showNoDataDates, false);
  assert.equal(defaults.markerShape, 'auto');
  assert.equal(defaults.orientation, 'values');
  assert.equal(defaults.minimumTrials, null);
  assert.equal(GRAPH_PREFERENCE_DEFAULTS.showValues, false);

  const stored = normalizeGraphPreferences({ showNoDataDates: 'yes', minimumTrials: -3, markerShape: 'nope', orientation: 'dates', summaryMode: 'average' });
  assert.equal(stored.showNoDataDates, false, 'a non-boolean falls back to the default');
  assert.equal(stored.minimumTrials, null);
  assert.equal(stored.markerShape, 'auto');
  assert.equal(stored.orientation, 'dates');
  assert.equal(stored.summaryMode, 'average');
  assert.equal(normalizeGraphPreferences({ minimumTrials: '7' }).minimumTrials, 7);
});

test('organisation graphing standards set the trial floor and can be overridden per view', () => {
  const standards = graphStandards(seed.clinicalStandards);
  assert.equal(standards.minimumTrialsPerDataPoint, 5);
  assert.equal(minimumTrialsFor({ minimumTrials: null }, seed.clinicalStandards), 5);
  assert.equal(minimumTrialsFor({ minimumTrials: 0 }, seed.clinicalStandards), 0);
  assert.equal(minimumTrialsFor({ minimumTrials: 12 }, seed.clinicalStandards), 12);
  const missing = graphStandards(null);
  assert.equal(missing.minimumTrialsPerDataPoint, 5, 'a fallback keeps the feature usable without standards');
});

test('low-trial and short-observation sessions can be suppressed without losing the record', () => {
  const trialTarget = { id: 't', type: 'TrialByTrial' };
  const rows = [
    { id: 'a', totalTrials: 10, timestamp: '2026-10-01T09:00:00' },
    { id: 'b', totalTrials: 2, timestamp: '2026-10-02T09:00:00' },
    { id: 'c', totalTrials: 6, timestamp: '2026-10-03T09:00:00' }
  ];
  assert.equal(isLowTrialRow(rows[1], trialTarget, 5), true);
  assert.equal(isLowTrialRow(rows[0], trialTarget, 5), false);
  const off = eligibleChartRows(rows, trialTarget, { suppressLowTrialSessions: false }, seed.clinicalStandards);
  assert.equal(off.rows.length, 3);
  const on = eligibleChartRows(rows, trialTarget, { suppressLowTrialSessions: true }, seed.clinicalStandards);
  assert.deepEqual(on.rows.map(row => row.id), ['a', 'c']);
  assert.equal(on.suppressed.trials, 1);
  assert.equal(isShortObservationRow({ lessonDurationMinutes: 0.5 }, { type: 'Frequency' }, 1), true);
  assert.equal(isShortObservationRow({ lessonDurationMinutes: 30 }, { type: 'Frequency' }, 1), false);
  assert.equal(isShortObservationRow({ lessonDurationMinutes: 0.5 }, { type: 'TrialByTrial' }, 1), false, 'trial targets ignore the observation-length rule');
  const graphRows = graphRowsForTarget(rows, trialTarget, { suppressLowTrialSessions: true }, seed.clinicalStandards);
  assert.equal(graphRows.rows.length, 2);
});

test('graph preference summaries and storage round-trip', () => {
  const preferences = normalizeGraphPreferences({ suppressLowTrialSessions: true, showValues: true, summaryMode: 'average' });
  const summary = preferenceSummary(preferences, seed.clinicalStandards);
  assert.match(summary, /measured dates only/);
  assert.match(summary, /min 5 trials/);
  assert.match(summary, /value labels/);
  assert.match(summary, /target average/);
  const store = new Map();
  const storage = { getItem: key => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  assert.equal(writeGraphPreferences('cli-liam', preferences, storage), true);
  assert.equal(store.has(storageKeyFor('cli-liam')), true);
  assert.deepEqual(readGraphPreferences('cli-liam', storage), preferences);
  assert.deepEqual(readGraphPreferences('cli-other', storage), normalizeGraphPreferences());
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(readGraphPreferences('cli-liam', broken), normalizeGraphPreferences());
  assert.equal(writeGraphPreferences('cli-liam', preferences, broken), false);
});

test('marker shapes follow the single-target convention and stay distinct for several series', () => {
  assert.equal(resolveMarkerShape('auto', { seriesCount: 1 }), 'circleSolid');
  const many = shapesForSeries('auto', 3);
  assert.equal(new Set(many).size, 3, 'multi-series graphs get distinct markers');
  assert.deepEqual(shapesForSeries('triangle', 3), ['triangle', 'triangle', 'triangle']);
  assert.ok(MARKER_LIBRARY.some(option => option.id === 'circleSolid'));
  assert.equal(describeMarker('auto', 1), 'Solid circle');
  const circle = markerElement('circleSolid', { x: 10, y: 20, size: 4, color: '#123456' });
  assert.equal(circle.tag, 'circle');
  assert.equal(circle.props.fill, '#123456');
  assert.equal(circle.props.cx, 10);
  const open = markerElement('squareOpen', { x: 0, y: 0, size: 4, color: '#123456' });
  assert.equal(open.tag, 'rect');
  assert.equal(open.props.fill, '#FFFFFF');
  const diamond = markerElement('diamond', { x: 5, y: 5, size: 3, color: '#123456' });
  assert.equal(diamond.tag, 'path');
  assert.match(diamond.props.d, /^M /);
});

test('combined and averaged program series summarise the visible targets', () => {
  const data = [
    series('t1', [['2026-10-01', 40], ['2026-10-02', 60]]),
    series('t2', [['2026-10-01', 60], ['2026-10-02', 80], ['2026-10-03', 100]])
  ];
  const average = summarySeries(data, { mode: 'average', id: 'summary-average', name: 'Average' });
  assert.equal(average.points.length, 3);
  assert.equal(average.points[0].val, 50);
  assert.equal(average.points[1].val, 70);
  assert.equal(average.points[2].val, 100, 'a single measured target is still plotted');
  assert.equal(average.points[0].contributing, 2);
  assert.match(average.points[0].displayVal, /average \(2 targets\)/);
  const total = summarySeries(data, { mode: 'total' });
  assert.equal(total.points[0].val, 100);
  assert.match(total.points[0].displayVal, /combined/);
  assert.equal(summarySeries(data, { mode: 'none' }), null);
  assert.equal(summarySeries([data[0]], { mode: 'average' }), null, 'one target needs no summary');
  assert.deepEqual(availableSummaryModes('TrialByTrial').map(mode => mode.value), ['none', 'average'], 'percentages are averaged, never summed');
  assert.deepEqual(availableSummaryModes('Frequency').map(mode => mode.value), ['none', 'average', 'total']);
  assert.equal(resolveSummaryMode('total', 'TrialByTrial', 3), 'none');
  assert.equal(resolveSummaryMode('average', 'TrialByTrial', 1), 'none');
  const layered = withSummarySeries(data, { mode: 'average', targetType: 'TrialByTrial', color: '#4b5a73' });
  assert.equal(layered.length, 3);
  assert.equal(layered[2].isSummary, true);
  assert.equal(withSummarySeries([data[0]], { mode: 'average' }).length, 1);
});

test('behavior presets and stage grouping organise the target selectors', () => {
  const presets = behaviorPresets(liamTargets.filter(target => target.category === 'BehaviorReduction'));
  assert.equal(presets[0].id, 'all');
  assert.ok(presets.some(preset => preset.id.startsWith('function-')));
  assert.ok(presets.some(preset => preset.id.startsWith('program-')));
  assert.ok(presets.every(preset => preset.ids.length > 0));
  const skillTargets = liamTargets.filter(target => target.category === 'SkillAcquisition');
  const groups = groupTargetsByStage(skillTargets);
  assert.ok(groups.length >= 2);
  assert.ok(groups.every((group, index) => index === 0 || ['current', 'maintenance', 'pending', 'completed', 'discontinued'].includes(group.id)));
  assert.equal(stageOf({ phase: 'Acquisition' }), 'current');
  assert.equal(stageOf({ phase: 'Maintenance' }), 'maintenance');
  assert.equal(stageOf({ phase: 'Discontinued' }), 'discontinued');
  assert.equal(stageOf({ phase: 'OnHold' }), 'pending');
  const firstGroup = groups[0];
  assert.ok(firstGroup.targets.every(target => stageOf(target) === firstGroup.id));
});

test('view-only access blocks every change but keeps exports and reading', () => {
  const view = permissionsFor('view');
  assert.equal(view.can.viewAnalytics, true);
  assert.equal(view.can.exportData, true);
  for (const action of ['record', 'manuallyEnterData', 'importData', 'editObservation', 'deleteObservation', 'annotate', 'configureChart', 'changeAxis', 'updateProgramStatus', 'resetDemoData']) {
    assert.equal(canDo('view', action), false, action);
  }
  assert.equal(canDo('full', 'annotate'), true);
  assert.equal(normalizeAccessLevel('nonsense'), 'full');
  assert.equal(accessLevelLabel('view'), 'View-only analytics');
  assert.match(deniedMessage('annotate'), /View-only access/);
  assert.match(viewOnlyNotice('view'), /changes are disabled/);
  assert.equal(viewOnlyNotice('full'), '');
});

test('manual entry validates like a recorded observation and keeps its source', () => {
  const trial = byId.get('tgt-expr-food');
  const row = manualRow(trial, { date: '2026-10-14', clinician: 'Maya Patel, RBT', source: 'School' });
  assert.equal(row.source, 'School');
  assert.deepEqual(validateManualEntry(row, trial).date, undefined);
  assert.ok(validateManualEntry({ ...row, date: '' }, trial).date);
  assert.ok(validateManualEntry({ ...row, time: '99:99' }, trial).time);
  assert.ok(validateManualEntry({ ...row, clinician: ' ' }, trial).clinician);
  assert.ok(validateManualEntry({ ...row, source: 'Guesswork' }, trial).source);
  const tooFewTrials = validateManualEntry({ ...row, values: { correctCount: '2', totalTrials: '2' } }, trial);
  assert.ok(tooFewTrials.totalTrials, 'a two-trial probe is not accepted as a session point');
  const inverted = validateManualEntry({ ...row, values: { correctCount: '9', totalTrials: '8' } }, trial);
  assert.ok(inverted.correctCount);
  const good = { ...row, values: { correctCount: '8', totalTrials: '10' } };
  assert.deepEqual(validateManualEntry(good, trial), {});
  const point = buildManualPoint(good, trial, { clientId: 'cli-liam', id: 'd-manual', sessionNumber: 42 });
  assert.equal(point.value, 80);
  assert.equal(point.correctCount, 8);
  assert.equal(point.dataSource, 'School');
  assert.equal(point.collectionContext, 'School or classroom');
  assert.equal(point.enteredManually, true);
  assert.equal(point.observationType, 'Primary');
  assert.equal(point.timestamp, '2026-10-14T09:00:00');
  assert.equal(sourceLabel('Paper'), 'Paper data sheet');
  assert.ok(sourceOptions({ includeSession: false }).every(option => option.value !== 'Session'));
  assert.deepEqual(dataSourceCounts([{ enteredManually: true, dataSource: 'Probe' }, {}]), [{ label: 'Probe / cold probe', count: 1 }, { label: 'Session recording', count: 1 }]);
});

test('spreadsheet import parses, maps, validates and explains every row', () => {
  const parsed = parseCsv('Date,Target,Correct,Total,Note\r\n2026-10-01,"Food Items, 10 cards",8,10,"Said ""apple"""\r\n');
  assert.deepEqual(parsed.headers, ['Date', 'Target', 'Correct', 'Total', 'Note']);
  assert.equal(parsed.rows[0][1], 'Food Items, 10 cards');
  assert.equal(parsed.rows[0][4], 'Said "apple"');
  const mapping = suggestMapping(['Observation Date', 'Target Name', 'Correct Trials', 'Total Trials', 'Collected By', 'Source']);
  assert.equal(mapping.date, 0);
  assert.equal(mapping.target, 1);
  assert.equal(mapping.correct, 2);
  assert.equal(mapping.total, 3);
  assert.equal(mapping.clinician, 4);
  assert.equal(mapping.source, 5);
  assert.deepEqual(requiredFieldsMissing(mapping), []);
  assert.deepEqual(requiredFieldsMissing({}), ['Date', 'Target']);
  assert.equal(matchSource('paper data sheet'), 'Paper');
  assert.equal(matchSource('Probe'), 'Probe');
  assert.equal(matchSource('telepathy'), null);

  const trialTarget = liamTargets.find(target => target.type === 'TrialByTrial');
  const durationTarget = liamTargets.find(target => target.type === 'Duration');
  const frequencyTarget = liamTargets.find(target => target.type === 'Frequency');
  const text = [
    ['Date', 'Time', 'Target', 'Correct', 'Total', 'DurationSeconds', 'Occurrences', 'Minutes', 'Source', 'Clinician', 'Note'],
    ['2026-10-01', '09:00', trialTarget.name, '8', '10', '', '', '', 'School', 'Maya Patel RBT', 'probe after recess'],
    ['2026-10-01', '10:00', durationTarget.name, '', '', '137', '', '', 'Paper', 'Maya Patel RBT', ''],
    ['2026-10-01', '11:00', frequencyTarget.name, '', '', '', '7', '30', 'Historical', 'Maya Patel RBT', ''],
    ['2026-10-02', '09:00', 'Not a real target', '5', '10', '', '', '', 'School', 'Maya Patel RBT', ''],
    ['nonsense', '09:00', trialTarget.name, '5', '10', '', '', '', 'School', 'Maya Patel RBT', '']
  ].map(cells => cells.join(',')).join('\n');
  const result = importSpreadsheet(text, { targets: liamTargets, clinicians: ['Maya Patel, RBT'] });
  assert.equal(result.records.length, 5);
  assert.equal(result.summary.ready, 3);
  assert.equal(result.summary.errors, 2);
  assert.ok(result.records[3].errors.target);
  assert.ok(result.records[4].errors.date);
  assert.equal(result.records[0].values.correctCount, '8');
  assert.equal(result.records[0].source, 'School');
  assert.equal(result.records[0].ok, true);
  const points = pointsFromImport(result.records, liamTargets, { clientId: 'cli-liam', nextSessionNumber: () => 7 });
  assert.equal(points.length, 3);
  assert.equal(points[0].timestamp, '2026-10-01T09:00');
  assert.equal(points[0].value, 80);
  assert.equal(points[0].enteredManually, true);
  assert.equal(points[0].sessionNumber, 7);
  assert.equal(points[1].value, 137);
  assert.equal(points[2].occurrenceCount, 7);
  assert.match(importErrorCsv(result.records), /Not a real target/);
  assert.match(importTemplateCsv([trialTarget]), /Correct,Total/);

  const percentOnly = valuesForTarget({ type: 'TrialByTrial' }, ['2026-10-01', '90'], { date: 0, value: 1 });
  assert.equal(percentOnly.values.correctCount, '9');
  assert.equal(percentOnly.values.totalTrials, '10');
  assert.match(percentOnly.notes[0], /10-trial assumption/);
  const summary = importSummary(result.records);
  assert.equal(summary.targets, 3);
  assert.equal(summary.firstDate, '2026-10-01');
});

test('correction and deletion are validated, audited and kept out of nothing they should count in', () => {
  const trial = byId.get('tgt-expr-food');
  const row = liamSessions.find(item => item.targetId === trial.id && item.correctCount != null);
  assert.ok(row, 'the fixture contains trial-by-trial data');
  const values = valuesFromRow(row, trial);
  assert.equal(values.totalTrials, String(row.totalTrials));
  assert.ok(validateObservationEdit({ values, reason: '' }, trial).reason);
  assert.ok(validateObservationEdit({ values: { correctCount: '9', totalTrials: '4' }, reason: 'Recording error' }, trial).correctCount);
  assert.deepEqual(validateObservationEdit({ values, reason: 'Recording error' }, trial), {});
  const corrected = applyObservationEdit(row, {
    values: { ...values, correctCount: '9' }, target: trial, reason: 'Recording error', note: 'Miscounted',
    staffName: 'Sarah Jenkins, BCBA', at: '2026-10-15T09:00', billed: true
  });
  assert.equal(corrected.editHistory.length, 1);
  assert.equal(corrected.editHistory[0].action, 'Corrected');
  assert.equal(corrected.editHistory[0].billedAfterService, true);
  assert.equal(corrected.editHistory[0].before.value, row.value);
  assert.notEqual(corrected.value, row.value);
  assert.match(billingNote(corrected), /without releasing and rebilling/);
  assert.deepEqual(Object.keys(validateDeletion({ reason: 'Recording error' })), []);
  assert.ok(validateDeletion({ reason: 'Other' }).note);
  assert.ok(validateDeletion({ reason: 'Nope' }).reason);
  assert.ok(EDIT_REASONS.includes('Post-billing correction'));
  const removed = deletionAudit(row, { reason: 'Duplicate entry', staffName: 'Sarah Jenkins, BCBA', at: '2026-10-15T10:00' });
  assert.equal(removed.action, 'Deleted');
  assert.equal(removed.id, row.id);
  const audit = auditTrail([{ id: 'x', targetId: 't', editHistory: [removed] }]);
  assert.equal(audit.length, 1);
  const summary = auditSummary(audit);
  assert.equal(summary.deleted, 1);
  assert.match(describeAuditEntry(removed), /Removed · Duplicate entry/);
  assert.equal(chartEligible(row), true);
  assert.equal(chartEligible({ observationType: 'IOA', value: 100 }), false, 'second-observer records never reach the totals');
  assert.equal(chartEligible({ observationType: 'Supervision', value: 100 }), false);
  assert.equal(observationType({}), 'Primary');
  assert.equal(chartEligible({ missingDataMode: 'DataNotTracked' }), false);
});

test('supervision and IOA observations are stored with the session but excluded from totals', () => {
  const withSupervision = liamServices.filter(session => session.supervision && session.ioaObserver);
  assert.ok(withSupervision.length, 'the fixture records supervision overlaps');
  const nameById = new Map(liamTargets.map(target => [target.id, target.name]));
  const records = supervisorObservations(withSupervision.slice(0, 3), liamSessions, { targetNameById: nameById });
  assert.ok(records.length >= 3);
  assert.ok(records.every(record => record.excludedFromTotals === true));
  const supervision = records.find(record => record.kind === 'Supervision');
  assert.match(supervision.label, /supervision/);
  assert.ok(supervision.minutes > 0);
  const ioa = records.find(record => record.kind === 'IOA');
  assert.ok(ioa.observer);
  assert.ok(DOCUMENTATION_STATUSES.complete);
});

test('live session activity summarises the day without reading a session note', () => {
  const clientSessions = liamSessions;
  const snapshot = activitySnapshot({ serviceSessions: liamServices, sessions: clientSessions, asOfDate: seed.asOfDate });
  const clock = demoClock({ sessions: clientSessions, serviceSessions: liamServices, asOfDate: seed.asOfDate });
  assert.equal(snapshot.date, clock.date);
  assert.ok(snapshot.appointments.length > 0);
  assert.ok(snapshot.documented <= snapshot.today);
  for (const appointment of snapshot.appointments) {
    assert.ok(['upcoming', 'inProgress', 'finished', 'cancelled'].includes(appointment.state));
    assert.ok(['complete', 'partial', 'pending', 'cancelled'].includes(appointment.documentation));
    assert.ok(appointment.observations >= 0);
  }
  assert.ok(snapshot.observations > 0, 'the demo clock has recorded data');
  const pending = snapshot.pending;
  assert.ok(Array.isArray(pending));
  assert.equal(snapshot.today, snapshot.appointments.length - snapshot.cancelled);

  const week = weeklyActivity({ serviceSessions: liamServices, sessions: clientSessions, asOfDate: seed.asOfDate, days: 7 });
  assert.equal(week.length, 7);
  assert.ok(week.at(-1).appointments > 0);
  assert.ok(week.every(day => day.observations >= 0 && day.hours >= 0));
  const last = lastRecordedTarget(clientSessions, liamServices);
  assert.ok(last.timestamp);
  assert.ok(last.targetId);

  const synthetic = activitySnapshot({
    asOfDate: '2026-10-14',
    sessions: [{ serviceSessionId: 's2', timestamp: '2026-10-14T11:00:00', targetId: 't1', lessonDurationMinutes: 20, note: 'Slept well' }],
    serviceSessions: [
      { id: 's0', clientId: 'c', date: '2026-10-14', start: '07:00', end: '08:00', minutes: 60, therapistName: 'A', role: 'RBT', serviceCode: '97153', setting: 'Clinic', status: 'Completed' },
      { id: 's1', clientId: 'c', date: '2026-10-14', start: '09:00', end: '12:00', minutes: 180, therapistName: 'A', role: 'RBT', serviceCode: '97153', setting: 'Clinic', status: 'Completed' },
      { id: 's2', clientId: 'c', date: '2026-10-14', start: '09:00', end: '12:00', minutes: 180, therapistName: 'B', role: 'RBT', serviceCode: '97153', setting: 'Home', status: 'Completed' },
      { id: 's3', clientId: 'c', date: '2026-10-14', start: '16:00', end: '17:00', minutes: 60, therapistName: 'C', role: 'RBT', serviceCode: '97156', setting: 'Home', status: 'Cancelled', cancelReason: 'Illness' }
    ]
  });
  assert.equal(synthetic.clock, '11:00', 'the demo clock follows the last recorded observation');
  assert.equal(synthetic.today, 3);
  assert.equal(synthetic.cancelled, 1);
  assert.deepEqual(synthetic.pendingIds, ['s0'], 'a finished appointment without data is documentation pending');
  assert.equal(synthetic.documented, 1);
  assert.equal(synthetic.documentationRate, 33);
  assert.equal(synthetic.appointments[1].state, 'inProgress');
  assert.equal(synthetic.appointments[1].documentation, 'pending');
  assert.equal(synthetic.appointments[2].documentation, 'complete');
  assert.equal(synthetic.appointments[2].state, 'inProgress');
  assert.equal(synthetic.appointments[0].state, 'finished');
});

test('behaviour-reduction mastery uses a baseline plus a sustained percentage reduction', () => {
  const criterion = reductionCriterion([10, 10, 12], { reductionPercent: 80 });
  assert.equal(criterion.baseline, 10.67);
  assert.equal(criterion.value, 2.13);
  assert.equal(reductionCriterion([10, 20], { reductionPercent: 50, baselineSource: 'max' }).value, 10);
  assert.equal(reductionCriterion([], { reductionPercent: 80 }), null);

  const rows = [
    { timestamp: '2026-09-01T09:00:00', value: 12 },
    { timestamp: '2026-09-04T09:00:00', value: 10 },
    { timestamp: '2026-09-08T09:00:00', value: 9 },
    { timestamp: '2026-09-12T09:00:00', value: 2 },
    { timestamp: '2026-09-26T09:00:00', value: 1.5 },
    { timestamp: '2026-10-10T09:00:00', value: 1 }
  ];
  const met = evaluateReductionMastery(rows, {}, { startDate: '2026-09-10', reductionPercent: 80, sustainedDays: 14 });
  assert.equal(met.met, true);
  assert.equal(met.firstMetDate, '2026-09-12');
  assert.ok(met.currentReductionPercent > 80);
  assert.match(met.message, /sustained for/);
  const notSustained = evaluateReductionMastery(rows, {}, { startDate: '2026-09-10', reductionPercent: 80, sustainedDays: 60 });
  assert.equal(notSustained.met, false);
  assert.match(notSustained.message, /Below criterion since/);
  const relapse = evaluateReductionMastery([...rows, { timestamp: '2026-10-14T09:00:00', value: 8 }], {}, { startDate: '2026-09-10', sustainedDays: 7, reductionPercent: 80 });
  assert.equal(relapse.met, false, 'a value back above the criterion resets the run');
  const empty = evaluateReductionMastery([], {}, {});
  assert.equal(empty.met, false);
  assert.match(empty.message, /No measured behavior data/);

  const rule = reductionRuleFor({}, seed.clinicalStandards);
  assert.equal(rule.reductionPercent, 80);
  assert.equal(rule.sustainedDays, 14);
  assert.equal(rule.source, 'Organisation standard');
  const targetRule = reductionRuleFor({ reductionRule: { reductionPercent: 90, sustainedDays: 21, baselineSource: 'max' } }, seed.clinicalStandards);
  assert.equal(targetRule.reductionPercent, 90);
  assert.equal(targetRule.source, 'Target rule');
  assert.match(describeReductionRule(targetRule), /90% or greater reduction from the highest baseline value/);
});

test('skill targets expose introduction, mastery and acquisition-rate dates', () => {
  const target = liamTargets.find(item => item.type === 'TrialByTrial' && item.phaseHistory?.length > 2);
  const milestones = targetMilestones(target);
  assert.ok(milestones.length >= 3);
  assert.equal(milestones[0].firstDate, true);
  assert.equal(milestones.at(-1).current, true);
  assert.ok(milestones.some(milestone => milestone.kind === 'Introduced'));
  assert.ok(milestones.some(milestone => ['Mastered', 'Generalized', 'Completed'].includes(milestone.kind)));
  assert.ok(introducedOn(target));
  assert.ok(masteredOn(target));
  const rate = acquisitionRate(target);
  assert.ok(rate.days > 0);
  assert.equal(targetMilestones({ phase: 'Acquisition' }).length, 0, 'a target without history has no milestones');

  const program = liamPrograms[0];
  const progress = programProgress(program, liamSessions);
  assert.equal(progress.targets, program.targets.length);
  assert.ok(progress.mastered >= 0);
  assert.ok(progress.lastDataDate);
  assert.match(programProgressLabel(progress), /mastered · last data/);
  assert.equal(programProgressLabel({ targets: 0 }), 'No targets');
});

test('time-of-day scatterplots read event timestamps from the log', () => {
  assert.equal(clockMinutes('2026-10-14T09:30:00'), 570);
  assert.equal(clockMinutes('nonsense'), null);
  const entries = seed.abcEntries.filter(entry => entry.clientId === 'cli-liam');
  const pattern = timeOfDayPattern(entries);
  assert.equal(pattern.total, entries.length);
  assert.ok(pattern.bins.length > 1);
  assert.ok(pattern.peak.count >= 1);
  assert.ok(pattern.earliest != null && pattern.latest != null);
  assert.ok(pattern.earliest <= pattern.latest);
  const shares = timeOfDayShares(pattern);
  assert.equal(shares.reduce((sum, bucket) => sum + bucket.count, 0), entries.length);
  assert.ok(Math.abs(shares.reduce((sum, bucket) => sum + bucket.share, 0) - 1) < 1e-9);
  const filtered = timeOfDayPattern(entries, { binMinutes: 120, behaviors: [entries[0].behaviors[0]] });
  assert.ok(filtered.total <= entries.length && filtered.total > 0);
  assert.ok(filtered.bins.every(bin => bin.block % 120 === 0));
  const empty = timeOfDayPattern([]);
  assert.equal(empty.total, 0);
  assert.equal(empty.peak, null);
});

test('target roster filters by status and by introduction or mastery date', () => {
  const all = targetRoster({ programs: liamPrograms, sessions: liamSessions });
  assert.ok(all.length > 10);
  const current = targetRoster({ programs: liamPrograms, sessions: liamSessions, statuses: 'current' });
  assert.ok(current.every(row => ['current', 'onhold', 'pending'].includes(row.statusId) === false || ['Baseline', 'Acquisition'].includes(row.phase)));
  const mastered = targetRoster({ programs: liamPrograms, sessions: liamSessions, statuses: 'mastered' });
  assert.ok(mastered.every(row => ['Maintenance', 'Generalization', 'Completed'].includes(row.phase)));
  assert.ok(mastered.every(row => row.masteredOn && row.introducedOn));
  const window = targetRoster({ programs: liamPrograms, sessions: liamSessions, statuses: 'mastered', from: '2026-08-01', to: '2026-10-14', dateField: 'mastered' });
  assert.ok(window.every(row => row.masteredOn >= '2026-08-01' && row.masteredOn <= '2026-10-14'));
  assert.ok(window.length <= mastered.length, 'a date filter reduces the list');
  const introduced = targetRoster({ programs: liamPrograms, sessions: liamSessions, from: '2026-09-01', dateField: 'introduced' });
  assert.ok(introduced.every(row => row.introducedOn >= '2026-09-01'));
  assert.equal(rosterStatus({ phase: 'Maintenance' }).id, 'maintenance');
  assert.equal(rosterStatus({ phase: 'Generalization' }).id, 'mastered');
  const csv = rosterCsv(all);
  assert.match(csv, /^Program,Target,Measurement/);
  assert.equal(csv.split('\n').length, all.length + 1);
});

test('report templates, model and standalone HTML carry every selected graph', () => {
  assert.deepEqual(REPORT_TEMPLATES.map(template => template.id), ['clinical-review', 'authorization', 'reassessment', 'treatment-plan']);
  assert.equal(templateById('nope').id, 'clinical-review');
  assert.equal(rangeStart('2026-10-14', '3 months'), '2026-07-14');
  assert.equal(rangeStart('2026-10-14', 'all'), null);

  for (const template of REPORT_TEMPLATES) {
    const model = buildReportModel({
      client: liam, template: template.id, programs: liamPrograms, sessions: liamSessions, serviceSessions: liamServices,
      standards: seed.clinicalStandards, asOfDate: seed.asOfDate, annotations: seed.graphNotes
    });
    assert.equal(model.template.id, template.id);
    assert.ok(model.charts.length > 0);
    assert.ok(model.roster.length > 0);
    assert.ok(model.sections.length >= 2);
    const charts = renderReportCharts(model);
    const rendered = Object.values(charts);
    assert.ok(rendered.length > 0, `${template.id} renders at least one graph`);
    assert.ok(rendered.every(svg => svg.startsWith('<svg') && svg.includes('<polyline') || svg.includes('<circle')));
    const html = reportHtml({ ...model, charts: model.charts }, { charts });
    assert.match(html, /<!doctype html>/);
    assert.match(html, /@media print/);
    assert.match(html, new RegExp(escapeXml(liam.name)));
    assert.match(html, /Second-observer and supervision records are stored with the session and excluded/);
    assert.ok(reportFileName(model).endsWith('.html'));
    assert.match(reportSummarySentence(model), /programs · \d+ targets · \d+ graphs/);
  }
  const model = buildReportModel({ client: liam, template: 'reassessment', programs: liamPrograms, sessions: liamSessions, serviceSessions: liamServices, standards: seed.clinicalStandards, asOfDate: seed.asOfDate, from: '2026-07-01' });
  assert.ok(model.quality.observations > 0);
  assert.ok(model.quality.ioaCoverage != null);
  assert.match(reportHtml(model), /Target roster/);
  const authorization = buildReportModel({ client: liam, template: 'authorization', programs: liamPrograms, sessions: liamSessions, serviceSessions: liamServices, standards: seed.clinicalStandards, asOfDate: seed.asOfDate });
  const authorizationHtml = reportHtml(authorization);
  assert.match(authorizationHtml, /Request summary/);
  assert.match(authorizationHtml, /contenteditable="true"/);
});

test('a single report chart keeps the criterion line, phase changes and note text', () => {
  const target = liamTargets.find(item => item.type === 'TrialByTrial');
  const annotation = seed.graphNotes.find(note => note.targetId);
  const chart = chartForTarget(target, liamSessions, {
    standards: seed.clinicalStandards, preferences: {}, noteByTarget: seed.graphNotes
  });
  assert.equal(chart.targetId, target.id);
  assert.ok(chart.series[0].points.length > 0);
  assert.ok(chart.goal);
  const svg = reportChartSvg({
    title: chart.title, subtitle: chart.subtitle, series: chart.series, percent: chart.percent, yLabel: chart.yLabel,
    goal: chart.goal, notes: [{ xKey: chart.series[0].points[0].xKey, text: annotation?.noteText || 'Context note', color: '#F59E0B' }]
  });
  assert.match(svg, /<svg/);
  assert.match(svg, /polyline/);
  assert.match(svg, /Criterion/);
  assert.ok(!svg.includes('&'), 'text is escaped before it reaches the document');
  assert.equal(reportChartSvg({ title: 'empty', series: [{ id: 'x', points: [] }] }), '');
  assert.equal(escapeXml('<b>"x" & y</b>'), '&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;');
  // A target with no data in range still produces a chart block with an explanation.
  const emptyChart = chartForTarget({ ...target, id: 'tgt-none' }, [], { standards: seed.clinicalStandards });
  assert.equal(emptyChart.series.length, 0);
});

test('mastery rules for skill targets still evaluate after the reduction additions', () => {
  const target = liamTargets.find(item => item.masteryRule && item.masteryRule.measure === 'percentCorrect');
  assert.ok(target, 'the fixture has a percentage mastery rule');
  const rows = liamSessions.filter(row => row.targetId === target.id && row.value != null);
  const evaluation = evaluateMastery(rows, target.masteryRule, { startDate: target.phaseHistory?.[0]?.date });
  assert.ok(evaluation);
  assert.ok(evaluation.required >= 1);
});

test('the raw export carries the lesson or session context for every data point', async () => {
  const { rawTrialCsv } = await import('../frontend/src/utils/exportUtils.js');
  const services = [{
    id: 'ss-1', date: '2026-10-14', setting: 'Clinic', serviceCode: '97153',
    therapistName: 'Jo Ronald, RBT', role: 'RBT', status: 'Completed'
  }];
  const csv = rawTrialCsv([
    { id: 'obs-1', timestamp: '2026-10-14T09:12', sessionNumber: 12, targetId: 't1', targetName: 'Tacting', value: 80, serviceSessionId: 'ss-1' },
    { id: 'obs-2', timestamp: '2026-10-12T08:00', targetId: 't1', targetName: 'Tacting', value: 60, enteredManually: true, collectionContext: 'Probe / cold probe' }
  ], services);
  const { headers: header, rows } = parseCsv(csv);
  assert.ok(header.includes('Session Context'));
  assert.ok(header.includes('Data Source'));
  assert.equal(header.includes('Setting') && header.includes('Service Code') && header.includes('Session Status'), true);
  assert.equal(rows[0][header.indexOf('Session Context')], 'Clinic · 97153 · Jo Ronald, RBT (RBT)');
  assert.equal(rows[0][header.indexOf('Data Source')], 'Session recording');
  assert.equal(rows[0][header.indexOf('Session Date')], '2026-10-14');
  assert.equal(rows[1][header.indexOf('Session Context')], 'Outside a session · not linked to a lesson note');
  assert.equal(rows[1][header.indexOf('Data Source')], 'Probe / cold probe');
  assert.equal(parseCsv(csv).rows.every(row => row.length === header.length), true, 'every row keeps the same number of columns as the header');
});

test('an annotation written once can be applied across a program without duplicates', async () => {
  const { apiService } = await import('../frontend/src/services/apiService.js');
  const before = apiService.getSnapshot().phaseLines.length;
  const targets = ['tgt-recall-1', 'tgt-recall-2', 'tgt-recall-3'];
  const records = targets.map(targetId => ({ targetId, date: '2026-10-01', label: 'Prompt fading begins', style: 'Solid', color: '#34634c' }));
  const first = apiService.addPhaseLinesBulk(records);
  assert.equal(first.created.length, 3);
  assert.equal(first.skipped.length, 0);
  const second = apiService.addPhaseLinesBulk(records);
  assert.equal(second.created.length, 0);
  assert.equal(second.skipped.length, 3, 're-applying the same annotation does not duplicate it');
  assert.equal(apiService.getSnapshot().phaseLines.length, before + 3);
  // The same rule applies to phase ranges and notes.
  const ranges = targets.map(targetId => ({ targetId, startDate: '2026-09-01', endDate: '2026-09-30', label: 'Baseline', color: '#34634c33' }));
  assert.equal(apiService.addPhaseRangesBulk(ranges).created.length, 3);
  assert.equal(apiService.addPhaseRangesBulk(ranges).skipped.length, 3);
  const notes = targets.map(targetId => ({ targetId, date: '2026-10-02', noteText: 'School holiday, short week.', staffName: 'Ana Ruiz, BCBA', color: '#34634c' }));
  assert.equal(apiService.addGraphNotesBulk(notes).created.length, 3);
  assert.equal(apiService.addGraphNotesBulk(notes).skipped.length, 3);
});

test('the report states the behaviour-reduction rule and the organisation graphing policy', () => {
  const model = buildReportModel({
    client: liam, template: 'clinical-review', programs: liamPrograms, sessions: liamSessions, serviceSessions: liamServices,
    standards: seed.clinicalStandards, asOfDate: seed.asOfDate
  });
  const reduction = model.sections.find(section => section.id === 'reduction');
  assert.ok(reduction, 'behaviour targets add a reduction-criteria section');
  assert.ok(reduction.bullets.length > 0);
  assert.match(reduction.bullets.join(' '), /reduction criterion|days sustained below/);
  const quality = model.sections.find(section => section.id === 'quality');
  assert.match(quality.bullets.join(' '), /Graphing policy: sessions with fewer than 5 trials/);
  const html = reportHtml(reduction ? model : model, { charts: {} });
  assert.match(html, /Behavior-reduction criteria/);
  assert.match(html, /Graphing policy/);
  // A skill-only scope has no behaviour targets, so the section is omitted rather than empty.
  const skillOnly = buildReportModel({
    client: liam, template: 'treatment-plan', programs: liamPrograms.filter(program => program.category === 'SkillAcquisition'),
    sessions: liamSessions, serviceSessions: liamServices, standards: seed.clinicalStandards, asOfDate: seed.asOfDate
  });
  assert.equal(skillOnly.sections.find(section => section.id === 'reduction'), undefined);
});
