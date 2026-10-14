import { useRef } from 'react';
import SectionHeader from './ui/SectionHeader';
import ExportMenu from './ui/ExportMenu';
import EmptyState from './ui/EmptyState';
import { CheckCircle2 } from './ui/Icons';
import { formatChartDate, CHART_GRID, CHART_MUTED, CHART_INK } from '../utils/chartTheme';
import { exportMasteryCsv, exportSvgElement, exportPngFromSvg } from '../utils/exportUtils';

export default function OverallMasterySection({ programs = [], selectedProgramId, onSelectProgram, masteryData = [] }) {
  const svgRef = useRef(null);
  const selectedProgram = programs.find(program => program.id === selectedProgramId);
  const skillPrograms = programs.filter(program => program.category === 'SkillAcquisition');
  const count = masteryData.at(-1)?.cumulativeCount || 0;
  const latest = masteryData.at(-1);
  const width = 720;
  const height = 180;
  const padding = { top: 25, right: 35, bottom: 40, left: 45 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const maxVal = Math.max(2, selectedProgram?.targets.length || 0, count);
  const points = masteryData.map((data, index) => ({ ...data,
    x: padding.left + (masteryData.length > 1 ? index / (masteryData.length - 1) * graphWidth : graphWidth / 2),
    y: padding.top + graphHeight - data.cumulativeCount / maxVal * graphHeight
  }));
  const pathD = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');

  function handleExport(type) {
    if (!selectedProgram || !masteryData.length) throw new Error('No mastery data to export');
    if (type === 'csv') return exportMasteryCsv(masteryData, selectedProgram.name);
    if (type === 'svg') return exportSvgElement(svgRef.current, `Mastery_${selectedProgram.name}.svg`);
    return exportPngFromSvg(svgRef.current, `Mastery_${selectedProgram.name}.png`);
  }

  return <section className="panel" aria-labelledby="mastery-title">
    <SectionHeader id="mastery-title" title="Skill mastery" description="How mastered targets accumulate over time."
      help="A target counts as mastered when it enters maintenance, generalization, or completed. This chart plots those transition dates, not each session."
      actions={<>
        <div className="control-field"><label htmlFor="mastery-prog">Program</label>
          <select id="mastery-prog" value={selectedProgramId || ''} onChange={event => onSelectProgram(event.target.value)}>
            <option value="">Choose a program</option>
            {skillPrograms.map(program => <option key={program.id} value={program.id}>{program.name}</option>)}
          </select>
        </div>
        <ExportMenu label="Export mastery" disabled={!masteryData.length} onExport={handleExport}
          formats={[{ id: 'csv', label: 'Mastery data · CSV' }, { id: 'svg', label: 'Vector chart · SVG' }, { id: 'png', label: 'Chart image · PNG' }]} />
      </>} />
    {!selectedProgram ? <EmptyState title="Choose a skill program." description="Select a program above to see how its targets progress."
      action={{ label: 'Choose a program', onClick: () => document.getElementById('mastery-prog').focus() }} />
      : !masteryData.length ? <EmptyState icon={CheckCircle2} title="Mastery is still ahead."
        description={`No targets in “${selectedProgram.name}” have entered maintenance, generalization, or completed yet. Review session observations in target analysis below.`}
        action={{ label: 'Review target analysis', onClick: () => document.getElementById('target-analysis')?.scrollIntoView({ block: 'start' }) }} />
      : <>
        <div className="mastery-content">
          <div className="mastery-summary">
            <dl><dt>Targets mastered</dt><dd>{count}<small>/ {selectedProgram.targets.length}</small></dd></dl>
            <p>Latest transition<strong>{formatChartDate(latest.date)}, {latest.date.slice(0, 4)}</strong>{latest.newlyMastered.join(' · ')}</p>
          </div>
          <div>
            <div className="chart-scroll" tabIndex={0} role="region" aria-label="Skill mastery chart. Scroll horizontally for the full timeline.">
              <div className="chart-inner chart-inner--mastery">
                <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img"
                  aria-label={`${selectedProgram.name}: ${count} of ${selectedProgram.targets.length} targets mastered.`}>
                  <title>Skill mastery over time</title><desc>A cumulative line chart. The transition dates and mastered targets are also listed in the data table below.</desc>
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
                  <path d={pathD} fill="none" stroke="#34634c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
            <div className="chart-caption"><span>Recorded mastery transitions</span><span className="scroll-hint">Scroll to see the full chart →</span></div>
          </div>
        </div>
        <details className="chart-data mx-6 pb-3">
          <summary>View mastery data table</summary>
          <div className="data-table-scroll" tabIndex={0} role="region" aria-label="Mastery transition data">
            <table className="data-table"><caption className="sr-only">Mastery transitions for {selectedProgram.name}</caption>
              <thead><tr><th scope="col">Transition date</th><th scope="col">Targets mastered</th><th scope="col">Newly mastered targets</th></tr></thead>
              <tbody>{masteryData.map(row => <tr key={row.date}><td>{formatChartDate(row.date)}, {row.date.slice(0, 4)}</td><td>{row.cumulativeCount}</td><td>{row.newlyMastered.join(', ')}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </>}
  </section>;
}
