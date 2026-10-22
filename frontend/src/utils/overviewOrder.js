// Overview module order: clinicians asked to put the module they read first at the top of the
// progress overview. The order is a presentation preference only — it never changes a
// calculation, hides a module or reorders the underlying data. Pure helpers keep normalisation
// testable and storage best-effort, like the graph preferences.

// v2 adds the target health matrix as its own module, so the key changes with the shape of the
// list. v1 (four modules) is still read once and migrated, see migrateLegacyOverviewOrder.
export const OVERVIEW_MODULE_STORAGE_KEY = 'welina_overview_module_order_v2';
export const LEGACY_OVERVIEW_MODULE_STORAGE_KEY = 'welina_overview_module_order';

// Page order: portfolio status first (the exception-first triage surface), then the two
// longitudinal views, then the target health matrix and finally the intervention timeline. The
// matrix reads as the evidence behind the KPI numbers and the timeline as the "what changed"
// close, so both sit at the end rather than interrupting the charts.
export const OVERVIEW_MODULES = Object.freeze([
  { id: 'triage', label: 'Portfolio status & attention', offset: 'overview-triage' },
  { id: 'mastery', label: 'Skill mastery', offset: 'overview-mastery' },
  { id: 'progress-map', label: 'Weekly progress map', offset: 'overview-progress-map' },
  { id: 'matrix', label: 'Target health matrix', offset: 'overview-matrix' },
  { id: 'timeline', label: 'Intervention timeline', offset: 'overview-timeline' }
]);

export const DEFAULT_OVERVIEW_ORDER = Object.freeze(OVERVIEW_MODULES.map(module => module.id));

// The v1 default order, kept only to recognise a saved default during migration.
const LEGACY_DEFAULT_OVERVIEW_ORDER = Object.freeze(['triage', 'timeline', 'mastery', 'progress-map']);

export function moduleById(id) {
  return OVERVIEW_MODULES.find(module => module.id === id) || null;
}

// Stored orders are accepted only when they are a permutation of the known modules:
// unknown ids are dropped, duplicates removed and any missing module appended in its
// default position. A corrupt value falls back to the documented default order.
export function normalizeOverviewOrder(value) {
  const stored = Array.isArray(value) ? value : [];
  const seen = new Set();
  const order = [];
  for (const id of stored) {
    if (typeof id !== 'string' || seen.has(id) || !moduleById(id)) continue;
    seen.add(id);
    order.push(id);
  }
  for (const id of DEFAULT_OVERVIEW_ORDER) if (!seen.has(id)) order.push(id);
  return order;
}

// A v1 order predates the target health matrix module. Rather than appending the new module
// after whatever the clinician saved last, it is slotted into its documented position — just
// before the intervention timeline — so an existing preference keeps its intent. A saved v1
// order that was simply the old default becomes the new default, because "reset" should not
// preserve an obsolete arrangement.
export function migrateLegacyOverviewOrder(value) {
  // Already migrated (or a hand-edited value that knows the module): keep it as saved.
  if (Array.isArray(value) && value.includes('matrix')) return normalizeOverviewOrder(value);
  const saved = normalizeOverviewOrder(value).filter(id => id !== 'matrix');
  const wasDefault = saved.length === LEGACY_DEFAULT_OVERVIEW_ORDER.length
    && saved.every((id, index) => id === LEGACY_DEFAULT_OVERVIEW_ORDER[index]);
  if (wasDefault) return [...DEFAULT_OVERVIEW_ORDER];
  const order = [...saved];
  const timelineIndex = order.indexOf('timeline');
  order.splice(timelineIndex < 0 ? order.length : timelineIndex, 0, 'matrix');
  return normalizeOverviewOrder(order);
}

export function moveOverviewModule(order, id, delta) {
  const normalized = normalizeOverviewOrder(order);
  const index = normalized.indexOf(id);
  if (index < 0) return normalized;
  const target = index + delta;
  if (target < 0 || target >= normalized.length) return normalized;
  const next = [...normalized];
  next.splice(index, 1);
  next.splice(target, 0, id);
  return next;
}

export function moveOverviewModuleTo(order, id, position) {
  const normalized = normalizeOverviewOrder(order);
  const index = normalized.indexOf(id);
  if (index < 0) return normalized;
  const target = Math.max(0, Math.min(normalized.length - 1, position));
  if (target === index) return normalized;
  const next = [...normalized];
  next.splice(index, 1);
  next.splice(target, 0, id);
  return next;
}

// Describes a move for the live region so a screen-reader user hears the new position.
export function describeOverviewMove(order, id) {
  const normalized = normalizeOverviewOrder(order);
  const index = normalized.indexOf(id);
  const module = moduleById(id);
  if (index < 0 || !module) return '';
  return `${module.label} moved to position ${index + 1} of ${normalized.length}.`;
}

export function readOverviewOrder(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(OVERVIEW_MODULE_STORAGE_KEY);
    if (raw) return normalizeOverviewOrder(JSON.parse(raw));
    // A browser that still holds a v1 order keeps its arrangement for the modules it knew.
    const legacy = storage?.getItem(LEGACY_OVERVIEW_MODULE_STORAGE_KEY);
    if (legacy) return migrateLegacyOverviewOrder(JSON.parse(legacy));
    return [...DEFAULT_OVERVIEW_ORDER];
  } catch {
    return [...DEFAULT_OVERVIEW_ORDER];
  }
}

export function writeOverviewOrder(order, storage = globalThis.localStorage) {
  try {
    storage?.setItem(OVERVIEW_MODULE_STORAGE_KEY, JSON.stringify(normalizeOverviewOrder(order)));
    return true;
  } catch {
    return false;
  }
}
