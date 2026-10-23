// Measurement-domain helpers for the Target analysis selection hierarchy.
//
// Target analysis now starts with the kind of clinical data a clinician wants to read
// (Programs, Behaviors, ABC). Within Programs and Behaviors the next decision is the
// measurement/data type, because only targets measured the same way can share one axis.
// These helpers are pure: they describe a target's measurement family and decide which
// targets may be selected together. Nothing here mutates a program, target or session.
import { MEASUREMENT_LABELS } from './formValidation.js';

// The three first-level choices inside Target analysis.
export const ANALYSIS_CATEGORIES = [
  {
    value: 'Programs',
    label: 'Programs',
    accessibleLabel: 'Programs — skill acquisition targets'
  },
  {
    value: 'Behaviors',
    label: 'Behaviors',
    accessibleLabel: 'Behaviors — behavior reduction targets'
  },
  {
    value: 'Abc',
    label: 'ABC Data',
    accessibleLabel: 'ABC data — antecedent, behavior and consequence'
  }
];

// Skill acquisition offers the full clinical measurement range; behavior reduction
// tracking is recorded with frequency, duration or interval data.
export const SKILL_MEASUREMENT_ORDER = [
  'TrialByTrial', 'Frequency', 'Duration', 'IntervalData', 'FluencyRate', 'Anecdotal'
];
export const BEHAVIOR_MEASUREMENT_ORDER = ['Frequency', 'Duration', 'IntervalData'];
export const INTERVAL_TYPES = ['Momentary', 'Partial', 'Whole'];
export const TRIAL_BY_TRIAL_VARIANTS = ['Binary', 'Customized'];

const INTERVAL_KEY_ORDER = ['Momentary', 'Partial', 'Whole'];

function normaliseIntervalType(value) {
  if (!value) return '';
  const text = String(value);
  const match = INTERVAL_KEY_ORDER.find(type => text.toLowerCase().includes(type.toLowerCase()));
  return match || '';
}

function trialByTrialVariant(target = {}) {
  const declared = target.trialByTrialType || target.trialType || target.dataType || '';
  if (/binary/i.test(declared)) return 'Binary';
  if (/custom|prompt/i.test(declared)) return 'Customized';
  // A target that carries a prompt hierarchy or configured prompt values records
  // prompt-based (customized) trials rather than a simple correct/incorrect binary.
  const promptValues = target.promptValues || target.promptLevels;
  if (target.promptHierarchyId || (Array.isArray(promptValues) && promptValues.length) || target.customPromptValues) {
    return 'Customized';
  }
  return 'Binary';
}

// One measurement family is one axis: same data type, and for interval recording the
// same interval schedule (momentary, partial or whole interval samples are not comparable).
export function measurementFamilyFor(target = {}) {
  const type = target.type || '';
  if (type === 'IntervalData') {
    const subType = normaliseIntervalType(target.intervalType || target.intervalSchedule || target.intervalTypeName);
    const key = subType ? `${type}|${subType}` : type;
    return {
      key,
      type,
      subType,
      variant: '',
      label: subType ? `${MEASUREMENT_LABELS[type] || type} · ${subType}` : (MEASUREMENT_LABELS[type] || type),
      shortLabel: subType || 'Interval',
      unitHint: 'percent of intervals'
    };
  }
  if (type === 'TrialByTrial') {
    const variant = trialByTrialVariant(target);
    return {
      key: type,
      type,
      subType: '',
      variant,
      label: MEASUREMENT_LABELS[type] || type,
      shortLabel: 'Trial',
      unitHint: variant === 'Customized' ? 'prompt-based trials' : 'binary trials'
    };
  }
  return {
    key: type,
    type,
    subType: '',
    variant: '',
    label: MEASUREMENT_LABELS[type] || type,
    shortLabel: (MEASUREMENT_LABELS[type] || type).split(' ')[0],
    unitHint: UNIT_HINTS[type] || ''
  };
}

const UNIT_HINTS = {
  Frequency: 'count of responses',
  Duration: 'time per episode',
  FluencyRate: 'frequency and duration',
  Anecdotal: 'narrative answers'
};

// Accepts a target, a catalog entry or a bare family key and returns the family key.
export function familyKeyOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value.familyKey) return value.familyKey;
  if (value.measurementType) return measurementFamilyFor({ ...value, type: value.measurementType }).key;
  if (value.type) return measurementFamilyFor(value).key;
  if (value.measurementFamilyKey) return value.measurementFamilyKey;
  return '';
}

export function familyTypeOf(value) {
  const key = familyKeyOf(value);
  return key.split('|')[0];
}

