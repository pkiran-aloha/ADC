import React, { useState, useRef } from 'react';
import { 
  Download, 
  HelpCircle, 
  CheckCircle2, 
  ChevronDown, 
  AlertCircle,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon
} from 'lucide-react';
import { exportMasteryCsv, exportSvgElement, exportPngFromSvg } from '../utils/exportUtils';

export default function OverallMasterySection({
  programs = [],
  selectedProgramId,
  onSelectProgram,
  masteryData = [],
  isDisabled = false
}) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const svgRef = useRef(null);

  const selectedProgram = programs.find(p => p.id === selectedProgramId);

  // Filter only Skill Acquisition programs that make sense for cumulative mastery
  const skillPrograms = programs.filter(p => p.category === 'SkillAcquisition');

  const handleExport = (type) => {
    setShowExportMenu(false);
    if (!selectedProgram) return;

    if (type === 'csv') {
      exportMasteryCsv(masteryData, selectedProgram.name);
    } else if (type === 'svg') {
      exportSvgElement(svgRef.current, `Mastery_${selectedProgram.name}.svg`);
    } else if (type === 'png') {
      exportPngFromSvg(svgRef.current, `Mastery_${selectedProgram.name}.png`);
    }
  };

  // Dimensions for SVG Graph
  const width = 800;
  const height = 260;
  const padding = { top: 30, right: 30, bottom: 40, left: 50 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Max value for Y-axis (at least 5 for scale)
  const maxVal = Math.max(
    5,
    masteryData.reduce((max, d) => Math.max(max, d.cumulativeCount), 0) + 1
  );

  const points = masteryData.map((d, i) => {
    const x = padding.left + (masteryData.length > 1 ? (i / (masteryData.length - 1)) * graphWidth : graphWidth / 2);
    const y = padding.top + graphHeight - (d.cumulativeCount / maxVal) * graphHeight;
    return { ...d, x, y };
  });

  const pathD = points.length > 0 
    ? points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : '';

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-xs transition-opacity ${isDisabled ? 'opacity-40 pointer-events-none' : ''}`}>
      
      {/* Widget Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900">
              Section A: Overall Targets Mastered
            </h2>
            <div className="relative group">
              <HelpCircle className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-pointer" />
              <div className="absolute left-0 top-6 hidden group-hover:block w-72 p-2.5 bg-slate-900 text-slate-100 text-xs rounded-lg shadow-lg z-20">
                Tracks how targets progress into mastered states (Maintenance, Generalization, or Completed) over time. Only transition dates are plotted.
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cumulative progression of mastered skills within the selected program
          </p>
        </div>

        {/* Controls: Program Selector & Export */}
        <div className="flex items-center space-x-3 self-end sm:self-auto">
          <div className="flex items-center space-x-2">
            <label htmlFor="mastery-prog" className="text-xs font-semibold text-slate-600 hidden md:block">
              Select Program:
            </label>
            <select
              id="mastery-prog"
              value={selectedProgramId || ''}
              onChange={(e) => onSelectProgram(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">-- Choose Program --</option>
              {skillPrograms.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Export Dropdown (Section 5.7) */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={masteryData.length === 0}
              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1"
              title="Download Graph & Data"
            >
              <Download className="w-4 h-4" />
              <ChevronDown className="w-3 h-3" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 text-xs">
                <div className="px-3 py-1 font-bold text-slate-400 uppercase text-[10px]">
                  Image Formats
                </div>
                <button
                  onClick={() => handleExport('svg')}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-500" />
                  <span>Export SVG</span>
                </button>
                <button
                  onClick={() => handleExport('png')}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Export PNG</span>
                </button>
                <div className="border-t border-slate-100 my-1"></div>
                <div className="px-3 py-1 font-bold text-slate-400 uppercase text-[10px]">
                  Data Format
                </div>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />
                  <span>Export CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Graph Area / Empty State (Section 5.6) */}
      <div className="p-4 sm:p-5">
        {!selectedProgramId ? (
          <div className="py-12 text-center text-slate-400">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Please select a program to view cumulative mastery.</p>
            <p className="text-xs text-slate-400 mt-1">Choose from the dropdown in the top-right corner.</p>
          </div>
        ) : masteryData.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No data available.</p>
            <p className="text-xs text-slate-400 mt-1">
              Targets in "{selectedProgram?.name}" have not yet entered Maintenance, Generalization, or Completed states.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[650px]">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto bg-slate-50/50 rounded-lg border border-slate-100"
              >
                {/* Horizontal Gridlines & Y-Axis Labels */}
                {[0, Math.round(maxVal / 2), maxVal].map((val, idx) => {
                  const y = padding.top + graphHeight - (val / maxVal) * graphHeight;
                  return (
                    <g key={idx}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={width - padding.right}
                        y2={y}
                        stroke="#E2E8F0"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={padding.left - 10}
                        y={y + 4}
                        textAnchor="end"
                        fontSize="11"
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
                  Cumulative Mastered Targets
                </text>

                {/* Shaded Area Under Line */}
                {points.length > 0 && (
                  <path
                    d={`${pathD} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${points[0].x} ${padding.top + graphHeight} Z`}
                    fill="url(#masteryGradient)"
                  />
                )}

                <defs>
                  <linearGradient id="masteryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Connecting Trend Line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data Points (Section 5.3 & 5.4) */}
                {points.map((p, idx) => (
                  <g key={idx} className="cursor-pointer group">
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="5.5"
                      fill="#FFFFFF"
                      stroke="#2563EB"
                      strokeWidth="2.5"
                      className="transition-transform group-hover:scale-125"
                    />

                    {/* Value Badge above node */}
                    <text
                      x={p.x}
                      y={p.y - 10}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill="#1E40AF"
                      fontFamily="sans-serif"
                    >
                      {p.cumulativeCount}
                    </text>

                    {/* X-Axis Date Label */}
                    <text
                      x={p.x}
                      y={height - padding.bottom + 18}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#64748B"
                      fontFamily="sans-serif"
                    >
                      {p.date.substring(5)}
                    </text>

                    {/* Tooltip */}
                    <title>
                      {`Date: ${p.date}\nCumulative Mastered: ${p.cumulativeCount}\nNewly Mastered: ${(p.newlyMastered || []).join(', ')}`}
                    </title>
                  </g>
                ))}

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
                  Dates of Target Mastery Transitions
                </text>
              </svg>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
