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
  OnHold: 'Paused', Discontinued: 'Discontinued'
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

export function isMastered(target) {
  if (!target) return false;
  if (target.masterySettings === 'Manual') return Boolean(target.manualMastery?.achieved);
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
export function validateProgram(values = {}, { category = PROGRAM_CATEGORIES.SKILL, existing = [] } = {}) {
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
  } else {
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

export function validateBehavior(values = {}, { existing = [] } = {}) {
  const errors = validateProgram(values, { category: PROGRAM_CATEGORIES.BEHAVIOR, existing });
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
