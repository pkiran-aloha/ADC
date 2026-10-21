// Portfolio-level target health: one triage record per measured target, computed from
// the same observations that drive the charts. This module is intentionally pure and
// schema-free of new entities — it reads programs, targets and session rows as they
// exist today, so the client -> program -> target -> observation structure is untouched.
import { processAggregation } from './analyticsMetrics.js';
import { addDays, linearRegression, mean, sampleSd } from './stats.js';
import { stabilityEnvelope, evaluateMastery, projectThresholdDate } from './visualAnalysis.js';
import { therapeuticDirection, targetMilestones } from './targetAnalytics.js';

// Documented, tunable thresholds (see ANALYTICS_LANDING_FINDINGS.md §7). They are starting
// values for decision support, not validated clinical cutoffs.
export const HEALTH_WINDOW_DAYS = 90;     // trailing window inspected for every target
export const TREND_POINTS = 12;           // weekly points fed to the trend fit
export const MIN_TREND_POINTS = 4;        // fewer weekly points -> "insufficient history"
export const MEANINGFUL_TREND = 0.10;     // |fitted change / mean| under 10% reads as stable
export const PLATEAU_MIN_POINTS = 6;      // a stable acquisition target needs this many points to be "plateau"
export const VARIABLE_CV = 0.25;          // coefficient-spread gate alongside the ±25% envelope
export const NEAR_MASTERY_DAYS = 21;      // projected criterion within this many days counts as near mastery
export const STALE_DAYS = 14;             // no measurement within this window is flagged for active targets
export const SUCCESS_WINDOW_DAYS = 30;    // recent mastery transitions for the successes feed
export const ATTENTION_LIMIT = 6;

export const MASTERED_PHASES = ['Maintenance', 'Generalization', 'Completed'];
const PAUSED_PHASES = ['OnHold'];
const ENDED_PHASES = ['Discontinued'];

export const PHASE_LABELS = {
  Baseline: 'Baseline', Pending: 'Pending', Introduced: 'Introduced', Acquisition: 'In acquisition',
  Maintenance: 'Maintenance', Generalization: 'Generalization', Completed: 'Completed',
  OnHold: 'Paused', Discontinued: 'Discontinued'
};

// Natural unit per measurement tool for the weekly rollup (mirrors the progress map).
const WEEKLY_VIEW = {
  Duration: { durationView: 'Total Duration' },
  Frequency: { frequencyView: 'Rate per Hour' },
  FluencyRate: { rateView: 'Rate per Minute' }
};

export function targetLifecycle(target) {
  const phase = target?.phase;
  if (MASTERED_PHASES.includes(phase)) return 'mastered';
  if (PAUSED_PHASES.includes(phase)) return 'paused';
  if (ENDED_PHASES.includes(phase)) return 'ended';
  return 'active';
}

// Direction-aware trend classification over the most recent weekly points.
export function classifyTargetTrend(points, { direction = 'increase' } = {}) {
  const recent = points.slice(-TREND_POINTS);
  if (recent.length < MIN_TREND_POINTS) {
    return { trend: 'insufficient', deltaPct: null, variable: null, fit: null };
  }
  const fit = linearRegression(recent.map((point, index) => ({ x: index, y: point.val })));
  const average = mean(recent.map(point => point.val));
  const fittedChange = fit.slope * (recent.length - 1);
  // Relative change keeps rate, duration and percent targets comparable; guard a zero mean.
  const relative = average !== 0 ? fittedChange / Math.abs(average) : (fittedChange === 0 ? 0 : 1);
  // The ±25% stability envelope alone over-flags weekly aggregates (findings §7.3), so a
  // coefficient-spread gate must also fail before a target is called variable.
  const envelope = stabilityEnvelope(
    recent.map((point, index) => ({ x: index, y: point.val })),
    { around: 'trend' }
  );
  const standardDeviation = sampleSd(recent.map(point => point.val));
  const coefficientSpread = average !== 0 ? standardDeviation / Math.abs(average) : 0;
  const variable = envelope ? !envelope.stable && coefficientSpread >= VARIABLE_CV : false;
  const meaningful = Math.abs(relative) >= MEANINGFUL_TREND;
  let trend = 'stable';
  if (meaningful) {
    const movingWell = direction === 'decrease' ? relative < 0 : relative > 0;
    trend = movingWell ? 'improving' : 'declining';
  }
  return { trend, deltaPct: Math.round(relative * 100), variable, fit };
}

