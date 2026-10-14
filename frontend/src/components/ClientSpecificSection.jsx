import React, { useState, useMemo, useRef } from 'react';
import { RotateCw, TrendingUp, Plus, Trash2, Edit3, CheckSquare, Square, UserCheck, ChevronLeft, ChevronRight } from './ui/Icons';
import { exportSvgElement, exportPngFromSvg, exportRawTrialDataCsv, exportStructuredZip } from '../utils/exportUtils';
import ProgramDetails from './ProgramDetails';
import SectionHeader from './ui/SectionHeader';
import ExportMenu from './ui/ExportMenu';
import Popover from './ui/Popover';
import SegmentedControl from './ui/SegmentedControl';
import EmptyState from './ui/EmptyState';
import { MEASUREMENT_LABELS } from '../utils/formValidation';
import { seriesColor, formatChartDate, chartMarkerInk, CHART_GRID, CHART_MUTED, CHART_INK } from '../utils/chartTheme';
import { getMinDate, processAggregation, getObservationKey, sortObservationKeys, chartStatistics } from '../utils/analyticsMetrics';

export default function ClientSpecificSection({
  client,
  programs = [],
  sessions = [],
  annotations = { phaseLines: [], phaseRanges: [], graphNotes: [] },
  onAddPhaseLineClick,
  onAddPhaseRangeClick,
  onAddGraphNoteClick,
  onDeletePhaseLine,
  onDeletePhaseRange,
  onDeleteGraphNote,
  onRefresh,
  onEditAnnotation,
  onRecordClick
}) {
  // Program / Behavior selection (Section 6.1 & 6.2)
  const [activeCategoryTab, setActiveCategoryTab] = useState('SkillAcquisition'); // 'SkillAcquisition' or 'Behavior'
  const [selectedProgramId, setSelectedProgramId] = useState(() => programs.find(program => program.category === 'SkillAcquisition')?.id || '');
  const [selectedBehaviorIds, setSelectedBehaviorIds] = useState(() => { const first = programs.find(program => program.category === 'BehaviorReduction')?.targets[0]?.id; return first ? [first] : []; }); // multi-selection support (Section 19)

  // Target Type Tab state (Section 7 & 9.4)
  const [requestedTargetType, setActiveTargetType] = useState('');

  // Target Visibility Control (Section 12.1)
  const [hiddenTargetIds, setHiddenTargetIds] = useState(new Set());

  // Duration filter (Section 7.3)
  const [durationFilter, setDurationFilter] = useState('1 month');

  // Aggregation view (Section 18)
  const [aggregation, setAggregation] = useState('Per Day'); // 'Per Day', 'Per Session', 'Weekly', 'Monthly'
  const [sessionPage, setSessionPage] = useState(1);

  // Duration target view options (Section 15)
  const [durationView, setDurationView] = useState('Total Duration'); // 'Total Duration', 'Total Count', 'Average Duration'

  // Fluency / Rate target view options (Section 6)
  const [rateView, setRateView] = useState('Rate per Day'); // 'Rate per Day', 'Rate per Minute', 'Rate per Hour'

  // Frequency view: Raw vs Rate
  const [frequencyView, setFrequencyView] = useState('Raw Frequency'); // 'Raw Frequency', 'Rate per Minute', 'Rate per Hour'

  // Split Data by Therapist (Section 17)
  const [splitByTherapist, setSplitByTherapist] = useState(false);
  const [hiddenTherapists, setHiddenTherapists] = useState(new Set());

  // Overlays: Average Line & Trend Line (Section 13 & 14)
  const [showAverageLine, setShowAverageLine] = useState(false);
  const [showTrendLine, setShowTrendLine] = useState(false);
  const [useRegressionTrend, setUseRegressionTrend] = useState(true);

  // Chart customization (Section 10.1, 10.2, 10.3)
  const [customTitles, setCustomTitles] = useState({});
  const [draftTitle, setDraftTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const titleButtonRef = useRef(null);
  const [annotationTargetId, setAnnotationTargetId] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showGridlines, setShowGridlines] = useState(true);
  const [colorMode, setColorMode] = useState('System'); // 'System' vs 'BlackAndWhite'

  // Behavior reduction missing data handling (Section 8.5)
  const [behaviorZeroOut, setBehaviorZeroOut] = useState(true);
  const [showEmptyDates, setShowEmptyDates] = useState(true);

  // Export menus & SVG ref
  const svgRef = useRef(null);

  // Filter programs by category
  const skillPrograms = useMemo(() => programs.filter(p => p.category === 'SkillAcquisition'), [programs]);
  const behaviorPrograms = useMemo(() => programs.filter(p => p.category === 'BehaviorReduction'), [programs]);

  // All behavior targets across behavior programs
  const allBehaviors = useMemo(() => {
    const list = [];
    behaviorPrograms.forEach(p => {
      p.targets.forEach(t => list.push({ ...t, programName: p.name }));
    });
    return list;
  }, [behaviorPrograms]);

  // Currently selected program object
  const currentSelectedProgram = useMemo(() => {
    if (activeCategoryTab === 'SkillAcquisition') {
      return skillPrograms.find(p => p.id === selectedProgramId) || null;
    }
    return null;
  }, [activeCategoryTab, selectedProgramId, skillPrograms]);

  // Active targets based on current selection
  const activeTargets = useMemo(() => {
    if (activeCategoryTab === 'SkillAcquisition') {
      return currentSelectedProgram ? currentSelectedProgram.targets : [];
    } else {
      return allBehaviors.filter(b => selectedBehaviorIds.includes(b.id));
    }
  }, [activeCategoryTab, currentSelectedProgram, allBehaviors, selectedBehaviorIds]);

  const detailPrograms = useMemo(() => activeCategoryTab === 'SkillAcquisition'
    ? (currentSelectedProgram ? [currentSelectedProgram] : [])
    : behaviorPrograms.filter(p => p.targets.some(t => selectedBehaviorIds.includes(t.id))),
  [activeCategoryTab, currentSelectedProgram, behaviorPrograms, selectedBehaviorIds]);

  const visibleTargetIds = useMemo(() => new Set(activeTargets.filter(target => !hiddenTargetIds.has(target.id)).map(target => target.id)), [activeTargets, hiddenTargetIds]);

  // Determine available target types for the selection (Section 7 & 9.4)
  const availableTargetTypes = useMemo(() => {
    if (activeTargets.length === 0) return [];

    // A pending target (or one with only DataNotTracked records) has no data tab.
    const typesWithData = new Set();
    activeTargets.forEach(tgt => {
      const hasData = sessions.some(s => s.clientId === client?.id &&
        s.targetId === tgt.id && s.missingDataMode !== 'DataNotTracked');
      if (hasData) typesWithData.add(tgt.type);
    });

    const standardOrder = ['TrialByTrial', 'Duration', 'Frequency', 'IntervalData', 'Anecdotal', 'FluencyRate'];
    return standardOrder.filter(type => typesWithData.has(type));
  }, [activeTargets, sessions, client]);

  const activeTargetType = availableTargetTypes.includes(requestedTargetType) ? requestedTargetType : availableTargetTypes[0] || '';

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
    if (resetTargets) {
      setHiddenTargetIds(new Set());
      setActiveTargetType('');
      setAnnotationTargetId('');
    }
  }

  // Targets in the currently selected target type tab
  const tabTargets = useMemo(() => {
    return activeTargets.filter(t => t.type === activeTargetType && visibleTargetIds.has(t.id));
  }, [activeTargets, activeTargetType, visibleTargetIds]);

  // Filter raw sessions based on duration, client, and targets
  const filteredSessions = useMemo(() => {
    if (!client || activeTargets.length === 0) return [];

    const targetIdList = activeTargets.map(t => t.id);
    let list = sessions.filter(s => s.clientId === client.id &&
      targetIdList.includes(s.targetId) && s.missingDataMode !== 'DataNotTracked');

    list = list.filter(s => new Date(s.timestamp) >= getMinDate(durationFilter));
    list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Behavior Reduction missing data handling (Section 8.3)
    if (activeCategoryTab === 'Behavior') {
      if (!behaviorZeroOut) {
        list = list.filter(s => s.missingDataMode !== 'ZeroOut');
      }
    }

    return list;
  }, [client, activeTargets, sessions, durationFilter, activeCategoryTab, behaviorZeroOut]);

  // Extract all unique therapists for the selected targets
  const allTherapistsForTarget = useMemo(() => {
    const set = new Set();
    filteredSessions.filter(session => tabTargets.some(target => target.id === session.targetId)).forEach(s => {
      if (s.therapistName) set.add(s.therapistName);
    });
    return Array.from(set);
  }, [filteredSessions, tabTargets]);

  const visibleTherapists = useMemo(() => new Set(allTherapistsForTarget.filter(name => !hiddenTherapists.has(name))), [allTherapistsForTarget, hiddenTherapists]);

  // Process data points for Graph based on Aggregation and Target Type
  const chartSeriesData = useMemo(() => {
    if (tabTargets.length === 0 || filteredSessions.length === 0) return [];


    // If Split by Therapist is enabled (Section 17) - only applies when single target is selected
    if (splitByTherapist && tabTargets.length === 1) {
      const tgt = tabTargets[0];
      return allTherapistsForTarget
        .filter(th => visibleTherapists.has(th))
        .map(therapist => {
          const thSessions = filteredSessions.filter(s => s.targetId === tgt.id && s.therapistName === therapist);
          const points = processAggregation(thSessions, aggregation, activeTargetType, durationView, rateView, frequencyView);
          return {
            id: `th-${therapist}`,
            name: therapist,
            color: seriesColor(allTherapistsForTarget.indexOf(therapist), colorMode === 'BlackAndWhite'),
            points
          };
        });
    }

    // Default: one series per target
    return tabTargets.map(tgt => {
      const tgtSessions = filteredSessions.filter(s => s.targetId === tgt.id);
      const points = processAggregation(tgtSessions, aggregation, activeTargetType, durationView, rateView, frequencyView);
      const defaultColor = seriesColor(activeTargets.findIndex(target => target.id === tgt.id), colorMode === 'BlackAndWhite');

      return {
        id: tgt.id,
        name: tgt.name,
        color: defaultColor,
        points
      };
    });
  }, [
    tabTargets,
    filteredSessions,
    splitByTherapist,
    allTherapistsForTarget,
    visibleTherapists,
    aggregation,
    activeTargetType,
    durationView,
    rateView,
    frequencyView,
    colorMode,
    activeTargets
  ]);

  const contextualXKeys = showEmptyDates && activeCategoryTab === 'Behavior'
    ? sessions.filter(session => session.clientId === client?.id && tabTargets.some(target => target.id === session.targetId) &&
      new Date(session.timestamp) >= getMinDate(durationFilter)).map(session => getObservationKey(session, aggregation))
    : [];
  const allChartKeys = sortObservationKeys(new Set([...contextualXKeys, ...chartSeriesData.flatMap(series => series.points.map(point => point.xKey))]), aggregation);
  const totalPages = Math.max(1, Math.ceil(allChartKeys.length / 12));
  const currentPage = Math.min(sessionPage, totalPages);
  const pageKeys = aggregation === 'Per Session' ? allChartKeys.slice((currentPage - 1) * 12, currentPage * 12) : allChartKeys;
  const displaySeriesData = aggregation === 'Per Session'
    ? chartSeriesData.map(series => ({ ...series, points: series.points.filter(point => pageKeys.includes(point.xKey)) })) : chartSeriesData;
  const { averageValue, trendlinePoints, regressionPoints, regressionParams } = chartStatistics(displaySeriesData, aggregation, pageKeys);
  const annotationTarget = tabTargets.find(target => target.id === annotationTargetId) || tabTargets[0];

  // Target-specific annotations (Section 10 & 11)
  // Hide when multiple behaviors are selected per Section 19.2
  const activeAnnotations = useMemo(() => {
    if (activeCategoryTab === 'Behavior' && selectedBehaviorIds.length > 1) {
      return { phaseLines: [], phaseRanges: [], graphNotes: [] };
    }
    const currentTargetId = annotationTarget?.id;
    if (!currentTargetId) return { phaseLines: [], phaseRanges: [], graphNotes: [] };
    return {
      phaseLines: (annotations.phaseLines || []).filter(p => !currentTargetId || p.targetId === currentTargetId),
      phaseRanges: (annotations.phaseRanges || []).filter(p => !currentTargetId || p.targetId === currentTargetId),
      graphNotes: (annotations.graphNotes || []).filter(p => !currentTargetId || p.targetId === currentTargetId)
    };
  }, [annotations, annotationTarget, activeCategoryTab, selectedBehaviorIds]);

  const handleExport = (type) => {
    if (type === 'svg') {
      return exportSvgElement(svgRef.current, `${chartTitle.replace(/\s+/g, '_')}.svg`);
    } else if (type === 'png') {
      return exportPngFromSvg(svgRef.current, `${chartTitle.replace(/\s+/g, '_')}.png`);
    } else if (type === 'raw-csv') {
      // Unlike the graph, the raw export includes DataNotTracked and zero-out dates.
      const ids = new Set(tabTargets.map(t => t.id));
      const raw = sessions.filter(s => s.clientId === client?.id && ids.has(s.targetId) &&
        new Date(s.timestamp) >= getMinDate(durationFilter));
      return exportRawTrialDataCsv(raw.map(record => ({ ...record, targetName: tabTargets.find(target => target.id === record.targetId)?.name || record.targetId })), client?.name);
    } else if (type === 'zip') {
      return exportStructuredZip({ clientName: client?.name || 'Client', programs, allRawRecords: sessions });
    }
  };

  const hasChart = activeTargetType !== 'Anecdotal' && displaySeriesData.some(series => series.points.length);
  const chartDataRows = displaySeriesData.flatMap(series => series.points.map(point => ({ ...point, series: series.name })));
  function saveTitle(event) {
    event.preventDefault();
    if (!draftTitle.trim()) { setTitleError('Enter a chart title before saving.'); return; }
    setCustomTitles(previous => ({ ...previous, [titleContext]: draftTitle.trim() }));
    setIsEditingTitle(false);
    setTitleError('');
    requestAnimationFrame(() => titleButtonRef.current?.focus());
  }

  return <section id="target-analysis" className="panel" aria-labelledby="target-analysis-title" tabIndex={-1}>
    <SectionHeader id="target-analysis-title" title="Target analysis" description="Compare observations across programs and measurement tools."
      help="Choose a program or behavior, then select a measurement type. Only tools with recorded observations appear. Measured zeros count; unobserved records never become zeros."
      actions={<>
        <ExportMenu label="Export targets" onExport={handleExport} formats={[
          { id: 'svg', label: 'Vector chart · SVG', disabled: !hasChart },
          { id: 'png', label: 'Chart image · PNG', disabled: !hasChart },
          { id: 'raw-csv', label: 'Raw observations · CSV', disabled: !tabTargets.length },
          { id: 'zip', label: 'All client targets · ZIP' }
        ]} />
        <button type="button" className="icon-button icon-button--bordered" onClick={onRefresh} aria-label="Refresh target analysis"><RotateCw size={19} /></button>
      </>} />

    <div className="analysis-filters">
      <SegmentedControl label="Program category" value={activeCategoryTab} onChange={value => { setActiveCategoryTab(value); resetView(); }}
        options={[{ value: 'SkillAcquisition', label: 'Skill acquisition' }, { value: 'Behavior', label: `Behavior reduction (${allBehaviors.length})` }]} />
      {activeCategoryTab === 'SkillAcquisition' ? <div className="control-field program-field">
        <label htmlFor="target-program">Program</label><select id="target-program" value={selectedProgramId} onChange={event => { setSelectedProgramId(event.target.value); resetView(); }}>
          <option value="">Choose a program</option>{skillPrograms.map(program => <option key={program.id} value={program.id}>{program.name} · {program.status}</option>)}
        </select>
      </div> : <div className="control-field program-field">
        <span className="control-label">Compare behaviors</span>
        <Popover label={`Choose behaviors (${selectedBehaviorIds.length})`}>
          <p className="popover-label">Select one or more behaviors</p>
          {allBehaviors.map(behavior => <label key={behavior.id} className="popover-option">
            <input type="checkbox" checked={selectedBehaviorIds.includes(behavior.id)} onChange={event => { setSelectedBehaviorIds(previous => event.target.checked ? [...previous, behavior.id] : previous.filter(id => id !== behavior.id)); resetView(); }} />
            <span>{behavior.name}<small className="block text-slate-500">{MEASUREMENT_LABELS[behavior.type]}</small></span>
          </label>)}
        </Popover>
      </div>}
      <div className="control-field"><label htmlFor="target-date-range">Date range</label><select id="target-date-range" value={durationFilter} onChange={event => setDurationFilter(event.target.value)}>
        {['3 days','5 days','7 days','2 weeks','1 month','3 months','6 months','1 year','2 years'].map(value => <option key={value} value={value}>{value}</option>)}
      </select></div>
    </div>
    <ProgramDetails programs={detailPrograms} />
    {availableTargetTypes.length > 0 && <div className="measurement-toolbar">
      <div className="measurement-tabs" role="group" aria-label="Measurement type">
        {availableTargetTypes.map(type => <button type="button" key={type} aria-pressed={activeTargetType === type} onClick={() => { setActiveTargetType(type); resetView(false); }}>{MEASUREMENT_LABELS[type]}</button>)}
      </div>
      <div className="view-controls">
        {activeTargetType !== 'Anecdotal' && <><label htmlFor="target-grouping">Group by</label><select id="target-grouping" value={aggregation} onChange={event => { setAggregation(event.target.value); setSessionPage(1); }}>
          {['Per Day','Per Session','Weekly','Monthly'].map(value => <option key={value} value={value}>{value === 'Per Day' ? 'Day' : value === 'Per Session' ? 'Session' : value}</option>)}
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
        {activeTargetType !== 'Anecdotal' && tabTargets.length === 1 && <label className="toggle-control"><input type="checkbox" checked={splitByTherapist} onChange={event => setSplitByTherapist(event.target.checked)} />Split by clinician</label>}
      </div>
    </div>}

    {activeTargetType && activeTargetType !== 'Anecdotal' && <div className="chart-toolbar">
      {isEditingTitle ? <form className="chart-title-editor" onSubmit={saveTitle} noValidate>
        <label className="sr-only" htmlFor="chart-title">Chart title</label><input id="chart-title" type="text" value={draftTitle} maxLength={80} aria-invalid={titleError ? true : undefined} aria-describedby={titleError ? 'chart-title-error' : undefined}
          onChange={event => setDraftTitle(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setIsEditingTitle(false); requestAnimationFrame(() => titleButtonRef.current?.focus()); } }} />
        <button type="submit" className="button button--primary">Save</button><button type="button" className="button button--tertiary" onClick={() => setIsEditingTitle(false)}>Cancel</button>
        {titleError && <p className="field-error" id="chart-title-error" role="alert">{titleError}</p>}
      </form> : <button type="button" ref={titleButtonRef} className="chart-title-button" aria-label={`Edit chart title: ${chartTitle}`} onClick={() => { setDraftTitle(chartTitle); setTitleError(''); setIsEditingTitle(true); }}><span>{chartTitle}</span><Edit3 size={16} /></button>}
      <div className="chart-options">
        <label className="toggle-control"><input type="checkbox" checked={showAverageLine} disabled={averageValue === null} onChange={event => setShowAverageLine(event.target.checked)} />Average</label>
        <label className="toggle-control"><input type="checkbox" checked={showTrendLine} disabled={!trendlinePoints} onChange={event => setShowTrendLine(event.target.checked)} /><TrendingUp size={15} />Trend</label>
        {showTrendLine && <select aria-label="Trend calculation" className="toggle-control" value={useRegressionTrend ? 'regression' : 'directional'} onChange={event => setUseRegressionTrend(event.target.value === 'regression')}><option value="regression">Linear regression</option><option value="directional">First-to-last direction</option></select>}
        <button type="button" className="toggle-control" aria-pressed={showGridlines} onClick={() => setShowGridlines(value => !value)}>Gridlines</button>
        <button type="button" className="toggle-control" aria-pressed={colorMode === 'BlackAndWhite'} onClick={() => setColorMode(value => value === 'System' ? 'BlackAndWhite' : 'System')}>Monochrome</button>
        {activeCategoryTab === 'Behavior' && <><label className="toggle-control"><input type="checkbox" checked={behaviorZeroOut} onChange={event => setBehaviorZeroOut(event.target.checked)} />Include measured zeros</label><label className="toggle-control"><input type="checkbox" checked={showEmptyDates} onChange={event => setShowEmptyDates(event.target.checked)} />Show missing dates</label></>}
        {(activeCategoryTab !== 'Behavior' || selectedBehaviorIds.length <= 1) && <div className="annotation-actions">
          {tabTargets.length > 1 && <select aria-label="Annotation target" className="toggle-control max-w-60" value={annotationTarget?.id || ''} onChange={event => setAnnotationTargetId(event.target.value)}>{tabTargets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}</select>}
          <button type="button" disabled={!annotationTarget} onClick={() => onAddPhaseLineClick(annotationTarget)}><Plus size={14} />Phase line</button>
          <button type="button" disabled={!annotationTarget} onClick={() => onAddPhaseRangeClick(annotationTarget)}><Plus size={14} />Phase range</button>
          <button type="button" disabled={!annotationTarget} onClick={() => onAddGraphNoteClick(annotationTarget)}><Plus size={14} />Note</button>
        </div>}
      </div>
    </div>}

    <div className="panel-body">
      {activeTargets.length === 0 ? <EmptyState title={activeCategoryTab === 'Behavior' ? 'Choose a behavior to compare.' : 'Choose a program to begin.'} description="The controls above keep this view focused on one client’s records." />
        : availableTargetTypes.length === 0 ? <EmptyState title="No observations for this program yet." description="Record a fictional observation to begin its timeline. Program definitions are still available above." action={{ label: 'Record an observation', onClick: () => onRecordClick(activeTargets[0]) }} />
        : activeTargetType === 'Anecdotal' ? <AnecdotalTableView key={selectedProgramId} targets={activeTargets.filter(target => target.type === 'Anecdotal' && visibleTargetIds.has(target.id))}
          sessions={filteredSessions.filter(session => session.qualitativeEntry && visibleTargetIds.has(session.targetId))} />
        : <>
          <QuantitativeSvgChart ref={svgRef} seriesData={displaySeriesData} targetType={activeTargetType} durationView={durationView} rateView={rateView} frequencyView={frequencyView}
            showAverageLine={showAverageLine} averageValue={averageValue} showTrendLine={showTrendLine} trendlinePoints={useRegressionTrend ? regressionPoints : trendlinePoints}
            regressionParams={useRegressionTrend ? regressionParams : null} showGridlines={showGridlines} annotations={activeAnnotations} aggregation={aggregation} extraXKeys={pageKeys}
            hasVisibleSeries={tabTargets.length > 0 && (!splitByTherapist || !allTherapistsForTarget.length || visibleTherapists.size > 0)}
            onChangeDateRange={() => document.getElementById('target-date-range')?.focus()} />
          {hasChart && <div className="chart-caption"><span>{showTrendLine && useRegressionTrend && regressionParams ? `Regression: y = ${regressionParams.slope}x + ${regressionParams.intercept}. x is the ordered observation group.` : `${MEASUREMENT_LABELS[activeTargetType]} · ${chartDataRows.length} plotted observations`}</span><span className="scroll-hint">Scroll to see the full chart →</span></div>}
          {aggregation === 'Per Session' && totalPages > 1 && <div className="pagination" aria-label="Session chart pagination"><span>Page {currentPage} of {totalPages}</span><button type="button" className="icon-button icon-button--bordered" aria-label="Previous session page" disabled={currentPage <= 1} onClick={() => setSessionPage(currentPage - 1)}><ChevronLeft size={18} /></button><button type="button" className="icon-button icon-button--bordered" aria-label="Next session page" disabled={currentPage >= totalPages} onClick={() => setSessionPage(currentPage + 1)}><ChevronRight size={18} /></button></div>}
          {chartDataRows.length > 0 && <details className="chart-data"><summary>View plotted data table ({chartDataRows.length})</summary><div className="data-table-scroll" tabIndex={0} role="region" aria-label="Plotted target observations">
            <table className="data-table"><caption className="sr-only">Values plotted for {chartTitle}. Filters and grouping match the chart.</caption><thead><tr><th scope="col">{aggregation === 'Per Session' ? 'Session' : 'Date group'}</th><th scope="col">Target / clinician</th><th scope="col">Measurement</th><th scope="col">Recording clinician</th></tr></thead>
              <tbody>{chartDataRows.map((row, index) => <tr key={`${row.series}-${row.xKey}-${index}`}><td>{formatChartDate(row.xKey, aggregation)}</td><td>{row.series}</td><td>{row.displayVal}</td><td>{row.therapist}</td></tr>)}</tbody>
            </table></div></details>}
        </>}
    </div>

    {activeTargets.length > 0 && activeTargetType && <footer className="chart-footer">
      <span className="legend-title">Visible targets · select to show or hide</span>
      <div className="target-legend">{activeTargets.filter(target => target.type === activeTargetType).map(target => <button type="button" key={target.id} className="legend-button" aria-pressed={visibleTargetIds.has(target.id)} onClick={() => setHiddenTargetIds(previous => { const next = new Set(previous); if (next.has(target.id)) next.delete(target.id); else next.add(target.id); return next; })}>
        <Swatch color={seriesColor(activeTargets.findIndex(item => item.id === target.id), colorMode === 'BlackAndWhite')} /><span>{target.name}</span>{visibleTargetIds.has(target.id) ? <CheckSquare size={17} /> : <Square size={17} />}
      </button>)}</div>
      {splitByTherapist && tabTargets.length === 1 && <div className="mt-4"><span className="legend-title">Visible clinicians</span><div className="target-legend">{allTherapistsForTarget.map((name, index) => <button type="button" key={name} className="legend-button" aria-pressed={visibleTherapists.has(name)} onClick={() => setHiddenTherapists(previous => { const next = new Set(previous); if (next.has(name)) next.delete(name); else next.add(name); return next; })}><Swatch color={seriesColor(index, colorMode === 'BlackAndWhite')} /><UserCheck size={17} />{name}</button>)}</div></div>}
      {annotationTarget && (activeCategoryTab !== 'Behavior' || selectedBehaviorIds.length <= 1) && <div className="annotations-list">
        <span className="legend-title">Annotations · {annotationTarget.name}</span>
        <div className="annotations-grid">{[
          ['line', 'Phase lines', activeAnnotations.phaseLines, onDeletePhaseLine],
          ['range', 'Phase ranges', activeAnnotations.phaseRanges, onDeletePhaseRange],
          ['note', 'Graph notes', activeAnnotations.graphNotes, onDeleteGraphNote]
        ].map(([kind, title, records, remove]) => <div className="annotation-group" key={kind}><h3>{title} ({records.length})</h3>
          {!records.length && <p className="annotation-empty">None added for this target.</p>}
          {records.map(record => <div className="annotation-item" key={record.id}><div>
            <p>{record.label || record.noteText}</p><small>{kind === 'range' ? `${record.startDate} – ${record.endDate}` : record.date}{record.staffName ? ` · ${record.staffName}` : ''}</small>
          </div><button type="button" className="icon-button" aria-label={`Edit ${record.label || 'graph note'}`} onClick={() => onEditAnnotation(kind, record, annotationTarget)}><Edit3 size={16} /></button><button type="button" className="icon-button delete-button" aria-label={`Delete ${record.label || 'graph note'}`} onClick={() => remove(record.id)}><Trash2 size={16} /></button></div>)}
        </div>)}</div>
      </div>}
    </footer>}
  </section>;
}

