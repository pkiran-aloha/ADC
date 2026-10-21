// Bridges raw observations, target definitions and the chart's current view so the
// analysis tools always use the same units as the graph the clinician is reading.
import { calculateMetricPoint, getObservationKey } from './analyticsMetrics.js';
import { addDays, dayNumber } from './stats.js';
import { eligibleChartRows } from './graphPreferences.js';

// Sessions a graph may plot for one target, honouring the organisation's minimum trial
// rule and the low-trial preference. Returns what was held back so the interface can
// explain any gap.
export function graphRowsForTarget(rows = [], target, preferences = {}, standards = null) {
  return eligibleChartRows(rows, target, preferences, standards);
}

export const PROMPT_COLORS = {
  I: '#2f5d46', G: '#7fa58c', S: '#7fa58c', M: '#c7a35a', P: '#b97a5c', V: '#8e4a3a', F: '#8e4a3a'
};
export const PROMPT_INK = { I: '#ffffff', G: '#14261b', S: '#14261b', M: '#2b2111', P: '#ffffff', V: '#ffffff', F: '#ffffff' };

export function viewKey({ targetType, durationView, rateView, frequencyView }) {
  if (targetType === 'Duration') return durationView;
  if (targetType === 'FluencyRate') return rateView;
  if (targetType === 'Frequency') return frequencyView;
  return 'Percent';
}

// Value of one observation in the chart's current unit (a group of one).
export function rowValue(row, { targetType, durationView, rateView, frequencyView }) {
  return calculateMetricPoint('row', [row], targetType, durationView, rateView, frequencyView).val;
}

export function phaseOnDate(target, date) {
  const history = target?.phaseHistory || [];
  if (!history.length) return target?.phase || null;
  let phase = null;
  for (const entry of history) if (entry.date <= date.slice(0, 10)) phase = entry.phase;
  return phase;
}

// Condition boundaries for visual analysis: every phase change in the target's
// history, plus manual phase lines (e.g., a procedure change inside acquisition).
export function conditionBoundaries(target, phaseLines = [], { includeManual = true } = {}) {
  const history = target?.phaseHistory || [];
  const boundaries = history.slice(1).map(entry => ({ date: entry.date, label: entry.phase, phase: entry.phase, kind: 'phase' }));
  if (includeManual) {
    for (const line of phaseLines) {
      if (line.targetId !== target.id || line.isAutomated || boundaries.some(boundary => boundary.date === line.date)) continue;
      boundaries.push({ date: line.date, label: line.label, phase: null, kind: 'line' });
    }
  }
  return boundaries.sort((a, b) => a.date.localeCompare(b.date));
}

export function firstConditionLabel(target) {
  return target?.phaseHistory?.[0]?.phase || 'Start';
}

// Labelled conditions across a visible date range for the chart's condition bar:
// each span runs from the previous phase change to the next one, so the label sits
// above the data it describes instead of overlapping the observations.
export function conditionSpans(target, phaseLines = [], startDate, endDate) {
  if (!startDate || !endDate || endDate < startDate) return [];
  const boundaries = conditionBoundaries(target, phaseLines).filter(boundary => boundary.date > startDate && boundary.date <= endDate);
  const spans = [];
  let start = startDate;
  // Label the first span with the phase actually running when the window opens.
  let label = phaseOnDate(target, startDate) || firstConditionLabel(target);
  for (const boundary of boundaries) {
    spans.push({ label, kind: boundary.kind, startDate: start, endDate: boundary.date, changedOn: boundary.date });
    start = boundary.date;
    label = boundary.label;
  }
  spans.push({ label, kind: 'current', startDate: start, endDate });
  return spans.filter(span => span.endDate >= span.startDate);
}

export const isBehaviorTarget = target => Boolean(target?.functionHypothesis) || target?.category === 'BehaviorReduction';

// Expected direction of therapeutic change for the measured target.
export function therapeuticDirection(target, programCategory) {
  if (target?.masteryRule) return ['atMost', 'below'].includes(target.masteryRule.comparison) ? 'decrease' : 'increase';
  return programCategory === 'BehaviorReduction' ? 'decrease' : 'increase';
}

