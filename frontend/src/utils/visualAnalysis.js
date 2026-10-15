// Visual-analysis helpers for single-case data (BACB TCO C.11, D.4-D.7, H.7).
// Points are chronologically ordered {x, y, date?} where x is the observation order or
// a day number. Nothing here makes clinical decisions; it quantifies what clinicians
// already inspect: level, trend, variability, immediacy, overlap and consistency
// (Kratochwill et al., 2010), plus the conservative dual-criterion (Fisher et al., 2003).
import {
  mean, median, sampleSd, linearRegression, binomialCriticalCount, binomialUpperTail,
  normalCdf, tQuantile, dayNumber, addDays
} from './stats.js';

const better = (direction, value, reference) => (direction === 'decrease' ? value < reference : value > reference);

export function splitMiddle(points) {
  if (points.length < 4) return null;
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const half = Math.floor(sorted.length / 2);
  const first = sorted.slice(0, half);
  const second = sorted.slice(sorted.length - half);
  const x1 = median(first.map(point => point.x));
  const x2 = median(second.map(point => point.x));
  if (x1 === x2) return null;
  const y1 = median(first.map(point => point.y));
  const y2 = median(second.map(point => point.y));
  const slope = (y2 - y1) / (x2 - x1);
  const quarterIntercept = y1 - slope * x1;
  // White & Haring (1980): shift the quarter-intersect line so half of the data fall on
  // or above it and half on or below it.
  const shift = median(sorted.map(point => point.y - (quarterIntercept + slope * point.x)));
  const intercept = quarterIntercept + shift;
  return { slope, intercept, quarterIntercept, predict: x => intercept + slope * x };
}

// Lane & Gast (2014): stable when >= 80% of points fall within +/-25% of the median
// (level envelope) or of the split-middle line (trend envelope).
export function stabilityEnvelope(points, { band = 0.25, minimum = 0.8, around = 'median' } = {}) {
  if (!points.length) return null;
  const center = median(points.map(point => point.y));
  const trend = around === 'trend' ? splitMiddle(points) : null;
  const width = band * Math.abs(center);
  const within = points.filter(point => Math.abs(point.y - (trend ? trend.predict(point.x) : center)) <= width + 1e-9).length;
  const percentWithin = (100 * within) / points.length;
  return { center, width, lower: center - width, upper: center + width, percentWithin,
    stable: percentWithin >= minimum * 100, trend, allZero: points.every(point => point.y === 0) };
}

export function movingAverage(points, window = 3) {
  return points.map((point, index) => {
    const slice = points.slice(Math.max(0, index - window + 1), index + 1);
    return { ...point, y: mean(slice.map(item => item.y)), complete: slice.length === window };
  });
}

export function describePhase(points, options = {}) {
  if (!points.length) return null;
  const values = points.map(point => point.y);
  const regression = linearRegression(points);
  const split = splitMiddle(points);
  const average = mean(values);
  const sd = sampleSd(values);
  return {
    n: values.length, mean: average, median: median(values), min: Math.min(...values), max: Math.max(...values),
    range: Math.max(...values) - Math.min(...values), sd, cv: average ? sd / Math.abs(average) : null,
    slope: regression?.slope ?? null, splitSlope: split?.slope ?? null, regression, split,
    firstThree: mean(values.slice(0, 3)), lastThree: mean(values.slice(-3)),
    level: stabilityEnvelope(points, options), trendEnvelope: stabilityEnvelope(points, { ...options, around: 'trend' })
  };
}

export function percentNonoverlapping(baseline, treatment, direction = 'increase') {
  if (!baseline.length || !treatment.length) return null;
  const values = baseline.map(point => point.y);
  const extreme = direction === 'decrease' ? Math.min(...values) : Math.max(...values);
  return (100 * treatment.filter(point => better(direction, point.y, extreme)).length) / treatment.length;
}

export function percentExceedingMedian(baseline, treatment, direction = 'increase') {
  if (!baseline.length || !treatment.length) return null;
  const middle = median(baseline.map(point => point.y));
  const score = treatment.reduce((total, point) => total + (point.y === middle ? 0.5 : better(direction, point.y, middle) ? 1 : 0), 0);
  return (100 * score) / treatment.length;
}

