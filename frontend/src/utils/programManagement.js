// Program management domain rules.
//
// The Program Management module defines what is taught and how it is measured.
// These are the rules the screens share: which phase a program carries, how
// targets are ordered, what a listing shows, and which values a clinician may
// type. Pure functions only, so they can be tested without a browser.

import { isValidDate } from './formValidation.js';

// The platform's program statuses. "Pending" is in the fixture already, so it
// belongs here even though the older status control left it out.
export const PROGRAM_STATUSES = [
  'Baselining', 'Teaching', 'Maintaining', 'Generalizing', 'Completed', 'Pending', 'OnHold', 'Discontinued'
];

export const PROGRAM_STATUS_LABELS = {
  Baselining: 'Baselining', Teaching: 'Teaching', Maintaining: 'Maintaining', Generalizing: 'Generalizing',
  Completed: 'Completed', Pending: 'Pending', OnHold: 'On hold', Discontinued: 'Discontinued'
};

// The target phases, shared by every measurement type. "Open" is the
// behavior-reduction case: defined, but not yet being reduced.
export const TARGET_PHASES = [
  'Baseline', 'Open', 'Pending', 'Acquisition', 'Maintenance', 'Generalization', 'Completed', 'OnHold', 'Discontinued'
];

// A behavior carries its own lifecycle, separate from its target's measurement
// progress. "Open" means defined but not yet reducing.
export const BEHAVIOR_PHASES = ['Open', 'Maintenance', 'Generalization', 'Completed', 'Pending', 'OnHold', 'Discontinued'];

export const PHASE_LABELS = {
  Baseline: 'Baseline', Open: 'Open', Pending: 'Pending', Acquisition: 'In acquisition',
  Maintenance: 'Maintenance', Generalization: 'Generalization', Completed: 'Completed',
  OnHold: 'On hold', Discontinued: 'Discontinued'
};

// Mastered means the target has been learned to criterion. Paused, ended and
// pending targets are not mastered, and neither is a behavior still open.
export const MASTERED_PHASES = ['Maintenance', 'Generalization', 'Completed'];
export const NOT_MEASURED_PHASES = ['Baseline', 'Open', 'Pending'];

// A program that is pending, completed, on hold or discontinued carries its
// targets with it. The active teaching statuses do not: those programs are
// live, and each target progresses on its own.
export const CASCADING_STATUSES = ['Pending', 'Completed', 'OnHold', 'Discontinued'];
export const ACTIVE_STATUSES = ['Baselining', 'Teaching', 'Maintaining', 'Generalizing'];

export const PROGRAM_CATEGORIES = { SKILL: 'SkillAcquisition', BEHAVIOR: 'BehaviorReduction' };

// Target order: not-yet-started first, then the teaching phases, then completed,
// then the paused and ended states. Within a phase, alphabetical.
const PHASE_ORDER = ['Baseline', 'Open', 'Pending', 'Acquisition', 'Maintenance', 'Generalization', 'Completed', 'OnHold', 'Discontinued'];

export function isArchived(record) {
  return Boolean(record?.archivedAt);
}

// A clinician's recorded decision is authoritative: mastered when they said so, not
// when they said otherwise. A target with no recorded decision, which includes every
// target that predates the decision field, is mastered when it sits in a mastered phase.
export function isMastered(target) {
  if (!target) return false;
  if (target.manualMastery) return Boolean(target.manualMastery.achieved);
  return MASTERED_PHASES.includes(target.phase);
}

// The target's mastery date: when it first reached a mastered phase.
export function masteryDate(target) {
  if (!target) return null;
  const history = target.phaseHistory || [];
  const first = history.find(entry => MASTERED_PHASES.includes(entry.phase));
  if (first) return first.date;
  return MASTERED_PHASES.includes(target.phase) ? target.phaseEnteredDate || null : null;
}