// Mastery criterion expressed in the chart's current unit, when the two are comparable.
export function goalInView(target, view, aggregation) {
  const rule = target?.masteryRule;
  if (!rule) return null;
  const perSession = aggregation === 'Per Session' || aggregation === 'Per Day';
  const { targetType, durationView, rateView, frequencyView } = view;
  let value = null;
  if (rule.measure === 'percentCorrect' && targetType === 'TrialByTrial') value = rule.threshold;
  else if (rule.measure === 'percentIntervals' && targetType === 'IntervalData') value = rule.threshold;
  else if (rule.measure === 'intervalCount' && targetType === 'IntervalData' && target.intervalSettings?.numberOfIntervals) {
    value = (100 * rule.threshold) / target.intervalSettings.numberOfIntervals;
  } else if (rule.measure === 'count' && targetType === 'Frequency' && frequencyView === 'Raw Frequency' && perSession) value = rule.threshold;
  else if (rule.measure === 'ratePerHour' && targetType === 'Frequency' && frequencyView !== 'Raw Frequency') {
    value = frequencyView === 'Rate per Hour' ? rule.threshold : rule.threshold / 60;
  } else if (rule.measure === 'correctPerMinute' && targetType === 'FluencyRate' && rateView !== 'Rate per Day') {
    value = rateView === 'Rate per Minute' ? rule.threshold : rule.threshold * 60;
  } else if (rule.measure === 'durationSeconds' && targetType === 'Duration' && durationView === 'Total Duration' && perSession) value = rule.threshold;
  if (value == null) return null;
  return { value, comparison: rule.comparison, label: `Criterion ${({ atLeast: '≥', atMost: '≤', below: '<', above: '>' })[rule.comparison]} ${Math.round(value * 100) / 100}` };
}

export function serviceIndex(serviceSessions = []) {
  return new Map(serviceSessions.map(session => [session.id, session]));
}

// Sub-buckets for drill-down: months -> weeks -> days -> sessions.
export function childBuckets(rows, aggregation) {
  const childAggregation = aggregation === 'Monthly' ? 'Weekly' : aggregation === 'Weekly' ? 'Per Day' : null;
  if (!childAggregation) return null;
  const buckets = new Map();
  for (const row of rows) {
    const key = getObservationKey(row, childAggregation);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return { aggregation: childAggregation, buckets: [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)) };
}

export function promptBreakdown(rows, template) {
  const codes = template?.codes || ['I', 'G', 'M', 'P', 'F'];
  const counts = Object.fromEntries(codes.map(code => [code, 0]));
  let total = 0;
  for (const row of rows) {
    for (const code of row.trialSequence || '') {
      if (code in counts) counts[code] += 1;
      total += 1;
    }
  }
  return { codes, counts, total, levels: template?.levels || codes };
}

// Ordered from independent to most intrusive so stacked bars read bottom-up as support.
export function promptOrder(template) {
  if (!template) return [];
  const pairs = template.codes.map((code, index) => ({ code, level: template.levels[index] }));
  const independent = pairs.filter(pair => pair.code === 'I');
  const prompts = pairs.filter(pair => pair.code !== 'I');
  // Most-to-least templates list the most intrusive prompt first; least-to-most lists it last.
  const leastFirst = template.id === 'most-to-least' ? [...prompts].reverse() : template.id === 'verbal-fading' ? [...prompts].reverse() : prompts;
  return [...independent, ...leastFirst];
}

export function projectedKeys(lastKey, aggregation, count, gapDays = 2) {
  if (aggregation === 'Per Session') return Array.from({ length: count }, (_, index) => String(Number(lastKey) + index + 1));
  if (aggregation === 'Monthly') {
    const [year, month] = lastKey.split('-').map(Number);
    return Array.from({ length: count }, (_, index) => {
      const value = new Date(Date.UTC(year, month - 1 + index + 1, 1));
      return value.toISOString().slice(0, 7);
    });
  }
  const step = aggregation === 'Weekly' ? 7 : Math.max(1, Math.round(gapDays));
  return Array.from({ length: count }, (_, index) => addDays(lastKey, step * (index + 1)));
}