// Parker & Vannest (2009) NAP with a one-tailed Mann-Whitney normal approximation,
// plus Tau (nonoverlap) and Tau-U corrected for baseline trend (Parker et al., 2011).
export function nonoverlapOfAllPairs(baseline, treatment, direction = 'increase') {
  const nA = baseline.length;
  const nB = treatment.length;
  if (!nA || !nB) return null;
  let positive = 0;
  let negative = 0;
  let ties = 0;
  for (const a of baseline) {
    for (const b of treatment) {
      if (a.y === b.y) ties += 1;
      else if (better(direction, b.y, a.y)) positive += 1;
      else negative += 1;
    }
  }
  const pairs = nA * nB;
  const nap = (positive + 0.5 * ties) / pairs;
  const sd = Math.sqrt((nA * nB * (nA + nB + 1)) / 12);
  const z = sd ? (positive + 0.5 * ties - pairs / 2) / sd : 0;
  let trendA = 0;
  for (let i = 0; i < nA; i++) {
    for (let j = i + 1; j < nA; j++) {
      if (baseline[j].y !== baseline[i].y) trendA += better(direction, baseline[j].y, baseline[i].y) ? 1 : -1;
    }
  }
  return { nap, tau: (positive - negative) / pairs, tauU: (positive - negative - trendA) / pairs, pValue: 1 - normalCdf(z),
    positive, negative, ties, pairs };
}

// Fisher, Kelley & Lomas (2003): project the baseline mean and OLS trend into the
// treatment phase, shift both by 0.25 SD in the therapeutic direction (CDC), and
// test the count of treatment points beyond both lines against a binomial criterion.
export function dualCriterion(baseline, treatment, { direction = 'increase', shiftSd = 0.25, alpha = 0.05 } = {}) {
  if (baseline.length < 3 || treatment.length < 3) return null;
  const order = [...baseline, ...treatment].map((point, index) => ({ ...point, order: index }));
  const base = order.slice(0, baseline.length);
  const treated = order.slice(baseline.length);
  const values = base.map(point => point.y);
  const sd = sampleSd(values) || 0;
  const sign = direction === 'decrease' ? -1 : 1;
  const shift = sign * shiftSd * sd;
  const average = mean(values);
  const fit = linearRegression(base.map(point => ({ x: point.order, y: point.y }))) || { predict: () => average };
  const meanLine = average + shift;
  const trendAt = point => fit.predict(point.order) + shift;
  const beyond = treated.filter(point => better(direction, point.y, meanLine) && better(direction, point.y, trendAt(point)));
  const required = binomialCriticalCount(treated.length, alpha);
  return {
    count: beyond.length, n: treated.length, required, met: required != null && beyond.length >= required,
    pValue: binomialUpperTail(beyond.length, treated.length), meanLine, shift,
    trendLine: treated.map(point => ({ ...point, y: trendAt(point) })),
    beyondKeys: new Set(beyond.map(point => point.key))
  };
}

export function napMagnitude(nap) {
  if (nap == null) return null;
  if (nap >= 0.93) return 'Strong';
  if (nap >= 0.66) return 'Medium';
  return 'Weak';
}

export function pndMagnitude(pnd) {
  if (pnd == null) return null;
  if (pnd >= 90) return 'Very effective';
  if (pnd >= 70) return 'Effective';
  if (pnd >= 50) return 'Questionable';
  return 'Ineffective';
}

// Vannest & Ninci (2015) guidance for Tau magnitudes.
export function tauMagnitude(tau) {
  if (tau == null) return null;
  const value = Math.abs(tau);
  if (value > 0.8) return 'Very large';
  if (value > 0.6) return 'Large';
  if (value > 0.2) return 'Moderate';
  return 'Small';
}

export function compareConditions(baseline, treatment, { direction = 'increase', band = 0.25, minimum = 0.8 } = {}) {
  const A = describePhase(baseline, { band, minimum });
  const B = describePhase(treatment, { band, minimum });
  if (!A || !B) return null;
  const sign = direction === 'decrease' ? -1 : 1;
  const overlap = nonoverlapOfAllPairs(baseline, treatment, direction);
  const pnd = percentNonoverlapping(baseline, treatment, direction);
  const pem = percentExceedingMedian(baseline, treatment, direction);
  return {
    direction, A, B,
    level: { change: B.mean - A.mean, medianChange: B.median - A.median,
      percentChange: A.mean ? (100 * (B.mean - A.mean)) / Math.abs(A.mean) : null, improved: sign * (B.mean - A.mean) > 0 },
    trend: { before: A.slope, after: B.slope },
    variability: { before: A.sd, after: B.sd, stableBefore: A.level.stable, stableAfter: B.level.stable },
    immediacy: { before: A.lastThree, after: B.firstThree, change: B.firstThree - A.lastThree,
      improved: sign * (B.firstThree - A.lastThree) > 0 },
    overlap: { pnd, pem, ...overlap, napMagnitude: napMagnitude(overlap?.nap), pndMagnitude: pndMagnitude(pnd),
      tauMagnitude: tauMagnitude(overlap?.tau) },
    cdc: dualCriterion(baseline, treatment, { direction })
  };
}

