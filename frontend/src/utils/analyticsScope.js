// One shared scope for the Progress overview. The program scope and time range are lifted to
// App state and every overview section reads the same derived window, so the landing page
// answers one question ("how is this learner doing, in this slice?") instead of each card
// carrying its own date control.
//
// This module is pure and additive: it reads the existing program -> target structure and the
// existing observation rows, and returns plain descriptors. Nothing here changes a client,
// program, target, lesson or observation.
import { addDays, dayNumber } from './stats.js';

export const DEFAULT_PROGRAM_SCOPE = 'all';
export const DEFAULT_RANGE_ID = '90D';

// Program scope: derived views of the existing program categories (no new entity).
export const PROGRAM_SCOPES = [
  { id: 'all', label: 'All programs', short: 'All', category: null, description: 'Skill acquisition and behavior reduction together' },
  { id: 'skill', label: 'Skill acquisition', short: 'Skills', category: 'SkillAcquisition', description: 'Skill acquisition programs only' },
  { id: 'behavior', label: 'Behavior reduction', short: 'Behaviors', category: 'BehaviorReduction', description: 'Behavior reduction programs only' }
];

// Time ranges offered on the landing page. `accessibleLabel` keeps the compact control
// unambiguous for screen readers ("6M" reads as "Last 6 months").
export const SCOPE_RANGES = [
  { id: '30D', label: 'Last 30 days', short: '30D', days: 30, accessibleLabel: 'Last 30 days' },
  { id: '90D', label: 'Last 90 days', short: '90D', days: 90, accessibleLabel: 'Last 90 days' },
  { id: '6M', label: 'Last 6 months', short: '6M', days: 183, accessibleLabel: 'Last 6 months' },
  { id: '1Y', label: 'Last year', short: '1Y', days: 365, accessibleLabel: 'Last year' },
  { id: 'ALL', label: 'All time', short: 'ALL', days: null, accessibleLabel: 'All time' }
];

// The chart's own date filter is coarse; focus requests pick the smallest window that still
// contains the event with a little context before it.
const DURATION_STEPS = [
  { days: 3, value: '3 days' },
  { days: 5, value: '5 days' },
  { days: 7, value: '7 days' },
  { days: 14, value: '2 weeks' },
  { days: 31, value: '1 month' },
  { days: 92, value: '3 months' },
  { days: 183, value: '6 months' },
  { days: 366, value: '1 year' },
  { days: 731, value: '2 years' }
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function rangeById(id) {
  return SCOPE_RANGES.find(range => range.id === id) || SCOPE_RANGES.find(range => range.id === DEFAULT_RANGE_ID);
}

export function programScopeById(id) {
  return PROGRAM_SCOPES.find(scope => scope.id === id) || PROGRAM_SCOPES.find(scope => scope.id === DEFAULT_PROGRAM_SCOPE);
}

// Accepts a partial (or absent) scope and always returns a complete, valid one.
export function normalizeScope(scope = {}) {
  return {
    programScope: programScopeById(scope.programScope).id,
    rangeId: rangeById(scope.rangeId).id
  };
}

export function scopePrograms(programs = [], programScope = DEFAULT_PROGRAM_SCOPE) {
  const category = programScopeById(programScope).category;
  return category ? programs.filter(program => program.category === category) : [...programs];
}

export function scopeIncludesCategory(programScope, category) {
  const scope = programScopeById(programScope);
  return scope.category === null || scope.category === category;
}

// Deterministic short date ("16 Jul 2026") so the caption is identical under SSR and in tests.
export function formatScopeDate(value) {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function earliestKnownDate(sessions = [], programs = []) {
  const dates = [];
  for (const row of sessions) {
    if (row?.timestamp) dates.push(String(row.timestamp).slice(0, 10));
  }
  for (const program of programs) {
    for (const target of program?.targets || []) {
      for (const entry of target.phaseHistory || []) {
        if (entry?.date) dates.push(String(entry.date).slice(0, 10));
      }
      if (target.phaseEnteredDate) dates.push(String(target.phaseEnteredDate).slice(0, 10));
    }
  }
  return dates.filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort()[0] || null;
}

// Resolve a range id into a concrete window. "All time" starts at the earliest date the
// client has any record for, so it stays data-driven rather than a magic number.
export function resolveScopeWindow({ asOfDate, rangeId = DEFAULT_RANGE_ID, sessions = [], programs = [] } = {}) {
  const range = rangeById(rangeId);
  const phrase = (bounded, window) => (bounded
    ? `the ${range.label.toLowerCase()}`
    : `all recorded history (${formatScopeDate(window.start)} – ${formatScopeDate(window.asOfDate)})`);
  if (range.days) {
    const window = {
      id: range.id, label: range.label, short: range.short, accessibleLabel: range.accessibleLabel,
      asOfDate, start: addDays(asOfDate, -range.days), days: range.days, bounded: true
    };
    return { ...window, phrase: phrase(true, window) };
  }
  const earliest = earliestKnownDate(sessions, programs);
  const start = earliest && earliest <= asOfDate ? earliest : asOfDate;
  const window = {
    id: range.id, label: range.label, short: range.short, accessibleLabel: range.accessibleLabel,
    asOfDate, start, days: Math.max(1, dayNumber(asOfDate) - dayNumber(start)), bounded: false
  };
  return { ...window, phrase: phrase(false, window) };
}

// Prose-safe phrasing of a window: "the last 90 days" / "all recorded history (13 Apr 2026 – 14 Oct 2026)".
// Used by components so sentences read naturally without each one re-deriving the wording.
export function rangePhrase(window) {
  return window?.phrase || 'the selected range';
}

export function isInScopeWindow(date, window) {
  if (!date) return false;
  const day = String(date).slice(0, 10);
  if (window.asOfDate && day > String(window.asOfDate).slice(0, 10)) return false;
  return !window.start || day >= String(window.start).slice(0, 10);
}

// Weekly progress map columns for a window: one column per week, kept inside a readable band.
export function weekCountFor(window, { min = 4, max = 53 } = {}) {
  return Math.max(min, Math.min(max, Math.ceil((window?.days || 90) / 7)));
}

export function durationFilterForDate(date, asOfDate, bufferDays = 14) {
  if (!date || !asOfDate) return '3 months';
  const distance = Math.max(0, dayNumber(asOfDate) - dayNumber(String(date).slice(0, 10)));
  const needed = distance + bufferDays;
  return (DURATION_STEPS.find(step => step.days >= needed) || DURATION_STEPS.at(-1)).value;
}

// The one-line answer to "what am I looking at?" shown beneath the controls.
export function scopeCaption(window, { programScope = DEFAULT_PROGRAM_SCOPE, counts = null } = {}) {
  const scope = programScopeById(programScope);
  const parts = [`${formatScopeDate(window.start)} – ${formatScopeDate(window.asOfDate)}`];
  if (window.bounded) parts.push(`${window.days} days`);
  else parts.push('all recorded history');
  if (counts) {
    const total = counts.total ?? ((counts.skill || 0) + (counts.behavior || 0));
    parts.push(`${total} program${total === 1 ? '' : 's'} in scope`);
  } else if (scope.category) {
    parts.push(scope.description.toLowerCase());
  }
  return `${scope.label} · ${parts.join(' · ')}`;
}
