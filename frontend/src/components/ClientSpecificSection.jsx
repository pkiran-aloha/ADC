import { createElement, useDeferredValue, useMemo, useRef, useState } from 'react';
import { RotateCw, TrendingUp, Edit3, CheckSquare, Square, UserCheck, ChevronLeft, ChevronRight, Settings2 } from './ui/Icons';
import { exportSvgElement, exportPngFromSvg, exportRawTrialDataCsv, exportStructuredZip } from '../utils/exportUtils';
import TrendExplorer from './overview/TrendExplorer';
import SectionHeader from './ui/SectionHeader';
import ExportMenu from './ui/ExportMenu';
import Popover from './ui/Popover';
import SegmentedControl from './ui/SegmentedControl';
import EmptyState from './ui/EmptyState';
import TargetChart from './analysis/TargetChart';
import ObservationInspector from './analysis/ObservationInspector';
import AnalysisPanel from './analysis/AnalysisPanel';
import { PromptLevelChart, CelerationChart, TimelineBrush, TrialStripChart, EpisodeStripChart } from './analysis/SpecialCharts';
import { MEASUREMENT_LABELS } from '../utils/formValidation';
import { SEED_AS_OF_DATE } from '../data/mockData';
import { seriesColor, formatChartDate } from '../utils/chartTheme';
import { getMinDate, processAggregation, getObservationKey, sortObservationKeys, chartStatistics } from '../utils/analyticsMetrics';
import { median, mean } from '../utils/stats';
import {
  splitMiddle, stabilityEnvelope, movingAverage, compareConditions, segmentByBoundaries, celeration,
  forecastLinear, projectThresholdDate, evaluateMastery, ioaSummary, evaluateReductionMastery, reductionRuleFor
} from '../utils/visualAnalysis';
import { weekdayOf } from '../utils/abcAnalytics';
import {
  conditionBoundaries, firstConditionLabel, therapeuticDirection, goalInView, serviceIndex, rowValue,
  projectedKeys, unitLabel, conditionSpans as buildConditionSpans, targetMilestones, programProgress
} from '../utils/targetAnalytics';
import { validateAxisBounds, describeAxisBounds, CHART_TYPES } from '../utils/chartScale';
import TransposedChart from './analysis/TransposedChart';
import { MARKER_LIBRARY, markerElement, resolveMarkerShape } from '../utils/markerShapes';
import {
  readGraphPreferences, writeGraphPreferences, resetGraphPreferences, normalizeGraphPreferences,
  minimumTrialsFor, graphStandards, preferenceSummary, eligibleChartRows
} from '../utils/graphPreferences';
import { observationType } from '../utils/observations';
import { availableSummaryModes, resolveSummaryMode, summaryLabel, withSummarySeries, behaviorPresets, groupTargetsByStage } from '../utils/groupSeries';
import { buildInsights } from '../utils/insights';
import { buildExplorerCatalog, selectExplorerProgram, selectExplorerTarget } from '../utils/trendExplorer';

const FUNCTION_OPTIONS = [
  { key: 'median', label: 'Median line', hint: 'Central tendency that resists outliers' },
  { key: 'movingAverage', label: 'Moving average (3 points)', hint: 'Smooths session-to-session variability' },
  { key: 'envelope', label: 'Stability envelope', hint: '±25% of the current condition’s median (Lane & Gast, 2014)' },
  { key: 'phaseMeans', label: 'Condition means', hint: 'Mean level for each phase or procedure change' },
  { key: 'goal', label: 'Mastery criterion line', hint: 'Shown when the rule matches the chart’s unit' },
  { key: 'forecast', label: 'Projection (80% band)', hint: 'Linear projection of the current condition' },
  { key: 'ioa', label: 'IOA markers', hint: 'Rings mark sessions with a second observer; dashed when below 80%' },
  { key: 'log', label: 'Ratio (log) scale', hint: 'Equal ratios look equal, as on a celeration chart' }
];