// Group chronologically ordered points by boundaries [{date, label}] (phase changes).
export function segmentByBoundaries(points, boundaries, firstLabel = 'Start') {
  const sorted = [...boundaries].sort((a, b) => a.date.localeCompare(b.date));
  const segments = [{ label: firstLabel, start: null, points: [] }];
  for (const boundary of sorted) segments.push({ label: boundary.label, start: boundary.date, phase: boundary.phase, points: [] });
  for (const point of points) {
    let index = 0;
    for (let position = 1; position < segments.length; position++) if (point.date >= segments[position].start) index = position;
    segments[index].points.push(point);
  }
  return segments.filter(segment => segment.points.length);
}

// Lindsley's celeration: the x/÷ change in a rate per week, fitted on log10 rates.
export function celeration(points) {
  const usable = points.filter(point => point.y > 0 && point.date);
  if (usable.length < 3) return null;
  const fit = linearRegression(usable.map(point => ({ x: dayNumber(point.date), y: Math.log10(point.y) })));
  if (!fit) return null;
  const weekly = 10 ** (fit.slope * 7);
  const residuals = usable.map(point => Math.log10(point.y) - fit.predict(dayNumber(point.date)));
  return { weekly, label: weekly >= 1 ? `×${weekly.toFixed(2)} per week` : `÷${(1 / weekly).toFixed(2)} per week`,
    bounce: 10 ** (Math.max(...residuals) - Math.min(...residuals)), fit, excludedZeros: points.length - usable.length,
    valueAt: date => 10 ** fit.predict(dayNumber(date)) };
}

// Linear projection with an approximate prediction band (for trend-based forecasting).
export function forecastLinear(points, { horizon = 5, level = 0.8, minimum = -Infinity, maximum = Infinity, step } = {}) {
  if (points.length < 4) return null;
  const fit = linearRegression(points);
  if (!fit) return null;
  const gaps = points.slice(1).map((point, index) => point.x - points[index].x).filter(gap => gap > 0);
  const delta = step ?? (median(gaps) || 1);
  const t = tQuantile(0.5 + level / 2, Math.max(1, fit.n - 2));
  const clampValue = value => Math.max(minimum, Math.min(maximum, value));
  const last = points.at(-1).x;
  return Array.from({ length: horizon }, (_, index) => {
    const x = last + delta * (index + 1);
    const se = fit.residualSd * Math.sqrt(1 + 1 / fit.n + (x - fit.xMean) ** 2 / fit.sxx);
    const y = fit.predict(x);
    return { x, y: clampValue(y), low: clampValue(y - t * se), high: clampValue(y + t * se) };
  });
}

// Days from the last observation until the fitted trend reaches a threshold.
export function projectThresholdDate(points, threshold, comparison, { maxDays = 180 } = {}) {
  const dated = points.filter(point => point.date);
  if (dated.length < 4) return null;
  const fit = linearRegression(dated.map(point => ({ x: dayNumber(point.date), y: point.y })));
  if (!fit || fit.slope === 0) return null;
  const meets = value => ({ atLeast: value >= threshold, above: value > threshold, atMost: value <= threshold, below: value < threshold })[comparison];
  const lastDate = dated.at(-1).date;
  const start = dayNumber(lastDate);
  for (let day = 1; day <= maxDays; day++) if (meets(fit.predict(start + day))) return { date: addDays(lastDate, day), days: day, slopePerWeek: fit.slope * 7 };
  return { date: null, days: null, slopePerWeek: fit.slope * 7 };
}

export function ruleValue(row, rule) {
  switch (rule.measure) {
    case 'percentCorrect':
    case 'percentIntervals': return row.value;
    case 'intervalCount': return row.occurredIntervals;
    case 'count': return row.occurrenceCount;
    case 'ratePerHour': return row.lessonDurationMinutes ? (60 * row.occurrenceCount) / row.lessonDurationMinutes : null;
    case 'correctPerMinute': return row.lessonDurationMinutes ? row.occurrenceCount / row.lessonDurationMinutes : null;
    case 'durationSeconds': return row.durationSeconds;
    default: return null;
  }
}

