import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../data/clinicalSeed.json' with { type: 'json' };
import {
  mean, median, quantile, sampleSd, linearRegression, binomialCriticalCount, binomialUpperTail, normalCdf,
  normalQuantile, tQuantile, poissonQuantile, areaUnderCurve, brierScore, solveLinear, addDays, dayNumber
} from '../frontend/src/utils/stats.js';
import {
  splitMiddle, stabilityEnvelope, movingAverage, percentNonoverlapping, percentExceedingMedian, nonoverlapOfAllPairs,
  dualCriterion, compareConditions, segmentByBoundaries, celeration, forecastLinear, projectThresholdDate,
  evaluateMastery, ioaSummary, napMagnitude, pndMagnitude, tauMagnitude, describeRule
} from '../frontend/src/utils/visualAnalysis.js';
import {
  contingency, functionProfile, scatterplot, weekdayBlockRates, precursorChains, settingEventEffects, sequenceFlows,
  phaseOn, timeBlock, weekdayOf, pareto, intensityTrend
} from '../frontend/src/utils/abcAnalytics.js';
import {
  trainLogistic, trainNaiveBayes, evaluateNaiveBayes, abcExamples, forecastTrend, buildSessionDataset,
  trainSessionForecastModel, aucInterval, weeksUntilBelow, trainPoisson
} from '../frontend/src/utils/predictiveModels.js';

const near = (actual, expected, tolerance = 1e-6, message) => assert.ok(Math.abs(actual - expected) <= tolerance, message || `${actual} != ${expected}`);
const series = values => values.map((y, x) => ({ x, y, key: String(x), date: addDays('2026-09-01', x) }));

test('descriptive statistics, regression and distribution helpers', () => {
  assert.equal(mean([1, 2, 3]), 2);
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  near(sampleSd([2, 4, 4, 4, 5, 5, 7, 9]), 2.138, 0.001);
  assert.equal(mean([]), null);
  const fit = linearRegression([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }]);
  near(fit.slope, 2); near(fit.intercept, 1); near(fit.r2, 1);
  near(normalCdf(1.96), 0.975, 0.0005);
  near(normalQuantile(0.975), 1.96, 0.001);
  near(tQuantile(0.975, 10), 2.228, 0.02);
  assert.equal(poissonQuantile(4, 0.5), 4);
  assert.deepEqual(solveLinear([[2, 0], [0, 4]], [2, 8]), [1, 2]);
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(dayNumber('2026-10-02') - dayNumber('2026-10-01'), 1);
  assert.equal(areaUnderCurve([0.9, 0.8, 0.2, 0.1], [1, 1, 0, 0]), 1);
  near(brierScore([1, 0], [1, 0]), 0);
});

test('binomial criteria match the Fisher, Kelley & Lomas (2003) dual-criterion table', () => {
  const expected = { 5: 5, 6: 6, 7: 7, 8: 7, 9: 8, 10: 9, 11: 9, 12: 10, 15: 12, 20: 15 };
  for (const [n, k] of Object.entries(expected)) assert.equal(binomialCriticalCount(Number(n)), k, `n=${n}`);
  near(binomialUpperTail(9, 10), 11 / 1024);
});

test('split-middle and stability envelopes follow White & Haring and Lane & Gast', () => {
  const line = splitMiddle(series([1, 3, 5, 7, 9, 11]));
  near(line.slope, 2); near(line.intercept, 1);
  // Half of the points fall on/above the split-middle line, half on/below.
  const noisy = series([2, 6, 3, 9, 5, 12, 8, 14]);
  const fit = splitMiddle(noisy);
  const above = noisy.filter(point => point.y >= fit.predict(point.x) - 1e-9).length;
  const below = noisy.filter(point => point.y <= fit.predict(point.x) + 1e-9).length;
  assert.ok(above >= 4 && below >= 4);
  assert.equal(stabilityEnvelope(series([10, 10, 11, 9, 10, 12])).stable, true);
  const unstable = stabilityEnvelope(series([1, 10, 20, 5, 30]));
  assert.equal(unstable.stable, false);
  near(unstable.width, 2.5);
  assert.equal(stabilityEnvelope(series([10, 20, 30, 40, 50]), { around: 'trend' }).stable, true);
  assert.deepEqual(movingAverage(series([3, 6, 9])).map(point => point.y), [3, 4.5, 6]);
});

