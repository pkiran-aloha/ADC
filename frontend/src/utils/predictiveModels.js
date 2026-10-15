// Transparent, small-sample predictive models for behavior data. They are deliberately
// simple (ridge logistic regression, naive Bayes, Poisson trend) so every prediction
// can be explained, and they are always evaluated on *later* data than they were trained
// on (forward chaining), as recommended for individual time-series prediction
// (e.g., Ferina et al., 2023). Outputs support planning; they are not clinical decisions.
import { solveLinear, invertMatrix, mean, median, normalQuantile, poissonQuantile, normalCdf } from './stats.js';
import { weekdayOf, timeBlock } from './abcAnalytics.js';

const sigmoid = value => 1 / (1 + Math.exp(-value));
const dot = (a, b) => a.reduce((total, value, index) => total + value * b[index], 0);

// Ridge-penalized logistic regression fitted by iteratively reweighted least squares.
export function trainLogistic(features, labels, { lambda = 1, iterations = 30 } = {}) {
  if (!features.length) return null;
  const rows = features.map(row => [1, ...row]);
  const size = rows[0].length;
  let beta = new Array(size).fill(0);
  for (let iteration = 0; iteration < iterations; iteration++) {
    const hessian = Array.from({ length: size }, () => new Array(size).fill(0));
    const gradient = new Array(size).fill(0);
    rows.forEach((row, index) => {
      const probability = sigmoid(dot(row, beta));
      const weight = Math.max(1e-6, probability * (1 - probability));
      for (let j = 0; j < size; j++) {
        gradient[j] += (labels[index] - probability) * row[j];
        for (let k = 0; k < size; k++) hessian[j][k] += weight * row[j] * row[k];
      }
    });
    for (let j = 1; j < size; j++) {
      hessian[j][j] += lambda;
      gradient[j] -= lambda * beta[j];
    }
    const step = solveLinear(hessian, gradient);
    if (!step) break;
    beta = beta.map((value, index) => value + step[index]);
    if (Math.max(...step.map(Math.abs)) < 1e-7) break;
  }
  return { beta, predict: row => sigmoid(dot([1, ...row], beta)), contributions: row => row.map((value, index) => value * beta[index + 1]) };
}

// Hanley & McNeil (1982) standard error for an AUC estimate.
export function aucInterval(auc, positives, negatives) {
  if (auc == null || !positives || !negatives) return null;
  const q1 = auc / (2 - auc);
  const q2 = (2 * auc * auc) / (1 + auc);
  const se = Math.sqrt((auc * (1 - auc) + (positives - 1) * (q1 - auc * auc) + (negatives - 1) * (q2 - auc * auc)) / (positives * negatives));
  return { low: Math.max(0, auc - 1.96 * se), high: Math.min(1, auc + 1.96 * se), se };
}

// ---------------------------------------------------------------------------
// Next-session forecast: a Poisson regression of episode counts with an exposure offset,
// a local time trend and session context (setting events act as motivating operations).
// ---------------------------------------------------------------------------
const BREAK_DAYS = 4;

export function contextOf(session, { primarySetting, gap = 0 }) {
  return {
    events: session.settingEvents || [],
    setting: session.setting,
    nonPrimarySetting: session.setting !== primarySetting ? 1 : 0,
    afternoon: Number(session.start.slice(0, 2)) >= 12 ? 1 : 0,
    weekday: weekdayOf(session.date),
    afterBreak: gap >= BREAK_DAYS ? 1 : 0
  };
}

const weeksBetween = (from, to) => (new Date(`${to}T12:00:00Z`) - new Date(`${from}T12:00:00Z`)) / (7 * 86400000);