export function meetsRule(value, rule) {
  if (value == null) return false;
  return ({ atLeast: value >= rule.threshold, atMost: value <= rule.threshold, below: value < rule.threshold,
    above: value > rule.threshold })[rule.comparison] ?? false;
}

export const RULE_UNITS = {
  percentCorrect: '% correct', percentIntervals: '% of intervals', intervalCount: 'intervals', count: 'per session',
  ratePerHour: 'per hour', correctPerMinute: 'correct per minute', durationSeconds: 'seconds'
};
export const COMPARISON_WORDS = { atLeast: 'at least', atMost: 'at most', below: 'below', above: 'above' };

export function describeRule(rule) {
  if (!rule) return null;
  return `${COMPARISON_WORDS[rule.comparison]} ${rule.threshold} ${RULE_UNITS[rule.measure]} for ${rule.consecutiveSessions} consecutive sessions`;
}

// Consecutive-session mastery evaluation (TCO C.7: trials and sessions to criterion).
export function evaluateMastery(rows, rule, { startDate } = {}) {
  if (!rule) return null;
  const teaching = rows.filter(row => row.value != null && (!startDate || row.timestamp.slice(0, 10) >= startDate));
  let streak = 0;
  let metIndex = -1;
  teaching.forEach((row, index) => {
    streak = meetsRule(ruleValue(row, rule), rule) ? streak + 1 : 0;
    if (metIndex < 0 && streak >= rule.consecutiveSessions) metIndex = index;
  });
  const met = metIndex >= 0 ? teaching[metIndex] : null;
  const trials = rows => rows.reduce((total, row) => total + (row.totalTrials || 0), 0);
  return {
    rule, required: rule.consecutiveSessions, streak, sessions: teaching.length, met: Boolean(met),
    metDate: met?.timestamp.slice(0, 10) || null,
    sessionsToCriterion: met ? metIndex + 1 : null,
    trialsToCriterion: met ? trials(teaching.slice(0, metIndex + 1)) || null : null,
    daysToCriterion: met && startDate ? dayNumber(met.timestamp) - dayNumber(startDate) : null,
    latest: teaching.length ? ruleValue(teaching.at(-1), rule) : null
  };
}

// Interobserver agreement coverage and quality (Cooper, Heron & Heward, 2020).
export function ioaSummary(rows, { minimumAgreement = 80, minimumCoverage = 20 } = {}) {
  const measured = rows.filter(row => row.value != null && row.qualitativeEntry == null);
  const checked = measured.filter(row => row.ioa);
  const percents = checked.map(row => row.ioa.percent);
  const coverage = measured.length ? (100 * checked.length) / measured.length : null;
  return {
    sessions: measured.length, checked: checked.length, coverage, mean: mean(percents),
    min: percents.length ? Math.min(...percents) : null, belowMinimum: percents.filter(value => value < minimumAgreement).length,
    meetsCoverage: coverage != null && coverage >= minimumCoverage,
    meetsAgreement: percents.length > 0 && mean(percents) >= minimumAgreement,
    methods: [...new Set(checked.map(row => row.ioa.method))]
  };
}

// ---------------------------------------------------------------------------
// Behavior-reduction mastery: a baseline level and a configured percentage reduction
// sustained across a defined number of days. Added for the analytics feedback round.
// ---------------------------------------------------------------------------

export const REDUCTION_BASELINE_SOURCES = [
  { value: 'mean', label: 'Baseline mean' },
  { value: 'median', label: 'Baseline median' },
  { value: 'max', label: 'Highest baseline value' }
];

// The value the treated data must stay at or below.
export function reductionCriterion(baselineValues = [], { reductionPercent = 80, baselineSource = 'mean' } = {}) {
  const values = baselineValues.filter(value => Number.isFinite(value));
  if (!values.length) return null;
  const base = baselineSource === 'median' ? median(values) : baselineSource === 'max' ? Math.max(...values) : mean(values);
  if (!Number.isFinite(base)) return null;
  const percent = Math.min(100, Math.max(0, Number(reductionPercent) || 0));
  return {
    baseline: Math.round(base * 100) / 100,
    baselineSource,
    reductionPercent: percent,
    value: Math.round(base * (1 - percent / 100) * 100) / 100,
    label: `${percent}% below the ${baselineSource === 'max' ? 'highest' : baselineSource} baseline of ${Math.round(base * 100) / 100}`
  };
}