export function sortTargets(targets = []) {
  return [...targets].sort((a, b) => {
    const phaseDelta = PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase);
    if (phaseDelta !== 0) return phaseDelta;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

export function sortPrograms(programs = []) {
  return [...programs].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

// The listing separates what is active from what has been archived, because an
// archived program keeps its history and its data but should not drive today.
export function partitionByArchive(programs = []) {
  const active = sortPrograms(programs.filter(program => !isArchived(program)));
  const archived = sortPrograms(programs.filter(program => isArchived(program)));
  return { active, archived };
}

// The summary widgets on a program view.
export function programSummary(program) {
  const targets = program?.targets || [];
  const mastered = targets.filter(isMastered);
  const percent = targets.length ? Math.round((mastered.length / targets.length) * 100) : 0;
  return { total: targets.length, mastered: mastered.length, percent };
}

// A program name is not unique. An exact duplicate within one client is almost
// always a mistake, so it warns; the same name for a different client is normal.
export function duplicateNameWarning(programs = [], { clientId, name, excludeId = null } = {}) {
  const wanted = String(name || '').trim().toLowerCase();
  if (!wanted) return null;
  const clash = programs.find(program =>
    program.clientId === clientId &&
    program.id !== excludeId &&
    String(program.name || '').trim().toLowerCase() === wanted
  );
  return clash ? clash.name : null;
}

// Which programs count toward a listing's counts.
export function countByCategory(programs = [], category) {
  return programs.filter(program => program.category === category && !isArchived(program)).length;
}

// A program belongs to a lesson when the lesson lists it. The listing shows the
// lesson name so a clinician can see where a program runs.
export function lessonNameByProgram(lessons = []) {
  const names = new Map();
  lessons.forEach(lesson => {
    (lesson.programIds || []).forEach(programId => {
      if (!names.has(programId)) names.set(programId, lesson.name);
    });
  });
  return names;
}

// Field limits from the platform's program form.
export const FIELD_LIMITS = {
  programName: 100,
  baseline: 1000,
  objective: 1000,
  teachingInstructions: 1000,
  targetInstructions: 1000,
  operationalDefinition: 5000
};

export function withinLimit(value, limit) {
  return String(value || '').length <= limit;
}

// A program form is complete when the required fields are filled and the
// platform's limits are respected. The behavior form adds the operational
// definition, because a behavior without one cannot be recorded consistently.
export function validateProgram(values = {}, { category = PROGRAM_CATEGORIES.SKILL, existing = [], scope = 'client' } = {}) {
  const errors = {};
  const name = String(values.name || '').trim();
  if (!name) errors.name = 'Give the program a name.';
  else if (!withinLimit(name, FIELD_LIMITS.programName)) errors.name = `Keep the name to ${FIELD_LIMITS.programName} characters.`;
  if (!values.status) errors.status = 'Choose a status.';
  else if (!PROGRAM_STATUSES.includes(values.status)) errors.status = 'Choose a status from the list.';

  if (category === PROGRAM_CATEGORIES.BEHAVIOR) {
    if (!String(values.operationalDefinition || '').trim()) {
      errors.operationalDefinition = 'Define exactly what qualifies as the behavior.';
    } else if (!withinLimit(values.operationalDefinition, FIELD_LIMITS.operationalDefinition)) {
      errors.operationalDefinition = `Keep the operational definition to ${FIELD_LIMITS.operationalDefinition} characters.`;
    }
    if (!values.behaviorPhase) errors.behaviorPhase = 'Choose a phase.';
    else if (!BEHAVIOR_PHASES.includes(values.behaviorPhase)) errors.behaviorPhase = 'Choose a phase from the list.';
  } else if (scope !== 'organization') {
    // The organization library holds no client-specific text, so instructions are optional there.
    if (!String(values.teachingInstructions || '').trim()) errors.teachingInstructions = 'Describe how the program is taught.';
  }

  [['baseline', 'baseline'], ['programObjective', 'objective'], ['teachingInstructions', 'teachingInstructions']]
    .forEach(([key, label]) => {
      if (values[key] && !withinLimit(values[key], FIELD_LIMITS[label])) {
        errors[key] = `Keep this to ${FIELD_LIMITS[label]} characters.`;
      }
    });

  // The name is not unique, but an exact duplicate within one client is a likely
  // mistake, so it warns without blocking.
  const clash = duplicateNameWarning(existing, { clientId: values.clientId, name });
  if (clash) errors.nameWarning = `A program for this client is already called “${clash}”.`;

  return errors;
}

// A form is complete when there are no errors and no warnings left unacknowledged.
export function programFormComplete(errors = {}) {
  return !Object.keys(errors).some(key => key !== 'nameWarning');
}

// Treatment areas and tags are multi-value lists. The fixture holds a treatment
// area as a single string, so it is normalized to a list at the boundary rather
// than changing the fixture.
export function toValueList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

// Treatment areas and tags are multi-value lists entered one item at a time.
// A partially typed item is kept when the clinician leaves the field.
export function addTagValue(list = [], value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return list;
  if (list.some(item => item.toLowerCase() === trimmed.toLowerCase())) return list;
  return [...list, trimmed];
}

export function removeTagValue(list = [], value) {
  return list.filter(item => item !== value);
}

// The client's ABC vocabulary: what a value list is called in the interface.
export const ABC_LISTS = [
  { key: 'antecedents', label: 'Antecedent' },
  { key: 'behaviors', label: 'Behavior' },
  { key: 'consequences', label: 'Consequence' },
  { key: 'locations', label: 'Location' }
];

// How many existing observations use a value. Removing a value that is in use
// warns the clinician before the vocabulary and the record disagree.
export function usageCount(entries = [], listKey, value) {
  const wanted = String(value || '');
  return entries.filter(entry => {
    // An observation holds one location, under the singular key.
    const values = listKey === 'location' || listKey === 'locations' ? [entry.location] : entry[listKey];
    return Array.isArray(values) && values.includes(wanted);
  }).length;
}

// ---- Targets --------------------------------------------------------------------------

export const TARGET_TYPES = ['TrialByTrial', 'Frequency', 'Duration', 'IntervalData', 'Anecdotal', 'FluencyRate'];
export const TARGET_TYPE_LABELS = {
  TrialByTrial: 'Trial by trial', Frequency: 'Frequency', Duration: 'Duration',
  IntervalData: 'Interval data', Anecdotal: 'Anecdotal', FluencyRate: 'Fluency / rate'
};
export const INTERVAL_START_TYPES = ['Manual', 'LessonStart'];
export const INTERVAL_CAPTURE_TYPES = ['Whole', 'Partial', 'MomentaryTimeSampling'];
export const FLUENCY_START_TYPES = ['LessonStartCountUp', 'ManualStartCountUp', 'ManualStartCountDown'];
// Taken from the rules the fixture already carries, so every existing target is valid.
export const MASTERY_MEASURES = ['percentCorrect', 'percentIntervals', 'durationSeconds', 'ratePerHour', 'correctPerMinute', 'count', 'intervalCount'];
export const MASTERY_COMPARISONS = ['atLeast', 'atMost', 'below'];

// A target's measurement type decides which configuration it must carry. The
// recorder reads the same configuration, so the checks live in one place.
export function validateTypeConfig(target = {}, { promptHierarchyIds = [] } = {}) {
  const errors = {};
  if (target.type === 'TrialByTrial') {
    if (!target.promptHierarchyId) errors.promptHierarchyId = 'Choose a prompt hierarchy.';
    else if (promptHierarchyIds.length && !promptHierarchyIds.includes(target.promptHierarchyId)) {
      errors.promptHierarchyId = 'Choose a prompt hierarchy from the list.';
    }
  }
  if (target.type === 'IntervalData') {
    const settings = target.intervalSettings || {};
    if (!INTERVAL_START_TYPES.includes(settings.startType)) errors.intervalStartType = 'Choose how the intervals start.';
    if (!/^\d{1,2}:\d{2}$/.test(String(settings.intervalLength || '')) || settings.intervalLength === '00:00') {
      errors.intervalLength = 'Enter the interval length as minutes and seconds, such as 00:30.';
    }
    if (!INTERVAL_CAPTURE_TYPES.includes(settings.captureType)) errors.intervalCaptureType = 'Choose how each interval is scored.';
    if (settings.numberOfIntervals != null && settings.numberOfIntervals !== '') {
      const count = Number(settings.numberOfIntervals);
      if (!Number.isInteger(count) || count < 1) errors.numberOfIntervals = 'Enter a whole number of intervals, or leave it blank.';
    }
  }
  if (target.type === 'FluencyRate') {
    if (!FLUENCY_START_TYPES.includes(target.fluencySettings?.startType)) errors.fluencyStartType = 'Choose how the timer runs.';
  }
  return errors;
}

// Mastery is either computed from a stated rule, or decided by a clinician.
export function validateMastery(target = {}) {
  const errors = {};
  if (target.masterySettings === 'Manual') {
    if (target.manualMastery?.achieved && !target.manualMastery.decidedOn) errors.manualDecidedOn = 'Record the date of the decision.';
    return errors;
  }
  const rule = target.masteryRule;
  if (rule) {
    if (!MASTERY_MEASURES.includes(rule.measure)) errors.masteryMeasure = 'Choose what is measured.';
    if (!MASTERY_COMPARISONS.includes(rule.comparison)) errors.masteryComparison = 'Choose a comparison.';
    if (!Number.isFinite(Number(rule.threshold)) || rule.threshold === '' || Number(rule.threshold) < 0) {
      errors.masteryThreshold = 'Enter a threshold of 0 or more.';
    }
    const sessions = Number(rule.consecutiveSessions);
    if (!Number.isInteger(sessions) || sessions < 1) errors.masterySessions = 'Enter a whole number of sessions.';
  }
  return errors;
}

export function validateTarget(values = {}, { promptHierarchyIds = [] } = {}) {
  const errors = {};
  const names = splitTargetNames(values.name);
  if (!names.length) errors.name = 'Give the target a name.';
  if (!TARGET_TYPES.includes(values.type)) errors.type = 'Choose a measurement type.';
  if (!TARGET_PHASES.includes(values.phase)) errors.phase = 'Choose a phase.';
  if (values.targetInstructions && !withinLimit(values.targetInstructions, FIELD_LIMITS.targetInstructions)) {
    errors.targetInstructions = `Keep this to ${FIELD_LIMITS.targetInstructions} characters.`;
  }
  return { ...errors, ...validateTypeConfig(values, { promptHierarchyIds }), ...validateMastery(values) };
}

// Several names entered together each become their own target.
export function splitTargetNames(raw) {
  return String(raw || '').split(/[\n,]/).map(part => part.trim()).filter(Boolean);
}

// A target's measurement type is fixed once it exists, so data collected under
// one method is never compared against data collected under another.
export function lockedTargetFields(target) {
  return target ? ['type'] : [];
}

// The type tabs on a program view: only types that exist are offered.
export function targetTypeTabs(targets = []) {
  const present = TARGET_TYPES.filter(type => targets.some(target => target.type === type));
  return present.length ? ['All', ...present] : [];
}

// ---- Behaviors ------------------------------------------------------------------------

// A behavior is counted one of three ways, chosen once and then locked.
export const BEHAVIOR_TOOLS = ['Frequency', 'Duration', 'IntervalData'];

export function validateBehavior(values = {}, { existing = [], scope = 'client' } = {}) {
  const errors = validateProgram(values, { category: PROGRAM_CATEGORIES.BEHAVIOR, existing, scope });
  // The platform requires the treatment area and the objective before a behavior is saved.
  if (!toValueList(values.treatmentArea).length) errors.treatmentArea = 'Add at least one treatment area.';
  if (!String(values.programObjective || '').trim()) errors.programObjective = 'State the change you expect to see in this behavior.';
  if (!BEHAVIOR_TOOLS.includes(values.measurementTool)) errors.measurementTool = 'Choose how the behavior is measured.';
  const config = validateTypeConfig({ type: values.measurementTool, intervalSettings: values.intervalSettings });
  return { ...errors, ...config };
}

// A behavior's own phase. Behaviors created before this field existed carry only their
// target's phase, so that stands in when it is a phase a behavior can hold; a target
// still in baseline or acquisition reads as open, defined and not yet reduced.
export function behaviorPhaseOf(program) {
  if (program?.behaviorPhase) return program.behaviorPhase;
  const targetPhase = program?.targets?.[0]?.phase;
  return BEHAVIOR_PHASES.includes(targetPhase) ? targetPhase : 'Open';
}

// ---- Lesson notes ---------------------------------------------------------------------

export const LESSON_NOTE_STATUSES = ['Draft', 'Unapproved', 'Approved'];
export const SIGNATURE_ROLES = ['Staff', 'Caregiver', 'Approver'];

// A lesson note can change until it is approved. An approved note is a finished record, so
// its content, its signatures and the data recorded into it are locked.
export function isLessonNoteEditable(note) {
  return Boolean(note) && note.status !== 'Approved';
}

export function validateLessonNote(values = {}, { lessons = [] } = {}) {
  const errors = {};
  if (!lessons.some(lesson => lesson.id === values.lessonId)) errors.lessonId = 'Choose a lesson.';
  if (!isValidDate(values.date)) errors.date = 'Choose a valid date.';
  if (!String(values.title || '').trim()) errors.title = 'Give the lesson note a title.';
  return errors;
}

export function validateSignature(values = {}) {
  const errors = {};
  if (!String(values.signedBy || '').trim()) errors.signedBy = 'Enter the name of the person signing.';
  if (!SIGNATURE_ROLES.includes(values.role)) errors.role = 'Choose a role.';
  return errors;
}

// An ABC observation needs at least one of its four parts.
export function validateAbcEntry(values = {}) {
  const has = ['antecedents', 'behaviors', 'consequences'].some(key => (values[key] || []).length) || Boolean(values.location);
  return has ? {} : { entry: 'Choose at least one antecedent, behavior, consequence or location.' };
}

// ---- Search and filter ----------------------------------------------------------------

// The text a program can be found by. A skill program is found by its name, tags, lesson
// and status; a behavior by its name, tags, measurement tool, treatment area and phase.
export function searchFields(program, { lessonName = '' } = {}) {
  const name = program?.name || '';
  const tags = toValueList(program?.tags);
  if (program?.category === PROGRAM_CATEGORIES.BEHAVIOR) {
    const phase = behaviorPhaseOf(program);
    const tool = program.targets?.[0]?.type;
    return [name, ...tags, TARGET_TYPE_LABELS[tool] || '', tool || '', ...toValueList(program.treatmentArea), phase, phase === 'OnHold' ? 'on hold' : ''];
  }
  return [name, ...tags, lessonName, program?.status || '', PROGRAM_STATUS_LABELS[program?.status] || ''];
}

// Every word typed must match somewhere, so "naming fluency" narrows rather than widens.
// Matching is partial and ignores case.
export function matchesQuery(program, query, context) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const fields = searchFields(program, context).map(field => String(field).toLowerCase());
  return words.every(word => fields.some(field => field.includes(word)));
}

// A skill program filters by its status, a behavior by its phase.
export function statusOf(program) {
  return program?.category === PROGRAM_CATEGORIES.BEHAVIOR ? behaviorPhaseOf(program) : program?.status;
}

export function matchesStatus(program, status) {
  if (!status) return true;
  return statusOf(program) === status;
}

// Every lesson a program belongs to. A program can sit in more than one lesson.
export function lessonsByProgram(lessons = []) {
  const map = new Map();
  lessons.forEach(lesson => (lesson.programIds || []).forEach(id => {
    map.set(id, [...(map.get(id) || []), { id: lesson.id, name: lesson.name }]);
  }));
  return map;
}

// The unified filter: a program must satisfy every group that has a choice made, and within
// a group any chosen value is enough. An empty group does not filter.
export function filterPrograms(programs = [], {
  query = '', status = '', statuses = [], tags = [], lessonIds = [], lessonNames = new Map(), memberships = new Map()
} = {}) {
  const wantedStatuses = status ? [...statuses, status] : statuses;
  return programs.filter(program => {
    if (wantedStatuses.length && !wantedStatuses.includes(statusOf(program))) return false;
    if (tags.length && !tags.some(tag => toValueList(program.tags).includes(tag))) return false;
    if (lessonIds.length && !(memberships.get(program.id) || []).some(lesson => lessonIds.includes(lesson.id))) return false;
    const names = (memberships.get(program.id) || []).map(lesson => lesson.name).join(' ') || lessonNames.get(program.id) || '';
    return matchesQuery(program, query, { lessonName: names });
  });
}

// What the filter panel offers, with how many programs each choice would show.
export function filterOptions(programs = [], { statusValues = PROGRAM_STATUSES, memberships = new Map(), lessons = [] } = {}) {
  const tagCounts = new Map();
  programs.forEach(program => toValueList(program.tags).forEach(tag => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));
  return {
    statuses: statusValues.map(value => ({ value, count: programs.filter(program => statusOf(program) === value).length })),
    tags: [...tagCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([value, count]) => ({ value, count })),
    lessons: lessons.map(lesson => ({
      value: lesson.id, label: lesson.name,
      count: programs.filter(program => (memberships.get(program.id) || []).some(entry => entry.id === lesson.id)).length
    }))
  };
}

// ---- Learning materials ---------------------------------------------------------------

// Material is saved in this browser, so the limits are what a browser can honestly hold:
// small text files. Documents and videos are refused with the reason, rather than appearing
// to upload and then not being there.
export const MATERIAL_LIMITS = {
  maxFiles: 5,
  maxFileBytes: 200 * 1024,
  maxTotalBytes: 1024 * 1024,
  extensions: ['.txt', '.md', '.csv']
};

export const MATERIAL_LIMITS_TEXT = 'Up to 5 files per program, text only (.txt, .md or .csv), 200 KB each and 1 MB in total. Files are saved in this browser; nothing is uploaded.';

// A stored file downloads from its own content; a demo file from its path under the site.
export function materialHref(material, base = '') {
  if (typeof material?.content === 'string') return `data:text/plain;charset=utf-8,${encodeURIComponent(material.content)}`;
  return `${base}${material?.path || ''}`;
}

const kilobytes = bytes => `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function materialBytes(material) {
  return Number(material?.size) || 0;
}

export function validateMaterial(file = {}, existing = []) {
  const name = String(file.name || '').trim();
  if (!name) return { ok: false, reason: 'Choose a file.' };
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  if (!MATERIAL_LIMITS.extensions.includes(extension)) {
    return { ok: false, reason: `“${name}” was not added. This demo keeps text files only (.txt, .md or .csv), because it saves material in your browser and cannot hold documents or videos.` };
  }
  if (existing.some(material => material.fileName === name)) {
    return { ok: false, reason: `A file called “${name}” is already attached to this program.` };
  }
  if (existing.length >= MATERIAL_LIMITS.maxFiles) {
    return { ok: false, reason: `A program can hold up to ${MATERIAL_LIMITS.maxFiles} files.` };
  }
  const size = Number(file.size) || 0;
  if (size > MATERIAL_LIMITS.maxFileBytes) {
    return { ok: false, reason: `“${name}” is ${kilobytes(size)}. Each file can be up to ${kilobytes(MATERIAL_LIMITS.maxFileBytes)}.` };
  }
  const total = existing.reduce((sum, material) => sum + materialBytes(material), 0) + size;
  if (total > MATERIAL_LIMITS.maxTotalBytes) {
    return { ok: false, reason: `Adding “${name}” would take this program past ${kilobytes(MATERIAL_LIMITS.maxTotalBytes)} of stored material.` };
  }
  return { ok: true };
}

// ---- Scope: client, organization, public ----------------------------------------------

export const SCOPES = ['client', 'organization', 'public'];
export const SCOPE_LABELS = { client: 'Client', organization: 'Organization', public: 'Public' };

// A program moved from a client into the organization library loses the text that was
// written for that learner, so client-specific detail is never shared by accident.
export const WIPED_FIELD_LABELS = ['Teaching instructions', 'Program objective', 'Baseline', 'Target instructions'];

// A copy is a new program with its own identity. It starts again: no phase history, no
// recorded decision about the learner, Pending status. What defines the work (the targets,
// the measurement and the mastery rule) is kept. `makeId(prefix)` supplies identities.
export function prepareCopy(source, { scope, clientId = null, wipe = false, asOf, makeId, name }) {
  const copy = JSON.parse(JSON.stringify(source));
  const cleared = [];
  const clear = (object, key, label) => {
    if (String(object[key] || '').trim() && !cleared.includes(label)) cleared.push(label);
    if (key in object) object[key] = '';
  };
  copy.id = makeId(scope === 'organization' ? 'org' : 'prog');
  copy.scope = scope;
  copy.clientId = clientId;
  if (name) copy.name = name;
  copy.status = 'Pending';
  copy.statusHistory = [{ status: 'Pending', date: asOf, reason: 'Program copied', staffName: '' }];
  copy.archivedAt = null;
  delete copy.archiveReason;
  delete copy.behaviorPhaseHistory;
  if (copy.category === PROGRAM_CATEGORIES.BEHAVIOR) copy.behaviorPhase = 'Open';
  else delete copy.behaviorPhase;
  const idMap = new Map();
  copy.targets = (copy.targets || []).map(target => {
    const id = makeId('tgt');
    idMap.set(target.id, id);
    const next = {
      ...target, id, programId: copy.id,
      phase: copy.category === PROGRAM_CATEGORIES.BEHAVIOR ? 'Open' : 'Pending',
      phaseEnteredDate: asOf, phaseHistory: []
    };
    delete next.manualMastery;
    if (wipe) clear(next, 'targetInstructions', 'Target instructions');
    return next;
  });
  if (copy.targetOrder) copy.targetOrder = copy.targetOrder.map(id => idMap.get(id)).filter(Boolean);
  if (wipe) {
    clear(copy, 'teachingInstructions', 'Teaching instructions');
    clear(copy, 'programObjective', 'Program objective');
    clear(copy, 'baseline', 'Baseline');
    copy.description = '';
    cleared.sort((a, b) => WIPED_FIELD_LABELS.indexOf(a) - WIPED_FIELD_LABELS.indexOf(b));
  }
  return { copy, cleared };
}

// ---- Target order -----------------------------------------------------------------------

// A clinician can order a program's targets by hand. Until they do, targets follow the
// default: phase by phase, then alphabetical. A hand-set order survives phase changes, and a
// target added later joins the end of it. Removed targets simply drop out.
export function orderedTargets(program) {
  const targets = program?.targets || [];
  const order = program?.targetOrder;
  if (!order?.length) return sortTargets(targets);
  const byId = new Map(targets.map(target => [target.id, target]));
  const placed = order.map(id => byId.get(id)).filter(Boolean);
  const placedIds = new Set(placed.map(target => target.id));
  return [...placed, ...sortTargets(targets.filter(target => !placedIds.has(target.id)))];
}

export function moveInOrder(ids = [], id, delta) {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

// ---- Describing a target ----------------------------------------------------------------

export const MEASURE_UNITS = {
  percentCorrect: 'percent correct', percentIntervals: 'percent of intervals', durationSeconds: 'seconds',
  ratePerHour: 'per hour', correctPerMinute: 'correct per minute', count: 'per session', intervalCount: 'intervals with the behavior'
};
export const COMPARISON_WORDS = { atLeast: 'At least', atMost: 'At most', below: 'Below' };

// The mastery rule in a sentence, so a card says what "mastered" means for this target.
export function describeMastery(target) {
  if (!target) return '';
  if (target.masterySettings === 'Manual') {
    const decision = target.manualMastery?.achieved ? ` Decided on ${target.manualMastery.decidedOn}.` : '';
    return `Manual: a clinician decides.${decision}`;
  }
  const rule = target.masteryRule;
  if (!rule) return target.masteryCriteria || 'Automatic';
  const sessions = Number(rule.consecutiveSessions) || 1;
  return `${COMPARISON_WORDS[rule.comparison] || rule.comparison} ${rule.threshold} ${MEASURE_UNITS[rule.measure] || rule.measure}, ${sessions} ${sessions === 1 ? 'session' : 'sessions in a row'}`;
}

// ---- History export ---------------------------------------------------------------------

const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

export function historyToCsv(entries = []) {
  const rows = [['Date', 'Change', 'Kind'], ...entries.map(entry => [entry.at, entry.summary, entry.kind])];
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

// ---- Labels for target configuration ----------------------------------------------------

export const START_LABELS = {
  Manual: 'Manual', LessonStart: 'Lesson start', LessonStartCountUp: 'Lesson start, count up',
  ManualStartCountUp: 'Manual, count up', ManualStartCountDown: 'Manual, count down'
};
export const CAPTURE_LABELS = { Whole: 'Whole interval', Partial: 'Partial interval', MomentaryTimeSampling: 'Momentary time sampling' };
export const MEASURE_LABELS = {
  percentCorrect: 'Percent correct', percentIntervals: 'Percent of intervals', durationSeconds: 'Duration in seconds',
  ratePerHour: 'Rate per hour', correctPerMinute: 'Correct per minute', count: 'Count', intervalCount: 'Intervals with occurrence'
};
export const COMPARISON_LABELS = { atLeast: 'At least', atMost: 'At most', below: 'Below' };

// How the target is configured to be recorded, in one line for its card.
export function describeConfiguration(target, hierarchies = []) {
  if (!target) return '';
  if (target.type === 'TrialByTrial') {
    const hierarchy = hierarchies.find(item => item.id === target.promptHierarchyId);
    return hierarchy ? `Prompt hierarchy: ${hierarchy.name} (${hierarchy.levels.join(' to ')})` : 'Prompt hierarchy not chosen';
  }
  if (target.type === 'IntervalData' && target.intervalSettings) {
    const { startType, intervalLength, captureType, numberOfIntervals } = target.intervalSettings;
    return `${START_LABELS[startType] || startType} start, ${intervalLength} intervals${numberOfIntervals ? `, ${numberOfIntervals} of them` : ''}, ${(CAPTURE_LABELS[captureType] || captureType || '').toLowerCase()}`;
  }
  if (target.type === 'FluencyRate' && target.fluencySettings) return `Timer: ${START_LABELS[target.fluencySettings.startType] || target.fluencySettings.startType}`;
  return '';
}

// A status or phase as the interface words it.
export function statusLabel(value, isBehavior) {
  return isBehavior ? (value === 'OnHold' ? 'On hold' : value) : PROGRAM_STATUS_LABELS[value] || value;
}
