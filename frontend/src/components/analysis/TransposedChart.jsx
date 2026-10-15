import { createElement, forwardRef, useId, useRef, useState } from 'react';
import EmptyState from '../ui/EmptyState';
import { formatChartDate, CHART_GRID, CHART_MUTED, CHART_INK } from '../../utils/chartTheme';
import { formatNumber } from '../../utils/targetAnalytics';
import { axisTicks, resolveAxisBounds } from '../../utils/chartScale';
import { markerElement, resolveMarkerShape } from '../../utils/markerShapes';

// The flipped view: time runs down the vertical axis and the measured value along the
// horizontal axis. Clinicians asked for the alternate orientation so a long timeline can be
// read on one screen; notes, phase changes and criteria are applied to the alternate axis,
// with every label left horizontal so it stays readable.
const WIDTH = 820;
const HEIGHT = 620;
const PADDING = { top: 46, right: 58, bottom: 66, left: 158 };
const GRAPH_WIDTH = WIDTH - PADDING.left - PADDING.right;
const GRAPH_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;
const FONT = 'Geist, sans-serif';

const clamp = (value, low, high) => Math.max(low, Math.min(value, high));

const TransposedChart = forwardRef(function TransposedChart({
  seriesData = [], targetType, yAxisLabel = 'Value', aggregation = 'Per Day',
  annotations = {}, onSelect, chartType = 'line',
  axisBounds = {}, showValues = false, showGridlines = true, markerPreference = 'auto',
  goal = null, milestones = [], hasVisibleSeries = true, onChangeDateRange
}, ref) {
  const [activeKey, setActiveKey] = useState(null);
  const svgRef = useRef(null);
  const instructionsId = useId();
  const clipId = useId();
  const setRefs = node => {
    svgRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const keys = [];
  for (const series of seriesData) {
    for (const point of series.points || []) if (!keys.includes(point.xKey)) keys.push(point.xKey);
  }
  keys.sort(aggregation === 'Per Session' ? (a, b) => Number(a) - Number(b) : undefined);
  const values = seriesData.flatMap(series => (series.points || []).map(point => point.val)).filter(Number.isFinite);

  if (!hasVisibleSeries) return <EmptyState title="No series are visible." description="Show a target in the legend below to bring the chart back." />;
  if (!keys.length || !values.length) return <EmptyState title="No measured observations in this range." description="Try a longer date range, or switch back to the standard orientation." action={{ label: 'Change date range', onClick: onChangeDateRange }} />;

  const percent = targetType === 'TrialByTrial' || targetType === 'IntervalData';
  const { min: valueMin, max: valueMax } = resolveAxisBounds(axisBounds, { dataMax: Math.max(0, ...values), percent, include: goal ? [goal.value] : [] });
  const valueTicks = axisTicks(valueMin, valueMax, 5);
  const xValue = value => PADDING.left + ((clamp(value, valueMin, valueMax) - valueMin) / (valueMax - valueMin || 1)) * GRAPH_WIDTH;
  const yKey = key => PADDING.top + (keys.length > 1 ? (keys.indexOf(key) / (keys.length - 1)) * GRAPH_HEIGHT : GRAPH_HEIGHT / 2);
  const toKey = date => keys.find(key => key === date) || null;
  const keyForDate = (date, clampToRange = false) => {
    if (aggregation === 'Per Session') return null;
    const target = date.slice(0, 7) === date ? `${date}-01` : date;
    if (toKey(target)) return toKey(target);
    const next = keys.findIndex(key => key > target);
    if (next <= 0) return clampToRange && keys.length ? (target < keys[0] ? keys[0] : keys.at(-1)) : null;
    const toTime = value => new Date(`${value.length === 7 ? `${value}-01` : value}T12:00:00Z`).getTime();
    const previous = keys[next - 1];
    const fraction = (toTime(target) - toTime(previous)) / (toTime(keys[next]) - toTime(previous));
    return fraction < 0.5 ? previous : keys[next];
  };

  const shownKey = activeKey && keys.includes(activeKey) ? activeKey : null;
  const pointsAt = key => seriesData.map(series => ({ series, point: (series.points || []).find(point => point.xKey === key) })).filter(item => item.point);
  const shownPoints = shownKey ? pointsAt(shownKey) : [];
  const markerShapes = seriesData.map((series, index) => (series.isSummary ? 'circleOpen' : resolveMarkerShape(markerPreference, { seriesCount: seriesData.length, seriesIndex: index })));

  function move(step) {
    if (!Number.isFinite(step)) {
      setActiveKey(step > 0 ? keys.at(-1) : keys[0]);
      return;
    }
    const index = shownKey ? keys.indexOf(shownKey) : -1;
    const next = Math.max(0, Math.min(keys.length - 1, index < 0 ? (step > 0 ? 0 : keys.length - 1) : index + step));
    setActiveKey(keys[next]);
  }
  function handleKeyDown(event) {
    if (event.target !== event.currentTarget) return;
    const actions = {
      ArrowDown: () => move(1), ArrowUp: () => move(-1), ArrowRight: () => move(1), ArrowLeft: () => move(-1),
      Home: () => move(-Infinity), End: () => move(Infinity),
      Enter: () => shownKey && onSelect?.(shownKey), ' ': () => shownKey && onSelect?.(shownKey), Escape: () => setActiveKey(null)
    };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
  }
  const keyAtClientY = clientY => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !keys.length) return null;
    const y = ((clientY - rect.top) / rect.height) * HEIGHT;
    let best = keys[0];
    for (const key of keys) if (Math.abs(yKey(key) - y) < Math.abs(yKey(best) - y)) best = key;
    return best;
  };
  const announce = shownKey ? `${formatChartDate(shownKey, aggregation)}: ${pointsAt(shownKey).map(({ series, point }) => `${series.name} ${point.displayVal}`).join('; ')}` : '';
  // Annotation labels sit in the left margin; rows are spaced so none of them collide.
  const noteRows = (annotations?.graphNotes || []).map(note => ({ note, key: keyForDate(note.date, true) })).filter(item => item.key);
  const phaseLines = (annotations?.phaseLines || []).map(line => ({ line, key: keyForDate(line.date, true) })).filter(item => item.key);
  const milestoneRows = (milestones || []).map(milestone => ({ milestone, key: keyForDate(milestone.date, true) })).filter(item => item.key);

  return <div className="chart-scroll" tabIndex={0} role="region" aria-label="Target analysis chart with time on the vertical axis. Scroll for the full view."
    onKeyDown={handleKeyDown} onBlur={() => setActiveKey(null)}>
    <p id={instructionsId} className="sr-only">Use the up and down arrow keys to move between dates and Enter to open details.</p>
    <div className="chart-inner chart-inner--quantitative chart-inner--transposed">
      <div className="chart-stage">
        <svg ref={setRefs} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="chart-svg" role="img"
          aria-label={`${yAxisLabel} on the horizontal axis and observation dates down the vertical axis across ${keys.length} observation groups.`}
          aria-describedby={instructionsId}>
          <desc>Flipped orientation: time runs from top to bottom, values run left to right. The plotted data table below lists every value.</desc>
          <defs><clipPath id={clipId}><rect x={PADDING.left} y={PADDING.top - 8} width={GRAPH_WIDTH} height={GRAPH_HEIGHT + 16} /></clipPath></defs>

          {valueTicks.map((value, index) => <g key={`${value}-${index}`}>
            {showGridlines && <line x1={xValue(value)} x2={xValue(value)} y1={PADDING.top} y2={PADDING.top + GRAPH_HEIGHT} stroke={CHART_GRID} strokeDasharray="3 3" />}
            <text x={xValue(value)} y={HEIGHT - PADDING.bottom + 20} textAnchor="middle" fontSize="12" fill={CHART_MUTED} fontFamily={FONT}>{formatNumber(value, value < 1 ? 2 : 1)}</text>
          </g>)}
          <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={PADDING.top + GRAPH_HEIGHT} y2={PADDING.top + GRAPH_HEIGHT} stroke="#c9d1c4" strokeWidth="1" />
          <line x1={PADDING.left} x2={PADDING.left} y1={PADDING.top} y2={PADDING.top + GRAPH_HEIGHT} stroke="#c9d1c4" strokeWidth="1" />
          <text x={PADDING.left + GRAPH_WIDTH / 2} y={HEIGHT - 12} textAnchor="middle" fontSize="13" fontWeight="500" fill={CHART_INK} fontFamily={FONT}>{yAxisLabel}</text>
          <text x="16" y={PADDING.top + GRAPH_HEIGHT / 2} transform={`rotate(-90 16 ${PADDING.top + GRAPH_HEIGHT / 2})`} textAnchor="middle" fontSize="13" fontWeight="500" fill={CHART_INK} fontFamily={FONT}>
            {aggregation === 'Per Session' ? 'Session timeline' : 'Observation date'}
          </text>

          <g clipPath={`url(#${clipId})`}>
            {goal && <g>
              <line x1={xValue(goal.value)} x2={xValue(goal.value)} y1={PADDING.top} y2={PADDING.top + GRAPH_HEIGHT} stroke="#9b7a3d" strokeWidth="2" strokeDasharray="2 4" />
              <title>{goal.label}</title>
            </g>}
            {phaseLines.map(({ line, key }) => <g key={line.id || `${line.date}-${line.label}`}>
              <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={yKey(key)} y2={yKey(key)} stroke={line.color || '#294f3d'} strokeWidth="1.5"
                strokeDasharray={line.style === 'Dotted' ? '4 4' : undefined} opacity="0.8" />
              <title>{`${line.label} · ${line.date}`}</title>
            </g>)}
            {seriesData.map((series, seriesPosition) => {
              const points = (series.points || []).filter(point => Number.isFinite(point.val) && keys.includes(point.xKey));
              return <g key={series.id}>
                {chartType !== 'points' && points.length > 1 && <polyline points={points.map(point => `${xValue(point.val)},${yKey(point.xKey)}`).join(' ')} fill="none"
                  stroke={series.color} strokeWidth={series.isSummary ? 2.6 : 2.2} strokeDasharray={series.isSummary ? '8 4' : undefined} strokeLinejoin="round" />}
                {points.map(point => {
                  const marker = markerElement(markerShapes[seriesPosition], { x: xValue(point.val), y: yKey(point.xKey), size: point.xKey === shownKey ? 5.4 : 4.4, color: series.color });
                  return <g key={point.xKey} className="chart-point">
                    {createElement(marker.tag, marker.props)}
                    <title>{`Target: ${series.name}\nDate: ${point.xKey}\nValue: ${point.displayVal}${point.therapist ? `\nTherapist: ${point.therapist}` : ''}`}</title>
                  </g>;
                })}
              </g>;
            })}
            {shownKey && <rect x={PADDING.left} y={yKey(shownKey) - 9} width={GRAPH_WIDTH} height="18" fill="#34634c" opacity="0.1" rx="3" />}
          </g>

          {milestoneRows.map(({ milestone, key }) => <g key={`${milestone.kind}-${milestone.date}`}>
            <polygon points={`${PADDING.left - 6},${yKey(key)} ${PADDING.left - 16},${yKey(key) - 5} ${PADDING.left - 16},${yKey(key) + 5}`} fill={milestone.kind === 'Introduced' ? '#4b5a73' : '#294f3d'} />
            <title>{`${milestone.label} · ${milestone.date}`}</title>
          </g>)}
          {noteRows.map(({ note, key }) => <g key={note.id || key} className="chart-point">
            <circle cx={PADDING.left - 24} cy={yKey(key)} r="7" fill={note.color || '#34634c'} stroke="#FFFFFF" strokeWidth="1.4" />
            <text x={PADDING.left - 24} y={yKey(key) + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#FFFFFF" fontFamily={FONT}>N</text>
            <text x={PADDING.left - 36} y={yKey(key) + 3.5} textAnchor="end" fontSize="10.5" fill={CHART_INK} fontFamily={FONT}>{note.noteText.length > 24 ? `${note.noteText.slice(0, 23)}…` : note.noteText}</text>
            <title>{`Note by ${note.staffName} (${note.date}):\n${note.noteText}`}</title>
          </g>)}

          {keys.map((key, index) => {
            const every = Math.ceil(keys.length / 18);
            if (every > 1 && index % every !== 0 && index !== keys.length - 1) return null;
            return <text key={key} x={PADDING.left - 8} y={yKey(key) + 4} textAnchor="end" fontSize="11.5" fill={CHART_MUTED} fontFamily={FONT}>
              {formatChartDate(key, aggregation)}
            </text>;
          })}

          {(annotations?.phaseLines || []).map((line, index) => {
            const item = phaseLines.find(entry => entry.line === line);
            if (!item) return null;
            const row = index % 3;
            return <g key={`label-${line.id || index}`}>
              <rect x={WIDTH - PADDING.right + 4} y={yKey(item.key) - 9 - row * 20} width="54" height="18" rx="3" fill="#294f3d" opacity="0.9" />
              <text x={WIDTH - PADDING.right + 8} y={yKey(item.key) + 4 - row * 20} fontSize="10" fill="#FFFFFF" fontFamily={FONT}>{line.label.length > 8 ? `${line.label.slice(0, 7)}…` : line.label}</text>
              <title>{`${line.label} · ${line.date}${line.isAutomated ? ' · automated' : ''}`}</title>
            </g>;
          })}

          {showValues && keys.length <= 24 && seriesData.map(series => (series.points || []).map(point => <text key={`${series.id}-${point.xKey}`}
            x={xValue(point.val)} y={yKey(point.xKey) - 8} textAnchor="middle" fontSize="10" fontWeight="600" fill={CHART_INK} fontFamily={FONT}
            stroke="#FFFFFF" strokeWidth="3" paintOrder="stroke" pointerEvents="none">{percent ? `${point.val}%` : formatNumber(point.val, point.val < 10 ? 2 : 1)}</text>))}

          <rect x={PADDING.left - 10} y={PADDING.top - 12} width={GRAPH_WIDTH + 20} height={GRAPH_HEIGHT + 24} fill="transparent" className="chart-hit-area"
            onPointerMove={event => setActiveKey(keyAtClientY(event.clientY))}
            onPointerLeave={() => setActiveKey(null)}
            onClick={event => { const key = keyAtClientY(event.clientY); if (key) onSelect?.(key); }} />
        </svg>
        {shownKey && shownPoints.length > 0 && <div className={`chart-tooltip${(xValue(shownPoints[0].point.val) / WIDTH) * 100 > 62 ? ' chart-tooltip--left' : ''}`}
          style={{ left: `${(xValue(shownPoints[0].point.val) / WIDTH) * 100}%`, top: `${(yKey(shownKey) / HEIGHT) * 100}%` }} aria-hidden="true">
          <strong>{formatChartDate(shownKey, aggregation)}</strong>
          {shownPoints.map(({ series, point }) => <span key={series.id} className="chart-tooltip-row">
            <i style={{ background: series.color }} />{series.name}{series.isSummary ? ' (combined)' : ''}<b>{point.displayVal}</b>
          </span>)}
          <small className="chart-tooltip-hint">{onSelect ? 'Click or press Enter for details' : ''}</small>
        </div>}
      </div>
    </div>
    <p className="sr-only" aria-live="polite">{announce}</p>
  </div>;
});

export default TransposedChart;