// Evaluate the rule against the target's whole history: baseline window, then a run of
// consecutive measured days inside the criterion.
export function evaluateReductionMastery(rows = [], rule = {}, { startDate = null, sustainedDays = 14, reductionPercent = 80 } = {}) {
  const config = {
    reductionPercent: Number(rule.reductionPercent ?? reductionPercent),
    sustainedDays: Number(rule.sustainedDays ?? sustainedDays),
    baselineSource: rule.baselineSource || 'mean',
    baselineFrom: rule.baselineFrom || null,
    baselineTo: rule.baselineTo || null
  };
  const measured = rows
    .filter(row => Number.isFinite(row?.value))
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  if (!measured.length) {
    return { configured: true, met: false, criterion: null, baseline: null, current: null, sustained: 0, requiredDays: config.sustainedDays, firstMetDate: null, message: 'No measured behavior data in this range.' };
  }
  const baselineRows = measured.filter(row => {
    const date = row.timestamp.slice(0, 10);
    if (config.baselineFrom && date < config.baselineFrom) return false;
    if (config.baselineTo && date > config.baselineTo) return false;
    if (!config.baselineFrom && !config.baselineTo && startDate && date >= startDate) return false;
    return true;
  });
  const baselineValues = (baselineRows.length ? baselineRows : measured.slice(0, Math.max(1, Math.min(5, measured.length)))).map(row => row.value);
  const criterion = reductionCriterion(baselineValues, config);
  if (!criterion) {
    return { configured: true, met: false, criterion: null, baseline: null, current: null, sustained: 0, requiredDays: config.sustainedDays, firstMetDate: null, message: 'No baseline values are available for this target.' };
  }
  const treated = measured.filter(row => row.timestamp.slice(0, 10) >= (config.baselineTo || startDate || row_date(baselineRows.at(-1)) || measured[0].timestamp.slice(0, 10)));
  const dayOf = row => row.timestamp.slice(0, 10);
  // Walk backwards from the most recent measurement while every value stays inside the
  // criterion; the run's span in days is what has to reach the configured duration.
  let runStart = null;
  for (let index = treated.length - 1; index >= 0; index -= 1) {
    if (treated[index].value > criterion.value) break;
    runStart = dayOf(treated[index]);
  }
  const lastDate = treated.length ? dayOf(treated.at(-1)) : null;
  const runDays = runStart && lastDate ? Math.round((new Date(`${lastDate}T12:00:00Z`) - new Date(`${runStart}T12:00:00Z`)) / 86400000) : 0;
  const met = Boolean(runStart) && runDays >= config.sustainedDays;
  const currentReduction = criterion.baseline > 0 && treated.length ? 100 * (1 - treated.at(-1).value / criterion.baseline) : null;
  const insideCount = treated.filter(row => row.value <= criterion.value).length;
  return {
    configured: true,
    met,
    criterion,
    baseline: criterion.baseline,
    current: treated.length ? treated.at(-1).value : null,
    currentReductionPercent: currentReduction == null ? null : Math.round(currentReduction * 10) / 10,
    sustained: runDays,
    requiredDays: config.sustainedDays,
    firstMetDate: met ? runStart : null,
    since: runStart,
    insideCount,
    treatedCount: treated.length,
    message: met
      ? `Criterion sustained for ${runDays} days from ${runStart}.`
      : runStart
        ? `Below criterion since ${runStart} (${runDays} of ${config.sustainedDays} days).`
        : 'No sustained reduction yet.'
  };
}

function row_date(row) {
  return row?.timestamp?.slice(0, 10) || null;
}

// Behaviour-reduction defaults come from the organisation's clinical standards, with a
// per-target rule overriding them.
export function reductionRuleFor(target, standards = null) {
  const configured = target?.reductionRule || {};
  const fallback = standards?.behaviorReduction || {};
  return {
    reductionPercent: Number(configured.reductionPercent ?? fallback.reductionPercent ?? 80),
    sustainedDays: Number(configured.sustainedDays ?? fallback.sustainedDays ?? 14),
    baselineSource: configured.baselineSource || fallback.baselineSource || 'mean',
    baselineFrom: configured.baselineFrom || null,
    baselineTo: configured.baselineTo || null,
    source: target?.reductionRule ? 'Target rule' : 'Organisation standard'
  };
}

export function describeReductionRule(rule) {
  const source = rule.baselineSource === 'max' ? 'the highest baseline value' : `the ${rule.baselineSource} baseline`;
  return `${rule.reductionPercent}% or greater reduction from ${source}, sustained for ${rule.sustainedDays} days`;
}