// Plain-language attention reasons. Tone drives the pill color, never color alone.
function attentionFlags({ lifecycle, phase, trend, variable, pointCount, lastDate, hasRows, asOfDate }) {
  if (!hasRows) return [{ id: 'no-data', label: 'No observations recorded', tone: 'attention' }];
  const stale = Boolean(lastDate && lastDate < addDays(asOfDate, -STALE_DAYS));
  if (lifecycle === 'mastered') {
    if (trend === 'declining') return [{ id: 'regression', label: 'Regression after mastery', tone: 'negative' }];
    if (stale) return [{ id: 'stale-mastered', label: 'No recent maintenance data', tone: 'attention' }];
    return [];
  }
  if (lifecycle === 'paused' || lifecycle === 'ended') return [];
  const flags = [];
  if (stale) flags.push({ id: 'stale', label: `No data in the last ${STALE_DAYS} days`, tone: 'attention' });
  if (trend === 'declining') flags.push({ id: 'declining', label: 'Wrong-direction trend', tone: 'negative' });
  if (trend === 'stable' && phase === 'Acquisition' && pointCount >= PLATEAU_MIN_POINTS) {
    flags.push({ id: 'plateau', label: 'Plateau — no meaningful trend', tone: 'attention' });
  }
  if (variable) flags.push({ id: 'variable', label: 'High session variability', tone: 'attention' });
  return flags;
}

function nearMasteryFor(target, allRows, weeklyPoints) {
  const empty = { nearMastery: false, forecastDays: null, streak: null, required: null };
  if (targetLifecycle(target) !== 'active' || !target.masteryRule || !allRows.length) return empty;
  const evaluation = evaluateMastery(allRows, target.masteryRule, {});
  let nearMastery = false;
  if (evaluation?.required && evaluation.streak > 0 && evaluation.required - evaluation.streak <= 1) {
    nearMastery = true;
  }
  let forecastDays = null;
  const dated = weeklyPoints.map((point, index) => ({ x: index, y: point.val, date: point.date }));
  const projection = projectThresholdDate(
    dated, target.masteryRule.threshold, target.masteryRule.comparison, { maxDays: 180 }
  );
  if (projection?.days != null) {
    forecastDays = projection.days;
    if (forecastDays <= NEAR_MASTERY_DAYS) nearMastery = true;
  }
  return { nearMastery, forecastDays, streak: evaluation?.streak ?? null, required: evaluation?.required ?? null };
}

// Current level against the mastery criterion, normalized to a 0-100 bar width. Returns
// null when the weekly unit and the rule measure are not comparable (e.g. raw counts).
function currentLevel(target, points) {
  const latest = points.at(-1);
  const rule = target.masteryRule;
  if (!latest || !rule) return null;
  let threshold = null;
  if (rule.measure === 'intervalCount' && target.intervalSettings?.numberOfIntervals) {
    threshold = (100 * rule.threshold) / target.intervalSettings.numberOfIntervals;
  } else if (['percentCorrect', 'percentIntervals', 'ratePerHour', 'correctPerMinute', 'durationSeconds'].includes(rule.measure)) {
    threshold = rule.threshold;
  }
  if (threshold == null || threshold === 0 || latest.val == null) return null;
  const decrease = ['atMost', 'below'].includes(rule.comparison);
  const percent = decrease
    ? Math.max(0, Math.min(100, 100 * threshold / Math.max(latest.val, threshold)))
    : Math.max(0, Math.min(100, 100 * latest.val / threshold));
  return { value: latest.val, percent: Math.round(percent), threshold, decrease };
}

