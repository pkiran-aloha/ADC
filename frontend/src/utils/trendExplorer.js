// Pure state and catalog helpers for the Phase 3 Trend explorer inside Target analysis.
// Reuses the Phase 1 portfolio-health engine (`targetHealth.js`) so trend deltas, phase
// labels and direction-aware tones match the Progress overview word for word, while also
// surfacing anecdotal (narrative) targets so every target in every program is reachable.
// No client, program, target or observation schema is changed or mutated.
import buildTargetHealth, {
  PHASE_LABELS, deltaText, trendLabel, trendTone, targetLifecycle, HEALTH_WINDOW_DAYS
} from './targetHealth.js';
import { programProgress, programProgressLabel } from './targetAnalytics.js';
import { MEASUREMENT_LABELS } from './formValidation.js';
import { measurementFamilyFor } from './measurementFamilies.js';

export const EXPLORER_CATEGORIES = [
  { value: 'All', label: 'All', accessibleLabel: 'All categories' },
  { value: 'SkillAcquisition', label: 'Skills', accessibleLabel: 'Skill acquisition' },
  { value: 'Behavior', label: 'Behaviors', accessibleLabel: 'Behavior reduction' }
];

function withMeasurementFamily(entry, target) {
  const family = measurementFamilyFor(target);
  return {
    ...entry,
    familyKey: family.key,
    familyLabel: family.label,
    familyShortLabel: family.shortLabel,
    familyVariant: family.variant
  };
}

function buildNarrativeEntry(program, target) {
  const lifecycle = targetLifecycle(target);
  const phaseLabel = PHASE_LABELS[target.phase] || target.phase;
  return withMeasurementFamily({
    targetId: target.id,
    targetName: target.name,
    programId: program.id,
    programName: program.name,
    category: program.category,
    measurementType: target.type,
    measurementLabel: MEASUREMENT_LABELS[target.type] || target.type,
    phase: target.phase,
    phaseLabel,
    lifecycle,
    direction: 'increase',
    trend: 'narrative',
    insufficient: false,
    deltaPct: null,
    deltaLabel: 'Notes',
    tone: 'neutral',
    statusText: 'Narrative notes',
    variable: false,
    nearMastery: false,
    forecastDays: null,
    flags: [],
    needsReview: false,
    hasRows: true,
    lastDate: null,
    points: []
  }, target);
}

function enrichHealthEntry(item, target) {
  return withMeasurementFamily({
    ...item,
    measurementLabel: MEASUREMENT_LABELS[item.measurementType] || item.measurementType,
    phaseLabel: PHASE_LABELS[item.phase] || item.phase,
    deltaLabel: deltaText(item),
    tone: trendTone(item),
    statusText: trendLabel(item)
  }, target);
}

// Groups all targets for a client under their programs, pairing each target with its
// 90-day health summary without mutating any program, target or session object.
export function buildExplorerCatalog({
  programs = [], sessions = [], asOfDate, windowDays = HEALTH_WINDOW_DAYS
}) {
  const health = buildTargetHealth({ programs, sessions, asOfDate, windowDays });
  const healthById = new Map(health.items.map(item => [item.targetId, item]));
  const groups = [];
  const items = [];
  let skillTargets = 0;
  let behaviorTargets = 0;

  for (const program of programs) {
    const progress = programProgress(program, sessions);
    const groupTargets = program.targets.map(target => {
      const base = healthById.get(target.id);
      const entry = base ? enrichHealthEntry(base, target) : buildNarrativeEntry(program, target);
      items.push(entry);
      if (program.category === 'BehaviorReduction') behaviorTargets += 1;
      else skillTargets += 1;
      return entry;
    });
    groups.push({
      id: program.id,
      name: program.name,
      category: program.category,
      status: program.status,
      domain: program.treatmentArea || program.domain || '',
      progress,
      progressLabel: programProgressLabel(progress),
      targets: groupTargets
    });
  }

  return {
    groups,
    items,
    health,
    counts: {
      programs: groups.length,
      targets: items.length,
      skillTargets,
      behaviorTargets
    }
  };
}

function matchesCategory(groupCategory, category) {
  if (!category || category === 'All') return true;
  if (category === 'Behavior' || category === 'BehaviorReduction') return groupCategory === 'BehaviorReduction';
  return groupCategory === 'SkillAcquisition';
}

function entryMatchesQuery(entry, group, needle) {
  const fields = [
    entry.targetName,
    group.name,
    group.domain,
    entry.measurementLabel,
    entry.phaseLabel,
    entry.statusText,
    entry.deltaLabel,
    ...entry.flags.map(flag => flag.label)
  ];
  return fields.some(value => value && String(value).toLowerCase().includes(needle));
}

// Filters program groups by category and search text without mutating the source array.
export function filterExplorerGroups(groups = [], { query = '', category = 'All' } = {}) {
  const trimmed = String(query || '').trim().toLowerCase();
  const result = [];
  for (const group of groups) {
    if (!matchesCategory(group.category, category)) continue;
    if (!trimmed) {
      result.push(group);
      continue;
    }
    const matchingTargets = group.targets.filter(entry => entryMatchesQuery(entry, group, trimmed));
    if (matchingTargets.length > 0) {
      result.push({ ...group, targets: matchingTargets });
    }
  }
  return result;
}