export function medianGapDays(keys) {
  const days = keys.filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key)).map(dayNumber);
  const gaps = days.slice(1).map((day, index) => day - days[index]).filter(gap => gap > 0).sort((a, b) => a - b);
  return gaps.length ? gaps[Math.floor(gaps.length / 2)] : 1;
}

export function formatNumber(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return '–';
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  return rounded.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function formatClock(timestamp) {
  return timestamp.slice(11, 16);
}

export function formatLongDate(date) {
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// Compact form for dense table columns (no weekday): the roster keeps dates on one line.
export function formatShortDate(date) {
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function unitLabel(view) {
  const { targetType, durationView, rateView, frequencyView } = view;
  if (targetType === 'TrialByTrial') return '% correct';
  if (targetType === 'IntervalData') return '% of intervals';
  if (targetType === 'Duration') return durationView === 'Total Count' ? 'episodes' : 'seconds';
  if (targetType === 'FluencyRate') return rateView === 'Rate per Minute' ? 'per minute' : rateView === 'Rate per Hour' ? 'per hour' : 'count';
  if (targetType === 'Frequency') return frequencyView === 'Rate per Minute' ? 'per minute' : frequencyView === 'Rate per Hour' ? 'per hour' : 'count';
  return '';
}

// ---------------------------------------------------------------------------
// Target milestones, program progress and graph-view filtering.
// Added for the analytics feedback round: clinicians asked to see when a target was
// introduced, mastered or moved to maintenance without opening each program, and to
// prioritise current acquisition targets in the selectors.
// ---------------------------------------------------------------------------

const MILESTONE_LABELS = {
  Baseline: { kind: 'Baseline', label: 'Baseline started' },
  Acquisition: { kind: 'Introduced', label: 'Teaching introduced' },
  Maintenance: { kind: 'Mastered', label: 'Moved to maintenance' },
  Generalization: { kind: 'Generalized', label: 'Generalization phase' },
  Completed: { kind: 'Completed', label: 'Completed' },
  OnHold: { kind: 'OnHold', label: 'Placed on hold' },
  Discontinued: { kind: 'Discontinued', label: 'Discontinued' },
  Pending: { kind: 'Pending', label: 'Pending start' }
};

// Every dated change in a target's phase history, in the order it happened.
export function targetMilestones(target) {
  const history = [...(target?.phaseHistory || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!history.length) return [];
  return history.map((entry, index) => {
    const meta = MILESTONE_LABELS[entry.phase] || { kind: entry.phase, label: `${entry.phase}` };
    return {
      ...meta,
      phase: entry.phase,
      date: entry.date,
      firstDate: index === 0,
      current: index === history.length - 1
    };
  });
}

export function milestoneOn(target, predicate) {
  return targetMilestones(target).find(predicate) || null;
}

export function introducedOn(target) {
  return milestoneOn(target, milestone => ['Baseline', 'Introduced', 'Pending'].includes(milestone.kind))?.date || null;
}

export function masteredOn(target) {
  return milestoneOn(target, milestone => ['Mastered', 'Generalized', 'Completed'].includes(milestone.kind))?.date || null;
}

export function daysBetween(start, end) {
  if (!start || !end) return null;
  return Math.round((dayNumber(end) - dayNumber(start)));
}

// The phases that count as mastered, in the same vocabulary the mastery chart, KPI strip and
// successes feed already use. Kept local so this module stays a leaf of the util graph.
const MASTERED_PHASES = ['Maintenance', 'Generalization', 'Completed'];

// Selection value for "All programs" in the mastery picker. It is a derived view of the
// programs already in scope, never a stored program.
export const ALL_PROGRAMS_ID = '__all-programs__';

// The mastery picker keeps a per-client choice. Fall back to the aggregate so the section
// answers the client-level question instead of defaulting to whichever program sorts first.
export function resolveMasterySelection(selection, skillPrograms = []) {
  if (!skillPrograms.length) return '';
  if (selection === ALL_PROGRAMS_ID) return ALL_PROGRAMS_ID;
  if (selection && skillPrograms.some(program => program.id === selection)) return selection;
  return ALL_PROGRAMS_ID;
}

// First mastered transition recorded on a target: the earliest mastery-phase entry in its
// phase history, falling back to the current phase for targets created before histories.
export function masteryTransitionDate(target) {
  const milestone = targetMilestones(target).find(entry => MASTERED_PHASES.includes(entry.phase));
  if (milestone) return milestone.date;
  return MASTERED_PHASES.includes(target?.phase) ? target?.phaseEnteredDate || null : null;
}

// Cumulative mastery series across one or more programs, in the shape the mastery chart and
// its CSV export expect. `from`/`to` window the transitions so the overview's shared range
// applies; without them the series is the all-time history.
export function cumulativeMasterySeries(programs = [], { from = null, to = null } = {}) {
  const transitions = [];
  for (const program of programs) {
    for (const target of program?.targets || []) {
      const date = masteryTransitionDate(target);
      if (!date) continue;
      if (from && date < from) continue;
      if (to && date > to) continue;
      transitions.push({ date, targetName: target.name });
    }
  }
  if (!transitions.length) return [];
  transitions.sort((a, b) => a.date.localeCompare(b.date) || a.targetName.localeCompare(b.targetName));
  const byDate = new Map();
  for (const transition of transitions) {
    if (!byDate.has(transition.date)) byDate.set(transition.date, []);
    byDate.get(transition.date).push(transition.targetName);
  }
  let cumulative = 0;
  return [...byDate.entries()].map(([date, newlyMastered]) => {
    cumulative += newlyMastered.length;
    return { date, cumulativeCount: cumulative, newlyMastered };
  });
}

// Acquisition-rate reporting: how long the target took from introduction to mastery.
export function acquisitionRate(target) {
  const start = introducedOn(target);
  const mastered = masteredOn(target);
  const days = daysBetween(start, mastered);
  return { start, mastered, days };
}

// Program-level progress, so the selector can show how a program is going without
// opening every target.
export function programProgress(program, sessions = []) {
  const targets = program?.targets || [];
  const mastered = targets.filter(target => ['Maintenance', 'Generalization', 'Completed'].includes(target.phase));
  const current = targets.filter(target => ['Baseline', 'Acquisition', 'Generalization'].includes(target.phase));
  const ids = new Set(targets.map(target => target.id));
  const rows = sessions.filter(row => ids.has(row.targetId) && row.missingDataMode !== 'DataNotTracked');
  const lastDataDate = rows.map(row => row.timestamp.slice(0, 10)).sort().at(-1) || null;
  const introduced = targets.map(target => introducedOn(target)).filter(Boolean).sort();
  const dates = [...new Set(rows.map(row => row.timestamp.slice(0, 10)))].sort();
  const recentCount = dates.slice(-4).length;
  const previousCount = Math.max(1, dates.slice(-8, -4).length);
  return {
    id: program?.id,
    name: program?.name,
    targets: targets.length,
    mastered: mastered.length,
    current: current.length,
    percentMastered: targets.length ? Math.round((100 * mastered.length) / targets.length) : 0,
    lastDataDate,
    firstIntroduced: introduced[0] || null,
    lastIntroduced: introduced.at(-1) || null,
    dataPoints: rows.length,
    recentSessions: recentCount,
    trend: recentCount > previousCount ? 'more data' : recentCount < previousCount ? 'less data' : 'steady'
  };
}

export function programProgressLabel(progress) {
  if (!progress || !progress.targets) return 'No targets';
  const last = progress.lastDataDate ? ` · last data ${formatCompactDate(progress.lastDataDate)}` : ' · no data yet';
  return `${progress.mastered}/${progress.targets} mastered${last}`;
}

function formatCompactDate(date) {
  return new Date(`${String(date).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