test('nonoverlap effect sizes: PND, PEM, NAP, Tau and Tau-U', () => {
  const baseline = series([1, 2, 3]);
  const treatment = series([4, 5, 2]);
  near(percentNonoverlapping(baseline, treatment), 200 / 3);
  near(percentExceedingMedian(baseline, treatment), 250 / 3); // a tie with the median counts half
  near(percentNonoverlapping(series([5, 6, 4]), series([1, 2, 6]), 'decrease'), 200 / 3);
  const perfect = nonoverlapOfAllPairs(series([1, 2]), series([3, 4]));
  assert.equal(perfect.nap, 1); assert.equal(perfect.tau, 1);
  const tied = nonoverlapOfAllPairs(series([2, 2]), series([2, 3]));
  near(tied.nap, 0.75);
  near(tied.tau, 0.5);
  // A rising baseline trend lowers Tau-U relative to Tau.
  const trend = nonoverlapOfAllPairs(series([1, 2, 3, 4]), series([5, 6, 7]));
  assert.ok(trend.tauU < trend.tau);
  assert.equal(napMagnitude(0.95), 'Strong'); assert.equal(napMagnitude(0.7), 'Medium'); assert.equal(napMagnitude(0.5), 'Weak');
  assert.equal(pndMagnitude(95), 'Very effective'); assert.equal(pndMagnitude(40), 'Ineffective');
  assert.equal(tauMagnitude(0.9), 'Very large'); assert.equal(tauMagnitude(-0.1), 'Small');
});

test('conservative dual-criterion detects reliable change and rejects a continuing trend', () => {
  const baseline = series([20, 22, 19, 21, 20]);
  const strong = dualCriterion(baseline, series([40, 45, 42, 48, 50, 47, 52, 55, 53, 56]));
  assert.equal(strong.required, 9);
  assert.equal(strong.count, 10);
  assert.equal(strong.met, true);
  // A baseline already improving at the same rate is not evidence of treatment effect.
  const rising = series([10, 14, 18, 22, 26]);
  const continuing = dualCriterion(rising, series([30, 34, 38, 42, 46, 50]).map((point, index) => ({ ...point, y: point.y - 2 + (index % 2) })));
  assert.equal(continuing.met, false);
  const decrease = dualCriterion(series([12, 10, 11, 13, 12]), series([3, 2, 1, 2, 0, 1, 0]), { direction: 'decrease' });
  assert.equal(decrease.met, true);
  const comparison = compareConditions(series([12, 10, 11, 13, 12]), series([3, 2, 1, 2, 0, 1, 0]), { direction: 'decrease' });
  assert.equal(comparison.level.improved, true);
  assert.equal(comparison.immediacy.improved, true);
  assert.equal(comparison.overlap.pnd, 100);
  assert.equal(comparison.cdc.met, true);
});

test('phase segmentation, celeration, forecasting and threshold projection', () => {
  const points = series([1, 2, 3, 4, 5, 6]);
  const segments = segmentByBoundaries(points, [{ date: addDays('2026-09-01', 3), label: 'Teaching begins' }], 'Baseline');
  assert.deepEqual(segments.map(segment => [segment.label, segment.points.length]), [['Baseline', 3], ['Teaching begins', 3]]);
  const doubling = [0, 7, 14, 21].map(day => ({ date: addDays('2026-09-01', day), y: 2 ** (day / 7) }));
  near(celeration(doubling).weekly, 2, 1e-9);
  assert.equal(celeration(doubling).label, '×2.00 per week');
  const halving = [0, 7, 14].map(day => ({ date: addDays('2026-09-01', day), y: 8 / 2 ** (day / 7) }));
  assert.equal(celeration(halving).label, '÷2.00 per week');
  const forecast = forecastLinear(series([10, 20, 30, 40, 50]), { horizon: 2, maximum: 55 });
  assert.equal(forecast[0].x, 5);
  assert.equal(forecast[0].y, 55);
  assert.ok(forecast[1].low <= forecast[1].y && forecast[1].high >= forecast[1].y);
  const projected = projectThresholdDate(series([50, 55, 60, 65, 70]), 80, 'atLeast');
  assert.equal(projected.date, addDays('2026-09-01', 6));
});

