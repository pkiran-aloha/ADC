import React, { useState, useMemo, useRef } from 'react';
import { 
  BarChart2, 
  Table as TableIcon, 
  LayoutList, 
  Download, 
  HelpCircle, 
  RotateCw, 
  AlertCircle,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon
} from 'lucide-react';
import { exportAbcDataCsv, exportSvgElement, exportPngFromSvg } from '../utils/exportUtils';
import { SEED_AS_OF_DATE } from '../data/mockData';

export default function AbcDataSection({
  client,
  abcEntries = [],
  abcConfiguration = null,
  isDisabled = false,
  onRefresh
}) {
  const [viewMode, setViewMode] = useState('Graph + Data'); // 'Graph', 'Data', 'Graph + Data'
  const [durationFilter, setDurationFilter] = useState('Past 1 Month');
  const [showGridlines, setShowGridlines] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const svgRef = useRef(null);

  // Palette for behavior types in stacked bar chart
  const behaviorColors = {
    'Vocal Disruption / Screaming': '#EF4444',
    'Elopement / Leaving Area': '#DC2626',
    'Property Disruption': '#F97316',
    'Task Refusal': '#8B5CF6',
    'Drop to Floor': '#EC4899',
    'Disruptive Vocalizations': '#B91C1C',
    'Bolting from Group': '#F97316',
    'Hand Biting': '#DC2626',
    'Repetitive Vocalizations': '#8B5CF6',
    'Other': '#64748B'
  };

  // Filter entries by duration
  const filteredEntries = useMemo(() => {
    if (!client || abcEntries.length === 0) return [];
    const now = new Date(`${SEED_AS_OF_DATE}T23:59:59`);
    let minDate = new Date(now);

    switch (durationFilter) {
      case 'Past 3 Days': minDate.setDate(now.getDate() - 3); break;
      case 'Past 5 Days': minDate.setDate(now.getDate() - 5); break;
      case 'Past 7 Days': minDate.setDate(now.getDate() - 7); break;
      case 'Past 1 Month': minDate.setMonth(now.getMonth() - 1); break;
      case 'Past 3 Months': minDate.setMonth(now.getMonth() - 3); break;
      case 'Past 6 Months': minDate.setMonth(now.getMonth() - 6); break;
      default: minDate.setMonth(now.getMonth() - 1); break;
    }

    return abcEntries
      .filter(e => new Date(e.timestamp) >= minDate)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [client, abcEntries, durationFilter]);

  // Aggregate by date and behavior for Stacked Bar Chart
  const { dateKeys, behaviorList, stackedData, maxTotal } = useMemo(() => {
    const datesMap = new Map();
    const behaviorsSet = new Set();

    filteredEntries.forEach(entry => {
      const dateKey = entry.timestamp.substring(0, 10);
      if (!datesMap.has(dateKey)) datesMap.set(dateKey, {});

      (entry.behaviors || ['Other']).forEach(beh => {
        behaviorsSet.add(beh);
        const current = datesMap.get(dateKey)[beh] || 0;
        datesMap.get(dateKey)[beh] = current + 1;
      });
    });

    const sortedDates = Array.from(datesMap.keys()).sort();
    const bList = Array.from(behaviorsSet);

    let maxDaySum = 0;
    const sData = sortedDates.map(date => {
      const counts = datesMap.get(date);
      let total = 0;
      const segments = bList.map(beh => {
        const count = counts[beh] || 0;
        total += count;
        return { behavior: beh, count };
      });
      if (total > maxDaySum) maxDaySum = total;
      return { date, total, segments };
    });

    return {
      dateKeys: sortedDates,
      behaviorList: bList,
      stackedData: sData,
      maxTotal: Math.max(5, maxDaySum + 1)
    };
  }, [filteredEntries]);

  const handleExport = (type) => {
    setShowExportMenu(false);
    if (!client) return;

    if (type === 'csv') {
      exportAbcDataCsv(filteredEntries, client.name);
    } else if (type === 'svg') {
      exportSvgElement(svgRef.current, `ABC_Data_${client.name}.svg`);
    } else if (type === 'png') {
      exportPngFromSvg(svgRef.current, `ABC_Data_${client.name}.png`);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (onRefresh) onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Dimensions for Stacked Bar Chart
  const width = 850;
  const height = 280;
  const padding = { top: 30, right: 30, bottom: 40, left: 55 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const barWidth = Math.min(36, Math.max(16, (graphWidth / Math.max(1, dateKeys.length)) * 0.6));

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-xs mt-6 transition-opacity ${isDisabled ? 'opacity-40 pointer-events-none' : ''}`}>
      
      {/* Section Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900">
              Section C: ABC Data Recording (ABCL Contextual Analysis)
            </h2>
            <div className="relative group">
              <HelpCircle className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-pointer" />
              <div className="absolute left-0 top-6 hidden group-hover:block w-80 p-2.5 bg-slate-900 text-slate-100 text-xs rounded-lg shadow-lg z-20">
                Antecedent–Behavior–Consequence–Location tracking. Combines behavior trend distribution with qualitative clinical context.
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Understand why behaviors occur using multi-layered sequence context and trend distribution
          </p>
        </div>

        {/* View Switcher & Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* 3 Interchangeable Views (Section 24.1) */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('Graph')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded transition-colors ${
                viewMode === 'Graph' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Graph</span>
            </button>
            <button
              onClick={() => setViewMode('Data')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded transition-colors ${
                viewMode === 'Data' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Data</span>
            </button>
            <button
              onClick={() => setViewMode('Graph + Data')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded transition-colors ${
                viewMode === 'Graph + Data' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Graph + Data</span>
            </button>
          </div>

          {/* Duration Filter (Section 24.6) */}
          <select
            value={durationFilter}
            onChange={(e) => setDurationFilter(e.target.value)}
            className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="Past 3 Days">Past 3 Days</option>
            <option value="Past 5 Days">Past 5 Days</option>
            <option value="Past 7 Days">Past 7 Days</option>
            <option value="Past 1 Month">Past 1 Month</option>
            <option value="Past 3 Months">Past 3 Months</option>
            <option value="Past 6 Months">Past 6 Months</option>
          </select>

          {/* Gridlines toggle (Section 24.7) */}
          {(viewMode === 'Graph' || viewMode === 'Graph + Data') && (
            <button
              onClick={() => setShowGridlines(!showGridlines)}
              className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                showGridlines ? 'bg-slate-200 text-slate-800' : 'bg-white border-slate-200 text-slate-500'
              }`}
              title="Toggle Gridlines"
            >
              Gridlines
            </button>
          )}

          {/* Export Menu (Section 24.9) */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center space-x-1"
              title="Export Raw Data"
            >
              <Download className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-30 text-xs">
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 font-semibold"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />
                  <span>Export Raw Data (CSV)</span>
                </button>
                <div className="border-t border-slate-100 my-1"></div>
                <button
                  onClick={() => handleExport('svg')}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-500" />
                  <span>Export Chart (SVG)</span>
                </button>
                <button
                  onClick={() => handleExport('png')}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Export Chart (PNG)</span>
                </button>
              </div>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className={`p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors ${
              isRefreshing ? 'animate-spin text-blue-600' : ''
            }`}
            title="Reload ABC data"
          >
            <RotateCw className="w-4 h-4" />
          </button>

        </div>
      </div>

      {abcConfiguration && (
        <details className="px-5 py-3 border-b border-slate-200 bg-blue-50/40 text-xs text-slate-700">
          <summary className="cursor-pointer font-semibold text-slate-800">
            ABC recording setup · {abcConfiguration.treatmentArea}
            <span className="ml-2 text-blue-700">(view teaching instructions &amp; configured lists)</span>
          </summary>
          <p className="mt-3"><strong>Teaching instructions:</strong> {abcConfiguration.teachingInstructions}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            {[
              ['Antecedents', abcConfiguration.antecedents],
              ['Behaviors', abcConfiguration.behaviors],
              ['Consequences', abcConfiguration.consequences],
              ['Locations', abcConfiguration.locations]
            ].map(([label, values]) => (
              <div key={label} className="p-3 rounded-lg bg-white border border-slate-200">
                <strong>{label}</strong>
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  {values.map(value => <li key={value}>{value}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Main Content Area */}
      <div className="p-4 sm:p-5 space-y-6">
        {filteredEntries.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No data found for selected date range.</p>
            <p className="text-xs text-slate-400 mt-1">Try expanding the duration filter above.</p>
          </div>
        ) : (
          <>
            {/* 1. Stacked Bar Chart (Graph View - Section 24.2) */}
            {(viewMode === 'Graph' || viewMode === 'Graph + Data') && (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[700px]">
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-auto bg-slate-50/40 rounded-lg border border-slate-100"
                  >
                    {/* Y-Axis Gridlines */}
                    {[0, Math.round(maxTotal / 2), maxTotal].map((val, idx) => {
                      const y = padding.top + graphHeight - (val / maxTotal) * graphHeight;
                      return (
                        <g key={idx}>
                          {showGridlines && (
                            <line
                              x1={padding.left}
                              y1={y}
                              x2={width - padding.right}
                              y2={y}
                              stroke="#E2E8F0"
                              strokeDasharray="4 4"
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
                            {val}
                          </text>
                        </g>
                      );
                    })}

                    {/* Y-Axis Title */}
                    <text
                      x={-(padding.top + graphHeight / 2)}
                      y="16"
                      transform="rotate(-90)"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="bold"
                      fill="#475569"
                      fontFamily="sans-serif"
                    >
                      Total Behaviors Recorded
                    </text>

                    {/* Stacked Bars */}
                    {stackedData.map((dayData, dIdx) => {
                      const cx = padding.left + (stackedData.length > 1
                        ? (dIdx / (stackedData.length - 1)) * (graphWidth - barWidth) + barWidth / 2
                        : graphWidth / 2);

                      let currentY = padding.top + graphHeight;

                      return (
                        <g key={dayData.date}>
                          {dayData.segments.map((seg, sIdx) => {
                            if (seg.count === 0) return null;
                            const segHeight = (seg.count / maxTotal) * graphHeight;
                            const sy = currentY - segHeight;
                            currentY = sy;
                            const fill = behaviorColors[seg.behavior] || '#64748B';

                            return (
                              <g key={sIdx} className="cursor-pointer group">
                                <rect
                                  x={cx - barWidth / 2}
                                  y={sy}
                                  width={barWidth}
                                  height={segHeight}
                                  fill={fill}
                                  rx="2"
                                  className="transition-opacity hover:opacity-85"
                                />
                                <title>
                                  {`Date: ${dayData.date}\nBehavior: ${seg.behavior}\nCount: ${seg.count}`}
                                </title>
                              </g>
                            );
                          })}

                          {/* Day Total Count above bar */}
                          <text
                            x={cx}
                            y={currentY - 6}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="bold"
                            fill="#1E293B"
                            fontFamily="sans-serif"
                          >
                            {dayData.total}
                          </text>

                          {/* X-Axis Date */}
                          <text
                            x={cx}
                            y={height - padding.bottom + 18}
                            textAnchor="middle"
                            fontSize="9.5"
                            fill="#64748B"
                            fontFamily="sans-serif"
                          >
                            {dayData.date.substring(5)}
                          </text>
                        </g>
                      );
                    })}

                    {/* X-Axis Title */}
                    <text
                      x={padding.left + graphWidth / 2}
                      y={height - 6}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="bold"
                      fill="#475569"
                      fontFamily="sans-serif"
                    >
                      Session Dates
                    </text>
                  </svg>
                </div>

                {/* Stacked Bar Legend */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-3 text-xs">
                  {behaviorList.map(beh => (
                    <div key={beh} className="flex items-center space-x-1.5">
                      <span
                        className="w-3 h-3 rounded-xs shrink-0"
                        style={{ backgroundColor: behaviorColors[beh] || '#64748B' }}
                      ></span>
                      <span className="font-medium text-slate-700">{beh}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Structured Data Table (Data View - Section 24.3 & 24.5) */}
            {(viewMode === 'Data' || viewMode === 'Graph + Data') && (
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 whitespace-nowrap w-36">Date & Time</th>
                        <th className="py-2.5 px-3 whitespace-nowrap w-36">Therapist</th>
                        <th className="py-2.5 px-3">Antecedents</th>
                        <th className="py-2.5 px-3">Behaviors</th>
                        <th className="py-2.5 px-3">Consequences</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Location</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredEntries.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50/70">
                          {/* Date & Time */}
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {row.timestamp.replace('T', ' ').slice(0, 16)}
                          </td>

                          {/* Therapist */}
                          <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                            {row.therapist}
                          </td>

                          {/* Antecedents (Section 24.5: Visual separation with subtle darker border) */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1">
                              {row.antecedents.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block px-2 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-400 font-medium text-[11px]"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Behaviors */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1">
                              {row.behaviors.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-300 font-semibold text-[11px]"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Consequences */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1">
                              {row.consequences.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-medium text-[11px]"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Location */}
                          <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px]">
                              {row.location}
                            </span>
                          </td>

                          {/* Notes (always last column per Section 24.3) */}
                          <td className="py-2.5 px-3 text-slate-600 italic">
                            {row.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
