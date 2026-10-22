// Overview module order: clinicians asked to put the module they read first (triage,
// timeline, mastery or the weekly progress map) at the top of the progress overview.
// The order is a presentation preference only — it never changes a calculation, hides a
// module or reorders the underlying data. Pure helpers keep normalisation testable and
// storage best-effort, like the graph preferences.

export const OVERVIEW_MODULE_STORAGE_KEY = 'welina_overview_module_order';

export const OVERVIEW_MODULES = Object.freeze([
  { id: 'triage', label: 'Attention & target health', offset: 'overview-triage' },
  { id: 'timeline', label: 'Intervention timeline', offset: 'overview-timeline' },
  { id: 'mastery', label: 'Skill mastery', offset: 'overview-mastery' },
  { id: 'progress-map', label: 'Weekly progress map', offset: 'overview-progress-map' }
]);

export const DEFAULT_OVERVIEW_ORDER = Object.freeze(OVERVIEW_MODULES.map(module => module.id));

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
    return normalizeOverviewOrder(raw ? JSON.parse(raw) : []);
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
