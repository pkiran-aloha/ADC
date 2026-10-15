// Access levels for the analytics workspace. View-only users review graphs and exports
// but cannot change axes, phase lines, notes, program status or graph configuration
// (requirement: read-only analytics access). Pure so the browser suite and the Node
// suite test the same matrix.

export const ACCESS_LEVELS = [
  { id: 'full', label: 'Full editing', hint: 'Record data, annotate graphs and change program status' },
  { id: 'view', label: 'View-only analytics', hint: 'Review graphs, tables and exports without changing them' }
];

export const ACCESS_STORAGE_KEY = 'welina_access_level';

const FULL = Object.freeze({
  viewAnalytics: true,
  exportData: true,
  record: true,
  manuallyEnterData: true,
  importData: true,
  editObservation: true,
  deleteObservation: true,
  annotate: true,
  configureChart: true,
  changeAxis: true,
  updateProgramStatus: true,
  resetDemoData: true
});

const VIEW_ONLY = Object.freeze({
  viewAnalytics: true,
  exportData: true,
  record: false,
  manuallyEnterData: false,
  importData: false,
  editObservation: false,
  deleteObservation: false,
  annotate: false,
  configureChart: false,
  changeAxis: false,
  updateProgramStatus: false,
  resetDemoData: false
});

const DENIED_MESSAGES = {
  record: 'View-only access: recording new observations is disabled for this account.',
  manuallyEnterData: 'View-only access: manual data entry is disabled for this account.',
  importData: 'View-only access: spreadsheet imports are disabled for this account.',
  editObservation: 'View-only access: observations cannot be edited for this account.',
  deleteObservation: 'View-only access: observations cannot be deleted for this account.',
  annotate: 'View-only access: phase lines, ranges and notes cannot be changed.',
  configureChart: 'View-only access: graph configuration is fixed for this account.',
  changeAxis: 'View-only access: the axis range cannot be changed.',
  updateProgramStatus: 'View-only access: program status cannot be changed.',
  resetDemoData: 'View-only access: demo data cannot be reset by this account.'
};

export function normalizeAccessLevel(value) {
  return ACCESS_LEVELS.some(level => level.id === value) ? value : 'full';
}

export function permissionsFor(level) {
  const id = normalizeAccessLevel(level);
  return { level: id, can: id === 'view' ? { ...VIEW_ONLY } : { ...FULL } };
}

export function canDo(level, action) {
  return Boolean(permissionsFor(level).can[action]);
}

export function deniedMessage(action) {
  return DENIED_MESSAGES[action] || 'This account has view-only access to the analytics workspace.';
}

export function accessLevelLabel(level) {
  return ACCESS_LEVELS.find(item => item.id === normalizeAccessLevel(level))?.label || 'Full editing';
}

export function readAccessLevel(storage = globalThis.localStorage) {
  try {
    return normalizeAccessLevel(storage?.getItem(ACCESS_STORAGE_KEY));
  } catch {
    return 'full';
  }
}

export function writeAccessLevel(level, storage = globalThis.localStorage) {
  try {
    storage?.setItem(ACCESS_STORAGE_KEY, normalizeAccessLevel(level));
    return true;
  } catch {
    return false;
  }
}

// View-only analytics still needs to explain itself wherever an action is blocked.
export function viewOnlyNotice(level) {
  return normalizeAccessLevel(level) === 'view'
    ? 'You have view-only analytics access. Graphs, tables and exports are available; changes are disabled.'
    : '';
}
