import { useRef } from 'react';
import SectionHeader from './ui/SectionHeader';
import ExportMenu from './ui/ExportMenu';
import EmptyState from './ui/EmptyState';
import { CheckCircle2 } from './ui/Icons';
import { formatChartDate, CHART_GRID, CHART_MUTED, CHART_INK } from '../utils/chartTheme';
import { ALL_PROGRAMS_ID } from '../utils/targetAnalytics';
import { exportMasteryCsv, exportSvgElement, exportPngFromSvg } from '../utils/exportUtils';

const MASTERED_PHASES = ['Maintenance', 'Generalization', 'Completed'];

// Skill mastery: how mastered targets accumulate. Phase 2 adds an "All programs" aggregate so
// the section answers the client-level question rather than defaulting to whichever skill
// program sorts first, and takes the overview's shared time range so the transitions it plots
// match the KPI strip and timeline above it. Both are derived views — no new entity, no change
// to any target's phase or phase history.
export default function OverallMasterySection({
  programs = [], selectedProgramId, onSelectProgram, masteryData = [],
  rangePhrase = 'the last 90 days'
}) {
  const svgRef = useRef(null);
  const skillPrograms = programs.filter(program => program.category === 'SkillAcquisition');
  const isAll = selectedProgramId === ALL_PROGRAMS_ID;
  const selectedProgram = isAll ? null : skillPrograms.find(program => program.id === selectedProgramId);
  const chartTitle = isAll ? 'All skill programs' : selectedProgram?.name;
  const scopedPrograms = isAll ? skillPrograms : selectedProgram ? [selectedProgram] : [];
  const scopedTargets = scopedPrograms.flatMap(program => program.targets);
  const totalTargets = scopedTargets.length;
  // Mastered overall is a phase snapshot (all-time); the chart counts transitions inside the
  // range, so the two numbers are labelled separately rather than conflated.
  const masteredOverall = scopedTargets.filter(target => MASTERED_PHASES.includes(target.phase)).length;
  const count = masteryData.at(-1)?.cumulativeCount || 0;
  const latest = masteryData.at(-1);
  const width = 720;
  const height = 180;
  const padding = { top: 25, right: 35, bottom: 40, left: 45 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const maxVal = Math.max(2, totalTargets, count);
  const points = masteryData.map((data, index) => ({ ...data,
    x: padding.left + (masteryData.length > 1 ? index / (masteryData.length - 1) * graphWidth : graphWidth / 2),
    y: padding.top + graphHeight - data.cumulativeCount / maxVal * graphHeight
  }));
  const pathD = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');

  function handleExport(type) {
    if (!chartTitle || !masteryData.length) throw new Error('No mastery data to export');
    if (type === 'csv') return exportMasteryCsv(masteryData, chartTitle);
    if (type === 'svg') return exportSvgElement(svgRef.current, `Mastery_${chartTitle}.svg`);
    return exportPngFromSvg(svgRef.current, `Mastery_${chartTitle}.png`);
  }

  return <section className="panel" aria-labelledby="mastery-title">
    <SectionHeader id="mastery-title" title="Skill mastery" description={`How mastered targets accumulate over ${rangePhrase}.`}
      help="A target counts as mastered when it enters maintenance, generalization, or completed. This chart plots those transition dates inside the selected time range, not each session. Choose All programs to see the whole client, or one program to see its targets only."
      actions={<>
        <div className="control-field"><label htmlFor="mastery-prog">Program</label>
          <select id="mastery-prog" value={selectedProgramId || ALL_PROGRAMS_ID} onChange={event => onSelectProgram(event.target.value)}>
            <option value={ALL_PROGRAMS_ID}>All programs</option>
            {skillPrograms.map(program => <option key={program.id} value={program.id}>{program.name}</option>)}
          </select>
        </div>
        <ExportMenu label="Export mastery" disabled={!masteryData.length} onExport={handleExport}
          formats={[{ id: 'csv', label: 'Mastery data · CSV' }, { id: 'svg', label: 'Vector chart · SVG' }, { id: 'png', label: 'Chart image · PNG' }]} />
      </>} />
    {!skillPrograms.length ? <EmptyState title="No skill programs in this scope."
      description="Set the program scope at the top of the overview to All programs or Skill acquisition to see mastery here." />
      : !masteryData.length ? (masteredOverall === 0
        ? <EmptyState icon={CheckCircle2} title="Mastery is still ahead."
          description={`No targets in “${chartTitle}” have entered maintenance, generalization, or completed yet. Review session observations in target analysis below.`}
          action={{ label: 'Review target analysis', onClick: () => document.getElementById('target-analysis')?.scrollIntoView({ block: 'start' }) }} />
        : <EmptyState icon={CheckCircle2} title="No transitions in this range."
          description={`${masteredOverall} of ${totalTargets} targets are mastered overall, but no target entered maintenance, generalization or completed during ${rangePhrase}. Choose a longer time range to see those transitions.`} />)
      : <>
        <div className="mastery-content">
          <div className="mastery-summary">
            <dl><dt>Newly mastered in this range</dt><dd>{count}<small>/ {totalTargets} targets in view</small></dd></dl>
            <p>Mastered overall<strong>{masteredOverall} of {totalTargets} targets</strong></p>
            <p>Latest transition<strong>{formatChartDate(latest.date)}, {latest.date.slice(0, 4)}</strong>{latest.newlyMastered.join(' · ')}</p>
          </div>
          <div>
            <div className="chart-scroll" tabIndex={0} role="region" aria-label="Skill mastery chart. Scroll horizontally for the full timeline.">
              <div className="chart-inner chart-inner--mastery">
                <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img"
                  aria-label={`${chartTitle}: ${count} targets mastered during ${rangePhrase}; ${masteredOverall} of ${totalTargets} mastered overall.`}>
                  <title>Skill mastery over time</title><desc>A cumulative line chart for {rangePhrase}. The transition dates and mastered targets are also listed in the data table below.</desc>
                  {[0, Math.ceil(maxVal / 2), maxVal].map(value => {
                    const y = padding.top + graphHeight - value / maxVal * graphHeight;
                    return <g key={value}><line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={CHART_GRID} strokeDasharray="3 5" />
                      <text x={padding.left - 14} y={y + 4} textAnchor="end" fontSize="13" fill={CHART_MUTED} fontFamily="Geist, sans-serif">{value}</text>
                    </g>;
                  })}
                  <defs><linearGradient id="mastery-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34634c" stopOpacity="0.14" /><stop offset="100%" stopColor="#34634c" stopOpacity="0.02" />
                  </linearGradient></defs>
                  <path d={`${pathD} L ${points.at(-1).x} ${padding.top + graphHeight} L ${points[0].x} ${padding.top + graphHeight} Z`} fill="url(#mastery-fill)" />
                  <path className="mastery-trend-line" d={pathD} pathLength="1" strokeDasharray="1" strokeDashoffset="0"
                    fill="none" stroke="#34634c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {points.map(point => <g key={point.date}>
                    <circle cx={point.x} cy={point.y} r="5" fill="#fff" stroke="#34634c" strokeWidth="2.5" />
                    <text x={point.x} y={point.y - 14} textAnchor="middle" fontSize="14" fontWeight="600" fill="#294f3d" fontFamily="Geist, sans-serif">{point.cumulativeCount}</text>
                    <text x={point.x} y={height - padding.bottom + 25} textAnchor="middle" fontSize="13" fill={CHART_MUTED} fontFamily="Geist, sans-serif">{formatChartDate(point.date)}</text>
                    <title>{`${point.date}: ${point.cumulativeCount} mastered. Newly mastered: ${point.newlyMastered.join(', ')}`}</title>
                  </g>)}
                  <text x={padding.left} y={16} fontSize="12" fill={CHART_INK} fontFamily="Geist, sans-serif">Mastered targets</text>
                </svg>
              </div>
            </div>
            <div className="chart-caption"><span>Recorded mastery transitions in {rangePhrase}</span><span className="scroll-hint">Scroll to see the full chart →</span></div>
          </div>
        </div>
        <details className="chart-data mx-6 pb-3">
          <summary>View mastery data table</summary>
          <div className="data-table-scroll" tabIndex={0} role="region" aria-label="Mastery transition data">
            <table className="data-table"><caption className="sr-only">Mastery transitions for {chartTitle} during {rangePhrase}</caption>
              <thead><tr><th scope="col">Transition date</th><th scope="col">Targets mastered</th><th scope="col">Newly mastered targets</th></tr></thead>
              <tbody>{masteryData.map(row => <tr key={row.date}><td>{formatChartDate(row.date)}, {row.date.slice(0, 4)}</td><td>{row.cumulativeCount}</td><td>{row.newlyMastered.join(', ')}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </>}
  </section>;
}