// Options for the measurement-type chooser. `typesWithData` annotates families with
// existing observations; families without records remain selectable so clinicians can
// deliberately inspect an empty state or begin recording the chosen measurement.
export function measurementFamilyOptions(targets = [], {
  typesWithData = null, order = SKILL_MEASUREMENT_ORDER
} = {}) {
  const hasData = value => !typesWithData || typesWithData.has(value);
  const byKey = new Map();
  for (const target of targets) {
    const family = measurementFamilyFor(target);
    // `order` doubles as the allow-list: behavior reduction offers frequency, duration and
    // interval recording, so any other data type is not a choice in that category.
    if (!family.key || !order.includes(family.type)) continue;
    if (!byKey.has(family.key)) {
      byKey.set(family.key, {
        ...family,
        count: 0,
        targetIds: [],
        variants: new Set(),
        hasData: hasData(family.type)
      });
    }
    const option = byKey.get(family.key);
    option.count += 1;
    option.targetIds.push(target.id);
    if (family.variant) option.variants.add(family.variant);
  }
  const rankType = type => {
    const index = order.indexOf(type);
    return index === -1 ? order.length : index;
  };
  return [...byKey.values()]
    .map(option => ({
      ...option,
      variants: [...option.variants].sort(
        (a, b) => TRIAL_BY_TRIAL_VARIANTS.indexOf(a) - TRIAL_BY_TRIAL_VARIANTS.indexOf(b)
      ),
      subTypeRank: option.subType ? INTERVAL_KEY_ORDER.indexOf(option.subType) : -1
    }))
    .sort((a, b) => rankType(a.type) - rankType(b.type)
      || (a.type === b.type ? a.subTypeRank - b.subTypeRank : 0)
      || a.label.localeCompare(b.label));
}

export function defaultFamilyKey(options = []) {
  return (options.find(option => option.hasData) || options[0])?.key || '';
}

export function isCompatibleWithFamily(value, familyKey) {
  if (!familyKey) return true;
  return familyKeyOf(value) === familyKey;
}

// Why a target cannot join the current selection, in the words a clinician needs.
export function incompatibilityReason(entry, familyKey, options = []) {
  const active = options.find(option => option.key === familyKey);
  if (!active) return '';
  const entryFamily = measurementFamilyFor({ type: entry.measurementType || entry.type, ...entry });
  if (entryFamily.key === familyKey) return '';
  const sameTypeDifferentInterval = entryFamily.type === active.type && entryFamily.type === 'IntervalData';
  const reason = sameTypeDifferentInterval
    ? `${entryFamily.label} intervals can’t be combined with ${active.label.toLowerCase()} intervals`
    : `${entryFamily.label} can’t be plotted with ${active.label.toLowerCase()}`;
  return `${reason}. Change the measurement type to include it.`;
}

// Selection pruning when the measurement type changes: keep only compatible targets,
// return what was dropped so the UI can explain the change.
export function pruneSelectionToFamily(selectedIds = [], targets = [], familyKey = '') {
  const byId = new Map(targets.map(target => [target.id, target]));
  const kept = [];
  const removed = [];
  for (const id of selectedIds) {
    const target = byId.get(id);
    if (!target) {
      removed.push(id);
      continue;
    }
    if (isCompatibleWithFamily(target, familyKey)) kept.push(id);
    else removed.push(id);
  }
  return {
    kept,
    removed,
    removedLabels: removed.map(id => byId.get(id)?.name).filter(Boolean)
  };
}

export function targetsInFamily(targets = [], familyKey = '') {
  if (!familyKey) return [...targets];
  return targets.filter(target => isCompatibleWithFamily(target, familyKey));
}

// Compact scope sentence for the selection pane: category → program → measure → count.
export function selectionScopeCaption({
  category = 'Programs', programName = '', familyLabel = '', selectedCount = 0, totalCount = 0
} = {}) {
  const parts = [];
  if (category === 'Behaviors') parts.push('Behavior reduction');
  else if (programName) parts.push(programName);
  else parts.push('No program selected');
  if (familyLabel) parts.push(familyLabel);
  const targetWord = totalCount === 1 ? 'target' : 'targets';
  parts.push(`${selectedCount} of ${totalCount} ${targetWord} plotted`);
  return parts.join(' · ');
}

// Explains a measurement-type change that cleared selections.
export function familyChangeNotice({
  familyLabel = '', removedLabels = [], autoSelected = 0
} = {}) {
  if (!removedLabels.length) {
    return autoSelected > 0
      ? `Measurement type set to ${familyLabel}. ${autoSelected} compatible ${autoSelected === 1 ? 'target' : 'targets'} selected.`
      : `Measurement type set to ${familyLabel}.`;
  }
  const names = removedLabels.slice(0, 2).join(', ');
  const more = removedLabels.length > 2 ? ` and ${removedLabels.length - 2} more` : '';
  return `Measurement type set to ${familyLabel}. ${removedLabels.length} incompatible ${removedLabels.length === 1 ? 'target was' : 'targets were'} cleared (${names}${more}) — different data types can’t share one analysis.`;
}
