import { forwardRef, useMemo } from 'react';
import { formatChartDate, CHART_GRID, CHART_MUTED, CHART_INK } from '../../utils/chartTheme';
import { PROMPT_COLORS, promptOrder, formatNumber } from '../../utils/targetAnalytics';
import { celeration } from '../../utils/visualAnalysis';
import { dayNumber, addDays } from '../../utils/stats';
import EmptyState from '../ui/EmptyState';

const FONT = 'Geist, sans-serif';

// Stacked prompt-level distribution per observation group (TCO G.7/G.8: prompt fading).
export const PromptLevelChart = forwardRef(function PromptLevelChart({ keys, rowsByKey, template, aggregation, selectedKey, onSelect, targetName }, ref) {
  const order = promptOrder(template);
  const width = 850;
  const height = 330;
  const padding = { top: 24, right: 24, bottom: 56, left: 60 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const groups = keys.map(key => {
    const codes = (rowsByKey.get(key) || []).map(row => row.trialSequence || '').join('');
    const counts = Object.fromEntries(order.map(item => [item.code, 0]));
    for (const code of codes) if (code in counts) counts[code] += 1;
    return { key, total: codes.length, counts };
  }).filter(group => group.total > 0);
  if (!groups.length) return <EmptyState title="No trial-by-trial prompt data in this range." description="Prompt levels are recorded with each trial. Try a longer date range." />;
  const band = graphWidth / groups.length;
  const barWidth = Math.min(34, band * 0.7);
  return <div className="chart-scroll" tabIndex={0} role="region" aria-label="Prompt level chart. Scroll horizontally for the full timeline.">
    <div className="chart-inner chart-inner--quantitative">
      <svg ref={ref} viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label={`Share of trials at each prompt level for ${targetName} across ${groups.length} observation groups.`}>
        <title>Prompt levels</title><desc>Stacked bars show the percentage of trials completed independently and at each prompt level; independent responding is at the bottom.</desc>
        {[0, 25, 50, 75, 100].map(value => {
          const y = padding.top + graphHeight - (value / 100) * graphHeight;
          return <g key={value}><line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke={CHART_GRID} strokeDasharray="2 4" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="12" fill={CHART_MUTED} fontFamily={FONT}>{value}%</text></g>;
        })}
        <text x={-(padding.top + graphHeight / 2)} y="16" transform="rotate(-90)" textAnchor="middle" fontSize="13" fontWeight="500" fill={CHART_INK} fontFamily={FONT}>Trials at each prompt level (%)</text>
        {groups.map((group, index) => {
          const x = padding.left + band * index + (band - barWidth) / 2;
          let y = padding.top + graphHeight;
          return <g key={group.key} className="chart-point" onClick={() => onSelect?.(group.key)}>
            {group.key === selectedKey && <rect x={x - 4} y={padding.top} width={barWidth + 8} height={graphHeight} fill="#34634c" opacity="0.1" rx="3" />}
            {order.map(item => {
              const share = group.counts[item.code] / group.total;
              if (!share) return null;
              const h = share * graphHeight;
              y -= h;
              return <rect key={item.code} x={x} y={y} width={barWidth} height={h} fill={PROMPT_COLORS[item.code]}>
                <title>{`${formatChartDate(group.key, aggregation)} · ${item.level}: ${Math.round(share * 100)}% (${group.counts[item.code]} of ${group.total} trials)`}</title>
              </rect>;
            })}
            {(groups.length <= 16 || index % Math.ceil(groups.length / 16) === 0) && <text x={x + barWidth / 2} y={height - padding.bottom + 20} textAnchor="middle" fontSize="11" fill={CHART_MUTED} fontFamily={FONT}>{formatChartDate(group.key, aggregation)}</text>}
          </g>;
        })}
        <text x={padding.left + graphWidth / 2} y={height - 8} textAnchor="middle" fontSize="13" fontWeight="500" fill={CHART_INK} fontFamily={FONT}>{aggregation === 'Per Session' ? 'Session timeline' : 'Observation date'}</text>
      </svg>
      <ul className="prompt-legend prompt-legend--chart">{order.map(item => <li key={item.code}><i style={{ background: PROMPT_COLORS[item.code] }} />{item.level}</li>)}</ul>
    </div>
  </div>;
});

// Daily per-minute semi-logarithmic chart in the spirit of the Standard Celeration Chart:
// corrects as dots, errors as x, record floor at 1 / counting time, celeration lines.
export const CelerationChart = forwardRef(function CelerationChart({ rows, phaseLines = [], targetName, aim }, ref) {
  const timings = useMemo(() => rows.filter(row => row.lessonDurationMinutes > 0 && row.value != null).map(row => ({
    date: row.timestamp.slice(0, 10), correct: (row.occurrenceCount ?? row.value) / row.lessonDurationMinutes,
    errors: row.errorCount != null ? row.errorCount / row.lessonDurationMinutes : null, floor: 1 / row.lessonDurationMinutes, id: row.id
  })), [rows]);
  if (timings.length < 2) return <EmptyState title="At least two timings are needed for a celeration chart." description="Try a longer date range." />;
  const width = 850;
  const height = 380;
  const padding = { top: 30, right: 120, bottom: 56, left: 64 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const first = timings[0].date;
  const last = timings.at(-1).date;
  const spanDays = Math.max(14, dayNumber(last) - dayNumber(first) + 7);
  const values = timings.flatMap(timing => [timing.correct, timing.errors, timing.floor]).filter(value => value > 0);
  const lowDecade = Math.floor(Math.log10(Math.min(...values) / 1.5));
  const highDecade = Math.max(lowDecade + 3, Math.ceil(Math.log10(Math.max(...values, aim || 0) * 1.5)));
  const x = date => padding.left + ((dayNumber(date) - dayNumber(first)) / spanDays) * graphWidth;
  const y = value => padding.top + graphHeight - ((Math.log10(Math.max(value, 10 ** lowDecade)) - lowDecade) / (highDecade - lowDecade)) * graphHeight;
  const corrects = celeration(timings.map(timing => ({ date: timing.date, y: timing.correct })));
  const errors = celeration(timings.filter(timing => timing.errors != null).map(timing => ({ date: timing.date, y: timing.errors })));
  const weeks = [];
  for (let day = 0; day <= spanDays; day += 7) weeks.push(addDays(first, day));
  const lineFor = fit => fit && { x1: x(first), y1: y(fit.valueAt(first)), x2: x(last), y2: y(fit.valueAt(last)) };
  const correctLine = lineFor(corrects);
  const errorLine = lineFor(errors);
  return <div className="chart-scroll" tabIndex={0} role="region" aria-label="Celeration chart. Scroll horizontally for the full timeline.">
    <div className="chart-inner chart-inner--quantitative">
      <svg ref={ref} viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img"
        aria-label={`Semi-logarithmic chart of correct and error responses per minute for ${targetName}. ${corrects ? `Corrects ${corrects.label}.` : ''} ${errors ? `Errors ${errors.label}.` : ''}`}>
        <title>Celeration chart</title><desc>Daily per-minute frequencies on a multiply-divide scale. Dots are corrects, crosses are errors, dashes mark the record floor (one per counting time).</desc>
        {Array.from({ length: highDecade - lowDecade + 1 }, (_, index) => lowDecade + index).flatMap(decade => [1, 2, 5].map(step => ({ value: step * 10 ** decade, major: step === 1 })))
          .filter(tick => tick.value <= 10 ** highDecade)
          .map(tick => <g key={tick.value}>
            <line x1={padding.left} x2={padding.left + graphWidth} y1={y(tick.value)} y2={y(tick.value)} stroke={tick.major ? '#c9d1c4' : CHART_GRID} strokeWidth={tick.major ? 1.2 : 0.8} />
            <text x={padding.left - 8} y={y(tick.value) + 4} textAnchor="end" fontSize="11" fill={CHART_MUTED} fontFamily={FONT}>{formatNumber(tick.value, 3)}</text>
          </g>)}
        {weeks.map(week => <g key={week}>
          <line x1={x(week)} x2={x(week)} y1={padding.top} y2={padding.top + graphHeight} stroke={CHART_GRID} strokeWidth="1" />
          <text x={x(week)} y={height - padding.bottom + 18} textAnchor="middle" fontSize="11" fill={CHART_MUTED} fontFamily={FONT}>{formatChartDate(week)}</text>
        </g>)}
        {phaseLines.filter(line => line.date >= first && line.date <= last).map(line => <g key={line.id}>
          <line x1={x(line.date)} x2={x(line.date)} y1={padding.top} y2={padding.top + graphHeight} stroke="#294f3d" strokeWidth="2" strokeDasharray={line.style === 'Dotted' ? '4 3' : undefined} />
          <title>{line.label}</title>
        </g>)}
        {aim && <g><line x1={padding.left} x2={padding.left + graphWidth} y1={y(aim)} y2={y(aim)} stroke="#9b7a3d" strokeWidth="1.6" strokeDasharray="2 4" />
          <text x={padding.left + graphWidth + 6} y={y(aim) + 4} fontSize="11" fontWeight="600" fill="#704b20" fontFamily={FONT}>Aim {formatNumber(aim)}</text></g>}
        {correctLine && <g><line {...correctLine} stroke="#2f5d46" strokeWidth="2" />
          <text x={padding.left + graphWidth + 6} y={correctLine.y2 + 4} fontSize="11" fontWeight="600" fill="#2f5d46" fontFamily={FONT}>{corrects.label.replace(' per week', '/wk')}</text></g>}
        {errorLine && <g><line {...errorLine} stroke="#a34436" strokeWidth="2" strokeDasharray="6 3" />
          <text x={padding.left + graphWidth + 6} y={errorLine.y2 + 4} fontSize="11" fontWeight="600" fill="#a34436" fontFamily={FONT}>{errors.label.replace(' per week', '/wk')}</text></g>}
        {timings.map(timing => <g key={timing.id}>
          <line x1={x(timing.date) - 5} x2={x(timing.date) + 5} y1={y(timing.floor)} y2={y(timing.floor)} stroke="#5d6a58" strokeWidth="1.5" />
          <circle cx={x(timing.date)} cy={y(timing.correct)} r="3.6" fill="#2f5d46"><title>{`${timing.date}: ${formatNumber(timing.correct, 2)} correct per minute`}</title></circle>
          {timing.errors != null && <g stroke="#a34436" strokeWidth="1.8"><line x1={x(timing.date) - 3.5} x2={x(timing.date) + 3.5} y1={y(Math.max(timing.errors, 10 ** lowDecade)) - 3.5} y2={y(Math.max(timing.errors, 10 ** lowDecade)) + 3.5} />
            <line x1={x(timing.date) - 3.5} x2={x(timing.date) + 3.5} y1={y(Math.max(timing.errors, 10 ** lowDecade)) + 3.5} y2={y(Math.max(timing.errors, 10 ** lowDecade)) - 3.5} />
            <title>{`${timing.date}: ${formatNumber(timing.errors, 2)} errors per minute`}</title></g>}
        </g>)}
        <text x={-(padding.top + graphHeight / 2)} y="16" transform="rotate(-90)" textAnchor="middle" fontSize="13" fontWeight="500" fill={CHART_INK} fontFamily={FONT}>Count per minute (multiply–divide scale)</text>
        <text x={padding.left + graphWidth / 2} y={height - 8} textAnchor="middle" fontSize="13" fontWeight="500" fill={CHART_INK} fontFamily={FONT}>Successive calendar days (weekly lines)</text>
      </svg>
      <ul className="prompt-legend prompt-legend--chart">
        <li><i style={{ background: '#2f5d46', borderRadius: '50%' }} />Corrects per minute{corrects ? ` · ${corrects.label}` : ''}</li>
        <li><i className="legend-cross" />Errors per minute{errors ? ` · ${errors.label}` : ''}</li>
        <li><i style={{ background: '#5d6a58', height: '2px' }} />Record floor (1 ÷ counting time)</li>
      </ul>
    </div>
  </div>;
});

// Two accessible range inputs over a sparkline: zoom into part of the selected range.
export function TimelineBrush({ keys, values, start, end, onChange, aggregation }) {
  if (keys.length < 12) return null;
  const max = Math.max(1e-9, ...values.filter(Number.isFinite));
  const path = values.map((value, index) => `${index ? 'L' : 'M'} ${(index / (keys.length - 1)) * 100} ${30 - (Number.isFinite(value) ? (value / max) * 26 : 0)}`).join(' ');
  return <div className="timeline-brush">
    <div className="timeline-brush-head">
      <span>Zoom · {formatChartDate(keys[start], aggregation)} – {formatChartDate(keys[end], aggregation)}</span>
      {(start > 0 || end < keys.length - 1) && <button type="button" className="button button--tertiary" onClick={() => onChange(0, keys.length - 1)}>Reset zoom</button>}
    </div>
    <div className="timeline-brush-track">
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true" className="timeline-brush-spark">
        <rect x={(start / (keys.length - 1)) * 100} width={((end - start) / (keys.length - 1)) * 100} y="0" height="32" fill="#34634c" opacity="0.12" />
        <path d={path} fill="none" stroke="#5d6a58" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <label className="sr-only" htmlFor="brush-start">Zoom start</label>
      <input id="brush-start" type="range" min={0} max={keys.length - 1} value={start} aria-valuetext={formatChartDate(keys[start], aggregation)}
        onChange={event => onChange(Math.min(Number(event.target.value), end - 1), end)} />
      <label className="sr-only" htmlFor="brush-end">Zoom end</label>
      <input id="brush-end" type="range" min={0} max={keys.length - 1} value={end} aria-valuetext={formatChartDate(keys[end], aggregation)}
        onChange={event => onChange(start, Math.max(Number(event.target.value), start + 1))} />
    </div>
  </div>;
}
