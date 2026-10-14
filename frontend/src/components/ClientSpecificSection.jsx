import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Filter, 
  Download, 
  RotateCw, 
  HelpCircle, 
  Eye, 
  EyeOff, 
  TrendingUp, 
  Activity, 
  Settings2, 
  FileText, 
  Layers, 
  Plus, 
  Trash2, 
  Edit3, 
  ChevronDown, 
  Calendar, 
  UserCheck, 
  CheckSquare, 
  Square,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Archive
} from 'lucide-react';
import { 
  exportSvgElement, 
  exportPngFromSvg, 
  exportRawTrialDataCsv,
  exportStructuredZip 
} from '../utils/exportUtils';

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
  isDisabled = false
}) {
  // Program / Behavior selection (Section 6.1 & 6.2)
  const [activeCategoryTab, setActiveCategoryTab] = useState('SkillAcquisition'); // 'SkillAcquisition' or 'Behavior'
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedBehaviorIds, setSelectedBehaviorIds] = useState([]); // multi-selection support (Section 19)

  // Target Type Tab state (Section 7 & 9.4)
  const [activeTargetType, setActiveTargetType] = useState('');

  // Target Visibility Control (Section 12.1)
  const [visibleTargetIds, setVisibleTargetIds] = useState(new Set());

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
  const [visibleTherapists, setVisibleTherapists] = useState(new Set());

  // Overlays: Average Line & Trend Line (Section 13 & 14)
  const [showAverageLine, setShowAverageLine] = useState(false);
  const [showTrendLine, setShowTrendLine] = useState(false);
  const [useRegressionTrend, setUseRegressionTrend] = useState(true);

  // Chart customization (Section 10.1, 10.2, 10.3)
  const [chartTitle, setChartTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [yAxisTitle, setYAxisTitle] = useState('');
  const [showGridlines, setShowGridlines] = useState(true);
  const [colorMode, setColorMode] = useState('System'); // 'System' vs 'BlackAndWhite'

  // Behavior reduction missing data handling (Section 8.5)
  const [behaviorZeroOut, setBehaviorZeroOut] = useState(true);
  const [showEmptyDates, setShowEmptyDates] = useState(true);

  // Anecdotal filters (Section 5.2)
  const [anecdotalTargetFilter, setAnecdotalTargetFilter] = useState('All');

  // Export menus & SVG ref
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  // Set default selection when programs load
  useEffect(() => {
    if (activeCategoryTab === 'SkillAcquisition') {
      if (skillPrograms.length > 0 && !selectedProgramId) {
        setSelectedProgramId(skillPrograms[0].id);
      }
    } else {
      if (allBehaviors.length > 0 && selectedBehaviorIds.length === 0) {
        setSelectedBehaviorIds([allBehaviors[0].id]);
      }
    }
  }, [programs, activeCategoryTab]);

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

  // Sync visible targets whenever activeTargets change
  useEffect(() => {
    const ids = new Set(activeTargets.map(t => t.id));
    setVisibleTargetIds(ids);
  }, [activeTargets]);

  // Determine available target types for the selection (Section 7 & 9.4)
  const availableTargetTypes = useMemo(() => {
    if (activeTargets.length === 0) return [];
    
    // Check which target types actually have data recorded or exist in selected targets
    const typesWithData = new Set();
    activeTargets.forEach(tgt => {
      const hasData = sessions.some(s => s.targetId === tgt.id);
      if (hasData || tgt.type) {
        typesWithData.add(tgt.type);
      }
    });

    const standardOrder = ['TrialByTrial', 'Duration', 'Frequency', 'IntervalData', 'Anecdotal', 'FluencyRate'];
    return standardOrder.filter(type => typesWithData.has(type));
  }, [activeTargets, sessions]);

  // Set first available target type tab by default (Section 9.4)
  useEffect(() => {
    if (availableTargetTypes.length > 0) {
      if (!availableTargetTypes.includes(activeTargetType)) {
        setActiveTargetType(availableTargetTypes[0]);
      }
    } else {
      setActiveTargetType('');
    }
  }, [availableTargetTypes]);

  // Default Chart Title logic (Section 20.1 & 20.2)
  useEffect(() => {
    if (!isEditingTitle) {
      if (activeCategoryTab === 'SkillAcquisition') {
        setChartTitle(currentSelectedProgram ? currentSelectedProgram.name : 'Program Analytics');
      } else {
        if (selectedBehaviorIds.length > 1) {
          setChartTitle('Multiple Behaviors');
        } else if (selectedBehaviorIds.length === 1) {
          const beh = allBehaviors.find(b => b.id === selectedBehaviorIds[0]);
          setChartTitle(beh ? beh.name : 'Behavior Analytics');
        } else {
          setChartTitle('Behavior Analytics');
        }
      }
    }
  }, [activeCategoryTab, currentSelectedProgram, selectedBehaviorIds, allBehaviors, isEditingTitle]);

  // Reset average & trend lines when target context switches (Section 13.5 & 14.3)
  useEffect(() => {
    setShowAverageLine(false);
    setShowTrendLine(false);
    setSplitByTherapist(false);
  }, [selectedProgramId, selectedBehaviorIds, activeTargetType]);

  // Targets in the currently selected target type tab
  const tabTargets = useMemo(() => {
    return activeTargets.filter(t => t.type === activeTargetType && visibleTargetIds.has(t.id));
  }, [activeTargets, activeTargetType, visibleTargetIds]);

  // Filter raw sessions based on duration, client, and targets
  const filteredSessions = useMemo(() => {
    if (!client || activeTargets.length === 0) return [];

    const targetIdList = activeTargets.map(t => t.id);
    let list = sessions.filter(s => s.clientId === client.id && targetIdList.includes(s.targetId));

    // Duration filter calculation (Section 7.3)
    const now = new Date('2026-10-14T23:59:59');
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
      default: minDate.setMonth(now.getMonth() - 1); break;
    }

    list = list.filter(s => new Date(s.timestamp) >= minDate);
    list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Behavior Reduction missing data handling (Section 8.3)
    if (activeCategoryTab === 'Behavior') {
      if (!behaviorZeroOut) {
        list = list.filter(s => s.value !== 0 && s.value !== null);
      }
    }

    return list;
  }, [client, activeTargets, sessions, durationFilter, activeCategoryTab, behaviorZeroOut]);

  // Extract all unique therapists for the selected targets
  const allTherapistsForTarget = useMemo(() => {
    const set = new Set();
    filteredSessions.forEach(s => {
      if (s.therapistName) set.add(s.therapistName);
    });
    return Array.from(set);
  }, [filteredSessions]);

  // Initialize visible therapists
  useEffect(() => {
    setVisibleTherapists(new Set(allTherapistsForTarget));
  }, [allTherapistsForTarget]);

  // Process data points for Graph based on Aggregation and Target Type
  const chartSeriesData = useMemo(() => {
    if (tabTargets.length === 0 || filteredSessions.length === 0) return [];

    const therapistPalette = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

    // If Split by Therapist is enabled (Section 17) - only applies when single target is selected
    if (splitByTherapist && tabTargets.length === 1) {
      const tgt = tabTargets[0];
      return allTherapistsForTarget
        .filter(th => visibleTherapists.has(th))
        .map((therapist, tIdx) => {
          const thSessions = filteredSessions.filter(s => s.targetId === tgt.id && s.therapistName === therapist);
          const points = processAggregation(thSessions, aggregation, activeTargetType, durationView, rateView, frequencyView);
          return {
            id: `th-${therapist}`,
            name: therapist,
            color: colorMode === 'BlackAndWhite' ? '#333333' : therapistPalette[tIdx % therapistPalette.length],
            points
          };
        });
    }

    // Default: one series per target
    return tabTargets.map((tgt, idx) => {
      const tgtSessions = filteredSessions.filter(s => s.targetId === tgt.id);
      const points = processAggregation(tgtSessions, aggregation, activeTargetType, durationView, rateView, frequencyView);
      const defaultColor = colorMode === 'BlackAndWhite' 
        ? '#1E293B' 
        : (tgt.color || '#3B82F6');

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
    colorMode
  ]);

  // Calculate Overall Average & Trend Line parameters
  const { averageValue, trendlinePoints, regressionParams } = useMemo(() => {
    const allNumeric = [];
    chartSeriesData.forEach(series => {
      series.points.forEach(p => {
        if (p.val !== null && p.val !== undefined && !isNaN(p.val)) {
          allNumeric.push(p);
        }
      });
    });

    if (allNumeric.length === 0) {
      return { averageValue: null, trendlinePoints: null, regressionParams: null };
    }

    const avg = allNumeric.reduce((acc, curr) => acc + curr.val, 0) / allNumeric.length;

    // Trendline calculation (Section 14 & Future Scope)
    let trend = null;
    let regression = null;
    if (allNumeric.length >= 2) {
      const first = allNumeric[0];
      const last = allNumeric[allNumeric.length - 1];
      trend = { start: first, end: last };

      // Linear regression y = mx + c
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      const n = allNumeric.length;
      allNumeric.forEach((p, idx) => {
        sumX += idx;
        sumY += p.val;
        sumXY += idx * p.val;
        sumX2 += idx * idx;
      });
      const slope = (n * sumXY - sumX * sumY) / Math.max(1, (n * sumX2 - sumX * sumX));
      const intercept = (sumY - slope * sumX) / n;
      regression = { slope: slope.toFixed(2), intercept: intercept.toFixed(2) };
    }

    return {
      averageValue: Math.round(avg * 100) / 100,
      trendlinePoints: trend,
      regressionParams: regression
    };
  }, [chartSeriesData]);

  // Target-specific annotations (Section 10 & 11)
  // Hide when multiple behaviors are selected per Section 19.2
  const activeAnnotations = useMemo(() => {
    if (activeCategoryTab === 'Behavior' && selectedBehaviorIds.length > 1) {
      return { phaseLines: [], phaseRanges: [], graphNotes: [] };
    }
    const currentTargetId = tabTargets[0]?.id;
    return {
      phaseLines: (annotations.phaseLines || []).filter(p => !currentTargetId || p.targetId === currentTargetId),
      phaseRanges: (annotations.phaseRanges || []).filter(p => !currentTargetId || p.targetId === currentTargetId),
      graphNotes: (annotations.graphNotes || []).filter(p => !currentTargetId || p.targetId === currentTargetId)
    };
  }, [annotations, tabTargets, activeCategoryTab, selectedBehaviorIds]);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    if (onRefresh) onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleExport = (type) => {
    setShowExportMenu(false);
    if (type === 'svg') {
      exportSvgElement(svgRef.current, `${chartTitle.replace(/\s+/g, '_')}.svg`);
    } else if (type === 'png') {
      exportPngFromSvg(svgRef.current, `${chartTitle.replace(/\s+/g, '_')}.png`);
    } else if (type === 'raw-csv') {
      exportRawTrialDataCsv(filteredSessions, client?.name, tabTargets.map(t => t.name));
    } else if (type === 'zip') {
      exportStructuredZip({ clientName: client?.name || 'Client', programs, allRawRecords: sessions });
    }
  };

  // Helper function to format duration values as MM min SS sec
  const formatDurationVal = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')} min ${secs.toString().padStart(2, '0')} sec`;
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-xs mt-6 transition-opacity ${isDisabled ? 'opacity-40 pointer-events-none' : ''}`}>
      
      {/* 1. Header Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900">
              Section B: Client-Specific Program and Target Data
            </h2>
            <div className="relative group">
              <HelpCircle className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-pointer" />
              <div className="absolute left-0 top-6 hidden group-hover:block w-80 p-2.5 bg-slate-900 text-slate-100 text-xs rounded-lg shadow-lg z-20">
                Granular target-level analysis for Skill Acquisition and Behavior Reduction targets. Dynamic tabs adapt strictly to recorded target data.
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Target performance, phase change markers, rate views, and therapist breakdowns
          </p>
        </div>

        {/* Program / Behavior Selection Controls (Section 6.1 & 6.2) */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Category Tabs: Skill Acquisition vs Behavior */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveCategoryTab('SkillAcquisition')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeCategoryTab === 'SkillAcquisition' 
                  ? 'bg-white text-blue-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Skill Acquisition
            </button>
            <button
              onClick={() => setActiveCategoryTab('Behavior')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeCategoryTab === 'Behavior' 
                  ? 'bg-white text-red-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Behavior ({allBehaviors.length})
            </button>
          </div>

          {/* Program Dropdown (for Skill Acquisition) */}
          {activeCategoryTab === 'SkillAcquisition' ? (
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">-- Select Program --</option>
              {skillPrograms.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          ) : (
            /* Multi-Behavior Selection Dropdown (Section 19) */
            <div className="relative group">
              <button
                type="button"
                className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 flex items-center space-x-1"
              >
                <span>Selected Behaviors ({selectedBehaviorIds.length})</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>
              <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl p-2 z-30 hidden group-hover:block space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-0.5">
                  Select Multiple Behaviors (Section 19)
                </div>
                {allBehaviors.map(b => {
                  const isChecked = selectedBehaviorIds.includes(b.id);
                  return (
                    <label key={b.id} className="flex items-center space-x-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedBehaviorIds(selectedBehaviorIds.filter(id => id !== b.id));
                          } else {
                            setSelectedBehaviorIds([...selectedBehaviorIds, b.id]);
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span className="font-medium text-slate-700">{b.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Duration Filter Dropdown (Section 7.3) */}
          <select
            value={durationFilter}
            onChange={(e) => setDurationFilter(e.target.value)}
            className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="3 days">3 days</option>
            <option value="5 days">5 days</option>
            <option value="7 days">7 days</option>
            <option value="2 weeks">2 weeks</option>
            <option value="1 month">1 month</option>
            <option value="3 months">3 months</option>
            <option value="6 months">6 months</option>
            <option value="1 year">1 year</option>
            <option value="2 years">2 years</option>
          </select>

          {/* Export Controls (Section 7.4, 21 & Future Scope #1) */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center space-x-1"
              title="Export Options"
            >
              <Download className="w-4 h-4" />
              <ChevronDown className="w-3 h-3" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-30 text-xs">
                <div className="px-3 py-1 font-bold text-slate-400 uppercase text-[10px]">
                  Visual Exports
                </div>
                <button
                  onClick={() => handleExport('svg')}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-500" />
                  <span>Download SVG</span>
                </button>
                <button
                  onClick={() => handleExport('png')}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Download PNG (High-Res)</span>
                </button>
                <div className="border-t border-slate-100 my-1"></div>
                <div className="px-3 py-1 font-bold text-slate-400 uppercase text-[10px]">
                  Raw Data Exports
                </div>
                <button
                  onClick={() => handleExport('raw-csv')}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />
                  <span>Export Raw Data (CSV)</span>
                </button>
                <button
                  onClick={() => handleExport('zip')}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 font-medium"
                >
                  <Archive className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Multi-Target Structured Zip</span>
                </button>
              </div>
            )}
          </div>

          {/* Refresh Button (Section 7.5) */}
          <button
            onClick={handleRefreshClick}
            className={`p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors ${
              isRefreshing ? 'animate-spin text-blue-600' : ''
            }`}
            title="Refresh current graph data"
          >
            <RotateCw className="w-4 h-4" />
          </button>

        </div>
      </div>

      {/* 2. Target Type Tabs (Section 7 & 9.4) */}
      <div className="px-5 pt-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between overflow-x-auto">
        <div className="flex space-x-1 shrink-0">
          {availableTargetTypes.map(tType => {
            const labelMap = {
              TrialByTrial: 'Trial by Trial',
              Duration: 'Duration',
              Frequency: 'Frequency',
              IntervalData: 'Interval Data',
              Anecdotal: 'Anecdotal Data',
              FluencyRate: 'Fluency / Rate'
            };
            const isActive = activeTargetType === tType;
            return (
              <button
                key={tType}
                onClick={() => setActiveTargetType(tType)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                  isActive
                    ? 'border-blue-600 text-blue-600 bg-white shadow-2xs font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                }`}
              >
                {labelMap[tType] || tType}
              </button>
            );
          })}
        </div>

        {/* View Modifiers: Aggregation, Duration Views, Fluency Views, Therapist Split */}
        <div className="flex items-center space-x-2 pb-2 shrink-0 text-xs">
          
          {/* Aggregated Data Selector (Section 18.1) */}
          {activeTargetType !== 'Anecdotal' && (
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-semibold text-slate-500">Group:</span>
              <select
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 font-medium"
              >
                <option value="Per Day">Per Day</option>
                <option value="Per Session">Per Session</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>
          )}

          {/* Duration Specific View (Section 15) */}
          {activeTargetType === 'Duration' && (
            <select
              value={durationView}
              onChange={(e) => setDurationView(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 font-medium"
            >
              <option value="Total Duration">Total Duration</option>
              <option value="Total Count">Total Count</option>
              <option value="Average Duration">Average Duration</option>
            </select>
          )}

          {/* Fluency / Rate View (Section 6) */}
          {activeTargetType === 'FluencyRate' && (
            <select
              value={rateView}
              onChange={(e) => setRateView(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 font-medium"
            >
              <option value="Rate per Day">Rate per Day</option>
              <option value="Rate per Minute">Rate per Minute</option>
              <option value="Rate per Hour">Rate per Hour</option>
            </select>
          )}

          {/* Split Data by Therapist Toggle (Section 17) */}
          {activeTargetType !== 'Anecdotal' && tabTargets.length === 1 && (
            <label className="flex items-center space-x-1.5 cursor-pointer bg-white px-2 py-1 rounded border border-slate-300 select-none">
              <input
                type="checkbox"
                checked={splitByTherapist}
                onChange={(e) => setSplitByTherapist(e.target.checked)}
                className="rounded text-blue-600 border-slate-300"
              />
              <span className="text-[11px] font-semibold text-slate-700">Split by Therapist</span>
            </label>
          )}

        </div>
      </div>

      {/* 3. Graph Action Bar: Overlays, Titles, Annotations */}
      {activeTargetType !== 'Anecdotal' && (
        <div className="px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Chart Title Customization (Section 10.1 & 20) */}
          <div className="flex items-center space-x-2">
            {isEditingTitle ? (
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  value={chartTitle}
                  onChange={(e) => setChartTitle(e.target.value)}
                  className="bg-white border border-blue-400 rounded px-2 py-0.5 text-xs font-bold text-slate-900"
                />
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="px-2 py-0.5 bg-blue-600 text-white rounded text-[11px] font-semibold"
                >
                  Update
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 group cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                <span className="font-bold text-slate-800 text-sm">{chartTitle}</span>
                <Edit3 className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
              </div>
            )}
            {activeCategoryTab === 'Behavior' && selectedBehaviorIds.length > 1 && (
              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                Multi-Behavior Comparative View
              </span>
            )}
          </div>

          {/* Overlays: Average Line, Trend Line, Gridlines, Annotations */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Average Line Toggle (Section 13) */}
            <label className={`flex items-center space-x-1 px-2 py-1 rounded border transition-colors cursor-pointer select-none ${
              showAverageLine ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold' : 'bg-white border-slate-200 text-slate-600'
            }`}>
              <input
                type="checkbox"
                checked={showAverageLine}
                onChange={(e) => setShowAverageLine(e.target.checked)}
                className="hidden"
              />
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Average Line {averageValue !== null && showAverageLine ? `(${averageValue})` : ''}</span>
            </label>

            {/* Trend Line Toggle (Section 14) */}
            <label className={`flex items-center space-x-1 px-2 py-1 rounded border transition-colors cursor-pointer select-none ${
              showTrendLine ? 'bg-indigo-50 border-indigo-300 text-indigo-800 font-bold' : 'bg-white border-slate-200 text-slate-600'
            }`}>
              <input
                type="checkbox"
                checked={showTrendLine}
                onChange={(e) => setShowTrendLine(e.target.checked)}
                className="hidden"
              />
              <TrendingUp className="w-3 h-3 text-indigo-600" />
              <span>Trend Line {regressionParams && showTrendLine ? `(y=${regressionParams.slope}x+${regressionParams.intercept})` : ''}</span>
            </label>

            {/* Gridline Toggle (Section 10.2) */}
            <button
              onClick={() => setShowGridlines(!showGridlines)}
              className={`px-2 py-1 rounded border transition-colors ${
                showGridlines ? 'bg-slate-200 text-slate-800' : 'bg-white border-slate-200 text-slate-500'
              }`}
              title="Toggle Gridlines"
            >
              Gridlines
            </button>

            {/* Color Mode Toggle (Section 10.3) */}
            <button
              onClick={() => setColorMode(colorMode === 'System' ? 'BlackAndWhite' : 'System')}
              className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 hover:text-slate-900"
              title="Toggle Color Mode (System vs Black & White)"
            >
              {colorMode === 'System' ? 'Color' : 'B&W'}
            </button>

            {/* Annotation Add Buttons (Section 10.4, 10.6, 10.8) */}
            {activeCategoryTab !== 'Behavior' || selectedBehaviorIds.length <= 1 ? (
              <div className="flex items-center space-x-1 border-l border-slate-200 pl-2">
                <button
                  onClick={onAddPhaseLineClick}
                  className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 font-semibold"
                >
                  <Plus className="w-3 h-3" />
                  <span>Phase Line</span>
                </button>
                <button
                  onClick={onAddPhaseRangeClick}
                  className="flex items-center space-x-1 px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-200 font-semibold"
                >
                  <Plus className="w-3 h-3" />
                  <span>Phase Range</span>
                </button>
                <button
                  onClick={onAddGraphNoteClick}
                  className="flex items-center space-x-1 px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded border border-amber-200 font-semibold"
                >
                  <Plus className="w-3 h-3" />
                  <span>Note</span>
                </button>
              </div>
            ) : null}

          </div>

        </div>
      )}

      {/* 4. Chart Visualization Area */}
      <div className="p-4 sm:p-5">
        {activeTargets.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-sm font-semibold text-slate-600">Please select at least one program to view the data.</p>
            <p className="text-xs text-slate-400 mt-1">Select from the dropdown above to load associated target graphs.</p>
          </div>
        ) : availableTargetTypes.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-sm font-semibold text-slate-600">No recorded data available for this selection.</p>
            <p className="text-xs text-slate-400 mt-1">Record a session trial to visualize graphs.</p>
          </div>
        ) : activeTargetType === 'Anecdotal' ? (
          /* Anecdotal Data Qualitative Table View (Section 5) */
          <AnecdotalTableView
            client={client}
            targets={activeTargets.filter(t => t.type === 'Anecdotal')}
            sessions={filteredSessions.filter(s => s.qualitativeEntry)}
            durationFilter={durationFilter}
            onFilterChange={setDurationFilter}
          />
        ) : (
          /* Quantitative SVG Chart (Trial by trial, Duration, Frequency, Interval, Fluency) */
          <QuantitativeSvgChart
            ref={svgRef}
            seriesData={chartSeriesData}
            targetType={activeTargetType}
            durationView={durationView}
            rateView={rateView}
            showAverageLine={showAverageLine}
            averageValue={averageValue}
            showTrendLine={showTrendLine}
            trendlinePoints={trendlinePoints}
            regressionParams={regressionParams}
            showGridlines={showGridlines}
            colorMode={colorMode}
            annotations={activeAnnotations}
            aggregation={aggregation}
            formatDurationVal={formatDurationVal}
          />
        )}
      </div>

      {/* 5. Chart Footer Section (Section 12: Target Legend & Annotation Summary) */}
      <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/60 rounded-b-xl text-xs space-y-4">
        
        {/* Target Legend with Checkboxes (Section 12.1) */}
        <div>
          <span className="font-bold text-slate-700 block mb-2 uppercase text-[10px] tracking-wider">
            Target Visibility Control (Legend):
          </span>
          <div className="flex flex-wrap gap-2.5">
            {activeTargets.map(tgt => {
              const isChecked = visibleTargetIds.has(tgt.id);
              return (
                <button
                  key={tgt.id}
                  onClick={() => {
                    const next = new Set(visibleTargetIds);
                    if (isChecked) next.delete(tgt.id);
                    else next.add(tgt.id);
                    setVisibleTargetIds(next);
                  }}
                  className={`flex items-center space-x-2 px-2.5 py-1 rounded-md border text-xs transition-colors ${
                    isChecked ? 'bg-white border-slate-300 font-semibold shadow-2xs' : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-xs shrink-0"
                    style={{ backgroundColor: colorMode === 'BlackAndWhite' ? '#333333' : (tgt.color || '#3B82F6') }}
                  ></span>
                  <span>{tgt.name}</span>
                  {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Therapist Legend when Split by Therapist is active (Section 17.4) */}
        {splitByTherapist && tabTargets.length === 1 && (
          <div>
            <span className="font-bold text-slate-700 block mb-2 uppercase text-[10px] tracking-wider">
              Therapist Contributors (Split View):
            </span>
            <div className="flex flex-wrap gap-2">
              {allTherapistsForTarget.map(th => {
                const isChecked = visibleTherapists.has(th);
                return (
                  <button
                    key={th}
                    onClick={() => {
                      const next = new Set(visibleTherapists);
                      if (isChecked) next.delete(th);
                      else next.add(th);
                      setVisibleTherapists(next);
                    }}
                    className={`flex items-center space-x-2 px-2.5 py-1 rounded border text-xs ${
                      isChecked ? 'bg-white border-slate-300 font-semibold' : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>{th}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Consolidated Annotation Summary (Section 12.3 & 12.4) */}
        {(activeAnnotations.phaseLines.length > 0 || activeAnnotations.phaseRanges.length > 0 || activeAnnotations.graphNotes.length > 0) && (
          <div className="pt-3 border-t border-slate-200/80">
            <span className="font-bold text-slate-700 block mb-2 uppercase text-[10px] tracking-wider">
              Added Annotations & Milestones (Edit / Remove):
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* Phase Change Lines */}
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800 text-[11px] block mb-1">
                  Phase Change Lines ({activeAnnotations.phaseLines.length})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {activeAnnotations.phaseLines.map(line => (
                    <div key={line.id} className="flex items-center justify-between text-[11px] p-1.5 bg-slate-50 rounded border border-slate-100">
                      <div>
                        <span className="font-semibold text-slate-800 block">{line.label}</span>
                        <span className="text-[10px] text-slate-500">{line.date} • {line.style}</span>
                      </div>
                      <button
                        onClick={() => onDeletePhaseLine(line.id)}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title="Delete Phase Line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phase Ranges */}
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800 text-[11px] block mb-1">
                  Phase Ranges ({activeAnnotations.phaseRanges.length})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {activeAnnotations.phaseRanges.map(range => (
                    <div key={range.id} className="flex items-center justify-between text-[11px] p-1.5 bg-slate-50 rounded border border-slate-100">
                      <div>
                        <span className="font-semibold text-slate-800 block">{range.label}</span>
                        <span className="text-[10px] text-slate-500">{range.startDate} to {range.endDate}</span>
                      </div>
                      <button
                        onClick={() => onDeletePhaseRange(range.id)}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title="Delete Phase Range"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Graph Notes */}
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800 text-[11px] block mb-1">
                  Graph Notes ({activeAnnotations.graphNotes.length})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {activeAnnotations.graphNotes.map(note => (
                    <div key={note.id} className="flex items-center justify-between text-[11px] p-1.5 bg-slate-50 rounded border border-slate-100">
                      <div>
                        <span className="text-slate-700 block line-clamp-1 font-medium">{note.noteText}</span>
                        <span className="text-[10px] text-slate-400">{note.date} • {note.staffName}</span>
                      </div>
                      <button
                        onClick={() => onDeleteGraphNote(note.id)}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title="Delete Note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
}

// ----------------------------------------------------
// Subcomponent: Quantitative SVG Chart Engine
// ----------------------------------------------------
const QuantitativeSvgChart = React.forwardRef(function QuantitativeSvgChart({
  seriesData = [],
  targetType,
  durationView,
  rateView,
  showAverageLine,
  averageValue,
  showTrendLine,
  trendlinePoints,
  regressionParams,
  showGridlines,
  colorMode,
  annotations,
  aggregation,
  formatDurationVal
}, ref) {

  // If no targets visible, render blank state (Section 12.2)
  if (seriesData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-xs italic bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
        All targets deselected. Check targets in legend below to plot.
      </div>
    );
  }

  // Dimensions
  const width = 850;
  const height = 340;
  const padding = { top: 35, right: 35, bottom: 45, left: 65 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Collect all unique X categories (dates or sessions)
  const allXKeysSet = new Set();
  seriesData.forEach(s => s.points.forEach(p => allXKeysSet.add(p.xKey)));
  const sortedXKeys = Array.from(allXKeysSet).sort();

  if (sortedXKeys.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-xs bg-slate-50/50 rounded-lg">
        No recorded trials found for this target type within the selected filter.
      </div>
    );
  }

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

  const getY = (val) => {
    return padding.top + graphHeight - (Math.min(val, maxY) / maxY) * graphHeight;
  };

  // Y-axis label by target type
  const getYAxisLabel = () => {
    if (targetType === 'TrialByTrial') return '% Correct Responses';
    if (targetType === 'IntervalData') return '% Correct Intervals';
    if (targetType === 'Duration') return durationView;
    if (targetType === 'FluencyRate') return rateView;
    if (targetType === 'Frequency') return 'Occurrences (Count)';
    return 'Value';
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[700px]">
        <svg
          ref={ref}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto bg-slate-50/40 rounded-lg border border-slate-100"
        >
          {/* Phase Ranges (Shaded vertical bands - Section 10.8) */}
          {(annotations?.phaseRanges || []).map((range, idx) => {
            const startX = getX(range.startDate);
            const endX = getX(range.endDate);
            const bandWidth = Math.max(12, Math.abs(endX - startX));
            return (
              <g key={range.id || idx}>
                <rect
                  x={Math.min(startX, endX)}
                  y={padding.top}
                  width={bandWidth}
                  height={graphHeight}
                  fill={range.color || 'rgba(147, 197, 253, 0.25)'}
                />
                <text
                  x={Math.min(startX, endX) + bandWidth / 2}
                  y={padding.top + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fill="#1E40AF"
                  fontFamily="sans-serif"
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
                    stroke="#E2E8F0"
                    strokeDasharray="3 3"
                  />
                )}
                <text
                  x={padding.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="#64748B"
                  fontFamily="sans-serif"
                >
                  {targetType === 'Duration' && durationView === 'Total Duration' ? `${Math.round(val / 60)}m` : val}
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
            fontSize="11"
            fontWeight="bold"
            fill="#475569"
            fontFamily="sans-serif"
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
                stroke="#10B981"
                strokeWidth="2"
                strokeDasharray="5 3"
              />
              <rect
                x={width - padding.right - 100}
                y={getY(averageValue) - 18}
                width="95"
                height="16"
                rx="3"
                fill="#10B981"
              />
              <text
                x={width - padding.right - 52}
                y={getY(averageValue) - 6}
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill="#FFFFFF"
                fontFamily="sans-serif"
              >
                Avg: {averageValue}
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
                stroke="#6366F1"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              <title>Trend Line (Directional Path)</title>
            </g>
          )}

          {/* Phase Change Lines (Section 10.4 & 11) */}
          {(annotations?.phaseLines || []).map((line, idx) => {
            const lx = getX(line.date);
            return (
              <g key={line.id || idx}>
                <line
                  x1={lx}
                  y1={padding.top}
                  x2={lx}
                  y2={padding.top + graphHeight}
                  stroke={line.color || '#2563EB'}
                  strokeWidth="2.5"
                  strokeDasharray={line.style === 'Dotted' ? '4 3' : undefined}
                />
                <rect
                  x={lx - 4}
                  y={padding.top + 2}
                  width="110"
                  height="16"
                  rx="3"
                  fill="#1E293B"
                  opacity="0.85"
                />
                <text
                  x={lx + 2}
                  y={padding.top + 13}
                  fontSize="9"
                  fontWeight="bold"
                  fill="#FFFFFF"
                  fontFamily="sans-serif"
                >
                  {line.label}
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
                    <g key={idx} className="cursor-pointer group">
                      <rect
                        x={px - 4.5}
                        y={py - 4.5}
                        width="9"
                        height="9"
                        fill="#FFFFFF"
                        stroke={series.color}
                        strokeWidth="2"
                        className="transition-transform group-hover:scale-150"
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
            const nx = getX(note.date);
            return (
              <g key={note.id || idx} className="cursor-pointer group">
                <circle
                  cx={nx}
                  cy={height - padding.bottom + 8}
                  r="6"
                  fill={note.color || '#F59E0B'}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
                <text
                  x={nx}
                  y={height - padding.bottom + 11.5}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="bold"
                  fill="#FFFFFF"
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
                y={height - padding.bottom + 18}
                textAnchor="middle"
                fontSize="9.5"
                fill="#64748B"
                fontFamily="sans-serif"
              >
                {aggregation === 'Per Session' ? `S${xKey}` : xKey.substring(5)}
              </text>
            );
          })}

          {/* X-Axis Dimension Title */}
          <text
            x={padding.left + graphWidth / 2}
            y={height - 8}
            textAnchor="middle"
            fontSize="11"
            fontWeight="bold"
            fill="#475569"
            fontFamily="sans-serif"
          >
            {aggregation === 'Per Session' ? 'Session Timeline' : 'Observation Date'}
          </text>
        </svg>
      </div>
    </div>
  );
});

// ----------------------------------------------------
// Subcomponent: Anecdotal Qualitative Table (Section 5)
// ----------------------------------------------------
function AnecdotalTableView({ targets, sessions, durationFilter, onFilterChange }) {
  const [selectedTargetId, setSelectedTargetId] = useState('All');

  // Filter entries
  const visibleEntries = useMemo(() => {
    let list = sessions;
    if (selectedTargetId !== 'All') {
      list = list.filter(s => s.targetId === selectedTargetId);
    }
    return list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [sessions, selectedTargetId]);

  return (
    <div className="space-y-4">
      {/* Header Row: All Targets (XX) and Filters (Section 5.2 & 5.3) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-800 text-sm">
            All Targets ({visibleEntries.length})
          </span>
          <span className="text-xs text-slate-500">Qualitative narrative entries</span>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-slate-600">Target Filter:</span>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
            >
              <option value="All">All Targets</option>
              {targets.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {visibleEntries.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <p className="text-sm font-semibold text-slate-600">No anecdotal data available for the selected filters.</p>
        </div>
      ) : (
        /* Table Groups by Target Name (Section 5.1 & 5.4) */
        targets
          .filter(t => selectedTargetId === 'All' || t.id === selectedTargetId)
          .map(tgt => {
            const targetEntries = visibleEntries.filter(e => e.targetId === tgt.id);
            if (targetEntries.length === 0) return null;

            return (
              <div key={tgt.id} className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
                {/* Target Name Header Block */}
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200">
                  <span className="font-bold text-slate-900 text-xs block">{tgt.name}</span>
                  <span className="text-[11px] text-slate-500 italic">{tgt.description}</span>
                </div>

                {/* Structured Columns */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2 px-4 w-44">Date & Timestamp</th>
                        <th className="py-2 px-4 w-44">Staff Name</th>
                        <th className="py-2 px-4">Entry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {targetEntries.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-4 font-mono text-slate-600">{row.timestamp}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-800">{row.therapistName}</td>
                          <td className="py-2.5 px-4 text-slate-700 leading-relaxed font-normal">{row.qualitativeEntry}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
      )}
    </div>
  );
}

// ----------------------------------------------------
// Aggregation & Metric Calculation Helpers
// ----------------------------------------------------
function processAggregation(sessions, aggregation, targetType, durationView, rateView, frequencyView) {
  if (sessions.length === 0) return [];

  if (aggregation === 'Per Session') {
    // Group by Session Number (Section 18.2)
    const map = new Map();
    sessions.forEach(s => {
      const sNum = s.sessionNumber || 1;
      if (!map.has(sNum)) map.set(sNum, []);
      map.get(sNum).push(s);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([sNum, sList]) => {
        return calculateMetricPoint(sNum.toString(), sList, targetType, durationView, rateView, frequencyView);
      });
  }

  if (aggregation === 'Weekly') {
    // Group Monday to Sunday (Section 18.3)
    const map = new Map();
    sessions.forEach(s => {
      const dt = new Date(s.timestamp);
      const mon = getMonday(dt);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const key = `${mon.toISOString().substring(5, 10)} to ${sun.toISOString().substring(5, 10)}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });

    return Array.from(map.entries()).map(([wKey, sList]) => {
      return calculateMetricPoint(wKey, sList, targetType, durationView, rateView, frequencyView);
    });
  }

  if (aggregation === 'Monthly') {
    // Group Calendar Month (Section 18.4)
    const map = new Map();
    sessions.forEach(s => {
      const key = s.timestamp.substring(0, 7); // YYYY-MM
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });

    return Array.from(map.entries()).map(([mKey, sList]) => {
      return calculateMetricPoint(mKey, sList, targetType, durationView, rateView, frequencyView);
    });
  }

  // Default: Per Day (Section 18.1.1)
  const map = new Map();
  sessions.forEach(s => {
    const dKey = s.timestamp.substring(0, 10);
    if (!map.has(dKey)) map.set(dKey, []);
    map.get(dKey).push(s);
  });

  return Array.from(map.entries()).map(([dKey, sList]) => {
    return calculateMetricPoint(dKey, sList, targetType, durationView, rateView, frequencyView);
  });
}

function calculateMetricPoint(xKey, sList, targetType, durationView, rateView, frequencyView) {
  const therapists = Array.from(new Set(sList.map(s => s.therapistName))).join(', ');

  // 1. Trial by Trial (% accuracy + fraction badge)
  if (targetType === 'TrialByTrial') {
    const totalTrials = sList.reduce((acc, s) => acc + (s.totalTrials || 1), 0);
    const correctCount = sList.reduce((acc, s) => acc + (s.correctCount || 0), 0);
    const pct = totalTrials > 0 ? Math.round((correctCount / totalTrials) * 100) : 0;
    return {
      xKey,
      val: pct,
      displayVal: `${pct}% (${correctCount}/${totalTrials})`,
      therapist: therapists
    };
  }

  // 2. Duration (Total Duration, Total Count, Average Duration - Section 15)
  if (targetType === 'Duration') {
    const totalSecs = sList.reduce((acc, s) => acc + (s.durationSeconds || s.value || 0), 0);
    const count = sList.length;
    let computedVal = totalSecs;

    if (durationView === 'Total Count') {
      computedVal = count;
      return { xKey, val: count, displayVal: `${count} entries`, therapist: therapists };
    } else if (durationView === 'Average Duration') {
      const avgSecs = count > 0 ? Math.round(totalSecs / count) : 0;
      const mins = Math.floor(avgSecs / 60);
      const secs = avgSecs % 60;
      return {
        xKey,
        val: avgSecs,
        displayVal: `${mins.toString().padStart(2, '0')} min ${secs.toString().padStart(2, '0')} sec`,
        therapist: therapists
      };
    } else {
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      return {
        xKey,
        val: totalSecs,
        displayVal: `${mins.toString().padStart(2, '0')} min ${secs.toString().padStart(2, '0')} sec`,
        therapist: therapists
      };
    }
  }

  // 3. Fluency / Rate (Rate per Day, Rate per Minute, Rate per Hour - Section 6)
  if (targetType === 'FluencyRate') {
    const totalOccurrences = sList.reduce((acc, s) => acc + (s.occurrenceCount || s.value || 0), 0);
    const totalMins = sList.reduce((acc, s) => acc + (s.lessonDurationMinutes || 7), 0);

    if (rateView === 'Rate per Minute') {
      const val = totalMins > 0 ? Math.round((totalOccurrences / totalMins) * 100) / 100 : 0;
      return { xKey, val, displayVal: `${val} (${totalOccurrences} in ${totalMins} min)`, therapist: therapists };
    } else if (rateView === 'Rate per Hour') {
      const val = totalMins > 0 ? Math.round(((60 / totalMins) * totalOccurrences) * 100) / 100 : 0;
      return { xKey, val, displayVal: `${val} (${totalOccurrences} in ${totalMins} min)`, therapist: therapists };
    } else {
      return { xKey, val: totalOccurrences, displayVal: `${totalOccurrences} occurrences`, therapist: therapists };
    }
  }

  // 4. Frequency
  if (targetType === 'Frequency') {
    const totalCount = sList.reduce((acc, s) => acc + (s.occurrenceCount ?? s.value ?? 0), 0);
    return { xKey, val: totalCount, displayVal: `${totalCount} occurrences`, therapist: therapists };
  }

  // 5. Interval Data (% intervals occurred + count)
  if (targetType === 'IntervalData') {
    const total = sList.reduce((acc, s) => acc + (s.totalTrials || 20), 0);
    const occurred = sList.reduce((acc, s) => acc + (s.correctCount || 0), 0);
    const pct = total > 0 ? Math.round((occurred / total) * 100) : 0;
    return {
      xKey,
      val: pct,
      displayVal: `${pct}% (${occurred}/${total} intervals)`,
      therapist: therapists
    };
  }

  const rawVal = sList.reduce((acc, s) => acc + (s.value || 0), 0);
  return { xKey, val: rawVal, displayVal: rawVal.toString(), therapist: therapists };
}

function getMonday(d) {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}