// One example per completed appointment with a measured (tracked) record for the target.
export function buildSessionDataset({ sessions, rows, target, primarySetting, since = null }) {
  const byService = new Map(rows.filter(row => row.targetId === target.id && row.value != null).map(row => [row.serviceSessionId, row]));
  const ordered = sessions
    .filter(session => session.status === 'Completed' && session.serviceCode !== '97156')
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const examples = [];
  let previous = null;
  for (const session of ordered) {
    const gap = previous ? Math.round(weeksBetween(previous, session.date) * 7) : 0;
    previous = session.date;
    const row = byService.get(session.id);
    if (!row || (since && session.date < since)) continue;
    const interval = target.type === 'IntervalData';
    examples.push({
      session, date: session.date,
      count: interval ? row.occurredIntervals : row.occurrenceCount || 0,
      exposure: interval ? row.totalIntervals : row.lessonDurationMinutes / 60,
      context: contextOf(session, { primarySetting, gap })
    });
  }
  const origin = examples[0]?.date;
  examples.forEach(example => { example.weeks = origin ? weeksBetween(origin, example.date) : 0; });
  return examples;
}

// Context features are derived from the data so a client never sees an irrelevant input.
export function contextFeatures(examples) {
  const count = predicate => examples.filter(predicate).length;
  const features = [];
  const events = [...new Set(examples.flatMap(example => example.context.events))].sort();
  for (const event of events) {
    if (count(example => example.context.events.includes(event)) >= 3) {
      features.push({ key: `event:${event}`, label: event, group: 'Setting events', value: context => (context.events.includes(event) ? 1 : 0) });
    }
  }
  if (count(example => example.context.nonPrimarySetting) >= 4 && count(example => !example.context.nonPrimarySetting) >= 4) {
    features.push({ key: 'nonPrimarySetting', label: 'Outside the usual setting', group: 'Appointment', value: context => context.nonPrimarySetting });
  }
  if (count(example => example.context.afternoon) >= 4 && count(example => !example.context.afternoon) >= 4) {
    features.push({ key: 'afternoon', label: 'Afternoon appointment', group: 'Appointment', value: context => context.afternoon });
  }
  for (const weekday of ['Mon', 'Fri']) {
    if (count(example => example.context.weekday === weekday) >= 4) {
      features.push({ key: `weekday:${weekday}`, label: weekday === 'Mon' ? 'Monday' : 'Friday', group: 'Appointment', value: context => (context.weekday === weekday ? 1 : 0) });
    }
  }
  if (count(example => example.context.afterBreak) >= 3) {
    features.push({ key: 'afterBreak', label: `First session after ${BREAK_DAYS}+ days`, group: 'Appointment', value: context => context.afterBreak });
  }
  return features;
}

function poissonRows(examples, features) {
  return examples.map(example => ({ x: [example.weeks, ...features.map(feature => feature.value(example.context))],
    count: example.count, exposure: example.exposure }));
}

function predictPoisson(fit, x, exposure, level = 0.8) {
  const design = [1, ...x];
  const eta = dot(design, fit.beta);
  const variance = fit.covariance
    ? design.reduce((total, xi, i) => total + design.reduce((inner, xj, j) => inner + xi * fit.covariance[i][j] * xj, 0), 0) : 0;
  const z = normalQuantile(0.5 + level / 2);
  const se = Math.sqrt(Math.max(0, variance));
  const expected = exposure * Math.exp(eta);
  return { expected, low: poissonQuantile(exposure * Math.exp(eta - z * se), (1 - level) / 2),
    high: poissonQuantile(exposure * Math.exp(eta + z * se), (1 + level) / 2) };
}