test('mastery evaluation reports sessions, trials and days to criterion', () => {
  const rows = [40, 60, 80, 70, 80, 90, 100].map((value, index) => ({
    value, totalTrials: 10, timestamp: `${addDays('2026-09-01', index)}T10:00:00`
  }));
  const rule = { measure: 'percentCorrect', comparison: 'atLeast', threshold: 80, consecutiveSessions: 3 };
  const result = evaluateMastery(rows, rule, { startDate: '2026-09-01' });
  assert.equal(result.met, true);
  assert.equal(result.metDate, '2026-09-07');
  assert.equal(result.sessionsToCriterion, 7);
  assert.equal(result.trialsToCriterion, 70);
  assert.equal(result.daysToCriterion, 6);
  assert.equal(result.streak, 3);
  assert.equal(describeRule(rule), 'at least 80 % correct for 3 consecutive sessions');
  const behavior = evaluateMastery([{ value: 2, occurrenceCount: 2, timestamp: '2026-09-01T09:00:00' }, { value: 0, occurrenceCount: 0, timestamp: '2026-09-02T09:00:00' }],
    { measure: 'count', comparison: 'atMost', threshold: 1, consecutiveSessions: 2 });
  assert.equal(behavior.met, false); assert.equal(behavior.streak, 1);
});

test('IOA summaries report coverage, mean agreement and low-agreement sessions', () => {
  const rows = [{ value: 1, ioa: { percent: 100 } }, { value: 2, ioa: { percent: 75 } }, { value: 3 }, { value: 4 }, { value: null }];
  const summary = ioaSummary(rows);
  assert.equal(summary.sessions, 4);
  assert.equal(summary.coverage, 50);
  near(summary.mean, 87.5);
  assert.equal(summary.belowMinimum, 1);
  assert.equal(summary.meetsCoverage, true);
});

test('ABC contingencies, function profiles, flows and Pareto summaries', () => {
  const entries = [
    { antecedents: ['Demand', 'Noise'], behaviors: ['Scream'], consequences: ['Task removed'], timestamp: '2026-09-01T09:10:00' },
    { antecedents: ['Demand'], behaviors: ['Scream', 'Run'], consequences: ['Reprimand'], timestamp: '2026-09-01T09:12:00' },
    { antecedents: ['Wait'], behaviors: ['Run'], consequences: ['Item returned'], timestamp: '2026-09-02T10:40:00' }
  ];
  const table = contingency(entries, entry => entry.antecedents, entry => entry.behaviors);
  assert.equal(table.count('Demand', 'Scream'), 2);
  assert.equal(table.rowGivenColumn('Demand', 'Scream'), 1);
  near(table.columnGivenRow('Demand', 'Run'), 0.5);
  near(table.lift('Demand', 'Scream'), 1.5);
  const functions = { 'Task removed': 'Escape', Reprimand: 'Attention', 'Item returned': 'Tangible' };
  const [scream] = functionProfile(entries, ['Scream'], functions);
  assert.equal(scream.n, 2); assert.equal(scream.shares.Escape, 0.5); assert.equal(scream.leading, 'Escape');
  const flows = sequenceFlows(entries, { antecedentCategories: { Demand: 'Demand', Noise: 'Sensory', Wait: 'Waiting' }, consequenceFunctions: functions });
  near(flows.left.reduce((total, link) => total + link.value, 0), 3);
  assert.deepEqual(pareto(entries, 'antecedents').map(item => [item.label, item.count]), [['Demand', 2], ['Noise', 1], ['Wait', 1]]);
  assert.equal(timeBlock('2026-09-01T09:44:00', 30), '09:30');
  assert.equal(weekdayOf('2026-10-14'), 'Wed');
  assert.equal(phaseOn({ phaseHistory: [{ phase: 'Baseline', date: '2026-04-13' }, { phase: 'Acquisition', date: '2026-05-04' }] }, '2026-05-04T09:00:00'), 'Acquisition');
  assert.equal(intensityTrend([{ ...entries[0], intensity: 3, durationMinutes: 2 }], ['Scream']).series[0].points[0].intensity, 3);
});