export default function ClientSpecificSection({
  client,
  programs = [],
  sessions = [],
  serviceSessions = [],
  abcEntries = [],
  templates = [],
  standards = null,
  asOfDate = SEED_AS_OF_DATE,
  annotations = { phaseLines: [], phaseRanges: [], graphNotes: [] },
  initialFocus = null,
  onAddPhaseLineClick,
  onAddPhaseRangeClick,
  onAddGraphNoteClick,
  onDeletePhaseLine,
  onDeletePhaseRange,
  onDeleteGraphNote,
  onRefresh,
  onEditAnnotation,
  onRecordClick,
  onManualEntryClick,
  onCorrectObservation,
  onDeleteObservation,
  onProgramStatusChange,
  canEdit = true,
  viewOnlyReason = '',
  supervisionRecords = []
}) {
  const [activeCategoryTab, setActiveCategoryTab] = useState(initialFocus?.category || 'SkillAcquisition');
  const [selectedProgramId, setSelectedProgramId] = useState(() => initialFocus?.programId || programs.find(program => program.category === 'SkillAcquisition')?.id || '');
  const [selectedBehaviorIds, setSelectedBehaviorIds] = useState(() => {
    if (initialFocus?.behaviorIds) return initialFocus.behaviorIds;
    const first = programs.find(program => program.category === 'BehaviorReduction')?.targets[0]?.id;
    return first ? [first] : [];
  });
  const [requestedTargetType, setActiveTargetType] = useState(initialFocus?.targetType || '');
  const [hiddenTargetIds, setHiddenTargetIds] = useState(() => new Set(initialFocus?.hiddenTargetIds || []));
  const [durationFilter, setDurationFilter] = useState(initialFocus?.durationFilter || '1 month');
  const [aggregation, setAggregation] = useState(initialFocus?.aggregation || 'Per Day');
  const [sessionPage, setSessionPage] = useState(1);
  const [durationView, setDurationView] = useState('Total Duration');
  const [rateView, setRateView] = useState('Rate per Day');
  const [frequencyView, setFrequencyView] = useState('Raw Frequency');
  const [splitByTherapist, setSplitByTherapist] = useState(false);
  const [hiddenTherapists, setHiddenTherapists] = useState(new Set());
  const [showAverageLine, setShowAverageLine] = useState(false);
  const [showTrendLine, setShowTrendLine] = useState(false);
  const [trendMethod, setTrendMethod] = useState('regression');
  const [customTitles, setCustomTitles] = useState({});
  const [draftTitle, setDraftTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const titleButtonRef = useRef(null);
  const [annotationTargetId, setAnnotationTargetId] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [colorMode, setColorMode] = useState('System');
  const [behaviorZeroOut, setBehaviorZeroOut] = useState(true);
  // Graph-view preferences (dates with no measurement, the organisation's minimum trial
  // count, marker shape, axis orientation and the combined/average summary line) are
  // remembered per client in this browser.
  const [prefsClientId, setPrefsClientId] = useState(client?.id);
  const [preferences, setPreferences] = useState(() => readGraphPreferences(client?.id));
  if (prefsClientId !== client?.id) {
    setPrefsClientId(client?.id);
    setPreferences(readGraphPreferences(client?.id));
  }
  const showGridlines = preferences.showGridlines;
  const showValues = preferences.showValues;
  const showPhaseLabels = preferences.showPhaseLabels;
  const showEmptyDates = preferences.showNoDataDates;
  function updatePreferences(patch) {
    setPreferences(previous => {
      const next = normalizeGraphPreferences({ ...previous, ...patch });
      writeGraphPreferences(client?.id, next);
      return next;
    });
  }
  // Analytical functions and drill-down state.
  const [functions, setFunctions] = useState(() => new Set());
  const [chartView, setChartView] = useState('standard');
  const [selectedKey, setSelectedKey] = useState(initialFocus?.selectedKey || null);
  const [analysisTargetId, setAnalysisTargetId] = useState(initialFocus?.analysisTargetId || '');
  const [analysisTab, setAnalysisTab] = useState('comparison');
  const [comparisonIndex, setComparisonIndex] = useState(null);
  const [cdcOnChart, setCdcOnChart] = useState(false);
  const [contextDimension, setContextDimension] = useState('clinician');
  const [highlightGroup, setHighlightGroup] = useState(null);
  const [zoom, setZoom] = useState(null);
  // Chart presentation: plot type, the clinician's own axis range, and labels.
  const [chartType, setChartType] = useState('line');
  const [axisBounds, setAxisBounds] = useState({ min: null, max: null });
  const [axisDraft, setAxisDraft] = useState({ min: '', max: '' });
  const [axisError, setAxisError] = useState('');

  const svgRef = useRef(null);
  // Performance: the heavy per-target aggregation runs against the deferred session list,
  // so changing a filter cannot block typing or navigation (feedback: keep the pages
  // responsive while graphs load).
  const deferredSessions = useDeferredValue(sessions);
  const chartPending = deferredSessions !== sessions;
  const clientSessions = useMemo(
    () => (client ? deferredSessions.filter(row => row.clientId === client.id) : []),
    [deferredSessions, client]
  );
  const explorerCatalog = useMemo(
    () => buildExplorerCatalog({ programs, sessions: clientSessions, asOfDate }),
    [programs, clientSessions, asOfDate]
  );
  const services = useMemo(() => serviceIndex(serviceSessions), [serviceSessions]);
  const skillPrograms = useMemo(() => programs.filter(p => p.category === 'SkillAcquisition'), [programs]);
  const behaviorPrograms = useMemo(() => programs.filter(p => p.category === 'BehaviorReduction'), [programs]);
  const allBehaviors = useMemo(() => behaviorPrograms.flatMap(p => p.targets.map(t => ({ ...t, programName: p.name }))), [behaviorPrograms]);
  const currentSelectedProgram = useMemo(() => activeCategoryTab === 'SkillAcquisition' ? skillPrograms.find(p => p.id === selectedProgramId) || null : null,
    [activeCategoryTab, selectedProgramId, skillPrograms]);
  const activeTargets = useMemo(() => activeCategoryTab === 'SkillAcquisition'
    ? (currentSelectedProgram ? currentSelectedProgram.targets : [])
    : allBehaviors.filter(b => selectedBehaviorIds.includes(b.id)), [activeCategoryTab, currentSelectedProgram, allBehaviors, selectedBehaviorIds]);
  const detailPrograms = useMemo(() => activeCategoryTab === 'SkillAcquisition'
    ? (currentSelectedProgram ? [currentSelectedProgram] : [])
    : behaviorPrograms.filter(p => p.targets.some(t => selectedBehaviorIds.includes(t.id))), [activeCategoryTab, currentSelectedProgram, behaviorPrograms, selectedBehaviorIds]);
  const visibleTargetIds = useMemo(() => new Set(activeTargets.filter(target => !hiddenTargetIds.has(target.id)).map(target => target.id)), [activeTargets, hiddenTargetIds]);

  const availableTargetTypes = useMemo(() => {
    if (!activeTargets.length) return [];
    const typesWithData = new Set();
    activeTargets.forEach(tgt => {
      if (sessions.some(s => s.clientId === client?.id && s.targetId === tgt.id && s.missingDataMode !== 'DataNotTracked')) typesWithData.add(tgt.type);
    });
    return ['TrialByTrial', 'Duration', 'Frequency', 'IntervalData', 'Anecdotal', 'FluencyRate'].filter(type => typesWithData.has(type));
  }, [activeTargets, sessions, client]);
  const activeTargetType = availableTargetTypes.includes(requestedTargetType) ? requestedTargetType : availableTargetTypes[0] || '';

  // Guide the selector with program-level progress so a clinician does not have to open
  // every program to see how it is going (feedback: progress in the Skill Acquisition selector).
  const programProgressMap = useMemo(() => new Map(skillPrograms.map(program => [program.id, programProgress(program, clientSessions)])), [skillPrograms, clientSessions]);
  const targetStages = useMemo(() => groupTargetsByStage(activeTargets.filter(target => target.type === activeTargetType)), [activeTargets, activeTargetType]);
  const behaviorQuickPicks = useMemo(() => behaviorPresets(allBehaviors), [allBehaviors]);
  const graphPolicyMinimum = minimumTrialsFor(preferences, standards);
  const titleContext = `${client?.id}-${activeCategoryTab}-${selectedProgramId}-${selectedBehaviorIds.join(',')}`;
  const defaultTitle = activeCategoryTab === 'SkillAcquisition' ? (currentSelectedProgram?.name || 'Program observations')
    : selectedBehaviorIds.length > 1 ? 'Behavior comparison' : allBehaviors.find(behavior => behavior.id === selectedBehaviorIds[0])?.name || 'Behavior observations';
  const chartTitle = customTitles[titleContext] || defaultTitle;

  function resetView(resetTargets = true) {
    setShowAverageLine(false);
    setShowTrendLine(false);
    setSplitByTherapist(false);
    setSessionPage(1);
    setIsEditingTitle(false);
    setTitleError('');
    setHiddenTherapists(new Set());
    setSelectedKey(null);
    setComparisonIndex(null);
    setCdcOnChart(false);
    setHighlightGroup(null);
    setZoom(null);
    setChartView('standard');
    setChartType('line');
    setAxisBounds({ min: null, max: null });
    setAxisDraft({ min: '', max: '' });
    setAxisError('');
    if (resetTargets) {
      setHiddenTargetIds(new Set());
      setActiveTargetType('');
      setAnnotationTargetId('');
      setAnalysisTargetId('');
    }
  }

  function applyExplorerTarget(entry) {
    resetView(false);
    const next = selectExplorerTarget(entry, programs);
    setActiveCategoryTab(next.category);
    if (next.selectedProgramId !== undefined) setSelectedProgramId(next.selectedProgramId);
    if (next.selectedBehaviorIds) setSelectedBehaviorIds(next.selectedBehaviorIds);
    setActiveTargetType(next.requestedTargetType);
    setHiddenTargetIds(next.hiddenTargetIds);
    setAnalysisTargetId(next.analysisTargetId);
    setAnnotationTargetId(next.annotationTargetId);
  }

  function applyExplorerProgram(group) {
    resetView(false);
    const next = selectExplorerProgram(group);
    setActiveCategoryTab(next.category);
    if (next.selectedProgramId !== undefined) setSelectedProgramId(next.selectedProgramId);
    if (next.selectedBehaviorIds) setSelectedBehaviorIds(next.selectedBehaviorIds);
    setActiveTargetType(next.requestedTargetType);
    setHiddenTargetIds(next.hiddenTargetIds);
    setAnalysisTargetId(next.analysisTargetId);
    setAnnotationTargetId(next.annotationTargetId);
  }

  const tabTargets = useMemo(() => activeTargets.filter(t => t.type === activeTargetType && visibleTargetIds.has(t.id)), [activeTargets, activeTargetType, visibleTargetIds]);

  const filteredSessions = useMemo(() => {
    if (!client || !activeTargets.length) return [];
    const ids = new Set(activeTargets.map(t => t.id));
    const minDate = getMinDate(durationFilter);
    let list = deferredSessions.filter(s => s.clientId === client.id && ids.has(s.targetId) && s.missingDataMode !== 'DataNotTracked' && new Date(s.timestamp) >= minDate);
    list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (activeCategoryTab === 'Behavior' && !behaviorZeroOut) list = list.filter(s => s.missingDataMode !== 'ZeroOut');
    return list;
  }, [client, activeTargets, deferredSessions, durationFilter, activeCategoryTab, behaviorZeroOut]);

  const allTherapistsForTarget = useMemo(() => [...new Set(filteredSessions.filter(session => tabTargets.some(target => target.id === session.targetId)).map(s => s.therapistName).filter(Boolean))], [filteredSessions, tabTargets]);
  const visibleTherapists = useMemo(() => new Set(allTherapistsForTarget.filter(name => !hiddenTherapists.has(name))), [allTherapistsForTarget, hiddenTherapists]);
  const view = useMemo(() => ({ targetType: activeTargetType, durationView, rateView, frequencyView }), [activeTargetType, durationView, rateView, frequencyView]);

  const percentType = activeTargetType === 'TrialByTrial' || activeTargetType === 'IntervalData';
  // Only primary observations reach the graph. Second-observer and supervision records
  // live with the session (see the observation inspector) and never move these totals.
  const primarySessions = useMemo(() => filteredSessions.filter(row => observationType(row) === 'Primary'), [filteredSessions]);
  // Sessions that fall below the organisation's minimum trial count can be suppressed so a
  // two-trial probe cannot suggest variability the sample does not support.
  const graphSessions = useMemo(() => preferences.suppressLowTrialSessions
    ? primarySessions.filter(row => {
      const target = activeTargets.find(item => item.id === row.targetId);
      const { rows } = eligibleChartRows([row], target, preferences, standards);
      return rows.length > 0;
    })
    : primarySessions, [primarySessions, preferences, activeTargets, standards]);
  const suppressedCounts = useMemo(() => {
    if (!preferences.suppressLowTrialSessions) return { trials: 0, shortObservations: 0 };
    const totals = { trials: 0, shortObservations: 0 };
    for (const row of primarySessions) {
      const target = activeTargets.find(item => item.id === row.targetId);
      const { suppressed } = eligibleChartRows([row], target, preferences, standards);
      totals.trials += suppressed.trials;
      totals.shortObservations += suppressed.shortObservations;
    }
    return totals;
  }, [preferences, primarySessions, activeTargets, standards]);

  const chartSeriesData = useMemo(() => {
    if (!tabTargets.length || !graphSessions.length) return [];
    if (splitByTherapist && tabTargets.length === 1) {
      const tgt = tabTargets[0];
      return allTherapistsForTarget.filter(th => visibleTherapists.has(th)).map(therapist => ({
        id: `th-${therapist}`, name: therapist, color: seriesColor(allTherapistsForTarget.indexOf(therapist), colorMode === 'BlackAndWhite'),
        points: processAggregation(graphSessions.filter(s => s.targetId === tgt.id && s.therapistName === therapist), aggregation, activeTargetType, durationView, rateView, frequencyView)
      }));
    }
    return tabTargets.map(tgt => ({
      id: tgt.id, name: tgt.name, color: seriesColor(activeTargets.findIndex(target => target.id === tgt.id), colorMode === 'BlackAndWhite'),
      points: processAggregation(graphSessions.filter(s => s.targetId === tgt.id), aggregation, activeTargetType, durationView, rateView, frequencyView)
    }));
  }, [tabTargets, graphSessions, splitByTherapist, allTherapistsForTarget, visibleTherapists, aggregation, activeTargetType, durationView, rateView, frequencyView, colorMode, activeTargets]);

  // A clinician can evaluate overall program performance with one combined or averaged
  // series across the visible targets instead of reading every target separately.
  const summaryMode = resolveSummaryMode(preferences.summaryMode, activeTargetType, tabTargets.length);

  // "Show missing dates" adds every date an appointment took place, so gaps in the data are
  // visible; the default shows only the dates on which something was measured.
  const contextualXKeys = useMemo(() => showEmptyDates && activeCategoryTab === 'Behavior'
    ? deferredSessions.filter(session => session.clientId === client?.id && tabTargets.some(target => target.id === session.targetId) &&
      new Date(session.timestamp) >= getMinDate(durationFilter)).map(session => getObservationKey(session, aggregation))
    : [], [showEmptyDates, activeCategoryTab, deferredSessions, client, tabTargets, durationFilter, aggregation]);
  const allChartKeys = useMemo(() => sortObservationKeys(new Set([...contextualXKeys, ...chartSeriesData.flatMap(series => series.points.map(point => point.xKey))]), aggregation),
    [contextualXKeys, chartSeriesData, aggregation]);
  const totalPages = Math.max(1, Math.ceil(allChartKeys.length / 12));
  const currentPage = Math.min(sessionPage, totalPages);
  const zoomSignature = `${aggregation}|${durationFilter}|${activeTargetType}|${allChartKeys.length}|${allChartKeys[0]}`;
  const zoomRange = aggregation !== 'Per Session' && zoom?.signature === zoomSignature ? zoom : { start: 0, end: Math.max(0, allChartKeys.length - 1) };
  const pageKeys = useMemo(() => aggregation === 'Per Session'
    ? allChartKeys.slice((currentPage - 1) * 12, currentPage * 12)
    : allChartKeys.slice(zoomRange.start, zoomRange.end + 1), [aggregation, allChartKeys, currentPage, zoomRange.start, zoomRange.end]);
  const pageKeySet = new Set(pageKeys);
  const pagedSeries = chartSeriesData.map(series => ({ ...series, points: series.points.filter(point => pageKeySet.has(point.xKey)) }));
  const displaySeriesData = withSummarySeries(pagedSeries, {
    mode: summaryMode, targetType: activeTargetType, color: '#4b5a73',
    precision: percentType ? 0 : 2
  });
  const { averageValue, trendlinePoints, regressionPoints, regressionParams } = chartStatistics(displaySeriesData, aggregation, pageKeys);
  const annotationTarget = tabTargets.find(target => target.id === annotationTargetId) || tabTargets[0];

  const activeAnnotations = useMemo(() => {
    if (activeCategoryTab === 'Behavior' && selectedBehaviorIds.length > 1) return { phaseLines: [], phaseRanges: [], graphNotes: [] };
    const currentTargetId = annotationTarget?.id;
    if (!currentTargetId) return { phaseLines: [], phaseRanges: [], graphNotes: [] };
    return {
      phaseLines: (annotations.phaseLines || []).filter(p => p.targetId === currentTargetId),
      phaseRanges: (annotations.phaseRanges || []).filter(p => p.targetId === currentTargetId),
      graphNotes: (annotations.graphNotes || []).filter(p => p.targetId === currentTargetId)
    };
  }, [annotations, annotationTarget, activeCategoryTab, selectedBehaviorIds]);

  // ---------------- Analysis target, overlays and visual analysis ----------------
  const analysisTarget = tabTargets.find(target => target.id === analysisTargetId) || tabTargets[0] || null;
  const focusedTarget = analysisTarget || activeTargets[0] || null;
  const focusedEntry = useMemo(
    () => explorerCatalog.items.find(item => item.targetId === focusedTarget?.id) || null,
    [explorerCatalog.items, focusedTarget]
  );
  // Introduction, mastery and maintenance dates for the target on screen. They are drawn on
  // the chart and repeated in the progress tab so acquisition rate can be read either way.
  const milestonesForTarget = useMemo(() => (analysisTarget ? targetMilestones(analysisTarget) : []), [analysisTarget]);
  const programCategory = activeCategoryTab === 'Behavior' ? 'BehaviorReduction' : 'SkillAcquisition';
  const isBehavior = programCategory === 'BehaviorReduction';
  const keyIndex = useMemo(() => new Map(pageKeys.map((key, index) => [key, index])), [pageKeys]);
  // Date span of the visible x-axis, used to label the chart's condition bar.
  const visibleRange = useMemo(() => {
    if (!pageKeys.length) return null;
    if (aggregation === 'Per Session') {
      const rows = filteredSessions.filter(row => keyIndex.has(getObservationKey(row, aggregation)));
      if (!rows.length) return null;
      return { start: rows[0].timestamp.slice(0, 10), end: rows.at(-1).timestamp.slice(0, 10) };
    }
    if (!/^\d{4}/.test(pageKeys[0])) return null;
    const toDate = key => (/^\d{4}-\d{2}$/.test(key) ? `${key}-01` : key);
    return { start: toDate(pageKeys[0]), end: toDate(pageKeys.at(-1)) };
  }, [pageKeys, aggregation, filteredSessions, keyIndex]);
  const conditionSpans = useMemo(() => analysisTarget && visibleRange
    ? buildConditionSpans(analysisTarget, activeAnnotations.phaseLines, visibleRange.start, visibleRange.end)
    : [], [analysisTarget, visibleRange, activeAnnotations.phaseLines]);
  const analysisRows = useMemo(() => analysisTarget ? filteredSessions.filter(row => row.targetId === analysisTarget.id) : [], [filteredSessions, analysisTarget]);
  const rowsByGroup = useMemo(() => {
    const groups = new Map();
    for (const row of filteredSessions) {
      if (!tabTargets.some(target => target.id === row.targetId)) continue;
      const key = `${row.targetId}|${getObservationKey(row, aggregation)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    return groups;
  }, [filteredSessions, tabTargets, aggregation]);
  const analysisPoints = useMemo(() => {
    if (!analysisTarget || activeTargetType === 'Anecdotal') return [];
    return processAggregation(analysisRows, aggregation, activeTargetType, durationView, rateView, frequencyView)
      .filter(point => keyIndex.has(point.xKey))
      .map(point => {
        const rows = rowsByGroup.get(`${analysisTarget.id}|${point.xKey}`) || [];
        return { ...point, x: keyIndex.get(point.xKey), y: point.val, key: `${analysisTarget.id}|${point.xKey}`,
          afterBreak: rows.some(row => services.get(row.serviceSessionId)?.settingEvents?.includes('Schedule change')) };
      });
  }, [analysisTarget, analysisRows, aggregation, activeTargetType, durationView, rateView, frequencyView, keyIndex, rowsByGroup, services]);

  const analysisRowsByKey = useMemo(() => new Map(pageKeys.map(key => [key, rowsByGroup.get(`${analysisTarget?.id}|${key}`) || []])), [pageKeys, rowsByGroup, analysisTarget]);
  const segments = useMemo(() => analysisTarget ? segmentByBoundaries(analysisPoints, conditionBoundaries(analysisTarget, annotations.phaseLines), firstConditionLabel(analysisTarget)) : [], [analysisPoints, analysisTarget, annotations.phaseLines]);
  const comparisonOptions = segments.slice(1).map((segment, index) => ({
    id: `${segments[index].label}-${segment.label}-${segment.start}`, before: segments[index].label, after: segment.label,
    label: `${segments[index].label} → ${segment.label} (from ${formatChartDate(segment.start)})`, A: segments[index], B: segment
  }));
  const defaultComparison = Math.max(0, comparisonOptions.findIndex(option => option.before === 'Baseline'));
  const chosenComparison = comparisonIndex != null && comparisonIndex < comparisonOptions.length ? comparisonIndex : (comparisonOptions.length ? (comparisonOptions.some(option => option.before === 'Baseline') ? defaultComparison : comparisonOptions.length - 1) : 0);
  const direction = therapeuticDirection(analysisTarget, programCategory);
  const comparison = useMemo(() => {
    const option = comparisonOptions[chosenComparison];
    return option ? compareConditions(option.A.points, option.B.points, { direction }) : null;
  }, [comparisonOptions, chosenComparison, direction]);

  const goal = goalInView(analysisTarget, view, aggregation);
  const currentSegment = segments.at(-1);
  const forecast = useMemo(() => {
    if (!functions.has('forecast') || !currentSegment || currentSegment.points.length < 4 || (aggregation === 'Per Session' && currentPage < totalPages)) return null;
    const lastPoint = currentSegment.points.at(-1);
    const projected = forecastLinear(currentSegment.points, { horizon: 4, step: 1, minimum: 0, maximum: percentType ? 100 : Infinity });
    if (!projected) return null;
    const gap = median(currentSegment.points.slice(1).map((point, index) => (new Date(point.date) - new Date(currentSegment.points[index].date)) / 86400000).filter(value => value > 0)) || 2;
    const keys = projectedKeys(lastPoint.xKey, aggregation, projected.length, gap);
    return { from: { xKey: lastPoint.xKey, y: lastPoint.y }, points: projected.map((point, index) => ({ ...point, xKey: keys[index] })) };
  }, [functions, currentSegment, aggregation, currentPage, totalPages, percentType]);

  const ioaKeys = useMemo(() => {
    if (!functions.has('ioa')) return null;
    const map = new Map();
    for (const [key, rows] of rowsByGroup) {
      const checks = rows.filter(row => row.ioa).map(row => row.ioa.percent);
      if (checks.length) map.set(key, Math.min(...checks));
    }
    return map;
  }, [functions, rowsByGroup]);

  const contextRows = analysisRows.filter(row => keyIndex.has(getObservationKey(row, aggregation)));
  const contextGroups = useMemo(() => {
    const groups = new Map();
    const labelsFor = row => {
      const service = services.get(row.serviceSessionId);
      switch (contextDimension) {
        case 'clinician': return [row.therapistName];
        case 'setting': return [service?.setting || 'Not recorded'];
        case 'time': return [service ? (Number(service.start.slice(0, 2)) < 12 ? 'Morning' : 'Afternoon') : 'Not recorded'];
        case 'weekday': return [weekdayOf(row.timestamp)];
        default: return service?.settingEvents?.length ? service.settingEvents : ['No setting events'];
      }
    };
    for (const row of contextRows) {
      const value = rowValue(row, view);
      if (!Number.isFinite(value)) continue;
      for (const label of labelsFor(row)) {
        if (!groups.has(label)) groups.set(label, { label, values: [], keys: new Set() });
        groups.get(label).values.push(value);
        groups.get(label).keys.add(`${row.targetId}|${getObservationKey(row, aggregation)}`);
      }
    }
    const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return [...groups.values()].map(group => ({ ...group, n: group.values.length, mean: mean(group.values) }))
      .sort((a, b) => contextDimension === 'weekday' ? order.indexOf(a.label) - order.indexOf(b.label) : b.n - a.n);
  }, [contextRows, contextDimension, services, view, aggregation]);
  const highlightKeys = analysisTab === 'context' && highlightGroup ? contextGroups.find(group => group.label === highlightGroup)?.keys || null : null;

  const overlays = {
    analysisSeriesId: splitByTherapist ? null : analysisTarget?.id,
    median: functions.has('median') && analysisPoints.length ? median(analysisPoints.map(point => point.y)) : null,
    movingAverage: functions.has('movingAverage') && analysisPoints.length > 2 ? movingAverage(analysisPoints, 3).map(point => ({ xKey: point.xKey, y: point.y })) : null,
    envelope: functions.has('envelope') && currentSegment?.points.length >= 3 ? stabilityEnvelope(currentSegment.points) : null,
    envelopeRange: currentSegment?.points.length ? [currentSegment.points[0].xKey, currentSegment.points.at(-1).xKey] : null,
    phaseMeans: functions.has('phaseMeans') ? segments.map(segment => ({ startKey: segment.points[0].xKey, endKey: segment.points.at(-1).xKey, mean: mean(segment.points.map(point => point.y)), label: segment.label })) : null,
    goal: functions.has('goal') ? goal : null,
    forecast: forecast?.points || null,
    forecastFrom: forecast?.from || null,
    ioaKeys,
    logScale: functions.has('log'),
    cdc: cdcOnChart && comparison?.cdc ? {
      meanLine: comparison.cdc.meanLine, trendLine: comparison.cdc.trendLine,
      startKey: comparisonOptions[chosenComparison].B.points[0].xKey, endKey: comparisonOptions[chosenComparison].B.points.at(-1).xKey,
      beyondKeys: comparison.cdc.beyondKeys
    } : null
  };
  const splitLine = showTrendLine && trendMethod === 'split-middle' && analysisPoints.length >= 4 ? splitMiddle(analysisPoints) : null;
  const shownTrend = !showTrendLine ? null : trendMethod === 'regression' ? regressionPoints : trendMethod === 'directional' ? trendlinePoints
    : splitLine ? { start: { xKey: pageKeys[analysisPoints[0].x], val: splitLine.predict(analysisPoints[0].x) }, end: { xKey: pageKeys[analysisPoints.at(-1).x], val: splitLine.predict(analysisPoints.at(-1).x) }, label: 'Split-middle line of progress' } : null;

  // Progress, mastery and data quality for the analysis target.
  const allTargetRows = useMemo(() => analysisTarget ? sessions.filter(row => row.clientId === client?.id && row.targetId === analysisTarget.id).sort((a, b) => a.timestamp.localeCompare(b.timestamp)) : [], [sessions, client, analysisTarget]);
  const acquisitionStart = analysisTarget?.phaseHistory?.find(entry => entry.phase === 'Acquisition')?.date;
  const evaluation = useMemo(() => analysisTarget?.masteryRule && acquisitionStart ? evaluateMastery(allTargetRows.filter(row => row.value != null), analysisTarget.masteryRule, { startDate: acquisitionStart }) : null, [allTargetRows, analysisTarget, acquisitionStart]);
  const ioa = useMemo(() => ioaSummary(analysisRows, { minimumAgreement: standards?.ioa?.minimumAgreementPercent ?? 80, minimumCoverage: standards?.ioa?.minimumCoveragePercent ?? 20 }), [analysisRows, standards]);
  const projection = goal && currentSegment ? projectThresholdDate(currentSegment.points, goal.value, goal.comparison) : null;
  // Behavior-reduction mastery: a baseline value and a configured percentage reduction
  // sustained across a defined number of days.
  const reductionRule = useMemo(() => reductionRuleFor(analysisTarget, standards), [analysisTarget, standards]);
  const reduction = useMemo(() => {
    if (!isBehavior || !analysisTarget) return null;
    const rows = sessions
      .filter(row => row.clientId === client?.id && row.targetId === analysisTarget.id && row.observationType !== 'IOA' && row.observationType !== 'Supervision' && Number.isFinite(row.value))
      .map(row => ({ timestamp: row.timestamp, value: row.value }));
    return { ...evaluateReductionMastery(rows, reductionRule, { startDate: acquisitionStart, sustainedDays: reductionRule.sustainedDays, reductionPercent: reductionRule.reductionPercent }), rule: reductionRule };
  }, [isBehavior, analysisTarget, sessions, client, reductionRule, acquisitionStart]);
  const rateCeleration = (activeTargetType === 'FluencyRate' && rateView !== 'Rate per Day') || (activeTargetType === 'Frequency' && frequencyView !== 'Raw Frequency')
    ? celeration(analysisPoints.map(point => ({ date: point.date, y: point.y }))) : null;
  const template = templates.find(item => item.id === analysisTarget?.promptHierarchyId);
  const insights = analysisTarget ? buildInsights({
    target: analysisTarget, isBehavior, points: analysisPoints, rows: analysisRows, evaluation, comparison, template, ioa, projection,
    scale: percentType ? 100 : Math.max(1, ...analysisPoints.map(point => point.y)), standards
  }) : [];
  const qualityServices = [...new Set(analysisRows.map(row => row.serviceSessionId).filter(Boolean))].map(id => services.get(id)).filter(Boolean);
  const fidelityValues = qualityServices.filter(service => service.fidelity).map(service => service.fidelity.percent);
  const observerMap = new Map();
  analysisRows.filter(row => row.ioa).forEach(row => {
    if (!observerMap.has(row.ioa.observer)) observerMap.set(row.ioa.observer, []);
    observerMap.get(row.ioa.observer).push(row.ioa.percent);
  });
  const untrackedInRange = analysisTarget ? sessions.filter(row => row.clientId === client?.id && row.targetId === analysisTarget.id && row.missingDataMode === 'DataNotTracked' && new Date(row.timestamp) >= getMinDate(durationFilter)).length : 0;

  // Drill-down selection.
  const selectableKeys = pageKeys.filter(key => displaySeriesData.some(series => series.points.some(point => point.xKey === key)));
  const shownSelection = selectedKey && selectableKeys.includes(selectedKey) ? selectedKey : null;
  const selectionRows = shownSelection ? filteredSessions.filter(row => tabTargets.some(target => target.id === row.targetId) && getObservationKey(row, aggregation) === shownSelection) : [];
  const targetMap = useMemo(() => new Map(activeTargets.map(target => [target.id, target])), [activeTargets]);
  const clientAbc = useMemo(() => abcEntries.filter(entry => entry.clientId === client?.id), [abcEntries, client]);
  const stepSelection = step => {
    const index = selectableKeys.indexOf(shownSelection);
    const next = selectableKeys[index + step];
    if (next) setSelectedKey(next);
  };

  const handleExport = (type) => {
    if (type === 'svg') return exportSvgElement(svgRef.current, `${chartTitle.replace(/\s+/g, '_')}.svg`);
    if (type === 'png') return exportPngFromSvg(svgRef.current, `${chartTitle.replace(/\s+/g, '_')}.png`);
    if (type === 'raw-csv') {
      // Unlike the graph, the raw export includes DataNotTracked and zero-out dates.
      const order = new Map(tabTargets.map((target, index) => [target.id, index]));
      const raw = sessions.filter(s => s.clientId === client?.id && order.has(s.targetId) && new Date(s.timestamp) >= getMinDate(durationFilter))
        .sort((a, b) => order.get(a.targetId) - order.get(b.targetId) || a.timestamp.localeCompare(b.timestamp));
      return exportRawTrialDataCsv(
        raw.map(record => ({ ...record, targetName: tabTargets.find(target => target.id === record.targetId)?.name || record.targetId })),
        client?.name, serviceSessions);
    }
    if (type === 'zip') return exportStructuredZip({ clientName: client?.name || 'Client', programs, allRawRecords: sessions });
  };

  const hasChart = activeTargetType !== 'Anecdotal' && displaySeriesData.some(series => series.points.length);
  const chartDataRows = displaySeriesData.flatMap(series => series.points.map(point => ({ ...point, series: series.name })));
  const enabledFunctions = FUNCTION_OPTIONS.filter(option => functions.has(option.key)).length;
  // Every measurement type gets its own specialist view alongside the shared plot types.
  const viewOptions = activeTargetType === 'TrialByTrial'
    ? [{ value: 'standard', label: 'Accuracy' }, { value: 'prompts', label: 'Prompt levels' }, { value: 'trials', label: 'Trial strip' }]
    : activeTargetType === 'FluencyRate' ? [{ value: 'standard', label: 'Timeline' }, { value: 'celeration', label: 'Celeration' }]
      : activeTargetType === 'Frequency' && frequencyView !== 'Raw Frequency' ? [{ value: 'standard', label: 'Timeline' }, { value: 'celeration', label: 'Celeration' }]
        : activeTargetType === 'Duration' && durationView === 'Total Duration' ? [{ value: 'standard', label: 'Timeline' }, { value: 'episodes', label: 'Episodes' }] : null;
  const shownChartView = viewOptions?.some(option => option.value === chartView) ? chartView : 'standard';
  // Aim line for the celeration chart, converted to the per-minute scale it draws.
  const celerationAim = (() => {
    const rule = analysisTarget?.masteryRule;
    if (!rule) return null;
    if (activeTargetType === 'FluencyRate') return rule.measure === 'correctPerMinute' ? rule.threshold : null;
    if (activeTargetType === 'Frequency') return rule.measure === 'ratePerHour' ? Math.round((rule.threshold / 60) * 100) / 100 : null;
    return null;
  })();
  const shownChartType = CHART_TYPES.some(option => option.value === chartType) && !(chartType === 'cumulative' && percentType) ? chartType : 'line';
  function applyAxis(draft) {
    setAxisDraft(draft);
    const { error, bounds } = validateAxisBounds(draft);
    setAxisError(error);
    if (bounds) setAxisBounds(bounds);
  }
  const unit = unitLabel(view);
  const brushValues = allChartKeys.map(key => analysisTarget ? (chartSeriesData.find(series => series.id === analysisTarget.id) || chartSeriesData[0])?.points.find(point => point.xKey === key)?.val : null);
  function toggleFunction(key, enabled) {
    setFunctions(previous => {
      const next = new Set(previous);
      if (enabled) next.add(key); else next.delete(key);
      return next;
    });
  }
  function saveTitle(event) {
    event.preventDefault();
    if (!draftTitle.trim()) { setTitleError('Enter a chart title before saving.'); return; }
    setCustomTitles(previous => ({ ...previous, [titleContext]: draftTitle.trim() }));
    setIsEditingTitle(false);
    setTitleError('');
    requestAnimationFrame(() => titleButtonRef.current?.focus());
  }
  const suppressionNote = suppressedCounts.trials + suppressedCounts.shortObservations > 0
    ? ` · ${[suppressedCounts.trials ? `${suppressedCounts.trials} low-trial session${suppressedCounts.trials === 1 ? '' : 's'}` : null,
      suppressedCounts.shortObservations ? `${suppressedCounts.shortObservations} short observation${suppressedCounts.shortObservations === 1 ? '' : 's'}` : null].filter(Boolean).join(' and ')} hidden by the graphing policy (${graphPolicyMinimum} trials minimum)`
    : '';
  const summaryNote = summaryMode === 'none' ? '' : ` · ${summaryLabel(summaryMode, tabTargets.length)} plotted as a dashed line`;
  const caption = showTrendLine && trendMethod === 'regression' && regressionParams
    ? `Regression: y = ${regressionParams.slope}x + ${regressionParams.intercept}. x is the ordered observation group.`
    : showTrendLine && trendMethod === 'split-middle' && splitLine
      ? `Split-middle line of progress for ${analysisTarget?.name}: ${splitLine.slope >= 0 ? '+' : ''}${splitLine.slope.toFixed(2)} ${unit} per observation group.`
      : `${MEASUREMENT_LABELS[activeTargetType]} · ${chartDataRows.length} plotted observations${shownSelection ? '' : ' · select a point for details'}${summaryNote}${suppressionNote}`;

  const explorerSelection = useMemo(() => ({
    activeCategoryTab,
    selectedProgramId,
    selectedBehaviorIds,
    activeTargetType,
    visibleTargetIds,
    analysisTargetId: analysisTarget?.id || ''
  }), [activeCategoryTab, selectedProgramId, selectedBehaviorIds, activeTargetType, visibleTargetIds, analysisTarget]);

  return <section id="target-analysis" className="panel" aria-labelledby="target-analysis-title" tabIndex={-1}>
    <SectionHeader id="target-analysis-title" title="Target analysis" description="Explore targets across programs, inspect trends and session trials, and read clinical context alongside each graph."
      help="Search or choose any target in the explorer on the left, then inspect its chart in the center and its definitions, insights and annotations in the clinical context rail. Measured zeros count; unobserved records never become zeros."
      actions={<>
        <ExportMenu label="Export targets" onExport={handleExport} formats={[
          { id: 'svg', label: 'Vector chart · SVG', disabled: !hasChart },
          { id: 'png', label: 'Chart image · PNG', disabled: !hasChart },
          { id: 'raw-csv', label: 'Raw observations · CSV', disabled: !tabTargets.length },
          { id: 'zip', label: 'All client targets · ZIP' }
        ]} />
        <button type="button" className="icon-button icon-button--bordered" onClick={onRefresh} aria-label="Refresh target analysis"><RotateCw size={19} /></button>
      </>} />

    {!canEdit && <p className="view-only-notice explorer-view-notice" role="status">{viewOnlyReason || 'View-only analytics access: graphs, tables and exports are available; changes are disabled.'}</p>}

    <TrendExplorer
      catalog={explorerCatalog}
      selection={explorerSelection}
      skillPrograms={skillPrograms}
      programProgressMap={programProgressMap}
      allBehaviors={allBehaviors}
      behaviorQuickPicks={behaviorQuickPicks}
      onSelectCategory={category => { setActiveCategoryTab(category); resetView(); }}
      onSelectProgramDropdown={programId => { setActiveCategoryTab('SkillAcquisition'); setSelectedProgramId(programId); resetView(); }}
      onToggleBehaviorId={(behaviorId, checked) => {
        setSelectedBehaviorIds(previous => (checked ? [...previous, behaviorId] : previous.filter(id => id !== behaviorId)));
        resetView();
      }}
      onSelectBehaviorPreset={ids => { setSelectedBehaviorIds(ids); resetView(); }}
      onSelectProgramGroup={applyExplorerProgram}
      onSelectTargetItem={applyExplorerTarget}
      insights={insights}
      focusedEntry={focusedEntry}
      annotationTarget={annotationTarget}
      tabTargets={tabTargets}
      onAnnotationTargetChange={setAnnotationTargetId}
      activeAnnotations={activeAnnotations}
      onAddPhaseLineClick={onAddPhaseLineClick}
      onAddPhaseRangeClick={onAddPhaseRangeClick}
      onAddGraphNoteClick={onAddGraphNoteClick}
      onEditAnnotation={onEditAnnotation}
      onDeletePhaseLine={onDeletePhaseLine}
      onDeletePhaseRange={onDeletePhaseRange}
      onDeleteGraphNote={onDeleteGraphNote}
      canEdit={canEdit}
      viewOnlyReason={viewOnlyReason}
      detailPrograms={detailPrograms}
      activeTarget={focusedTarget}
    >
      <div className="measurement-toolbar">
        {availableTargetTypes.length > 0 ? <div className="measurement-tabs" role="group" aria-label="Measurement type">
          {availableTargetTypes.map(type => <button type="button" key={type} aria-pressed={activeTargetType === type} onClick={() => { setActiveTargetType(type); resetView(false); }}>{MEASUREMENT_LABELS[type]}</button>)}
        </div> : <span className="control-label">Chart window</span>}
        <div className="view-controls">
          <label htmlFor="target-date-range">Date range</label>
          <select id="target-date-range" value={durationFilter} onChange={event => { setDurationFilter(event.target.value); setSelectedKey(null); setZoom(null); }}>
            {['3 days', '5 days', '7 days', '2 weeks', '1 month', '3 months', '6 months', '1 year', '2 years'].map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          {availableTargetTypes.length > 0 && viewOptions && <SegmentedControl label="Chart view" value={shownChartView} onChange={value => { setChartView(value); setSelectedKey(null); }} options={viewOptions} className="chart-view-control" />}
          {availableTargetTypes.length > 0 && activeTargetType !== 'Anecdotal' && <><label htmlFor="target-grouping">Group by</label><select id="target-grouping" value={aggregation} onChange={event => { setAggregation(event.target.value); setSessionPage(1); setSelectedKey(null); setZoom(null); }}>
            {['Per Day', 'Per Session', 'Weekly', 'Monthly'].map(value => <option key={value} value={value}>{value === 'Per Day' ? 'Day' : value === 'Per Session' ? 'Session' : value}</option>)}
          </select></>}
          {availableTargetTypes.length > 0 && activeTargetType !== 'Anecdotal' && <><label htmlFor="target-chart-type">Plot</label><select id="target-chart-type" value={shownChartType} onChange={event => { setChartType(event.target.value); setSelectedKey(null); }}>
            {CHART_TYPES.map(option => <option key={option.value} value={option.value} disabled={option.value === 'cumulative' && percentType}>{option.label}{option.value === 'cumulative' && percentType ? ' · counts only' : ''}</option>)}
          </select></>}
          {activeTargetType === 'Duration' && <select aria-label="Duration measure" value={durationView} onChange={event => setDurationView(event.target.value)}>
            <option value="Total Duration">Total duration</option><option value="Total Count">Occurrence count</option><option value="Average Duration">Average duration</option>
          </select>}
          {activeTargetType === 'FluencyRate' && <select aria-label="Fluency rate measure" value={rateView} onChange={event => setRateView(event.target.value)}>
            <option value="Rate per Day">{aggregation === 'Per Day' ? 'Occurrences per day' : 'Occurrence count'}</option><option value="Rate per Minute">Rate per minute</option><option value="Rate per Hour">Rate per hour</option>
          </select>}
          {activeTargetType === 'Frequency' && <select aria-label="Frequency measure" value={frequencyView} onChange={event => setFrequencyView(event.target.value)}>
            <option value="Raw Frequency">Occurrence count</option><option value="Rate per Minute">Rate per minute</option><option value="Rate per Hour">Rate per hour</option>
          </select>}
          {availableTargetTypes.length > 0 && activeTargetType !== 'Anecdotal' && tabTargets.length > 1 && <><label htmlFor="summary-mode">Summary</label>
            <select id="summary-mode" value={summaryMode} onChange={event => updatePreferences({ summaryMode: event.target.value })}>
              {availableSummaryModes(activeTargetType).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></>}
          {availableTargetTypes.length > 0 && activeTargetType !== 'Anecdotal' && tabTargets.length === 1 && <label className="toggle-control"><input type="checkbox" checked={splitByTherapist} onChange={event => setSplitByTherapist(event.target.checked)} />Split by clinician</label>}
        </div>
      </div>

      {activeTargetType && activeTargetType !== 'Anecdotal' && <div className="chart-toolbar">
        {canEdit && isEditingTitle ? <form className="chart-title-editor" onSubmit={saveTitle} noValidate>
          <label className="sr-only" htmlFor="chart-title">Chart title</label><input id="chart-title" type="text" value={draftTitle} maxLength={80} aria-invalid={titleError ? true : undefined} aria-describedby={titleError ? 'chart-title-error' : undefined}
            onChange={event => setDraftTitle(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setIsEditingTitle(false); requestAnimationFrame(() => titleButtonRef.current?.focus()); } }} />
          <button type="submit" className="button button--primary">Save</button><button type="button" className="button button--tertiary" onClick={() => setIsEditingTitle(false)}>Cancel</button>
          {titleError && <p className="field-error" id="chart-title-error" role="alert">{titleError}</p>}
        </form> : canEdit ? <button type="button" ref={titleButtonRef} className="chart-title-button" aria-label={`Edit chart title: ${chartTitle}`} onClick={() => { setDraftTitle(chartTitle); setTitleError(''); setIsEditingTitle(true); }}><span>{chartTitle}</span><Edit3 size={16} /></button>
          : <p className="chart-title-static">{chartTitle}</p>}
        <div className="chart-options">
          <button type="button" className="button button--tertiary" disabled={!canEdit} onClick={() => onManualEntryClick?.(activeTargets[0])}>Add data point</button>
          <label className="toggle-control"><input type="checkbox" checked={showAverageLine} disabled={averageValue === null || !canEdit} onChange={event => setShowAverageLine(event.target.checked)} />Average</label>
          <label className="toggle-control"><input type="checkbox" checked={showTrendLine} disabled={!trendlinePoints || !canEdit} onChange={event => setShowTrendLine(event.target.checked)} /><TrendingUp size={15} />Trend</label>
          {showTrendLine && <select aria-label="Trend calculation" className="toggle-control" disabled={!canEdit} value={trendMethod} onChange={event => setTrendMethod(event.target.value)}>
            <option value="regression">Linear regression</option><option value="directional">First-to-last direction</option><option value="split-middle">Split-middle (line of progress)</option>
          </select>}
          <Popover label="Graph view" icon={Settings2} className="graph-view-popover">
            <p className="popover-label">Graph view · {preferenceSummary(preferences, standards)}</p>
            <label className="popover-option"><input type="checkbox" checked={preferences.showNoDataDates} disabled={!canEdit}
              onChange={event => updatePreferences({ showNoDataDates: event.target.checked })} />
              <span>Include dates without data<small className="block text-slate-500">Charts start with the dates that have measurements</small></span></label>
            <label className="popover-option"><input type="checkbox" checked={preferences.suppressLowTrialSessions} disabled={!canEdit}
              onChange={event => updatePreferences({ suppressLowTrialSessions: event.target.checked })} />
              <span>Hide sessions below the trial minimum<small className="block text-slate-500">{graphStandards(standards).source}</small></span></label>
            <div className="axis-fields">
              <label htmlFor="graph-minimum-trials">Minimum trials per point</label>
              <input id="graph-minimum-trials" type="number" min="0" step="1" inputMode="numeric" disabled={!canEdit}
                placeholder={String(graphStandards(standards).minimumTrialsPerDataPoint)} value={preferences.minimumTrials ?? ''}
                onChange={event => updatePreferences({ minimumTrials: event.target.value === '' ? null : Math.max(0, Math.round(Number(event.target.value))) })} />
            </div>
            <div className="control-field"><label htmlFor="marker-shape">Data point shape</label>
              <select id="marker-shape" value={preferences.markerShape} disabled={!canEdit} onChange={event => updatePreferences({ markerShape: event.target.value })}>
                {MARKER_LIBRARY.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select></div>
            <p className="field-hint">{MARKER_LIBRARY.find(option => option.id === preferences.markerShape)?.hint}</p>
            <div className="control-field"><label htmlFor="chart-orientation">Axis orientation</label>
              <select id="chart-orientation" value={preferences.orientation} disabled={!canEdit} onChange={event => { updatePreferences({ orientation: event.target.value }); setChartView('standard'); }}>
                <option value="values">Values vertical · dates horizontal</option>
                <option value="dates">Dates vertical · values horizontal (flipped)</option>
              </select></div>
            <p className="field-hint">The flipped view puts time down the vertical axis and keeps phase changes, notes and criteria on the alternate axis.</p>
            <button type="button" className="button button--tertiary" disabled={!canEdit}
              onClick={() => setPreferences(resetGraphPreferences(client?.id) ? readGraphPreferences(client?.id) : normalizeGraphPreferences())}>Reset graph view</button>
          </Popover>
          <Popover label={`Chart functions (${enabledFunctions})`} icon={Settings2} className="functions-popover">
            <p className="popover-label">Analytical functions for {analysisTarget?.name || 'the plotted target'}</p>
            {FUNCTION_OPTIONS.map(option => {
              const unavailable = (option.key === 'goal' && !goal) || (option.key === 'log' && percentType) || (shownChartView !== 'standard') || !canEdit;
              return <label key={option.key} className="popover-option function-option">
                <input type="checkbox" checked={functions.has(option.key)} disabled={unavailable} onChange={event => toggleFunction(option.key, event.target.checked)} />
                <span>{option.label}<small className="block text-slate-500">{option.key === 'goal' && !goal ? 'Not comparable with this unit or grouping' : option.hint}</small></span>
              </label>;
            })}
          </Popover>
          <Popover label={`Y axis · ${describeAxisBounds(axisBounds)}`} icon={Settings2} className="axis-popover">
            <p className="popover-label">Vertical axis range</p>
            <div className="axis-fields">
              <label htmlFor="axis-min">Minimum</label>
              <input id="axis-min" type="number" step="any" inputMode="decimal" placeholder="Auto" disabled={!canEdit} value={axisDraft.min} onChange={event => applyAxis({ ...axisDraft, min: event.target.value })} />
              <label htmlFor="axis-max">Maximum</label>
              <input id="axis-max" type="number" step="any" inputMode="decimal" placeholder="Auto" disabled={!canEdit} value={axisDraft.max} onChange={event => applyAxis({ ...axisDraft, max: event.target.value })} />
            </div>
            {axisError && <p className="field-error" role="alert">{axisError}</p>}
            <p className="field-hint">Leave a field blank to scale that end to the data. Observations outside the range stay in the data table and exports.</p>
            <button type="button" className="button button--tertiary" disabled={!canEdit} onClick={() => applyAxis({ min: '', max: '' })}>Use automatic scale</button>
          </Popover>
          <button type="button" className="toggle-control" aria-pressed={showValues} onClick={() => updatePreferences({ showValues: !showValues })}>Values</button>
          <button type="button" className="toggle-control" aria-pressed={showPhaseLabels} onClick={() => updatePreferences({ showPhaseLabels: !showPhaseLabels })}>Phase labels</button>
          <button type="button" className="toggle-control" aria-pressed={showGridlines} onClick={() => updatePreferences({ showGridlines: !showGridlines })}>Gridlines</button>
          <button type="button" className="toggle-control" aria-pressed={colorMode === 'BlackAndWhite'} onClick={() => setColorMode(value => value === 'System' ? 'BlackAndWhite' : 'System')}>Monochrome</button>
          {activeCategoryTab === 'Behavior' && <label className="toggle-control"><input type="checkbox" checked={behaviorZeroOut} onChange={event => setBehaviorZeroOut(event.target.checked)} />Include measured zeros</label>}
          <label className="toggle-control"><input type="checkbox" checked={showEmptyDates} onChange={event => updatePreferences({ showNoDataDates: event.target.checked })} />Show missing dates</label>
        </div>
      </div>}

      <div className="panel-body">
        {activeTargets.length === 0 ? <EmptyState title={activeCategoryTab === 'Behavior' ? 'Choose a behavior to compare.' : 'Choose a program to begin.'} description="Select a target or program from the explorer list to plot its observations." />
          : availableTargetTypes.length === 0 ? <EmptyState title="No observations for this program yet." description="Record a fictional observation to begin its timeline. Program definitions are visible in the clinical context rail." action={{ label: 'Record an observation', onClick: () => onRecordClick(activeTargets[0]) }} />
            : activeTargetType === 'Anecdotal' ? <AnecdotalTableView key={selectedProgramId} targets={activeTargets.filter(target => target.type === 'Anecdotal' && visibleTargetIds.has(target.id))}
              sessions={filteredSessions.filter(session => session.qualitativeEntry && visibleTargetIds.has(session.targetId))} />
              : <>
                {shownChartView === 'prompts' && analysisTarget ? <PromptLevelChart ref={svgRef} keys={pageKeys} aggregation={aggregation} template={template} targetName={analysisTarget.name}
                  rowsByKey={analysisRowsByKey} selectedKey={shownSelection} onSelect={setSelectedKey} />
                  : shownChartView === 'trials' && analysisTarget ? <TrialStripChart ref={svgRef} keys={pageKeys} aggregation={aggregation} template={template} targetName={analysisTarget.name}
                    rowsByKey={analysisRowsByKey} selectedKey={shownSelection} onSelect={setSelectedKey} />
                    : shownChartView === 'episodes' && analysisTarget ? <EpisodeStripChart ref={svgRef} keys={pageKeys} aggregation={aggregation} targetName={analysisTarget.name}
                      rowsByKey={analysisRowsByKey} selectedKey={shownSelection} onSelect={setSelectedKey} />
                      : shownChartView === 'celeration' && analysisTarget ? <CelerationChart ref={svgRef} rows={analysisRows.filter(row => keyIndex.has(getObservationKey(row, aggregation)))} targetName={analysisTarget.name}
                        phaseLines={activeAnnotations.phaseLines} aim={celerationAim} />
                        : preferences.orientation === 'dates' ? <TransposedChart ref={svgRef} seriesData={displaySeriesData} targetType={activeTargetType}
                          yAxisLabel={unitLabel(view)} aggregation={aggregation} annotations={activeAnnotations} selectedKey={shownSelection}
                          onSelect={key => setSelectedKey(current => current === key ? null : key)} chartType={shownChartType} axisBounds={axisBounds}
                          showValues={showValues} showGridlines={showGridlines} markerPreference={preferences.markerShape} goal={functions.has('goal') ? goal : null}
                          milestones={milestonesForTarget} hasVisibleSeries={tabTargets.length > 0 && (!splitByTherapist || !allTherapistsForTarget.length || visibleTherapists.size > 0)}
                          onChangeDateRange={() => document.getElementById('target-date-range')?.focus()} />
                    : <TargetChart ref={svgRef} seriesData={displaySeriesData} targetType={activeTargetType} durationView={durationView} rateView={rateView} frequencyView={frequencyView}
                      showAverageLine={showAverageLine} averageValue={averageValue} showTrendLine={Boolean(shownTrend)} trendlinePoints={shownTrend}
                      regressionParams={trendMethod === 'regression' ? regressionParams : null} showGridlines={showGridlines} annotations={activeAnnotations} aggregation={aggregation} extraXKeys={pageKeys}
                      hasVisibleSeries={tabTargets.length > 0 && (!splitByTherapist || !allTherapistsForTarget.length || visibleTherapists.size > 0)}
                      onChangeDateRange={() => document.getElementById('target-date-range')?.focus()}
                      overlays={overlays} selectedKey={shownSelection} highlightKeys={highlightKeys} onSelect={key => setSelectedKey(current => current === key ? null : key)}
                      chartType={shownChartType} axisBounds={axisBounds} showValues={showValues} showPhaseLabels={showPhaseLabels} conditionSpans={conditionSpans}
                      markerPreference={preferences.markerShape} milestones={milestonesForTarget}
                      suppressed={preferences.orientation === 'values' ? suppressedCounts : null} />}
                {chartPending && <p className="chart-pending" role="status">Updating chart…</p>}
                {hasChart && <div className="chart-caption"><span>{caption}</span><span className="scroll-hint">Scroll to see the full chart →</span></div>}
                {aggregation === 'Per Session' && totalPages > 1 && <div className="pagination" aria-label="Session chart pagination"><span>Page {currentPage} of {totalPages}</span><button type="button" className="icon-button icon-button--bordered" aria-label="Previous session page" disabled={currentPage <= 1} onClick={() => setSessionPage(currentPage - 1)}><ChevronLeft size={18} /></button><button type="button" className="icon-button icon-button--bordered" aria-label="Next session page" disabled={currentPage >= totalPages} onClick={() => setSessionPage(currentPage + 1)}><ChevronRight size={18} /></button></div>}
                {hasChart && aggregation !== 'Per Session' && <TimelineBrush keys={allChartKeys} values={brushValues} start={zoomRange.start} end={zoomRange.end} aggregation={aggregation}
                  onChange={(start, end) => setZoom({ signature: zoomSignature, start, end })} />}
                {shownSelection && selectionRows.length > 0 && <ObservationInspector key={`${shownSelection}-${aggregation}`} selection={{ key: shownSelection, aggregation }} rows={selectionRows}
                  targets={targetMap} templates={templates} services={services} abcEntries={clientAbc} view={view} onClose={() => setSelectedKey(null)}
                  canEdit={canEdit} viewOnlyReason={viewOnlyReason} supervisionRecords={supervisionRecords}
                  onCorrectObservation={onCorrectObservation} onDeleteObservation={onDeleteObservation}
                  canStep={step => Boolean(selectableKeys[selectableKeys.indexOf(shownSelection) + step])} onStep={stepSelection} />}
                {hasChart && analysisTarget && <AnalysisPanel tab={analysisTab} onTabChange={setAnalysisTab} unit={unit}
                  targetOptions={tabTargets} analysisTargetId={analysisTarget.id} onAnalysisTargetChange={id => { setAnalysisTargetId(id); setComparisonIndex(null); setHighlightGroup(null); }}
                  comparison={{ options: comparisonOptions, index: chosenComparison, onIndexChange: setComparisonIndex, result: comparison }}
                  onShowFullHistory={() => { setDurationFilter('1 year'); setZoom(null); }} cdcOnChart={cdcOnChart} onToggleCdc={setCdcOnChart}
                  progress={{ target: analysisTarget, evaluation, insights, celeration: rateCeleration, phaseSince: analysisTarget.phaseEnteredDate,
                    program: programs.find(program => program.id === analysisTarget.programId) || null, canEdit, onProgramStatusChange, standards, reduction }}
                  quality={{ ioa, observers: [...observerMap.entries()].map(([name, values]) => ({ name, n: values.length, mean: mean(values) })).sort((a, b) => b.n - a.n),
                    lowIoa: analysisRows.filter(row => row.ioa && row.ioa.percent < 80), fidelity: { mean: mean(fidelityValues), n: fidelityValues.length, below: fidelityValues.filter(value => value < (standards?.fidelity?.minimumPercent ?? 85)).length },
                    untracked: untrackedInRange, substitutes: qualityServices.filter(service => service.settingEvents?.includes('Substitute staff')).length,
                    events: qualityServices.filter(service => service.settingEvents?.length).length, standards }}
                  onInspectRow={row => { setSelectedKey(getObservationKey(row, aggregation)); requestAnimationFrame(() => document.getElementById('inspector-title')?.scrollIntoView({ block: 'nearest' })); }}
                  context={{ dimension: contextDimension, onDimensionChange: value => { setContextDimension(value); setHighlightGroup(null); }, groups: contextGroups, highlighted: highlightGroup, onHighlight: setHighlightGroup }} />}
                {chartDataRows.length > 0 && <details className="chart-data"><summary>View plotted data table ({chartDataRows.length})</summary><div className="data-table-scroll" tabIndex={0} role="region" aria-label="Plotted target observations">
                  <table className="data-table"><caption className="sr-only">Values plotted for {chartTitle}. Filters and grouping match the chart.</caption><thead><tr><th scope="col">{aggregation === 'Per Session' ? 'Session' : 'Date group'}</th><th scope="col">Target / clinician</th><th scope="col">Measurement</th><th scope="col">Recording clinician</th></tr></thead>
                    <tbody>{chartDataRows.map((row, index) => <tr key={`${row.series}-${row.xKey}-${index}`}><td>{formatChartDate(row.xKey, aggregation)}</td><td>{row.series}</td><td>{row.displayVal}</td><td>{row.therapist}</td></tr>)}</tbody>
                  </table></div></details>}
              </>}
      </div>

      {activeTargets.length > 0 && activeTargetType && <footer className="chart-footer">
        <span className="legend-title">Visible targets · select to show or hide</span>
        <div className="target-legend">
          {targetStages.map(group => <div className="legend-group" key={group.id}>
            <p className="legend-group-label" title={group.hint}>{group.label} <span>({group.targets.filter(target => !hiddenTargetIds.has(target.id)).length}/{group.targets.length} shown)</span></p>
            <div className="legend-group-items">
              {group.targets.map(target => <button type="button" key={target.id} className="legend-button" aria-pressed={visibleTargetIds.has(target.id)} onClick={() => setHiddenTargetIds(previous => { const next = new Set(previous); if (next.has(target.id)) next.delete(target.id); else next.add(target.id); return next; })}>
                <MarkerSwatch color={seriesColor(activeTargets.findIndex(item => item.id === target.id), colorMode === 'BlackAndWhite')} shape={preferences.markerShape} count={tabTargets.length} index={tabTargets.findIndex(item => item.id === target.id)} />
                <span>{target.name}</span>{visibleTargetIds.has(target.id) ? <CheckSquare size={17} /> : <Square size={17} />}
              </button>)}
            </div>
          </div>)}
        </div>
        {splitByTherapist && tabTargets.length === 1 && <div className="mt-4"><span className="legend-title">Visible clinicians</span><div className="target-legend">{allTherapistsForTarget.map((name, index) => <button type="button" key={name} className="legend-button" aria-pressed={visibleTherapists.has(name)} onClick={() => setHiddenTherapists(previous => { const next = new Set(previous); if (next.has(name)) next.delete(name); else next.add(name); return next; })}><Swatch color={seriesColor(index, colorMode === 'BlackAndWhite')} /><UserCheck size={17} />{name}</button>)}</div></div>}
      </footer>}
    </TrendExplorer>
  </section>;
}

function Swatch({ color }) {
  return <span className="legend-swatch" aria-hidden="true"><svg viewBox="0 0 12 12"><rect width="12" height="12" rx="2" fill={color} /></svg></span>;
}

// The legend shows the same marker the chart draws, so the shape choice is visible there too.
function MarkerSwatch({ color, shape, count = 1, index = 0 }) {
  const marker = markerElement(resolveMarkerShape(shape, { seriesCount: count, seriesIndex: Math.max(0, index) }), { x: 6, y: 6, size: 4.4, color });
  return <span className="legend-swatch" aria-hidden="true">
    <svg viewBox="0 0 12 12">{createElement(marker.tag, marker.props)}</svg>
  </span>;
}

// Anecdotal (qualitative) observations are grouped by target in a table.
function AnecdotalTableView({ targets = [], sessions = [] }) {
  const [selectedTargetId, setSelectedTargetId] = useState('All');
  const filter = targets.some(target => target.id === selectedTargetId) ? selectedTargetId : 'All';
  const visibleEntries = [...sessions].filter(session => filter === 'All' || session.targetId === filter).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (!targets.length) return <EmptyState title="All narrative targets are hidden." description="Show an anecdotal target in the legend below to read its observations." />;
  return <div>
    <div className="view-controls justify-between mb-5"><div><h3 className="font-medium text-base">Observation notes</h3><p className="field-hint">{visibleEntries.length} narrative observations · most recent first</p></div>
      <div className="control-field"><label htmlFor="anecdotal-target">Target</label><select id="anecdotal-target" value={filter} onChange={event => setSelectedTargetId(event.target.value)}><option value="All">All narrative targets</option>{targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}</select></div>
    </div>
    {!visibleEntries.length ? <EmptyState title="No notes in this date range." description="Try a longer range using the date filter above." /> : targets.filter(target => filter === 'All' || target.id === filter).map(target => {
      const entries = visibleEntries.filter(entry => entry.targetId === target.id);
      if (!entries.length) return null;
      return <section key={target.id} className="mb-5" aria-label={`${target.name} observation notes`}>
        <h4 className="font-medium text-slate-800 mb-2">{target.name}</h4>
        <div className="data-table-scroll" tabIndex={0} role="region" aria-label={`${target.name} narrative observations`}>
          <table className="data-table"><caption className="sr-only">Narrative observations for {target.name}</caption><thead><tr><th scope="col">Date &amp; time</th><th scope="col">Recording clinician</th><th scope="col">Observation</th></tr></thead><tbody>
            {entries.map(row => <tr key={row.id}><td className="whitespace-nowrap">{row.timestamp.replace('T', ' ').slice(0, 16)}</td><td>{row.therapistName}</td><td><p>{row.qualitativeEntry}</p></td></tr>)}
          </tbody></table>
        </div>
      </section>;
    })}
  </div>;
}