function Swatch({ color }) {
  return <span className="legend-swatch" aria-hidden="true"><svg viewBox="0 0 12 12"><rect width="12" height="12" rx="2" fill={color} /></svg></span>;
}

// ----------------------------------------------------
// Subcomponent: Quantitative SVG Chart Engine
// ----------------------------------------------------
const QuantitativeSvgChart = React.forwardRef(function QuantitativeSvgChart({
  seriesData = [],
  targetType,
  durationView,
  rateView,
  frequencyView,
  showAverageLine,
  averageValue,
  showTrendLine,
  trendlinePoints,
  regressionParams,
  showGridlines,
  annotations,
  aggregation,
  extraXKeys = [],
  hasVisibleSeries = true,
  onChangeDateRange
}, ref) {

  if (!hasVisibleSeries) return <EmptyState title="No series are visible." description="Show a target or clinician in the legend below to bring the chart back." />;

  // Dimensions
  const width = 850;
  const height = 355;
  const padding = { top: 35, right: 35, bottom: 60, left: 65 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Collect all unique X categories (dates or sessions)
  const allXKeysSet = new Set();
  seriesData.forEach(s => s.points.forEach(p => allXKeysSet.add(p.xKey)));
  extraXKeys.forEach(key => allXKeysSet.add(key));
  const sortedXKeys = sortObservationKeys(allXKeysSet, aggregation);

  if (!sortedXKeys.length || !seriesData.some(series => series.points.length)) return <EmptyState title="No measured observations in this range." description="Try a longer date range. Unobserved records aren’t plotted as zeros." action={{ label: 'Change date range', onClick: onChangeDateRange }} />;

  // Calculate Y Max
  let maxY = 10;
  if (targetType === 'TrialByTrial' || targetType === 'IntervalData') {
    maxY = 100;
  } else {
    let observedMax = 0;
    seriesData.forEach(s => {
      s.points.forEach(p => {
        if (p.val > observedMax) observedMax = p.val;
      });
    });
    maxY = Math.max(10, Math.ceil(observedMax * 1.15));
  }

  // Coordinate mapper
  const getX = (xKey) => {
    const idx = sortedXKeys.indexOf(xKey);
    if (idx === -1) return padding.left;
    return padding.left + (sortedXKeys.length > 1 ? (idx / (sortedXKeys.length - 1)) * graphWidth : graphWidth / 2);
  };

  const getAnnotationX = (date, clamp = false) => {
    if (aggregation === 'Per Session') {
      const point = seriesData.flatMap(series => series.points).find(item => item.date === date);
      return point ? getX(point.xKey) : null;
    }
    const key = getObservationKey({ timestamp: `${date}T12:00:00` }, aggregation);
    if (sortedXKeys.includes(key)) return getX(key);
    if (key < sortedXKeys[0]) return clamp ? padding.left : null;
    if (key > sortedXKeys.at(-1)) return clamp ? width - padding.right : null;
    const next = sortedXKeys.findIndex(item => item > key);
    if (next < 1) return null;
    const toTime = value => new Date(`${value.length === 7 ? `${value}-01` : value}T12:00:00Z`).getTime();
    const fraction = (toTime(key) - toTime(sortedXKeys[next - 1])) / (toTime(sortedXKeys[next]) - toTime(sortedXKeys[next - 1]));
    return getX(sortedXKeys[next - 1]) + fraction * (getX(sortedXKeys[next]) - getX(sortedXKeys[next - 1]));
  };

  const getY = (val) => {
    return padding.top + graphHeight - (Math.max(0, Math.min(val, maxY)) / maxY) * graphHeight;
  };

  // Keep units explicit without changing the underlying seconds/counts/rates.
  const durationInMinutes = targetType === 'Duration' && durationView !== 'Total Count' && maxY >= 120;
  const rateLabel = view => view === 'Rate per Minute' ? 'Occurrences per minute' : 'Occurrences per hour';
  const averageLabel = targetType === 'Duration' && durationView !== 'Total Count'
    ? `${durationInMinutes ? Math.round(averageValue / 6) / 10 : averageValue}${durationInMinutes ? 'm' : 's'}` : averageValue;
  const getYAxisLabel = () => {
    if (targetType === 'TrialByTrial') return 'Correct responses (%)';
    if (targetType === 'IntervalData') return 'Intervals scored (%)';
    if (targetType === 'Duration') return durationView === 'Total Count' ? 'Occurrence count'
      : `${durationView === 'Total Duration' ? 'Total duration' : 'Average duration'} (${durationInMinutes ? 'minutes' : 'seconds'})`;
    if (targetType === 'FluencyRate') return rateView === 'Rate per Day'
      ? (aggregation === 'Per Day' ? 'Occurrences per day' : 'Occurrence count') : rateLabel(rateView);
    if (targetType === 'Frequency') return frequencyView === 'Raw Frequency' ? 'Occurrence count' : rateLabel(frequencyView);
    return 'Value';
  };

  return (
    <div className="chart-scroll" tabIndex={0} role="region" aria-label="Target analysis chart. Scroll horizontally for the full timeline.">
      <div className="chart-inner chart-inner--quantitative">
        <svg
          ref={ref}
          viewBox={`0 0 ${width} ${height}`}
          className="chart-svg" role="img" aria-label={`${getYAxisLabel()} across ${sortedXKeys.length} observation groups. Read the plotted data table below for exact values.`}
        >
          <title>Target observations</title><desc>One labeled series per target or clinician. The data table below provides all plotted measurements.</desc>
          {/* Phase Ranges (Shaded vertical bands - Section 10.8) */}
          {(annotations?.phaseRanges || []).map((range, idx) => {
            if (aggregation !== 'Per Session' && (getObservationKey({ timestamp: range.endDate }, aggregation) < sortedXKeys[0] || getObservationKey({ timestamp: range.startDate }, aggregation) > sortedXKeys.at(-1))) return null;
            const startX = getAnnotationX(range.startDate, true);
            const endX = getAnnotationX(range.endDate, true);
            if (startX == null || endX == null) return null;
            const bandWidth = Math.max(12, Math.abs(endX - startX));
            return (
              <g key={range.id || idx}>
                <rect
                  x={Math.min(startX, endX)}
                  y={padding.top}
                  width={bandWidth}
                  height={graphHeight}
                  fill={range.color || '#71957f33'}
                />
                <text
                  x={Math.min(startX, endX) + bandWidth / 2}
                  y={padding.top + 14}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="500"
                  fill={CHART_INK}
                  fontFamily="Geist, sans-serif"
                >
                  {range.label}
                </text>
              </g>
            );
          })}

          {/* Gridlines & Y-Axis Scale (Section 10.2) */}
          {[0, Math.round(maxY * 0.25), Math.round(maxY * 0.5), Math.round(maxY * 0.75), maxY].map((val, idx) => {
            const y = getY(val);
            return (
              <g key={idx}>
                {showGridlines && (
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke={CHART_GRID}
                    strokeDasharray="3 3"
                  />
                )}
                <text
                  x={padding.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="13"
                  fill={CHART_MUTED}
                  fontFamily="Geist, sans-serif"
                >
                  {durationInMinutes ? Math.round(val / 6) / 10 : val}
                </text>
              </g>
            );
          })}

          {/* Y-Axis Label */}
          <text
            x={-(padding.top + graphHeight / 2)}
            y="18"
            transform="rotate(-90)"
            textAnchor="middle"
            fontSize="13"
            fontWeight="500"
            fill={CHART_INK}
            fontFamily="Geist, sans-serif"
          >
            {getYAxisLabel()}
          </text>

          {/* Average Line Overlay (Section 13) */}
          {showAverageLine && averageValue !== null && (
            <g className="transition-opacity">
              <line
                x1={padding.left}
                y1={getY(averageValue)}
                x2={width - padding.right}
                y2={getY(averageValue)}
                stroke="#34634c"
                strokeWidth="2"
                strokeDasharray="5 3"
              />
              <rect
                x={width - padding.right - 100}
                y={getY(averageValue) - 18}
                width="95"
                height="20"
                rx="3"
                fill="#34634c"
              />
              <text
                x={width - padding.right - 52}
                y={getY(averageValue) - 6}
                textAnchor="middle"
                fontSize="11"
                fontWeight="500"
                fill="#FFFFFF"
                fontFamily="Geist, sans-serif"
              >
                Avg: {averageLabel}
              </text>
              <title>Average value: {averageValue}</title>
            </g>
          )}

          {/* Trend Line Overlay (Section 14 & Future Scope) */}
          {showTrendLine && trendlinePoints && (
            <g>
              <line
                x1={getX(trendlinePoints.start.xKey)}
                y1={getY(trendlinePoints.start.val)}
                x2={getX(trendlinePoints.end.xKey)}
                y2={getY(trendlinePoints.end.val)}
                stroke="#697b96"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              <title>{regressionParams ? `Linear regression: y = ${regressionParams.slope}x + ${regressionParams.intercept}` : 'Direction from first to last observation'}</title>
            </g>
          )}

          {/* Phase Change Lines (Section 10.4 & 11) */}
          {(annotations?.phaseLines || []).map((line, idx) => {
            const lx = getAnnotationX(line.date);
            if (lx == null) return null;
            return (
              <g key={line.id || idx}>
                <line
                  x1={lx}
                  y1={padding.top}
                  x2={lx}
                  y2={padding.top + graphHeight}
                  stroke={line.color || '#34634c'}
                  strokeWidth="2.5"
                  strokeDasharray={line.style === 'Dotted' ? '4 3' : undefined}
                />
                <rect
                  x={Math.min(lx - 4, width - padding.right - 150)}
                  y={padding.top + 2}
                  width="150"
                  height="20"
                  rx="3"
                  fill="#294f3d"
                  opacity="0.85"
                />
                <text
                  x={Math.min(lx + 2, width - padding.right - 144)}
                  y={padding.top + 16}
                  fontSize="11"
                  fontWeight="500"
                  fill="#FFFFFF"
                  fontFamily="Geist, sans-serif"
                >
                  {line.label.length > 22 ? `${line.label.slice(0, 21)}…` : line.label}
                </text>
              </g>
            );
          })}

          {/* Plot Data Series Lines and Points */}
          {seriesData.map((series) => {
            // Check for phase line visual breaks if solid phase lines exist (Future Scope #2)
            const solidPhaseDates = (annotations?.phaseLines || [])
              .filter(p => p.style === 'Solid')
              .map(p => p.date);

            // Break series into segments if visual breaks apply
            const segments = [];
            let currentSegment = [];

            series.points.forEach((p) => {
              if (solidPhaseDates.includes(p.xKey) && currentSegment.length > 0) {
                segments.push(currentSegment);
                currentSegment = [p];
              } else {
                currentSegment.push(p);
              }
            });
            if (currentSegment.length > 0) segments.push(currentSegment);

            return (
              <g key={series.id}>
                {/* Connecting Lines */}
                {segments.map((seg, sIdx) => {
                  const dPath = seg.map((p, idx) => {
                    const px = getX(p.xKey);
                    const py = getY(p.val);
                    return `${idx === 0 ? 'M' : 'L'} ${px} ${py}`;
                  }).join(' ');

                  return (
                    <path
                      key={sIdx}
                      d={dPath}
                      fill="none"
                      stroke={series.color}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}

                {/* Data Points (Square Shape per Future Scope #3 standardized rule) */}
                {series.points.map((p, idx) => {
                  const px = getX(p.xKey);
                  const py = getY(p.val);
                  return (
                    <g key={idx} className="chart-point">
                      <rect
                        x={px - 4.5}
                        y={py - 4.5}
                        width="9"
                        height="9"
                        fill="#FFFFFF"
                        stroke={series.color}
                        strokeWidth="2"

                      />

                      {/* Tooltip text showing fractional badge e.g. 100% (5/5) */}
                      <title>
                        {`Target: ${series.name}\n${aggregation === 'Per Session' ? 'Session' : 'Date'}: ${p.xKey}\nValue: ${p.displayVal}\nTherapist: ${p.therapist || 'Recorded'}`}
                      </title>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Graph Notes Annotations (Section 10.6) */}
          {(annotations?.graphNotes || []).map((note, idx) => {
            const nx = getAnnotationX(note.date);
            if (nx == null) return null;
            return (
              <g key={note.id || idx} className="chart-point">
                <circle
                  cx={nx}
                  cy={height - padding.bottom + 12}
                  r="8"
                  fill={note.color || '#34634c'}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
                <text
                  x={nx}
                  y={height - padding.bottom + 15.5}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="Geist, sans-serif"
                  fill={chartMarkerInk(note.color || '#34634c')}
                >
                  N
                </text>
                <title>{`Note by ${note.staffName} (${note.date}):\n${note.noteText}`}</title>
              </g>
            );
          })}

          {/* X-Axis Labels */}
          {sortedXKeys.map((xKey, idx) => {
            const px = getX(xKey);
            // Show every 1-2 labels if many keys
            if (sortedXKeys.length > 15 && idx % 2 !== 0) return null;
            return (
              <text
                key={idx}
                x={px}
                y={height - padding.bottom + 36}
                textAnchor="middle"
                fontSize="12"
                fill={CHART_MUTED}
                fontFamily="Geist, sans-serif"
              >
                {formatChartDate(xKey, aggregation)}
              </text>
            );
          })}

          {/* X-Axis Dimension Title */}
          <text
            x={padding.left + graphWidth / 2}
            y={height - 8}
            textAnchor="middle"
            fontSize="13"
            fontWeight="500"
            fill={CHART_INK}
            fontFamily="Geist, sans-serif"
          >
            {aggregation === 'Per Session' ? 'Session timeline' : 'Observation date'}
          </text>
        </svg>
      </div>
    </div>
  );
});

// ----------------------------------------------------
// Subcomponent: Anecdotal Qualitative Table (Section 5)
// ----------------------------------------------------
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