function buildItem({ program, target, sessions, asOfDate, windowStart }) {
  const targetRows = sessions
    .filter(row => row.targetId === target.id && row.value != null && row.missingDataMode !== 'DataNotTracked')
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const hasRows = targetRows.length > 0;
  const lastDate = hasRows ? targetRows.at(-1).timestamp.slice(0, 10) : null;
  const view = WEEKLY_VIEW[target.type] || {};
  const windowRows = targetRows.filter(row => row.timestamp.slice(0, 10) >= windowStart);
  const points = processAggregation(
    windowRows, 'Weekly', target.type, view.durationView, view.rateView, view.frequencyView
  );
  const direction = therapeuticDirection(target, program.category);
  const lifecycle = targetLifecycle(target);
  const { trend, deltaPct, variable } = classifyTargetTrend(points, { direction });
  const { nearMastery, forecastDays, streak, required } = nearMasteryFor(target, targetRows, points);
  const flags = attentionFlags({
    lifecycle, phase: target.phase, trend, variable, pointCount: points.length, lastDate, hasRows, asOfDate
  });
  return {
    targetId: target.id,
    targetName: target.name,
    programId: program.id,
    programName: program.name,
    category: program.category,
    measurementType: target.type,
    phase: target.phase,
    lifecycle,
    direction,
    trend,
    insufficient: trend === 'insufficient',
    deltaPct,
    variable,
    nearMastery,
    forecastDays,
    streak,
    required,
    flags,
    needsReview: flags.length > 0,
    hasRows,
    lastDate,
    points,
    level: currentLevel(target, points)
  };
}

export function summarizeKpis(items) {
  const active = items.filter(item => item.lifecycle === 'active');
  const classifiable = active.filter(item => item.trend !== 'insufficient');
  const countWhere = (predicate, list) => list.filter(predicate).length;
  const percentOf = count => (classifiable.length ? Math.round((100 * count) / classifiable.length) : 0);
  const improving = countWhere(item => item.trend === 'improving', classifiable);
  const stable = countWhere(item => item.trend === 'stable', classifiable);
  const declining = countWhere(item => item.trend === 'declining', classifiable);
  return {
    total: items.length,
    activeTotal: active.length,
    classifiableTotal: classifiable.length,
    insufficient: active.length - classifiable.length,
    mastered: countWhere(item => item.lifecycle === 'mastered', items),
    paused: countWhere(item => item.lifecycle === 'paused', items),
    ended: countWhere(item => item.lifecycle === 'ended', items),
    improving: { count: improving, percent: percentOf(improving) },
    stable: { count: stable, percent: percentOf(stable) },
    declining: { count: declining, percent: percentOf(declining) },
    nearMastery: countWhere(item => item.nearMastery, items),
    needsReview: countWhere(item => item.needsReview, items)
  };
}

const SEVERITY = { negative: 0, attention: 1, neutral: 2 };

export function attentionItems(items) {
  return items
    .filter(item => item.needsReview)
    .sort((a, b) => {
      const severity = Math.min(...a.flags.map(flag => SEVERITY[flag.tone] ?? 2))
        - Math.min(...b.flags.map(flag => SEVERITY[flag.tone] ?? 2));
      if (severity !== 0) return severity;
      if (b.flags.length !== a.flags.length) return b.flags.length - a.flags.length;
      return a.targetName.localeCompare(b.targetName);
    });
}

function recentSuccesses(programs, asOfDate) {
  const cutoff = addDays(asOfDate, -SUCCESS_WINDOW_DAYS);
  const successes = [];
  for (const program of programs) {
    for (const target of program.targets) {
      for (const milestone of targetMilestones(target)) {
        if (MASTERED_PHASES.includes(milestone.phase) && milestone.date >= cutoff) {
          successes.push({
            targetId: target.id, targetName: target.name,
            programId: program.id, programName: program.name,
            phase: milestone.phase, date: milestone.date
          });
        }
      }
    }
  }
  return successes.sort((a, b) => b.date.localeCompare(a.date) || a.targetName.localeCompare(b.targetName));
}

