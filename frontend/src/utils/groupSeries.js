// Program-level graphing: one combined or averaged series across the targets a clinician
// has selected, so overall program performance can be evaluated without reading each
// target separately. Pure maths so the summary line is covered by the Node test suite.

export const SUMMARY_MODES = [
  { value: 'none', label: 'No summary line' },
  { value: 'average', label: 'Average of visible targets' },
  { value: 'total', label: 'Combined total of visible targets' }
];

const PERCENT_TYPES = ['TrialByTrial', 'IntervalData'];

// Averaging percentages is meaningful; summing them is not, so totals are offered
// only for count, duration and rate measurements.
export function availableSummaryModes(targetType) {
  return SUMMARY_MODES.filter(mode => !(mode.value === 'total' && PERCENT_TYPES.includes(targetType)));
}

export function resolveSummaryMode(requested, targetType, seriesCount) {
  if (seriesCount < 2) return 'none';
  return availableSummaryModes(targetType).some(mode => mode.value === requested) ? requested : 'none';
}

export function summaryLabel(mode, seriesCount) {
  if (mode === 'average') return `Average of ${seriesCount} targets`;
  if (mode === 'total') return `Combined total of ${seriesCount} targets`;
  return '';
}

// Group each series' points by x-axis key, keeping the per-key value lists.
export function pointsByKey(seriesData = []) {
  const map = new Map();
  for (const series of seriesData) {
    for (const point of series.points || []) {
      if (!Number.isFinite(point.val)) continue;
      if (!map.has(point.xKey)) map.set(point.xKey, []);
      map.get(point.xKey).push({ ...point, seriesId: series.id, seriesName: series.name });
    }
  }
  return map;
}

// One x-axis key can carry several observations (a target measured twice in a day).
// The summary uses each target's own grouped value, not each raw session, so a target
// measured more often cannot outweigh the others.
function targetValuesAtKey(seriesData, key) {
  return seriesData
    .map(series => (series.points || []).find(point => point.xKey === key))
    .filter(point => point && Number.isFinite(point.val))
    .map(point => point.val);
}

function orderKeys(seriesData) {
  const seen = new Set();
  const ordered = [];
  for (const series of seriesData) {
    for (const point of series.points || []) {
      if (Number.isFinite(point.val) && !seen.has(point.xKey)) {
        seen.add(point.xKey);
        ordered.push(point.xKey);
      }
    }
  }
  return ordered;
}

// The combined / averaged series itself. `mode` is 'average' or 'total'.
export function summarySeries(seriesData = [], { mode = 'average', id = 'summary', name = '', color = '#4b5a73', precision = 2 } = {}) {
  const keys = orderKeys(seriesData);
  if (mode === 'none' || seriesData.length < 2 || !keys.length) return null;
  const round = value => Math.round(value * 10 ** precision) / 10 ** precision;
  const points = keys.map(key => {
    const values = targetValuesAtKey(seriesData, key);
    if (!values.length) return null;
    const total = values.reduce((sum, value) => sum + value, 0);
    const val = mode === 'total' ? total : total / values.length;
    const therapists = new Set((seriesData.flatMap(series => (series.points || []).filter(point => point.xKey === key))).map(point => point.therapist).filter(Boolean));
    const base = (seriesData.flatMap(series => (series.points || []).find(point => point.xKey === key)) || []);
    return {
      ...base,
      xKey: key,
      val: round(val),
      displayVal: mode === 'total'
        ? `${round(total)} combined (${values.length} targets)`
        : `${round(val)} average (${values.length} targets)`,
      therapist: [...therapists].join(', ') || 'Combined',
      isSummary: true,
      contributing: values.length,
      range: values.length > 1 ? { min: round(Math.min(...values)), max: round(Math.max(...values)) } : null
    };
  }).filter(Boolean);
  return { id, name, color, points, isSummary: true, summaryMode: mode };
}

// Chart series plus the optional summary line, never exceeding the series count guard.
export function withSummarySeries(seriesData = [], { mode = 'none', color = '#4b5a73', targetType, precision = 2 } = {}) {
  const resolved = resolveSummaryMode(mode, targetType, seriesData.length);
  if (resolved === 'none') return seriesData;
  const summary = summarySeries(seriesData, {
    mode: resolved,
    id: `summary-${resolved}`,
    name: summaryLabel(resolved, seriesData.length),
    color,
    precision
  });
  return summary ? [...seriesData, summary] : seriesData;
}

// Behaviour-reduction analysis works faster when a clinician can pick a whole program,
// one function, or every target at once instead of ticking targets one by one.
export function behaviorPresets(behaviors = []) {
  const presets = [{ id: 'all', label: `All behaviors (${behaviors.length})`, ids: behaviors.map(behavior => behavior.id) }];
  const functions = new Map();
  for (const behavior of behaviors) {
    const key = behavior.functionHypothesis || 'Unspecified';
    if (!functions.has(key)) functions.set(key, []);
    functions.get(key).push(behavior.id);
  }
  for (const [name, ids] of [...functions.entries()].sort((a, b) => b[1].length - a[1].length)) {
    presets.push({ id: `function-${name}`, label: `${name} function (${ids.length})`, ids });
  }
  const byProgram = new Map();
  for (const behavior of behaviors) {
    const key = behavior.programName || 'Program';
    if (!byProgram.has(key)) byProgram.set(key, []);
    byProgram.get(key).push(behavior.id);
  }
  for (const [name, ids] of byProgram.entries()) presets.push({ id: `program-${name}`, label: `${name} (${ids.length})`, ids });
  return presets;
}

// Stage grouping for the target selector and legend: current acquisition targets first,
// then maintenance / mastery work, with discontinued targets last.
export const TARGET_STAGES = [
  { id: 'current', label: 'Current acquisition', hint: 'Baseline, acquisition and generalization targets being taught now' },
  { id: 'maintenance', label: 'Maintenance & mastery', hint: 'Mastered targets kept under periodic review' },
  { id: 'pending', label: 'Pending & on hold', hint: 'Waiting for a start date or paused by the supervisor' },
  { id: 'completed', label: 'Completed', hint: 'Mastery criterion met and teaching withdrawn' },
  { id: 'discontinued', label: 'Discontinued', hint: 'Withdrawn from the plan' }
];

export function stageOf(target) {
  switch (target?.phase) {
    case 'Baseline': case 'Acquisition': case 'Generalization': return 'current';
    case 'Maintenance': return 'maintenance';
    case 'Completed': return 'completed';
    case 'Discontinued': return 'discontinued';
    default: return 'pending';
  }
}

export function groupTargetsByStage(targets = []) {
  const groups = new Map(TARGET_STAGES.map(stage => [stage.id, { ...stage, targets: [] }]));
  for (const target of targets) groups.get(stageOf(target)).targets.push(target);
  return [...groups.values()].filter(group => group.targets.length);
}