test('scatterplots separate unobserved time from observed zeros and rates are exposure-adjusted', () => {
  const sessions = [
    { id: 's1', date: '2026-10-12', start: '09:00', end: '11:00', minutes: 120, status: 'Completed', serviceCode: '97153' },
    { id: 's2', date: '2026-10-13', start: '09:00', end: '10:00', minutes: 60, status: 'Completed', serviceCode: '97153' },
    { id: 's3', date: '2026-10-14', start: '09:00', end: '10:00', minutes: 60, status: 'Cancelled', serviceCode: '97153' }
  ];
  const entries = [{ timestamp: '2026-10-12T09:15:00', behaviors: ['A'] }, { timestamp: '2026-10-12T09:20:00', behaviors: ['A'] }];
  const plot = scatterplot(entries, sessions, { blockMinutes: 60 });
  assert.deepEqual(plot.cell('2026-10-12', '09:00'), { count: 2, observed: 60 });
  assert.deepEqual(plot.cell('2026-10-13', '09:00'), { count: 0, observed: 60 });
  assert.equal(plot.cell('2026-10-14', '09:00').observed, 0);
  const rates = weekdayBlockRates(entries, sessions);
  assert.equal(rates.cell('Mon', '09:00').rate, 2);
  assert.equal(rates.cell('Tue', '09:00').rate, 0);
});

test('precursor chains and setting-event effects find planted structure', () => {
  const entries = [];
  for (let day = 1; day <= 9; day++) {
    entries.push({ serviceSessionId: `s${day}`, timestamp: `2026-09-0${day}T09:00:00`, behaviors: ['Refusal'] });
    if (day % 3) entries.push({ serviceSessionId: `s${day}`, timestamp: `2026-09-0${day}T09:03:00`, behaviors: ['Drop'] });
    entries.push({ serviceSessionId: `s${day}`, timestamp: `2026-09-0${day}T11:00:00`, behaviors: ['Refusal'] });
  }
  const chains = precursorChains(entries, { withinMinutes: 10 });
  const link = chains.chains.find(chain => chain.from === 'Refusal' && chain.to === 'Drop');
  near(link.probability, 6 / 18);
  assert.ok(link.lift > 1);
  const sessions = Array.from({ length: 20 }, (_, index) => ({ id: `t${index}`, date: addDays('2026-09-01', index), start: '09:00', minutes: 60,
    status: 'Completed', serviceCode: '97153', ...(index % 4 === 0 ? { settingEvents: ['Poor sleep reported'] } : {}) }));
  const rows = sessions.map((session, index) => ({ serviceSessionId: session.id, targetId: 'b', value: 1, occurrenceCount: index % 4 === 0 ? 6 : 2 }));
  const [effect] = settingEventEffects(rows, sessions, ['b']);
  assert.equal(effect.event, 'Poor sleep reported');
  near(effect.ratio, 3);
  assert.ok(effect.low > 1);
});

test('logistic regression, naive Bayes and Poisson trend recover simple planted signals', () => {
  const features = [];
  const labels = [];
  for (let index = 0; index < 120; index++) {
    const risk = index % 3 === 0 ? 1 : 0;
    features.push([risk, index % 2]);
    labels.push(risk ? (index % 5 !== 0 ? 1 : 0) : (index % 7 === 0 ? 1 : 0));
  }
  const model = trainLogistic(features, labels, { lambda: 0.5 });
  assert.ok(model.beta[1] > 1.5 && Math.abs(model.beta[2]) < 0.8);
  assert.ok(model.predict([1, 0]) > 0.6 && model.predict([0, 0]) < 0.3);
  const interval = aucInterval(0.8, 20, 30);
  assert.ok(interval.low < 0.8 && interval.high > 0.8);

  const examples = Array.from({ length: 60 }, (_, index) => ({
    behavior: index % 2 ? 'Escape behavior' : 'Tangible behavior',
    features: { antecedents: [index % 2 ? 'Demand' : 'Item removed'], location: index % 2 ? 'Table' : 'Play', block: '09:00', weekday: 'Mon', events: ['None reported'] }
  }));
  const bayes = trainNaiveBayes(examples, example => example.behavior);
  assert.equal(bayes.predict({ antecedents: ['Demand'], location: 'Table' })[0].label, 'Escape behavior');
  const evaluation = evaluateNaiveBayes(examples.map((example, index) => ({ ...example, entry: { timestamp: `2026-09-01T09:${String(index).padStart(2, '0')}:00` } })), example => example.behavior);
  assert.equal(evaluation.accuracy, 1);
  assert.ok(evaluation.majorityAccuracy < 1);

  // Poisson regression with an exposure offset recovers a planted rate ratio of 2.
  const poissonRows = Array.from({ length: 80 }, (_, index) => ({ x: [index % 2], count: index % 2 ? (index % 4 === 1 ? 4 : 4) : 2, exposure: 2 }));
  const poisson = trainPoisson(poissonRows);
  near(Math.exp(poisson.beta[1]), 2, 1e-3);
  const decaying = Array.from({ length: 30 }, (_, index) => ({ date: addDays('2026-08-01', index * 2), count: Math.round(12 * 0.92 ** index), exposure: 3 }));
  const trend = forecastTrend(decaying, { weeks: 9 });
  assert.ok(trend.weeklyChange < 1);
  assert.ok(trend.forecast.at(-1).rate < trend.current.rate);
  assert.ok(trend.current.countLow <= trend.current.expectedCount + 1);
  assert.ok(weeksUntilBelow(trend, 0.5) != null);
});

