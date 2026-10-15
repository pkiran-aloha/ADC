import {
  INITIAL_CLIENTS,
  INITIAL_PROGRAMS,
  INITIAL_SESSION_DATA,
  INITIAL_PHASE_LINES,
  INITIAL_PHASE_RANGES,
  INITIAL_GRAPH_NOTES,
  INITIAL_ABC_CONFIGURATIONS,
  INITIAL_ABC_ENTRIES,
  SERVICE_SESSIONS,
  STAFF,
  CLINICAL_STANDARDS,
  SEED_VERSION,
  SEED_AS_OF_DATE
} from '../data/mockData.js';

const MASTERED_PHASES = ['Maintenance', 'Generalization', 'Completed'];

// First date a target entered a mastered phase; falls back to the current phase for
// targets created before phase histories existed.
export function masteryDate(target) {
  const history = target.phaseHistory || [];
  const first = history.find(entry => MASTERED_PHASES.includes(entry.phase));
  if (first) return first.date;
  return MASTERED_PHASES.includes(target.phase) ? target.phaseEnteredDate || null : null;
}

const STORAGE_KEYS = {
  CLIENTS: 'welina_clients',
  PROGRAMS: 'welina_programs',
  SESSIONS: 'welina_sessions',
  PHASE_LINES: 'welina_phase_lines',
  PHASE_RANGES: 'welina_phase_ranges',
  GRAPH_NOTES: 'welina_graph_notes',
  ABC_ENTRIES: 'welina_abc_entries',
  SEED_VERSION: 'welina_seed_version'
};

const cloneSeed = (value) => structuredClone(value);

function getStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('LocalStorage write failed:', e);
    return false;
  }
}

class AnalyticsService {
  constructor() {
    // The app is a demo: a fixture revision intentionally replaces older demo
    // localStorage data so returning visitors see the new programs and recordings.
    if (getStored(STORAGE_KEYS.SEED_VERSION, null) !== SEED_VERSION) {
      this.resetToDefault();
    } else {
      this.clients = getStored(STORAGE_KEYS.CLIENTS, cloneSeed(INITIAL_CLIENTS));
      this.programs = getStored(STORAGE_KEYS.PROGRAMS, cloneSeed(INITIAL_PROGRAMS));
      this.sessions = getStored(STORAGE_KEYS.SESSIONS, cloneSeed(INITIAL_SESSION_DATA));
      this.phaseLines = getStored(STORAGE_KEYS.PHASE_LINES, cloneSeed(INITIAL_PHASE_LINES));
      this.phaseRanges = getStored(STORAGE_KEYS.PHASE_RANGES, cloneSeed(INITIAL_PHASE_RANGES));
      this.graphNotes = getStored(STORAGE_KEYS.GRAPH_NOTES, cloneSeed(INITIAL_GRAPH_NOTES));
      this.abcEntries = getStored(STORAGE_KEYS.ABC_ENTRIES, cloneSeed(INITIAL_ABC_ENTRIES));
    }
    this.abcConfigurations = INITIAL_ABC_CONFIGURATIONS;
    this.serviceSessions = SERVICE_SESSIONS;
    this.staff = STAFF;
    this.standards = CLINICAL_STANDARDS;
    this.publishSnapshot();
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener) => {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener('welina-data-change', listener);
    return () => window.removeEventListener('welina-data-change', listener);
  };

