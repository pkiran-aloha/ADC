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
import { applyObservationEdit, deletionAudit } from '../utils/observations.js';
import {
  CASCADING_STATUSES, PROGRAM_CATEGORIES, PROGRAM_STATUSES, toValueList
} from '../utils/programManagement.js';

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
  DELETION_AUDIT: 'welina_deletion_audit',
  ACTIVITY: 'welina_activity',
  LESSONS: 'welina_lessons',
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
    // Removed observations keep an audit entry so a post-billing correction stays traceable.
    this.deletedRecords = getStored(STORAGE_KEYS.DELETION_AUDIT, []);
    // Program Management changes leave a trail too, so a clinician can see how the plan
    // reached its current state.
    this.activity = getStored(STORAGE_KEYS.ACTIVITY, []);
    // Lessons group programs for delivery. The collection is empty until a
    // clinician builds one, so a fresh workspace reads as "not in a lesson".
    this.lessons = getStored(STORAGE_KEYS.LESSONS, []);
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
      graphNotes: [...this.graphNotes], serviceSessions: SERVICE_SESSIONS, deletedRecords: [...this.deletedRecords],
      activity: [...(this.activity || [])],
      lessons: [...(this.lessons || [])],
      storageError: Boolean(this.storageError)
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
      [STORAGE_KEYS.DELETION_AUDIT]: this.deletedRecords,
      [STORAGE_KEYS.ACTIVITY]: this.activity || [],
      [STORAGE_KEYS.LESSONS]: this.lessons || [],
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
    this.deletedRecords = [];
    this.activity = [];
    this.lessons = [];
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

  // Latest session number for a target, counting records added earlier in this batch.
  nextSessionNumber(clientId, targetId, assigned = new Map()) {
    const key = `${clientId}|${targetId}`;
    if (assigned.has(key)) return assigned.get(key) + 1;
    const last = this.sessions.reduce((max, session) => (session.clientId === clientId && session.targetId === targetId ? Math.max(max, session.sessionNumber || 0) : max), 0);
    return last + 1;
  }

  // Update target phase + optional phase line prompt
  updateTargetPhase({ targetId, newPhase, addPhaseLine, phaseLineLabel, phaseDate }) {
    const target = this.applyTargetPhase({ targetId, newPhase, addPhaseLine, phaseLineLabel, phaseDate });
    if (target) this.saveAll([STORAGE_KEYS.PROGRAMS, STORAGE_KEYS.PHASE_LINES]);
    return target;
  }

  // Several phase changes from one session: mutate everything, then save once.
  updateTargetPhases(changes = []) {
    const updated = changes.map(change => this.applyTargetPhase(change)).filter(Boolean);
    if (updated.length) this.saveAll([STORAGE_KEYS.PROGRAMS, STORAGE_KEYS.PHASE_LINES]);
    return updated;
  }

  applyTargetPhase({ targetId, newPhase, addPhaseLine, phaseLineLabel, phaseDate }) {
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
      // Pushed directly so a batch of phase changes saves both keys once.
      this.phaseLines.push({
        id: `pcl-${Date.now()}-${(this.sequence = (this.sequence || 0) + 1)}`,
        targetId,
        date: target.phaseEnteredDate,
        label: phaseLineLabel || newPhase,
        style: 'Solid',
        color: '#34634c',
        isAutomated: false,
        source: 'Manual'
      });
    }
    return target;
  }

  // ---- Round 2: manual entry, import, correction and program updates -----------------

  // Manually entered data (probe, school, paper, assessment) is stored exactly like a
  // recorded observation, with the collection context kept for the raw export.
  addObservation(point) {
    const [created] = this.recordTrials([{ observationType: 'Primary', ...point }]);
    return created;
  }

  addObservations(points = []) {
    return this.recordTrials(points.map(point => ({ observationType: 'Primary', ...point })));
  }

  findObservation(id) {
    return this.sessions.find(row => row.id === id) || null;
  }

  // Correction of an existing observation, with the previous measurement kept in the
  // record's edit history so a billed appointment does not need releasing and rebilling.
  updateObservation(id, patch, audit = {}) {
    const index = this.sessions.findIndex(row => row.id === id);
    if (index === -1) return null;
    const updated = applyObservationEdit(this.sessions[index], { ...patch, ...audit });
    this.sessions[index] = updated;
    this.saveAll([STORAGE_KEYS.SESSIONS]);
    return updated;
  }

  // Deletion removes the observation from the data but keeps an audit entry.
  deleteObservation(id, audit = {}) {
    const index = this.sessions.findIndex(row => row.id === id);
    if (index === -1) return null;
    const [removed] = this.sessions.splice(index, 1);
    const entry = { ...deletionAudit(removed, audit), clientId: removed.clientId, targetId: removed.targetId };
    this.deletedRecords = [entry, ...(this.deletedRecords || [])].slice(0, 500);
    this.saveAll([STORAGE_KEYS.SESSIONS, STORAGE_KEYS.DELETION_AUDIT]);
    return { removed, entry };
  }

  getDeletionAudit(clientId = null) {
    return (this.deletedRecords || []).filter(entry => !clientId || entry.clientId === clientId);
  }

  // ---- Annotations applied across several targets ------------------------------------

  // A phase line, range or note created once can be applied to every target in a program,
  // to the visible targets, or to every behavior target. Duplicates are skipped so the
  // refresh after saving never produces two lines on the same date.
  addPhaseLinesBulk(lines = []) {
    const { created, skipped } = this.#bulkInsert(this.phaseLines, 'pcl', lines, line => `${line.targetId}|${line.date}|${line.label}`);
    if (created.length) this.saveAll([STORAGE_KEYS.PHASE_LINES]);
    return { created, skipped };
  }

  addPhaseRangesBulk(ranges = []) {
    const { created, skipped } = this.#bulkInsert(this.phaseRanges, 'pr', ranges, range => `${range.targetId}|${range.startDate}|${range.endDate}|${range.label}`);
    if (created.length) this.saveAll([STORAGE_KEYS.PHASE_RANGES]);
    return { created, skipped };
  }

  addGraphNotesBulk(notes = []) {
    const { created, skipped } = this.#bulkInsert(this.graphNotes, 'gn', notes, note => `${note.targetId}|${note.date}|${note.noteText}`);
    if (created.length) this.saveAll([STORAGE_KEYS.GRAPH_NOTES]);
    return { created, skipped };
  }

  #bulkInsert(collection, prefix, records, keyOf) {
    // Duplicate protection: a line, range or note that already exists for that target is
    // reported as skipped rather than added twice.
    const existing = new Set(collection.map(keyOf));
    const stamp = Date.now();
    const created = [];
    const skipped = [];
    records.forEach((record, index) => {
      const key = keyOf(record);
      if (existing.has(key)) { skipped.push(record); return; }
      existing.add(key);
      const entry = { ...record, id: record.id || `${prefix}-${stamp}-${index}` };
      collection.push(entry);
      created.push(entry);
    });
    return { created, skipped };
  }

  // A clinician reviewing the data can move the program forward without leaving analytics.
  updateProgramStatus(programId, status, { reason = '', staffName = '', asOf = null, note = '' } = {}) {
    const program = this.programs.find(item => item.id === programId);
    if (!program || !status) return null;
    const date = asOf || new Date().toISOString().slice(0, 10);
    program.status = status;
    program.statusHistory = [...(program.statusHistory || []), { status, date, reason, staffName, note: note || undefined }];
    this.saveAll([STORAGE_KEYS.PROGRAMS]);
    return program;
  }

  // ---- Program Management -----------------------------------------------------------
  // Programs are defined here, not only analysed. Every change is one user action, one
  // state change, written to the browser and recorded in the activity log.

  findProgram(programId) {
    return this.programs.find(item => item.id === programId) || null;
  }

  // A program as the listing shows it: archived programs are kept out of the working
  // list, and every program carries the scope it lives in.
  listPrograms(clientId, { category = null, includeArchived = false } = {}) {
    return this.programs
      .filter(program => program.clientId === clientId)
      .filter(program => (category ? program.category === category : true))
      .filter(program => (includeArchived ? true : !program.archivedAt));
  }

  // Create a program. The new program starts active, in client scope, and with the
  // fields the platform's form collects.
  createProgram({ clientId, name, category = PROGRAM_CATEGORIES.SKILL, status = 'Pending', ...fields } = {}) {
    if (!clientId || !String(name || '').trim()) return null;
    const program = {
      id: `prog-${Date.now()}-${(this.sequence = (this.sequence || 0) + 1)}`,
      clientId,
      name: String(name).trim(),
      category,
      status,
      scope: 'client',
      domain: fields.domain || '',
      treatmentArea: toValueList(fields.treatmentArea),
      tags: toValueList(fields.tags),
      baseline: fields.baseline || '',
      programObjective: fields.programObjective || '',
      teachingInstructions: fields.teachingInstructions || '',
      description: fields.programObjective || '',
      learningMaterials: fields.learningMaterials || [],
      customFields: fields.customFields || {},
      targets: [],
      archivedAt: null,
      statusHistory: [{ status, date: fields.asOf || SEED_AS_OF_DATE, reason: 'Program created', staffName: fields.staffName || '' }]
    };
    if (category === PROGRAM_CATEGORIES.BEHAVIOR) {
      program.behaviorPhase = fields.behaviorPhase || 'Open';
      program.operationalDefinition = fields.operationalDefinition || '';
    }
    this.programs.push(program);
    this.recordActivity('program.created', 'program', program.id, `Created program “${program.name}”.`);
    this.saveAll([STORAGE_KEYS.PROGRAMS, STORAGE_KEYS.ACTIVITY]);
    return program;
  }

  // Edit a program. The scope and the client's identity never change.
  updateProgram(programId, patch = {}) {
    const program = this.findProgram(programId);
    if (!program) return null;
    const allowed = ['name', 'status', 'domain', 'treatmentArea', 'tags', 'baseline', 'programObjective',
      'teachingInstructions', 'description', 'learningMaterials', 'customFields', 'behaviorPhase',
      'operationalDefinition', 'scope'];
    allowed.forEach(key => {
      if (key in patch) program[key] = patch[key];
    });
    // Treatment areas and tags are lists in the form; the fixture stores a
    // treatment area as a single string, so both are normalized to lists here.
    if ('treatmentArea' in patch) program.treatmentArea = toValueList(patch.treatmentArea);
    if ('tags' in patch) program.tags = toValueList(patch.tags);
    if ('programObjective' in patch && !('description' in patch)) program.description = patch.programObjective;
    this.recordActivity('program.updated', 'program', program.id, `Updated program “${program.name}”.`);
    this.saveAll([STORAGE_KEYS.PROGRAMS, STORAGE_KEYS.ACTIVITY]);
    return program;
  }

  // Archive keeps the program and everything recorded against it; it only stops the
  // program from driving today's work.
  archiveProgram(programId, { asOf = null, reason = '' } = {}) {
    const program = this.findProgram(programId);
    if (!program) return null;
    program.archivedAt = asOf || SEED_AS_OF_DATE;
    program.archiveReason = reason || undefined;
    this.recordActivity('program.archived', 'program', program.id, `Archived program “${program.name}”.`);
    this.saveAll([STORAGE_KEYS.PROGRAMS, STORAGE_KEYS.ACTIVITY]);
    return program;
  }

  unarchiveProgram(programId) {
    const program = this.findProgram(programId);
    if (!program) return null;
    program.archivedAt = null;
    program.archiveReason = undefined;
    this.recordActivity('program.unarchived', 'program', program.id, `Restored program “${program.name}” to the active list.`);
    this.saveAll([STORAGE_KEYS.PROGRAMS, STORAGE_KEYS.ACTIVITY]);
    return program;
  }

  // A duplicate starts again: new identities, no observations, no phase history.
  duplicateProgram(programId, { clientId = null, asOf = null } = {}) {
    const source = this.findProgram(programId);
    if (!source) return null;
    const stamp = Date.now();
    const copy = {
      ...JSON.parse(JSON.stringify(source)),
      id: `prog-${stamp}-${(this.sequence = (this.sequence || 0) + 1)}`,
      clientId: clientId || source.clientId,
      name: `${source.name} (copy)`,
      status: 'Pending',
      archivedAt: null,
      archiveReason: undefined,
      targets: (source.targets || []).map((target, index) => ({
        ...JSON.parse(JSON.stringify(target)),
        id: `tgt-${stamp}-${index}-${(this.sequence = (this.sequence || 0) + 1)}`,
        phase: 'Pending',
        phaseEnteredDate: asOf || SEED_AS_OF_DATE,
        phaseHistory: [],
        masteryRule: undefined,
        manualMastery: undefined
      }))
    };
    copy.targets = copy.targets.map(target => ({ ...target, programId: copy.id }));
    this.programs.push(copy);
    this.recordActivity('program.duplicated', 'program', copy.id, `Duplicated program “${source.name}”.`);
    this.saveAll([STORAGE_KEYS.PROGRAMS, STORAGE_KEYS.ACTIVITY]);
    return copy;
  }

  // The platform's cascade: a program that is pending, completed, on hold or
  // discontinued carries its targets with it. The active teaching statuses do not.
  applyProgramStatus(programId, status, { reason = '', staffName = '', asOf = null, plotLine = false } = {}) {
    const program = this.findProgram(programId);
    if (!program || !PROGRAM_STATUSES.includes(status)) return null;
    const date = asOf || SEED_AS_OF_DATE;
    program.status = status;
    program.statusHistory = [...(program.statusHistory || []), { status, date, reason, staffName }];
    if (CASCADING_STATUSES.includes(status)) {
      (program.targets || []).forEach(target => {
        this.applyTargetPhase({ targetId: target.id, newPhase: status, phaseDate: date });
      });
    }
    if (plotLine) {
      this.phaseLines.push({
        id: `pcl-${Date.now()}-${(this.sequence = (this.sequence || 0) + 1)}`,
        targetId: null,
        programId: program.id,
        date,
        label: `${status} starts`,
        style: 'Solid',
        color: '#34634c',
        isAutomated: false,
        source: 'Manual'
      });
    }
    this.recordActivity('program.status', 'program', program.id, `Set program “${program.name}” to ${status}.`);
    this.saveAll([STORAGE_KEYS.PROGRAMS, STORAGE_KEYS.PHASE_LINES, STORAGE_KEYS.ACTIVITY]);
    return program;
  }

  // A target is one measurable unit inside a program. The measurement tool is fixed
  // once the target exists, so that data collected under one method is never
  // compared against data collected under another.
  addTarget(programId, target = {}) {
    const program = this.findProgram(programId);
    if (!program || !String(target.name || '').trim() || !target.type) return null;
    const created = {
      id: `tgt-${Date.now()}-${(this.sequence = (this.sequence || 0) + 1)}`,
      name: String(target.name).trim(),
      description: target.description || '',
      type: target.type,
      phase: target.phase || 'Pending',
      phaseEnteredDate: target.phaseEnteredDate || SEED_AS_OF_DATE,
      phaseHistory: [],
      discriminativeStimuli: target.discriminativeStimuli || '',
      masterySettings: target.masterySettings || 'Automatic',
      masteryCriteria: target.masteryCriteria || '',
      color: target.color || '#3B82F6',
      programId: program.id,
      promptHierarchyId: target.promptHierarchyId,
      targetInstructions: target.targetInstructions,
      intervalSettings: target.intervalSettings,
      fluencySettings: target.fluencySettings,
      masteryRule: target.masteryRule,
      manualMastery: target.manualMastery
    };
    program.targets = [...(program.targets || []), created];
    this.recordActivity('target.created', 'target', created.id, `Added target “${created.name}” to “${program.name}”.`);
    this.saveAll([STORAGE_KEYS.PROGRAMS, STORAGE_KEYS.ACTIVITY]);
    return created;
  }

  // Editing keeps the measurement type fixed and the identity unchanged.
  updateTarget(targetId, patch = {}) {
    const target = this.findTarget(targetId);
    if (!target) return null;
    const allowed = ['name', 'description', 'discriminativeStimuli', 'masterySettings', 'masteryCriteria',
      'masteryRule', 'manualMastery', 'promptHierarchyId', 'targetInstructions', 'intervalSettings', 'fluencySettings'];
    allowed.forEach(key => { if (key in patch) target[key] = patch[key]; });
    this.recordActivity('target.updated', 'target', target.id, `Updated target “${target.name}”.`);
    this.saveAll([STORAGE_KEYS.PROGRAMS, STORAGE_KEYS.ACTIVITY]);
    return target;
  }

  // Deleting removes the target from its program. Observations already recorded
  // against it stay in the data, so a deletion never silently erases a record.
  deleteTargets(programId, targetIds = []) {
    const program = this.findProgram(programId);
    if (!program) return [];
    const wanted = new Set(targetIds);
    const removed = (program.targets || []).filter(target => wanted.has(target.id));
    if (!removed.length) return [];
    program.targets = program.targets.filter(target => !wanted.has(target.id));
    removed.forEach(target => this.recordActivity('target.deleted', 'target', target.id, `Deleted target “${target.name}” from “${program.name}”.`));
    this.saveAll([STORAGE_KEYS.PROGRAMS, STORAGE_KEYS.ACTIVITY]);
    return removed;
  }

  findTarget(targetId) {
    for (const program of this.programs) {
      const target = (program.targets || []).find(item => item.id === targetId);
      if (target) return target;
    }
    return null;
  }

  // ---- Activity log -----------------------------------------------------------------
  // Every change made in Program Management leaves a trail, so a clinician can see how
  // the plan reached its current state. The log is capped, like the deletion audit.
  recordActivity(kind, entityType, entityId, summary) {
    if (!this.activity) this.activity = [];
    this.activity = [{ id: `act-${Date.now()}-${(this.sequence = (this.sequence || 0) + 1)}`, at: SEED_AS_OF_DATE, kind, entityType, entityId, summary }, ...this.activity].slice(0, 500);
    return this.activity[0];
  }

  getActivity(entityId = null) {
    const log = this.activity || [];
    return entityId ? log.filter(entry => entry.entityId === entityId) : log;
  }

  // ---- Lessons ----------------------------------------------------------------------
  // A lesson is a reusable group of programs for one client: the shape of a recurring
  // session, defined once and used each time it runs.
  getLessons(clientId = null) {
    const lessons = this.lessons || [];
    return clientId ? lessons.filter(lesson => lesson.clientId === clientId) : lessons;
  }

  createLesson({ clientId, name, programIds = [] } = {}) {
    if (!clientId || !String(name || '').trim()) return null;
    const lesson = {
      id: `lesson-${Date.now()}-${(this.sequence = (this.sequence || 0) + 1)}`,
      clientId,
      name: String(name).trim(),
      programIds: [...programIds],
      createdAt: SEED_AS_OF_DATE
    };
    this.lessons.push(lesson);
    this.recordActivity('lesson.created', 'lesson', lesson.id, `Created lesson “${lesson.name}”.`);
    this.saveAll([STORAGE_KEYS.LESSONS, STORAGE_KEYS.ACTIVITY]);
    return lesson;
  }

  recordTrial(data) {
    const [newPoint] = this.recordTrials([data]);
    return newPoint;
  }

  // One session can update several targets at once: number per target, save once.
  recordTrials(points = []) {
    const assigned = new Map();
    const created = points.map(data => {
      const sessionNumber = data.sessionNumber || this.nextSessionNumber(data.clientId, data.targetId, assigned);
      assigned.set(`${data.clientId}|${data.targetId}`, sessionNumber);
      const newPoint = {
        therapistName: 'Sarah Jenkins, BCBA',
        ...data,
        id: `d-${Date.now()}-${(this.sequence = (this.sequence || 0) + 1)}`,
        timestamp: data.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 16),
        sessionNumber
      };
      this.sessions.push(newPoint);
      return newPoint;
    });
    if (created.length) this.saveAll([STORAGE_KEYS.SESSIONS]);
    return created;
  }
}

export const apiService = new AnalyticsService();