test('the simulated seed contains the clinical patterns the analytics claim to surface', () => {
  const config = seed.abcConfigurations.find(item => item.clientId === 'cli-liam');
  const vocal = seed.programs.flatMap(program => program.targets).find(target => target.id === 'br-vocal');
  const liam = seed.abcEntries.filter(entry => entry.clientId === 'cli-liam');
  // Pre-intervention consequences for screaming are mostly escape (demand removed, quiet corner).
  const baselineEntries = liam.filter(entry => phaseOn(vocal, entry.timestamp) === 'Baseline');
  const [profile] = functionProfile(baselineEntries, [vocal.name], config.consequenceFunctions);
  assert.equal(profile.leading, vocal.functionHypothesis);
  // Escalation from screaming to elopement within a few minutes is overrepresented.
  const chain = precursorChains(liam).chains.find(item => item.from === vocal.name && item.to === 'Elopement / Leaving Area');
  assert.ok(chain.n >= 2 && chain.lift > 1, JSON.stringify(chain));
  // Setting events behave like motivating operations once the treatment trend is controlled for.
  const sessions = seed.serviceSessions.filter(session => session.clientId === 'cli-liam');
  const brIds = seed.programs.filter(program => program.clientId === 'cli-liam' && program.category === 'BehaviorReduction').map(program => program.targets[0].id);
  const effects = settingEventEffects(seed.sessionData, sessions, brIds);
  const sleep = effects.find(effect => effect.event === 'Poor sleep reported');
  assert.ok(sleep && sleep.ratio > 1.15, JSON.stringify(sleep));
  // Treatment reduced screaming: the latest treatment data show a reliable (CDC) decrease
  // from baseline with strong nonoverlap; early treatment includes an extinction burst.
  const start = vocal.phaseHistory.find(entry => entry.phase === 'Acquisition').date;
  const rows = seed.sessionData.filter(row => row.targetId === 'br-vocal' && row.value != null)
    .map((row, index) => ({ x: index, y: (60 * row.occurrenceCount) / row.lessonDurationMinutes, date: row.timestamp.slice(0, 10), key: row.id }));
  const baseline = rows.filter(row => row.date < start);
  const treatment = rows.filter(row => row.date >= start);
  const comparison = compareConditions(baseline, treatment.slice(-20), { direction: 'decrease' });
  assert.equal(comparison.cdc.met, true);
  assert.ok(comparison.overlap.nap >= 0.9, String(comparison.overlap.nap));
  assert.ok(mean(treatment.slice(0, 3).map(row => row.y)) > mean(baseline.map(row => row.y)), 'Extinction burst at the start of treatment');
  // The next-session forecast is evaluated on later sessions only and recovers the
  // planted motivating-operation effect of poor sleep (rate ratio > 1).
  const dataset = buildSessionDataset({ sessions, rows: seed.sessionData, target: vocal, primarySetting: 'Clinic', since: start });
  const forecast = trainSessionForecastModel(dataset);
  assert.ok(forecast.testN >= 60);
  assert.ok(forecast.weeklyChange < 1, 'Screaming is declining during treatment');
  assert.ok(forecast.coverage >= 0.7 && forecast.coverage <= 1);
  const sleepEffect = forecast.rateRatios.find(item => item.key === 'event:Poor sleep reported');
  assert.ok(sleepEffect.ratio > 1 && sleepEffect.low > 1, JSON.stringify(sleepEffect));
  const scenario = forecast.predict({ 'event:Poor sleep reported': true }, { exposure: 3 });
  const calm = forecast.predict({}, { exposure: 3 });
  assert.ok(scenario.expected > calm.expected && scenario.low <= scenario.expected && scenario.high >= scenario.expected);
  const examples = abcExamples(liam);
  const evaluation = evaluateNaiveBayes(examples, example => example.behavior);
  assert.ok(evaluation.accuracy > evaluation.majorityAccuracy, JSON.stringify(evaluation));
});