// Portfolio rollup for one client. `sessions` may be the full workspace list; the program
// list is already client-scoped by the caller.
export default function buildTargetHealth({ programs = [], sessions = [], asOfDate, windowDays = HEALTH_WINDOW_DAYS }) {
  const windowStart = addDays(asOfDate, -windowDays);
  const items = [];
  for (const program of programs) {
    for (const target of program.targets) {
      if (target.type === 'Anecdotal') continue;
      items.push(buildItem({ program, target, sessions, asOfDate, windowStart }));
    }
  }
  const successes = recentSuccesses(programs, asOfDate);
  return {
    items,
    kpis: summarizeKpis(items),
    attention: attentionItems(items),
    successes,
    windowStart,
    windowDays
  };
}

// KPI-card filters applied to the health matrix.
export const HEALTH_FILTERS = [
  { id: 'improving', label: 'Improving', match: item => item.lifecycle === 'active' && item.trend === 'improving' },
  { id: 'stable', label: 'Stable', match: item => item.lifecycle === 'active' && item.trend === 'stable' },
  { id: 'declining', label: 'Declining', match: item => item.lifecycle === 'active' && item.trend === 'declining' },
  { id: 'nearMastery', label: 'Near mastery', match: item => item.nearMastery },
  { id: 'needsReview', label: 'Needs review', match: item => item.needsReview }
];

export function filterHealthItems(items, filterId) {
  const filter = HEALTH_FILTERS.find(entry => entry.id === filterId);
  return filter ? items.filter(filter.match) : items;
}

export function healthFilterLabel(filterId) {
  return HEALTH_FILTERS.find(entry => entry.id === filterId)?.label || 'All items';
}

// Forecast column wording, reusing the projection caveats used elsewhere in the workspace.
export function forecastLabel(item) {
  if (item.lifecycle === 'mastered') return 'Achieved';
  if (item.lifecycle === 'paused') return 'Paused';
  if (item.lifecycle === 'ended') return 'Discontinued';
  if (!item.hasRows) return 'No data yet';
  if (item.nearMastery && item.streak > 0 && item.required) return `${item.streak}/${item.required} at criterion`;
  if (item.nearMastery && item.forecastDays != null) return `Criterion in ~${item.forecastDays} days`;
  if (item.flags.some(flag => flag.id === 'declining' || flag.id === 'plateau')) return 'Review needed';
  if (item.trend === 'insufficient') return 'Collect more data';
  if (item.forecastDays != null) return `~${item.forecastDays} days to criterion`;
  return '—';
}

// Plain-language trend wording. The arrow comes from deltaText so a behavior that
// improves downward can show "↓ 24%" in a positive tone (direction, not raw sign).
export function trendLabel(item) {
  if (item.lifecycle !== 'active') return PHASE_LABELS[item.phase] || item.phase;
  if (item.trend === 'insufficient') return 'Insufficient history';
  if (item.trend === 'improving') return 'Improving';
  if (item.trend === 'declining') return 'Wrong direction';
  return item.deltaPct === 0 ? 'Flat' : 'Stable';
}

export function deltaText(item) {
  if (item.deltaPct == null) return '—';
  const arrow = item.deltaPct > 0 ? '↑' : item.deltaPct < 0 ? '↓' : '→';
  return `${arrow} ${Math.abs(item.deltaPct)}%`;
}

// Semantic tone for trend-colored UI. Stability is neutral; plateau and variability are
// communicated separately through flag pills, not by recoloring the trend.
export function trendTone(item) {
  if (item.lifecycle === 'mastered') return 'positive';
  if (item.lifecycle === 'paused' || item.lifecycle === 'ended') return 'neutral';
  if (item.trend === 'improving') return 'positive';
  if (item.trend === 'declining') return 'negative';
  return 'neutral';
}