// Rolling-origin evaluation: every prediction comes from a model that only saw earlier
// sessions, compared against the naive "average of the last five sessions" forecast.
export function trainSessionForecastModel(examples, { minimumTraining = 25, refitEvery = 4, lambda = 0.8, level = 0.8 } = {}) {
  if (examples.length < minimumTraining + 10) return { insufficient: true, n: examples.length };
  const features = contextFeatures(examples);
  const rows = poissonRows(examples, features);
  let rolling = null;
  const errors = [];
  for (let index = minimumTraining; index < rows.length; index++) {
    if (!rolling || (index - minimumTraining) % refitEvery === 0) rolling = trainPoisson(rows.slice(0, index), { lambda }) || rolling;
    if (!rolling) continue;
    const prediction = predictPoisson(rolling, rows[index].x, rows[index].exposure, level);
    const recent = rows.slice(Math.max(0, index - 5), index);
    const naive = rows[index].exposure * recent.reduce((total, row) => total + row.count, 0) / recent.reduce((total, row) => total + row.exposure, 0);
    errors.push({ model: Math.abs(prediction.expected - rows[index].count), naive: Math.abs(naive - rows[index].count),
      covered: rows[index].count >= prediction.low && rows[index].count <= prediction.high });
  }
  const fit = trainPoisson(rows, { lambda });
  if (!fit) return { insufficient: true, n: examples.length };
  const maeModel = mean(errors.map(error => error.model));
  const maeNaive = mean(errors.map(error => error.naive));
  const last = examples.at(-1);
  const rateRatios = features.map((feature, index) => {
    const coefficient = fit.beta[index + 2];
    const se = fit.covariance ? Math.sqrt(Math.max(0, fit.covariance[index + 2][index + 2])) : null;
    return { ...feature, ratio: Math.exp(coefficient), low: se ? Math.exp(coefficient - 1.96 * se) : null, high: se ? Math.exp(coefficient + 1.96 * se) : null,
      n: examples.filter(example => feature.value(example.context)).length };
  }).sort((a, b) => Math.abs(Math.log(b.ratio)) - Math.abs(Math.log(a.ratio)));
  const trendSe = fit.covariance ? Math.sqrt(Math.max(0, fit.covariance[1][1])) : null;
  return {
    features, fit, n: examples.length, testN: errors.length, since: examples[0].date, testPeriod: [examples[minimumTraining].date, last.date],
    maeModel, maeNaive, improvement: maeNaive ? 1 - maeModel / maeNaive : null,
    coverage: mean(errors.map(error => (error.covered ? 1 : 0))), level,
    weeklyChange: Math.exp(fit.beta[1]),
    weeklyChangeInterval: trendSe ? [Math.exp(fit.beta[1] - 1.96 * trendSe), Math.exp(fit.beta[1] + 1.96 * trendSe)] : null,
    rateRatios, typicalExposure: median(examples.slice(-10).map(example => example.exposure)), lastWeeks: last.weeks,
    predict: (inputs, { exposure, weeksAhead = 0 } = {}) => {
      const x = [last.weeks + weeksAhead, ...features.map(feature => (inputs[feature.key] ? 1 : 0))];
      return predictPoisson(fit, x, exposure ?? median(examples.slice(-10).map(example => example.exposure)), level);
    }
  };
}

