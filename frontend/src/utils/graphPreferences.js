// Graph view preferences: the toggles a clinician sets once and expects the chart to
// remember. Defaults match the release requirements (only measured dates, solid circles
// for a single target, the organisation's minimum trial count). Pure helpers so the
// defaults, stored values and suppression rules are covered by the Node test suite.

export const MARKER_SHAPE_VALUES = ['auto', 'circleSolid', 'circleOpen', 'squareSolid', 'squareOpen', 'triangle', 'diamond'];
export const ORIENTATION_VALUES = ['values', 'dates'];
export const SUMMARY_MODE_VALUES = ['none', 'average', 'total'];
export const STORAGE_PREFIX = 'welina_graph_preferences';

// The organisation's floor for a plotted session, used when a target has no override.
export const FALLBACK_GRAPH_STANDARDS = Object.freeze({
  minimumTrialsPerDataPoint: 5,
  minimumMinutesPerDataPoint: 1,
  source: 'Demo default. Replace with the organisation’s own graphing policy.'
});

export const GRAPH_PREFERENCE_DEFAULTS = Object.freeze({
  // Requirement: default to the dates on which data were collected, with an option
  // to include dates that have no measurement.
  showNoDataDates: false,
  // Requirement: an organisation-defined minimum number of trials before a session
  // becomes a data point.
  minimumTrials: null,
  suppressLowTrialSessions: false,
  showValues: false,
  showPhaseLabels: true,
  showGridlines: true,
  markerShape: 'auto',
  orientation: 'values',
  summaryMode: 'none'
});

const asBoolean = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

export function normalizeGraphPreferences(value = {}) {
  const stored = value && typeof value === 'object' ? value : {};
  // An absent floor stays absent; Number(null) would silently become zero.
  const rawMinimum = stored.minimumTrials;
  const minimum = rawMinimum === null || rawMinimum === undefined || rawMinimum === '' ? Number.NaN : Number(rawMinimum);
  return {
    ...GRAPH_PREFERENCE_DEFAULTS,
    showNoDataDates: asBoolean(stored.showNoDataDates, GRAPH_PREFERENCE_DEFAULTS.showNoDataDates),
    minimumTrials: Number.isFinite(minimum) && minimum >= 0 ? Math.round(minimum) : null,
    suppressLowTrialSessions: asBoolean(stored.suppressLowTrialSessions, GRAPH_PREFERENCE_DEFAULTS.suppressLowTrialSessions),
    showValues: asBoolean(stored.showValues, GRAPH_PREFERENCE_DEFAULTS.showValues),
    showPhaseLabels: asBoolean(stored.showPhaseLabels, GRAPH_PREFERENCE_DEFAULTS.showPhaseLabels),
    showGridlines: asBoolean(stored.showGridlines, GRAPH_PREFERENCE_DEFAULTS.showGridlines),
    markerShape: MARKER_SHAPE_VALUES.includes(stored.markerShape) ? stored.markerShape : GRAPH_PREFERENCE_DEFAULTS.markerShape,
    orientation: ORIENTATION_VALUES.includes(stored.orientation) ? stored.orientation : GRAPH_PREFERENCE_DEFAULTS.orientation,
    summaryMode: SUMMARY_MODE_VALUES.includes(stored.summaryMode) ? stored.summaryMode : GRAPH_PREFERENCE_DEFAULTS.summaryMode
  };
}

export function graphStandards(standards) {
  const configured = standards?.graphing || {};
  const trials = Number(configured.minimumTrialsPerDataPoint);
  const minutes = Number(configured.minimumMinutesPerDataPoint);
  return {
    ...FALLBACK_GRAPH_STANDARDS,
    ...configured,
    minimumTrialsPerDataPoint: Number.isFinite(trials) && trials >= 0 ? trials : FALLBACK_GRAPH_STANDARDS.minimumTrialsPerDataPoint,
    minimumMinutesPerDataPoint: Number.isFinite(minutes) && minutes > 0 ? minutes : FALLBACK_GRAPH_STANDARDS.minimumMinutesPerDataPoint
  };
}

// The organisation's floor, or the clinician's own value when they set one.
export function minimumTrialsFor(preferences, standards) {
  const chosen = preferences?.minimumTrials;
  if (Number.isFinite(chosen) && chosen >= 0) return chosen;
  return graphStandards(standards).minimumTrialsPerDataPoint;
}

// A session with fewer trials than the floor is a real observation, but plotting it can
// suggest variability that the sample does not support (requirement: low-trial sessions).
export function isLowTrialRow(row, target, minimum) {
  if (!Number.isFinite(minimum) || minimum <= 0 || !row) return false;
  if (row.missingDataMode === 'DataNotTracked') return false;
  if (target?.type === 'TrialByTrial') return Number(row.totalTrials || 0) < minimum;
  if (target?.type === 'IntervalData') return Number(row.totalIntervals || 0) < minimum;
  return false;
}

// A session whose observation window is too short to compare rates fairly.
export function isShortObservationRow(row, target, minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0 || !row) return false;
  if (!['Frequency', 'FluencyRate'].includes(target?.type)) return false;
  const observed = Number(row.lessonDurationMinutes ?? 0);
  return observed > 0 && observed < minutes;
}

// Rows the chart may plot, plus what was held back so the interface can say so.
export function eligibleChartRows(rows = [], target, preferences = {}, standards = null) {
  if (!preferences.suppressLowTrialSessions) return { rows: [...rows], suppressed: { trials: 0, shortObservations: 0 } };
  const minimum = minimumTrialsFor(preferences, standards);
  const minimumMinutes = graphStandards(standards).minimumMinutesPerDataPoint;
  const kept = [];
  const suppressed = { trials: 0, shortObservations: 0 };
  for (const row of rows) {
    if (isLowTrialRow(row, target, minimum)) { suppressed.trials += 1; continue; }
    if (isShortObservationRow(row, target, minimumMinutes)) { suppressed.shortObservations += 1; continue; }
    kept.push(row);
  }
  return { rows: kept, suppressed };
}

export function preferenceSummary(preferences, standards) {
  const active = [];
  if (preferences.showNoDataDates) active.push('all dates');
  else active.push('measured dates only');
  if (preferences.suppressLowTrialSessions) active.push(`min ${minimumTrialsFor(preferences, standards)} trials`);
  if (preferences.showValues) active.push('value labels');
  if (preferences.orientation === 'dates') active.push('time on the vertical axis');
  if (preferences.markerShape !== 'auto') active.push(preferences.markerShape === 'circleSolid' ? 'solid circles' : 'custom markers');
  if (preferences.summaryMode !== 'none') active.push(preferences.summaryMode === 'average' ? 'target average' : 'combined total');
  return active.join(' · ');
}

export function storageKeyFor(clientId) {
  return `${STORAGE_PREFIX}:${clientId || 'all'}`;
}

// Storage is best-effort: a blocked browser keeps the defaults rather than failing.
export function readGraphPreferences(clientId, storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(storageKeyFor(clientId));
    return normalizeGraphPreferences(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeGraphPreferences({});
  }
}

export function writeGraphPreferences(clientId, preferences, storage = globalThis.localStorage) {
  try {
    storage?.setItem(storageKeyFor(clientId), JSON.stringify(normalizeGraphPreferences(preferences)));
    return true;
  } catch {
    return false;
  }
}

export function resetGraphPreferences(clientId, storage = globalThis.localStorage) {
  try {
    storage?.removeItem(storageKeyFor(clientId));
    return true;
  } catch {
    return false;
  }
}