export function isExplorerProgramSelected(group, {
  activeCategoryTab, selectedProgramId, selectedBehaviorIds = []
} = {}) {
  if (!group) return false;
  if (group.category === 'BehaviorReduction') {
    return activeCategoryTab === 'Behavior'
      && group.targets.some(target => selectedBehaviorIds.includes(target.targetId));
  }
  return activeCategoryTab === 'SkillAcquisition' && selectedProgramId === group.id;
}

export function isExplorerTargetSelected(entry, {
  activeCategoryTab, selectedProgramId, selectedBehaviorIds = [],
  activeTargetType = '', visibleTargetIds = new Set(), analysisTargetId = ''
} = {}) {
  if (!entry) return { plotted: false, focused: false };
  if (entry.category === 'BehaviorReduction') {
    const plotted = activeCategoryTab === 'Behavior' && selectedBehaviorIds.includes(entry.targetId);
    const focused = plotted && (analysisTargetId === entry.targetId || selectedBehaviorIds.length === 1);
    return { plotted, focused };
  }
  const inProgram = activeCategoryTab === 'SkillAcquisition' && selectedProgramId === entry.programId;
  const plotted = inProgram && entry.measurementType === activeTargetType && visibleTargetIds.has(entry.targetId);
  const focused = plotted && (analysisTargetId === entry.targetId || visibleTargetIds.size === 1);
  return { plotted, focused };
}

// Selecting one target row narrows the analysis to that target's measurement family.
// Further compatible targets are added with their own checkbox rows (or a group action).
export function selectExplorerTarget(entry) {
  const familyKey = measurementFamilyFor({ type: entry.measurementType, ...entry }).key;
  if (entry.category === 'BehaviorReduction') {
    return {
      category: 'Behavior',
      selectedBehaviorIds: [entry.targetId],
      requestedTargetType: familyKey,
      selectedTargetIds: null,
      analysisTargetId: entry.targetId,
      annotationTargetId: entry.targetId
    };
  }
  return {
    category: 'SkillAcquisition',
    selectedProgramId: entry.programId,
    requestedTargetType: familyKey,
    // An explicit selection keeps only the chosen target; null means "auto-select the
    // compatible family", which is what a program change resets to.
    selectedTargetIds: [entry.targetId],
    analysisTargetId: entry.targetId,
    annotationTargetId: entry.targetId
  };
}

// Choosing a program is the first step of the Programs flow: the target list, measurement
// chooser and comparison scope all restart for the new program.
export function selectExplorerProgram(group) {
  if (group.category === 'BehaviorReduction') {
    return {
      category: 'Behavior',
      selectedBehaviorIds: group.targets.map(target => target.targetId),
      requestedTargetType: '',
      selectedTargetIds: null,
      analysisTargetId: group.targets[0]?.targetId || '',
      annotationTargetId: group.targets[0]?.targetId || ''
    };
  }
  return {
    category: 'SkillAcquisition',
    selectedProgramId: group.id,
    requestedTargetType: '',
    selectedTargetIds: null,
    analysisTargetId: '',
    annotationTargetId: ''
  };
}

// Toggling one target inside a family group. Incompatible targets are never added: the
// caller disables them, and this guard keeps the state honest if a stale row is clicked.
export function toggleExplorerSelection(selectedIds, entry, familyKey) {
  const next = new Set(selectedIds);
  const id = entry.targetId || entry.id;
  if (!id) return next;
  if (next.has(id)) {
    next.delete(id);
    return next;
  }
  if (familyKey && measurementFamilyFor({ type: entry.measurementType || entry.type }).key !== familyKey) return next;
  next.add(id);
  return next;
}

export function nextExplorerFocusIndex(currentIndex, key, total) {
  if (total <= 0) return -1;
  if (key === 'ArrowDown') return (currentIndex + 1) % total;
  if (key === 'ArrowUp') return (currentIndex - 1 + total) % total;
  if (key === 'Home') return 0;
  if (key === 'End') return total - 1;
  return null;
}

export function explorerSummaryCaption({
  filteredGroups = [], query = '', category = 'All'
} = {}) {
  const targetCount = filteredGroups.reduce((sum, group) => sum + group.targets.length, 0);
  const programCount = filteredGroups.length;
  const targetWord = targetCount === 1 ? 'target' : 'targets';
  const programWord = programCount === 1 ? 'program' : 'programs';
  const scopeNote = category === 'SkillAcquisition'
    ? ' · skills'
    : category === 'Behavior' ? ' · behaviors' : '';
  const queryNote = String(query || '').trim() ? ` matching “${String(query).trim()}”` : '';
  return `${targetCount} ${targetWord} across ${programCount} ${programWord}${scopeNote}${queryNote}`;
}