  publishSnapshot() {
    this.snapshot = {
      clients: [...this.clients], programs: [...this.programs], sessions: [...this.sessions],
      abcEntries: [...this.abcEntries], phaseLines: [...this.phaseLines], phaseRanges: [...this.phaseRanges],
      graphNotes: [...this.graphNotes], serviceSessions: SERVICE_SESSIONS, storageError: Boolean(this.storageError)
    };
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event('welina-data-change'));
    }
  }

  saveAll(keys = null) {
    // Only rewrite what changed (observations alone are ~1 MB), but track failures per
    // key so a later small write never hides an earlier failed one.
    const values = {
      [STORAGE_KEYS.CLIENTS]: this.clients,
      [STORAGE_KEYS.PROGRAMS]: this.programs,
      [STORAGE_KEYS.SESSIONS]: this.sessions,
      [STORAGE_KEYS.PHASE_LINES]: this.phaseLines,
      [STORAGE_KEYS.PHASE_RANGES]: this.phaseRanges,
      [STORAGE_KEYS.GRAPH_NOTES]: this.graphNotes,
      [STORAGE_KEYS.ABC_ENTRIES]: this.abcEntries,
      [STORAGE_KEYS.SEED_VERSION]: SEED_VERSION
    };
    this.failedKeys = this.failedKeys || new Set();
    for (const key of keys ? [...keys, ...this.failedKeys] : Object.keys(values)) {
      if (setStored(key, values[key])) this.failedKeys.delete(key);
      else this.failedKeys.add(key);
    }
    this.storageError = this.failedKeys.size > 0;
    this.publishSnapshot();
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('welina-storage-status', { detail: { saved: !this.storageError } }));
    }
    return !this.storageError;
  }

  resetToDefault() {
    // Clone nested targets too: phase edits must not change the imported seed.
    this.clients = cloneSeed(INITIAL_CLIENTS);
    this.programs = cloneSeed(INITIAL_PROGRAMS);
    this.sessions = cloneSeed(INITIAL_SESSION_DATA);
    this.phaseLines = cloneSeed(INITIAL_PHASE_LINES);
    this.phaseRanges = cloneSeed(INITIAL_PHASE_RANGES);
    this.graphNotes = cloneSeed(INITIAL_GRAPH_NOTES);
    this.abcEntries = cloneSeed(INITIAL_ABC_ENTRIES);
    this.abcConfigurations = INITIAL_ABC_CONFIGURATIONS;
    this.saveAll();
  }

  getClients() {
    return this.clients;
  }

  getServiceSessions(clientId) {
    return this.serviceSessions.filter(session => session.clientId === clientId);
  }

  getClient(id) {
    return this.clients.find(c => c.id === id) || null;
  }

  getPrograms(clientId, category = null) {
    let progs = this.programs.filter(p => p.clientId === clientId);
    if (category) {
      progs = progs.filter(p => p.category === category);
    }
    return progs;
  }

  // Section A: Overall Targets Mastered
  getCumulativeMastery(clientId, programId) {
    const program = this.programs.find(p => p.clientId === clientId && p.id === programId);
    if (!program) return [];

    const transitionEvents = [];

    program.targets.forEach(tgt => {
      const date = masteryDate(tgt);
      if (date) transitionEvents.push({ date, targetName: tgt.name, phase: tgt.phase });
    });

    if (transitionEvents.length === 0) return [];

    // Group changes by date to aggregate multiple transitions on the same date
    const dateMap = new Map();
    transitionEvents.forEach(evt => {
      if (!dateMap.has(evt.date)) dateMap.set(evt.date, []);
      dateMap.get(evt.date).push(evt.targetName);
    });

    const sortedDates = Array.from(dateMap.keys()).sort();
    let cumulative = 0;
    const result = [];

    sortedDates.forEach(date => {
      const targetNames = dateMap.get(date);
      cumulative += targetNames.length;
      result.push({
        date,
        cumulativeCount: cumulative,
        newlyMastered: targetNames
      });
    });

    return result;
  }

  // Section B: Target Data
  getTargetData({
    clientId,
    targetIds = [],
    durationFilter = '1 month',
    zeroOutBehavior = true
  }) {
    if (!clientId || targetIds.length === 0) {
      return { series: [], dates: [], rawRecords: [] };
    }

    // Filter raw sessions by client & target
    let raw = this.sessions.filter(s => s.clientId === clientId && targetIds.includes(s.targetId));

    // Apply duration filter
    const now = new Date(`${SEED_AS_OF_DATE}T23:59:59`);
    let minDate = new Date(now);

    switch (durationFilter) {
      case '3 days': minDate.setDate(now.getDate() - 3); break;
      case '5 days': minDate.setDate(now.getDate() - 5); break;
      case '7 days': minDate.setDate(now.getDate() - 7); break;
      case '2 weeks': minDate.setDate(now.getDate() - 14); break;
      case '1 month': minDate.setMonth(now.getMonth() - 1); break;
      case '3 months': minDate.setMonth(now.getMonth() - 3); break;
      case '6 months': minDate.setMonth(now.getMonth() - 6); break;
      case '1 year': minDate.setFullYear(now.getFullYear() - 1); break;
      case '2 years': minDate.setFullYear(now.getFullYear() - 2); break;
      case 'All': minDate = new Date(2020, 0, 1); break;
      default: minDate.setMonth(now.getMonth() - 1); break;
    }

    raw = raw.filter(s => new Date(s.timestamp) >= minDate);
    raw.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // A missed observation is never a measured zero; zero-out is optional.
    raw = raw.filter(s => s.missingDataMode !== 'DataNotTracked' &&
      (zeroOutBehavior || s.missingDataMode !== 'ZeroOut'));

    return {
      rawRecords: raw
    };
  }

  // Section C: ABC Data
  getAbcConfiguration(clientId) {
    return this.abcConfigurations.find(config => config.clientId === clientId) || null;
  }

  getAbcData(clientId, durationFilter = 'Past 1 Month') {
    let entries = this.abcEntries.filter(a => a.clientId === clientId);
    const now = new Date(`${SEED_AS_OF_DATE}T23:59:59`);
    let minDate = new Date(now);

    switch (durationFilter) {
      case 'Past 3 Days': minDate.setDate(now.getDate() - 3); break;
      case 'Past 5 Days': minDate.setDate(now.getDate() - 5); break;
      case 'Past 7 Days': minDate.setDate(now.getDate() - 7); break;
      case 'Past 1 Month': minDate.setMonth(now.getMonth() - 1); break;
      case 'Past 3 Months': minDate.setMonth(now.getMonth() - 3); break;
      case 'Past 6 Months': minDate.setMonth(now.getMonth() - 6); break;
      case 'All': minDate = new Date(2020, 0, 1); break;
      default: minDate.setMonth(now.getMonth() - 1); break;
    }

    entries = entries.filter(e => new Date(e.timestamp) >= minDate);
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return entries;
  }

  // Annotations
  getAnnotations(targetId) {
    return {
      phaseLines: this.phaseLines.filter(p => p.targetId === targetId),
      phaseRanges: this.phaseRanges.filter(p => p.targetId === targetId),
      graphNotes: this.graphNotes.filter(p => p.targetId === targetId)
    };
  }

  addPhaseLine(line) {
    const id = line.id || `pcl-${Date.now()}`;
    const newLine = { ...line, id };
    this.phaseLines.push(newLine);
    this.saveAll([STORAGE_KEYS.PHASE_LINES]);
    return newLine;
  }

  deletePhaseLine(id) {
    this.phaseLines = this.phaseLines.filter(p => p.id !== id);
    this.saveAll([STORAGE_KEYS.PHASE_LINES]);
  }

  updatePhaseLine(id, updated) {
    const idx = this.phaseLines.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.phaseLines[idx] = { ...this.phaseLines[idx], ...updated };
      this.saveAll([STORAGE_KEYS.PHASE_LINES]);
    }
  }

  addPhaseRange(range) {
    const id = range.id || `pr-${Date.now()}`;
    const newRange = { ...range, id };
    this.phaseRanges.push(newRange);
    this.saveAll([STORAGE_KEYS.PHASE_RANGES]);
    return newRange;
  }

  deletePhaseRange(id) {
    this.phaseRanges = this.phaseRanges.filter(p => p.id !== id);
    this.saveAll([STORAGE_KEYS.PHASE_RANGES]);
  }

  updatePhaseRange(id, updated) {
    const idx = this.phaseRanges.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.phaseRanges[idx] = { ...this.phaseRanges[idx], ...updated };
      this.saveAll([STORAGE_KEYS.PHASE_RANGES]);
    }
  }

  addGraphNote(note) {
    const id = note.id || `gn-${Date.now()}`;
    const newNote = { ...note, id };
    this.graphNotes.push(newNote);
    this.saveAll([STORAGE_KEYS.GRAPH_NOTES]);
    return newNote;
  }

  deleteGraphNote(id) {
    this.graphNotes = this.graphNotes.filter(p => p.id !== id);
    this.saveAll([STORAGE_KEYS.GRAPH_NOTES]);
  }

  updateGraphNote(id, updated) {
    const idx = this.graphNotes.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.graphNotes[idx] = { ...this.graphNotes[idx], ...updated };
      this.saveAll([STORAGE_KEYS.GRAPH_NOTES]);
    }
  }

  // Update target phase + optional phase line prompt
  updateTargetPhase({ targetId, newPhase, addPhaseLine, phaseLineLabel, phaseDate }) {
    let target = null;

    for (const p of this.programs) {
      const t = p.targets.find(x => x.id === targetId);
      if (t) {
        target = t;
        break;
      }
    }

    if (!target) return null;

    target.phase = newPhase;
    target.phaseEnteredDate = phaseDate || new Date().toISOString().split('T')[0];
    // Keep the phase history chronological so mastery and phase analytics stay truthful.
    const history = (target.phaseHistory || []).filter(entry => entry.date < target.phaseEnteredDate);
    target.phaseHistory = [...history, { phase: newPhase, date: target.phaseEnteredDate }];

    if (addPhaseLine) {
      this.addPhaseLine({
        targetId,
        date: target.phaseEnteredDate,
        label: phaseLineLabel || newPhase,
        style: 'Solid',
        color: '#34634c',
        isAutomated: false,
        source: 'Manual'
      });
    }

    this.saveAll([STORAGE_KEYS.PROGRAMS, STORAGE_KEYS.PHASE_LINES]);
    return target;
  }

  recordTrial(data) {
    const newPoint = {
      id: `d-${Date.now()}`,
      timestamp: data.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 16),
      sessionNumber: data.sessionNumber || 1,
      therapistName: data.therapistName || 'Sarah Jenkins, BCBA',
      ...data
    };
    this.sessions.push(newPoint);
    this.saveAll([STORAGE_KEYS.SESSIONS]);
    return newPoint;
  }
}

export const apiService = new AnalyticsService();