// ---------------------------------------------------------------------------
// Naive Bayes over ABC context: which behavior, and how severe, given a situation?
// ---------------------------------------------------------------------------
export function abcExamples(entries, blockMinutes = 60) {
  return [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map(entry => ({
    entry,
    behavior: entry.behaviors[0],
    severe: entry.intensity >= 4 ? 'High intensity (4-5)' : 'Lower intensity (1-3)',
    features: {
      antecedents: [...new Set(entry.antecedents)],
      location: entry.location,
      block: timeBlock(entry.timestamp, blockMinutes),
      weekday: weekdayOf(entry.timestamp),
      events: (entry.settingEvents || []).length ? entry.settingEvents : ['None reported']
    }
  }));
}

const SET_FEATURES = ['antecedents', 'events'];

export function trainNaiveBayes(examples, labelOf, { alpha = 1, featureNames = ['antecedents', 'location', 'block', 'weekday', 'events'] } = {}) {
  const classes = [...new Set(examples.map(labelOf))].sort();
  const classCounts = Object.fromEntries(classes.map(name => [name, 0]));
  const vocab = Object.fromEntries(featureNames.map(name => [name, new Set()]));
  const counts = {};
  for (const example of examples) {
    const label = labelOf(example);
    classCounts[label] += 1;
    for (const name of featureNames) {
      const values = SET_FEATURES.includes(name) ? example.features[name] : [example.features[name]];
      for (const value of values) {
        vocab[name].add(value);
        const key = `${label}\u0000${name}\u0000${value}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
  }
  const total = examples.length;
  const likelihood = (label, name, value) => {
    const count = counts[`${label}\u0000${name}\u0000${value}`] || 0;
    // Bernoulli likelihood for set-valued features, categorical for the others.
    return SET_FEATURES.includes(name)
      ? (count + alpha) / (classCounts[label] + 2 * alpha)
      : (count + alpha) / (classCounts[label] + alpha * Math.max(1, vocab[name].size));
  };
  function predict(features) {
    const scores = classes.map(label => {
      let score = Math.log((classCounts[label] + alpha) / (total + alpha * classes.length));
      for (const name of featureNames) {
        const value = features[name];
        if (value == null) continue;
        if (SET_FEATURES.includes(name)) {
          const present = new Set(value);
          for (const item of vocab[name]) {
            const p = likelihood(label, name, item);
            score += Math.log(present.has(item) ? p : 1 - p);
          }
        } else if (vocab[name].has(value)) {
          score += Math.log(likelihood(label, name, value));
        }
      }
      return score;
    });
    const top = Math.max(...scores);
    const exp = scores.map(score => Math.exp(score - top));
    const normalizer = exp.reduce((sum, value) => sum + value, 0);
    return classes.map((label, index) => ({ label, probability: exp[index] / normalizer })).sort((a, b) => b.probability - a.probability);
  }
  return { classes, classCounts, vocab, predict, n: total };
}

export function evaluateNaiveBayes(examples, labelOf, { trainFraction = 0.7 } = {}) {
  if (examples.length < 30) return { insufficient: true, n: examples.length };
  const cut = Math.floor(examples.length * trainFraction);
  const model = trainNaiveBayes(examples.slice(0, cut), labelOf);
  const test = examples.slice(cut);
  const predictions = test.map(example => model.predict(example.features));
  const truth = test.map(labelOf);
  const accuracy = mean(predictions.map((prediction, index) => (prediction[0].label === truth[index] ? 1 : 0)));
  const topTwo = mean(predictions.map((prediction, index) => (prediction.slice(0, 2).some(item => item.label === truth[index]) ? 1 : 0)));
  const majority = Object.entries(model.classCounts).sort((a, b) => b[1] - a[1])[0][0];
  const majorityAccuracy = mean(truth.map(label => (label === majority ? 1 : 0)));
  const brier = mean(predictions.map((prediction, index) => prediction.reduce((total, item) => total + (item.probability - (item.label === truth[index] ? 1 : 0)) ** 2, 0)));
  const confusion = model.classes.map(actual => model.classes.map(predicted => predictions.filter((prediction, index) => truth[index] === actual && prediction[0].label === predicted).length));
  // Exact one-sided binomial test of accuracy against the majority-class rate.
  const correct = Math.round(accuracy * test.length);
  const z = (correct - majorityAccuracy * test.length) / Math.sqrt(test.length * majorityAccuracy * (1 - majorityAccuracy) || 1);
  return { n: examples.length, trainN: cut, testN: test.length, accuracy, topTwo, majority, majorityAccuracy, brier, confusion,
    classes: model.classes, pValue: 1 - normalCdf(z), testPeriod: [test[0].entry.timestamp.slice(0, 10), test.at(-1).entry.timestamp.slice(0, 10)] };
}

// ---------------------------------------------------------------------------
// Poisson trend forecast with exposure (episodes per observed hour or per interval).
// ---------------------------------------------------------------------------
export function trainPoisson(rows, { lambda = 1e-4, iterations = 40 } = {}) {
  // rows: [{ x: [covariates], count, exposure }]
  if (rows.length < 4) return null;
  const size = rows[0].x.length + 1;
  const design = rows.map(row => [1, ...row.x]);
  const offset = rows.map(row => Math.log(Math.max(row.exposure, 1e-9)));
  const meanRate = rows.reduce((total, row) => total + row.count, 0) / rows.reduce((total, row) => total + row.exposure, 0);
  let beta = [Math.log(Math.max(meanRate, 1e-3)), ...new Array(size - 1).fill(0)];
  let information = null;
  for (let iteration = 0; iteration < iterations; iteration++) {
    information = Array.from({ length: size }, () => new Array(size).fill(0));
    const score = new Array(size).fill(0);
    design.forEach((x, index) => {
      const mu = Math.exp(Math.min(30, dot(x, beta) + offset[index]));
      for (let j = 0; j < size; j++) {
        score[j] += (rows[index].count - mu) * x[j];
        for (let k = 0; k < size; k++) information[j][k] += mu * x[j] * x[k];
      }
    });
    for (let j = 1; j < size; j++) {
      information[j][j] += lambda;
      score[j] -= lambda * beta[j];
    }
    const step = solveLinear(information, score);
    if (!step) return null;
    beta = beta.map((value, index) => value + step[index]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  const covariance = invertMatrix(information);
  return { beta, covariance };
}

// series: chronological [{ date, count, exposure }] where exposure is hours (or intervals).
export function forecastTrend(series, { weeks = 8, horizonWeeks = 2, level = 0.8, typicalExposure } = {}) {
  if (series.length < 6) return null;
  const lastDate = series.at(-1).date;
  const end = new Date(`${lastDate}T12:00:00Z`).getTime();
  const windowed = series.filter(point => (end - new Date(`${point.date}T12:00:00Z`).getTime()) / 86400000 <= weeks * 7);
  if (windowed.length < 6) return null;
  const toWeeks = date => (new Date(`${date}T12:00:00Z`).getTime() - end) / (7 * 86400000);
  const fit = trainPoisson(windowed.map(point => ({ x: [toWeeks(point.date)], count: point.count, exposure: point.exposure })));
  if (!fit || !fit.covariance) return null;
  const z = normalQuantile(0.5 + level / 2);
  const exposure = typicalExposure ?? median(windowed.map(point => point.exposure));
  const at = weeksAhead => {
    const x = [1, weeksAhead];
    const eta = dot(x, fit.beta);
    const variance = x.reduce((total, xi, i) => total + x.reduce((inner, xj, j) => inner + xi * fit.covariance[i][j] * xj, 0), 0);
    const se = Math.sqrt(Math.max(0, variance));
    const rate = Math.exp(eta);
    const low = Math.exp(eta - z * se);
    const high = Math.exp(eta + z * se);
    return { weeksAhead, rate, rateLow: low, rateHigh: high,
      countLow: poissonQuantile(low * exposure, (1 - level) / 2), countHigh: poissonQuantile(high * exposure, (1 + level) / 2),
      expectedCount: rate * exposure };
  };
  const forecast = [];
  for (let week = 0; week <= horizonWeeks; week += 0.5) forecast.push(at(week));
  return { fit, weeklyChange: Math.exp(fit.beta[1]), current: at(0), forecast, exposure, window: windowed.length,
    since: windowed[0].date, at };
}

// First future week at which the expected per-session count meets an upper threshold.
export function weeksUntilBelow(trend, threshold, { maxWeeks = 26 } = {}) {
  if (!trend || trend.weeklyChange >= 1) return null;
  for (let week = 0; week <= maxWeeks; week += 0.5) if (trend.at(week).expectedCount <= threshold) return week;
  return null;
}
