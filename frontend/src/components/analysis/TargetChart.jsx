import { createElement, forwardRef, useId, useMemo, useRef, useState } from 'react';
import EmptyState from '../ui/EmptyState';
import { formatChartDate, chartMarkerInk, CHART_GRID, CHART_MUTED, CHART_INK } from '../../utils/chartTheme';
import { getObservationKey, sortObservationKeys } from '../../utils/analyticsMetrics';
import { formatNumber } from '../../utils/targetAnalytics';
import { axisTicks, resolveAxisBounds, CHART_TYPES, layoutNoteLabels } from '../../utils/chartScale';
import { markerElement, resolveMarkerShape } from '../../utils/markerShapes';

const WIDTH = 850;
const HEIGHT = 380;
const PADDING = { top: 58, right: 35, bottom: 60, left: 65 };
const GRAPH_WIDTH = WIDTH - PADDING.left - PADDING.right;
const GRAPH_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;
// Condition bar: phase names live in their own strip above the plot so they never
// sit on top of an observation.
const BAND = { top: 8, height: 22 };
const FONT = 'Geist, sans-serif';

const clamp = (value, low, high) => Math.max(low, Math.min(value, high));

// Approximate advance width for hand-written SVG text (no measurement API in SVG 1.1).
function fitText(text, maxWidth, fontSize = 11.5) {
  const per = 0.53 * fontSize;
  const limit = Math.max(2, Math.floor(maxWidth / per));
  return text.length <= limit ? text : `${text.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
}

// One labeled SVG chart for all quantitative tools. Overlays are optional analytical
// functions; interaction adds a tooltip, a keyboard crosshair and drill-down selection.
const TargetChart = forwardRef(function TargetChart({
  seriesData = [], targetType, durationView, rateView, frequencyView,
  showAverageLine, averageValue, showTrendLine, trendlinePoints, regressionParams,
  showGridlines, annotations, aggregation, extraXKeys = [], hasVisibleSeries = true, onChangeDateRange,
  overlays = {}, selectedKey = null, highlightKeys = null, onSelect,
  chartType = 'line', axisBounds = {}, showValues = false, showPhaseLabels = true, conditionSpans = [],
  markerPreference = 'auto', milestones = [], suppressed = null
}, ref) {
  const [activeKey, setActiveKey] = useState(null);
  const [pointerActive, setPointerActive] = useState(false);
  const svgRef = useRef(null);
  const instructionsId = useId();
  const clipId = useId();
  const setRefs = node => {
    svgRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  // Cumulative view re-plots each series as a running total; other views share the data.
  const plotSeries = useMemo(() => {
    if (chartType !== 'cumulative') return seriesData;
    return seriesData.map(series => {
      let running = 0;
      return {
        ...series,
        points: series.points.map(point => {
          running += Number.isFinite(point.val) ? point.val : 0;
          return { ...point, val: running, baseVal: point.val, displayVal: `${formatNumber(running)} cumulative` };
        })
      };
    });
  }, [seriesData, chartType]);

  const measuredKeys = useMemo(() => sortObservationKeys(new Set([...plotSeries.flatMap(series => series.points.map(point => point.xKey)), ...extraXKeys]), aggregation), [plotSeries, extraXKeys, aggregation]);
  const forecastKeys = (overlays.forecast || []).map(point => point.xKey).filter(key => !measuredKeys.includes(key));
  const allKeys = [...measuredKeys, ...forecastKeys];

  if (!hasVisibleSeries) return <EmptyState title="No series are visible." description="Show a target or clinician in the legend below to bring the chart back." />;
  if (!measuredKeys.length || !plotSeries.some(series => series.points.length)) return <EmptyState title="No measured observations in this range." description="Try a longer date range. Unobserved records aren’t plotted as zeros." action={{ label: 'Change date range', onClick: onChangeDateRange }} />;

  const percent = targetType === 'TrialByTrial' || targetType === 'IntervalData';
  const logScale = Boolean(overlays.logScale) && !percent;
  const observed = plotSeries.flatMap(series => series.points.map(point => point.val)).filter(Number.isFinite);
  const { min: yMin, max: yMax } = resolveAxisBounds(axisBounds, {
    dataMax: Math.max(0, ...observed), percent,
    include: [overlays.goal?.value, overlays.envelope?.upper, ...(overlays.forecast || []).map(point => point.high), overlays.cdc?.meanLine]
  });
  const positives = observed.filter(value => value > 0);
  const logFloor = logScale && yMin > 0 ? yMin : (logScale ? 10 ** Math.floor(Math.log10(Math.max(0.01, Math.min(...positives, yMax) / 2))) : 0);
  const logCeil = logScale ? (axisBounds?.max != null ? yMax : 10 ** Math.ceil(Math.log10(Math.max(yMax, logFloor * 10)))) : 0;

  const getX = key => {
    const index = allKeys.indexOf(key);
    if (index === -1) return PADDING.left;
    return PADDING.left + (allKeys.length > 1 ? (index / (allKeys.length - 1)) * GRAPH_WIDTH : GRAPH_WIDTH / 2);
  };
  const getY = value => {
    if (logScale) {
      const safe = Math.max(logFloor, Math.min(value, logCeil));
      return plotTop + GRAPH_HEIGHT - ((Math.log10(safe) - Math.log10(logFloor)) / (Math.log10(logCeil) - Math.log10(logFloor))) * GRAPH_HEIGHT;
    }
    return plotTop + GRAPH_HEIGHT - ((clamp(value, yMin, yMax) - yMin) / (yMax - yMin)) * GRAPH_HEIGHT;
  };
  const getAnnotationX = (date, clampToRange = false) => {
    if (aggregation === 'Per Session') {
      const point = plotSeries.flatMap(series => series.points).find(item => item.date === date);
      return point ? getX(point.xKey) : null;
    }
    const key = getObservationKey({ timestamp: `${date}T12:00:00` }, aggregation);
    if (measuredKeys.includes(key)) return getX(key);
    if (key < measuredKeys[0]) return clampToRange ? PADDING.left : null;
    if (key > measuredKeys.at(-1)) return clampToRange ? getX(measuredKeys.at(-1)) : null;
    const next = measuredKeys.findIndex(item => item > key);
    if (next < 1) return null;
    const toTime = value => new Date(`${value.length === 7 ? `${value}-01` : value}T12:00:00Z`).getTime();
    const fraction = (toTime(key) - toTime(measuredKeys[next - 1])) / (toTime(measuredKeys[next]) - toTime(measuredKeys[next - 1]));
    return getX(measuredKeys[next - 1]) + fraction * (getX(measuredKeys[next]) - getX(measuredKeys[next - 1]));
  };

  // Annotation text: every note gets its full text in a label above the plot, wrapped to
  // two lines and laid out in rows so two notes on nearby dates never overlap and the
  // label box always matches its text (feedback: readable annotation text).
  const noteLabels = layoutNoteLabels((annotations?.graphNotes || []).map((note, index) => {
    const x = getAnnotationX(note.date);
    return x == null ? null : { key: note.id || `note-${index}`, x, text: note.noteText, note, date: note.date };
  }).filter(Boolean), { minX: PADDING.left + 2, maxX: WIDTH - PADDING.right - 2, maxRows: 3, gap: 10 });
  // The note band lives between the condition strip and the plot. When notes need more
  // rows than the built-in gap, the canvas grows upward so nothing is clipped or covered.
  const notesHeight = noteLabels.reduce((max, label) => Math.max(max, label.rowY + label.boxHeight), 0);
  const NOTES_GAP = PADDING.top - (BAND.top + BAND.height);
  const extraTop = Math.max(0, notesHeight - NOTES_GAP + 12);
  const plotTop = PADDING.top + extraTop;
  const chartHeight = HEIGHT + extraTop;

  const durationInMinutes = targetType === 'Duration' && durationView !== 'Total Count' && yMax >= 120;
  const tickText = value => (durationInMinutes ? Math.round(value / 6) / 10 : formatNumber(value, value < 1 ? 2 : 1));
  const rateLabel = view => (view === 'Rate per Minute' ? 'Occurrences per minute' : 'Occurrences per hour');
  const averageLabel = targetType === 'Duration' && durationView !== 'Total Count'
    ? `${durationInMinutes ? Math.round(averageValue / 6) / 10 : averageValue}${durationInMinutes ? 'm' : 's'}` : averageValue;
  const yAxisLabel = (() => {
    if (targetType === 'TrialByTrial') return 'Correct responses (%)';
    if (targetType === 'IntervalData') return 'Intervals scored (%)';
    if (targetType === 'Duration') return durationView === 'Total Count' ? 'Occurrence count'
      : `${durationView === 'Total Duration' ? 'Total duration' : 'Average duration'} (${durationInMinutes ? 'minutes' : 'seconds'})`;
    if (targetType === 'FluencyRate') return rateView === 'Rate per Day' ? (aggregation === 'Per Day' ? 'Occurrences per day' : 'Occurrence count') : rateLabel(rateView);
    if (targetType === 'Frequency') return frequencyView === 'Raw Frequency' ? 'Occurrence count' : rateLabel(frequencyView);
    return 'Value';
  })();
  const cumulativeLabel = chartType === 'cumulative' ? `Cumulative ${yAxisLabel.replace(/^Correct responses \(%\)$/, 'correct responses').replace(/^Intervals scored \(%\)$/, 'scored intervals')}` : yAxisLabel;
  const yTicks = logScale
    ? (() => {
      const ticks = [];
      for (let decade = logFloor; decade <= logCeil * 1.0001; decade *= 10) [1, 2, 5].forEach(step => { const value = decade * step; if (value <= logCeil * 1.0001) ticks.push(value); });
      return ticks;
    })()
    : axisTicks(yMin, yMax, 5);

  // Data-point markers: the clinician's shape choice, with solid circles when a single
  // target is plotted (the usual single-case convention).
  const seriesShapes = plotSeries.map((series, index) => (series.isSummary
    ? 'circleOpen'
    : resolveMarkerShape(markerPreference, { seriesCount: plotSeries.length, seriesIndex: index })));

  // Bar geometry: grouped columns centred on each observation group.
  const bandWidth = allKeys.length ? GRAPH_WIDTH / allKeys.length : GRAPH_WIDTH;
  const seriesCount = Math.max(1, plotSeries.length);
  const barWidth = Math.max(4, Math.min(26, (bandWidth * 0.78) / seriesCount));
  const barOffset = index => -((seriesCount * barWidth) / 2) + index * barWidth;
  const baselineY = getY(clamp(0, yMin, yMax));
  const outsideCount = observed.filter(value => value > yMax || value < yMin).length;


  // Phase milestones (introduced, mastered, maintenance) sit on the time axis so acquisition
  // rate is readable straight from the graph.
  const milestoneMarkers = milestones.map(milestone => {
    const x = getAnnotationX(milestone.date);
    return x == null ? null : { ...milestone, x };
  }).filter(Boolean);

  const keyAtClientX = clientX => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !measuredKeys.length) return null;
    const x = ((clientX - rect.left) / rect.width) * WIDTH;
    let best = measuredKeys[0];
    for (const key of measuredKeys) if (Math.abs(getX(key) - x) < Math.abs(getX(best) - x)) best = key;
    return best;
  };
  const shownKey = activeKey && measuredKeys.includes(activeKey) ? activeKey : null;
  const pointsAt = key => plotSeries.map(series => ({ series, point: series.points.find(point => point.xKey === key) })).filter(item => item.point);
  function move(step) {
    if (!Number.isFinite(step)) {
      setActiveKey(step > 0 ? measuredKeys.at(-1) : measuredKeys[0]);
      setPointerActive(false);
      return;
    }
    const index = shownKey ? measuredKeys.indexOf(shownKey) : (selectedKey ? measuredKeys.indexOf(selectedKey) : -1);
    const next = Math.max(0, Math.min(measuredKeys.length - 1, index < 0 ? (step > 0 ? 0 : measuredKeys.length - 1) : index + step));
    setActiveKey(measuredKeys[next]);
    setPointerActive(false);
  }
  function handleKeyDown(event) {
    if (event.target !== event.currentTarget) return;
    const actions = {
      ArrowRight: () => move(1), ArrowLeft: () => move(-1), Home: () => move(-Infinity), End: () => move(Infinity),
      Enter: () => shownKey && onSelect?.(shownKey), ' ': () => shownKey && onSelect?.(shownKey), Escape: () => setActiveKey(null)
    };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
  }
  const announce = shownKey ? `${formatChartDate(shownKey, aggregation)}: ${pointsAt(shownKey).map(({ series, point }) => `${series.name} ${point.displayVal}`).join('; ')}` : '';

  // Phase changes: one labelled strip per condition, plus thin dividers drawn behind
  // the observations so a phase change never hides a data point.
  const bandSpans = [];
  for (const span of conditionSpans) {
    const startX = getAnnotationX(span.startDate, true);
    const endX = getAnnotationX(span.endDate, true);
    if (startX == null || endX == null) continue;
    const left = clamp(Math.min(startX, endX), PADDING.left, WIDTH - PADDING.right);
    const right = clamp(Math.max(startX, endX), PADDING.left, WIDTH - PADDING.right);
    bandSpans.push({ ...span, left, right, width: Math.max(1, right - left) });
  }
  const dividers = [];
  const addDivider = (x, line) => {
    if (x == null || x <= PADDING.left + 0.5) return;
    if (dividers.some(item => Math.abs(item.x - x) < 1.5)) return;
    dividers.push({ x, dotted: line ? line.style === 'Dotted' : false, color: line?.color || '#294f3d', label: line?.label || '', date: line?.date || '' });
  };
  for (const span of bandSpans) if (span.changedOn) addDivider(span.left < WIDTH - PADDING.right ? span.left : null, null);
  for (const line of annotations?.phaseLines || []) addDivider(getAnnotationX(line.date), line);

  // Fallback labels when a chart has phase lines but no condition span (e.g. no phase history).
  const lineLabels = [];
  if (!bandSpans.length) {
    for (const line of annotations?.phaseLines || []) {
      const x = getAnnotationX(line.date);
      if (x == null) continue;
      let row = 0;
      while (lineLabels.some(item => item.row === row && Math.abs(item.x - x) < 152) && row < 1) row += 1;
      lineLabels.push({ line, x, row });
    }
  }

  const tooltipKey = shownKey;
  const tooltipPoints = tooltipKey ? pointsAt(tooltipKey) : [];
  const tooltipLeft = tooltipKey ? (getX(tooltipKey) / WIDTH) * 100 : 0;
  const tooltipTop = tooltipPoints.length ? (Math.min(...tooltipPoints.map(({ point }) => getY(point.val))) / chartHeight) * 100 : 0;
  const valueText = point => (percent ? `${point.val}%` : formatNumber(point.val, point.val < 10 ? 2 : 1));

  return <div className="chart-scroll" tabIndex={0} role="region" aria-label="Target analysis chart. Scroll horizontally for the full timeline." aria-describedby={instructionsId}
    onKeyDown={handleKeyDown} onBlur={() => { if (!pointerActive) setActiveKey(null); }}>
    <p id={instructionsId} className="sr-only">Use the left and right arrow keys to move between observations and Enter to open details.</p>
    <div className="chart-inner chart-inner--quantitative">
      <div className="chart-stage">
        <svg ref={setRefs} viewBox={`0 0 ${WIDTH} ${chartHeight}`} className="chart-svg" role="img"
          aria-label={`${CHART_TYPES.find(item => item.value === chartType)?.label || 'Line'} chart of ${cumulativeLabel} across ${measuredKeys.length} observation groups. Read the plotted data table below for exact values.`}>
          <title>Target observations</title><desc>One labeled series per target or clinician. The data table below provides all plotted measurements.</desc>
          <defs>
            <clipPath id={clipId}><rect x={PADDING.left - 8} y={plotTop} width={GRAPH_WIDTH + 16} height={GRAPH_HEIGHT} /></clipPath>
          </defs>

          {showPhaseLabels && bandSpans.length > 0 && <g className="condition-bar">
            {bandSpans.map((span, index) => <g key={`${span.label}-${span.startDate}`}>
              <rect x={span.left} y={BAND.top} width={span.width} height={BAND.height} rx="3"
                fill={index % 2 ? '#eef3ec' : '#f7f9f5'} stroke="#dfe5db" strokeWidth="1" />
              <title>{`${span.label} · ${span.startDate} to ${span.endDate}`}</title>
              {span.width >= 34 && <text x={span.left + span.width / 2} y={BAND.top + 15} textAnchor="middle" fontSize="11.5" fontWeight="600"
                fill="#294f3d" fontFamily={FONT} pointerEvents="none">{fitText(span.label, span.width - 10)}</text>}
            </g>)}
          </g>}

          {yTicks.map((value, index) => <g key={`${value}-${index}`}>
            {showGridlines && <line x1={PADDING.left} y1={getY(value)} x2={WIDTH - PADDING.right} y2={getY(value)} stroke={CHART_GRID} strokeDasharray="3 3" />}
            <text x={PADDING.left - 8} y={getY(value) + 3.5} textAnchor="end" fontSize="13" fill={CHART_MUTED} fontFamily={FONT}>{tickText(value)}</text>
          </g>)}
          <line x1={PADDING.left} x2={PADDING.left} y1={plotTop} y2={plotTop + GRAPH_HEIGHT} stroke="#c9d1c4" strokeWidth="1" />
          <text x={-(plotTop + GRAPH_HEIGHT / 2)} y="18" transform="rotate(-90)" textAnchor="middle" fontSize="13" fontWeight="500" fill={CHART_INK} fontFamily={FONT}>
            {cumulativeLabel}{logScale ? ' · log scale' : ''}
          </text>

          <g clipPath={`url(#${clipId})`}>
            {(annotations?.phaseRanges || []).map((range, index) => {
              if (aggregation !== 'Per Session' && (getObservationKey({ timestamp: range.endDate }, aggregation) < measuredKeys[0] || getObservationKey({ timestamp: range.startDate }, aggregation) > measuredKeys.at(-1))) return null;
              const startX = getAnnotationX(range.startDate, true);
              const endX = getAnnotationX(range.endDate, true);
              if (startX == null || endX == null) return null;
              const rangeWidth = Math.max(12, Math.abs(endX - startX));
              return <g key={range.id || index}>
                <rect x={Math.min(startX, endX)} y={plotTop} width={rangeWidth} height={GRAPH_HEIGHT} fill={range.color || '#71957f33'} />
                <text x={Math.min(startX, endX) + rangeWidth / 2} y={plotTop + 14} textAnchor="middle" fontSize="12" fontWeight="500" fill={CHART_INK} fontFamily={FONT}>{range.label}</text>
              </g>;
            })}

            {overlays.envelope && overlays.envelopeRange && <g>
              <rect x={getX(overlays.envelopeRange[0])} width={Math.max(2, getX(overlays.envelopeRange[1]) - getX(overlays.envelopeRange[0]))}
                y={getY(overlays.envelope.upper)} height={Math.max(1, getY(overlays.envelope.lower) - getY(overlays.envelope.upper))} fill="#71957f" opacity="0.13" />
              <title>{`Stability envelope: ${formatNumber(overlays.envelope.lower)}–${formatNumber(overlays.envelope.upper)} (±25% of the median); ${Math.round(overlays.envelope.percentWithin)}% of points inside`}</title>
            </g>}

            {(overlays.phaseMeans || []).map(segment => {
              const width = getX(segment.endKey) - getX(segment.startKey);
              return <g key={`${segment.startKey}-${segment.label}`}>
                <line x1={getX(segment.startKey)} x2={Math.max(getX(segment.endKey), getX(segment.startKey) + 6)} y1={getY(segment.mean)} y2={getY(segment.mean)} stroke="#294f3d" strokeWidth="2.2" strokeDasharray="10 4" opacity="0.85" />
                {width >= 70 && <text x={getX(segment.startKey) + 3} y={getY(segment.mean) - 5} fontSize="11" fontWeight="600" fill="#294f3d" fontFamily={FONT} stroke="#fff" strokeWidth="3" paintOrder="stroke">{`x̄ ${formatNumber(segment.mean)}`}</text>}
                <title>{`${segment.label}: mean ${formatNumber(segment.mean)}`}</title>
              </g>;
            })}

            {selectedKey && allKeys.includes(selectedKey) && <rect x={getX(selectedKey) - 9} y={plotTop} width="18" height={GRAPH_HEIGHT} fill="#34634c" opacity="0.1" rx="3" />}

            {overlays.goal && <g>
              <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={getY(overlays.goal.value)} y2={getY(overlays.goal.value)} stroke="#9b7a3d" strokeWidth="2" strokeDasharray="2 4" />
              <text x={WIDTH - PADDING.right - 4} y={getY(overlays.goal.value) - 6} textAnchor="end" fontSize="11" fontWeight="600" fill="#704b20" fontFamily={FONT}>{overlays.goal.label}</text>
            </g>}

            {overlays.forecast?.length > 0 && overlays.forecastFrom && (() => {
              const band = [...overlays.forecast.map(point => `${getX(point.xKey)},${getY(point.high)}`), ...[...overlays.forecast].reverse().map(point => `${getX(point.xKey)},${getY(point.low)}`)];
              return <g>
                <polygon points={band.join(' ')} fill="#697b96" opacity="0.16" />
                <path d={`M ${getX(overlays.forecastFrom.xKey)} ${getY(overlays.forecastFrom.y)} ${overlays.forecast.map(point => `L ${getX(point.xKey)} ${getY(point.y)}`).join(' ')}`} fill="none" stroke="#697b96" strokeWidth="2" strokeDasharray="5 5" />
                <text x={getX(overlays.forecast.at(-1).xKey)} y={getY(overlays.forecast.at(-1).high) - 6} textAnchor="end" fontSize="11" fontWeight="600" fill="#4b5a73" fontFamily={FONT}>Projection · 80% band</text>
              </g>;
            })()}

            {showAverageLine && averageValue !== null && <g className="transition-opacity">
              <line x1={PADDING.left} y1={getY(averageValue)} x2={WIDTH - PADDING.right} y2={getY(averageValue)} stroke="#34634c" strokeWidth="2" strokeDasharray="5 3" />
              <rect x={WIDTH - PADDING.right - 100} y={getY(averageValue) - 18} width="95" height="20" rx="3" fill="#34634c" />
              <text x={WIDTH - PADDING.right - 52} y={getY(averageValue) - 6} textAnchor="middle" fontSize="11" fontWeight="500" fill="#FFFFFF" fontFamily={FONT}>Avg: {averageLabel}</text>
              <title>Average value: {averageValue}</title>
            </g>}

            {showTrendLine && trendlinePoints && <g>
              <line x1={getX(trendlinePoints.start.xKey)} y1={getY(trendlinePoints.start.val)} x2={getX(trendlinePoints.end.xKey)} y2={getY(trendlinePoints.end.val)} stroke="#697b96" strokeWidth="2" strokeDasharray="6 4" />
              <title>{trendlinePoints.label || (regressionParams ? `Linear regression: y = ${regressionParams.slope}x + ${regressionParams.intercept}` : 'Direction from first to last observation')}</title>
            </g>}

            {overlays.movingAverage?.length > 1 && <path d={overlays.movingAverage.map((point, index) => `${index ? 'L' : 'M'} ${getX(point.xKey)} ${getY(point.y)}`).join(' ')} fill="none" stroke="#9b7a3d" strokeWidth="2.4" strokeLinecap="round" opacity="0.85">
              <title>Three-point moving average</title>
            </path>}

            {overlays.cdc && <g>
              <line x1={getX(overlays.cdc.startKey)} x2={getX(overlays.cdc.endKey)} y1={getY(overlays.cdc.meanLine)} y2={getY(overlays.cdc.meanLine)} stroke="#a36959" strokeWidth="1.8" strokeDasharray="8 3 2 3" />
              {overlays.cdc.trendLine.length > 1 && <path d={overlays.cdc.trendLine.map((point, index) => `${index ? 'L' : 'M'} ${getX(point.xKey)} ${getY(point.y)}`).join(' ')} fill="none" stroke="#a36959" strokeWidth="1.8" strokeDasharray="1 3" />}
              <text x={getX(overlays.cdc.startKey) + 4} y={getY(overlays.cdc.meanLine) + 14} fontSize="11" fontWeight="600" fill="#863c30" fontFamily={FONT}>CDC criterion lines</text>
            </g>}

            {/* Phase dividers: a light casing keeps the line readable where it crosses data. */}
            {dividers.map((divider, index) => <g key={`divider-${index}`}>
              <line x1={divider.x} x2={divider.x} y1={BAND.top + BAND.height + 3} y2={plotTop + GRAPH_HEIGHT}
                stroke="#FFFFFF" strokeWidth="4" opacity="0.75" />
              <line x1={divider.x} x2={divider.x} y1={BAND.top + BAND.height + 3} y2={plotTop + GRAPH_HEIGHT}
                stroke={divider.color} strokeWidth={showPhaseLabels ? 1.6 : 1.4} strokeOpacity={showPhaseLabels ? 0.55 : 0.4}
                strokeDasharray={divider.dotted ? '4 4' : undefined} />
              <title>{divider.label ? `${divider.label} · ${divider.date}` : 'Phase change'}</title>
            </g>)}

            {plotSeries.map((series, seriesPosition) => {
              const solidDates = (annotations?.phaseLines || []).filter(line => line.style === 'Solid').map(line => line.date);
              const segments = [];
              let current = [];
              series.points.forEach(point => {
                if (solidDates.includes(point.xKey) && current.length) { segments.push(current); current = [point]; }
                else current.push(point);
              });
              if (current.length) segments.push(current);
              const dimmed = highlightKeys && overlays.analysisSeriesId === series.id;
              return <g key={series.id}>
                {chartType === 'bars' && series.points.map(point => {
                  const top = Math.min(getY(point.val), baselineY);
                  return <rect key={point.xKey} x={getX(point.xKey) + barOffset(seriesPosition)} y={top}
                    width={Math.max(3, barWidth - 1.5)} height={Math.max(1.5, Math.abs(baselineY - getY(point.val)))}
                    rx="2" fill={series.color} opacity={dimmed ? 0.45 : 0.9}>
                    <title>{`Target: ${series.name}\n${aggregation === 'Per Session' ? 'Session' : 'Date'}: ${point.xKey}\nValue: ${point.displayVal}`}</title>
                  </rect>;
                })}
                {chartType !== 'bars' && chartType !== 'points' && segments.map((segment, index) => <path key={index} d={segment.map((point, position) => `${position ? 'L' : 'M'} ${getX(point.xKey)} ${getY(point.val)}`).join(' ')}
                  fill="none" stroke={series.color} strokeWidth={series.isSummary ? 2.6 : 2.2} strokeDasharray={series.isSummary ? '8 4' : undefined}
                  strokeLinecap="round" strokeLinejoin="round" opacity={dimmed ? 0.45 : 1} />)}
                {series.points.map(point => {
                  const x = getX(point.xKey) + (chartType === 'bars' ? barOffset(seriesPosition) + barWidth / 2 : 0);
                  const y = getY(point.val);
                  const emphasized = point.xKey === shownKey || point.xKey === selectedKey;
                  const ioa = overlays.ioaKeys?.get?.(`${series.id}|${point.xKey}`);
                  const highlighted = highlightKeys?.has(`${series.id}|${point.xKey}`);
                  const beyond = overlays.cdc?.beyondKeys?.has(`${series.id}|${point.xKey}`);
                  const size = emphasized ? 5.5 : (chartType === 'points' ? 4.5 : 4.5);
                  const showMarker = chartType !== 'bars' || emphasized || highlighted || ioa != null;
                  return <g key={point.xKey} className="chart-point">
                    {ioa != null && <circle cx={x} cy={y} r="9" fill="none" stroke={ioa < 80 ? '#a34436' : '#527d82'} strokeWidth="1.6" strokeDasharray={ioa < 80 ? '2 2' : undefined} />}
                    {highlighted && <circle cx={x} cy={y} r="10" fill="#9b7a3d" opacity="0.28" />}
                    {showMarker && (() => {
                      const shape = emphasized && chartType === 'points' && seriesShapes[seriesPosition] === 'squareOpen' ? 'circleOpen' : seriesShapes[seriesPosition];
                      const marker = markerElement(shape, {
                        x, y, size: chartType === 'points' ? (emphasized ? 6 : 4.6) : size,
                        color: series.color, fill: beyond ? series.color : undefined
                      });
                      return createElement(marker.tag, { ...marker.props, opacity: dimmed && !highlighted ? 0.5 : 1 });
                    })()}
                    <title>{`Target: ${series.name}\n${aggregation === 'Per Session' ? 'Session' : 'Date'}: ${point.xKey}\nValue: ${point.displayVal}\nTherapist: ${point.therapist || 'Recorded'}${ioa != null ? `\nIOA: ${ioa}%` : ''}`}</title>
                  </g>;
                })}
              </g>;
            })}

            {overlays.median != null && <g>
              <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={getY(overlays.median)} y2={getY(overlays.median)} stroke="#527d82" strokeWidth="2" strokeDasharray="12 4" />
              <rect x={PADDING.left + 4} y={getY(overlays.median) - 18} width="104" height="20" rx="3" fill="#527d82" />
              <text x={PADDING.left + 56} y={getY(overlays.median) - 6} textAnchor="middle" fontSize="11" fontWeight="500" fill="#FFFFFF" fontFamily={FONT}>Median: {formatNumber(overlays.median)}</text>
            </g>}

            {overlays.splitMiddle && <g>
              <line x1={getX(overlays.splitMiddle.start.xKey)} y1={getY(overlays.splitMiddle.start.val)} x2={getX(overlays.splitMiddle.end.xKey)} y2={getY(overlays.splitMiddle.end.val)} stroke="#4b5a73" strokeWidth="2" strokeDasharray="14 4 3 4" />
              <title>Split-middle line of progress (White &amp; Haring, 1980)</title>
            </g>}

            {shownKey && <line x1={getX(shownKey)} x2={getX(shownKey)} y1={plotTop} y2={plotTop + GRAPH_HEIGHT} stroke="#29372a" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" pointerEvents="none" />}
          </g>

          {/* Value labels sit outside the clipped area so top-of-range points keep theirs. */}
          {showValues && allKeys.length <= 24 && plotSeries.map(series => series.points
            .filter(point => point.val >= yMin && point.val <= yMax)
            .map(point => <text key={`${series.id}-${point.xKey}`}
              x={getX(point.xKey) + (chartType === 'bars' ? barOffset(plotSeries.indexOf(series)) + barWidth / 2 : 0)}
              y={getY(point.val) - (chartType === 'bars' ? 4 : 9)} textAnchor="middle" fontSize="10" fontWeight="600" fill={CHART_INK}
              stroke="#FFFFFF" strokeWidth="3" paintOrder="stroke" fontFamily={FONT} pointerEvents="none">{valueText(point)}</text>))}

          {outsideCount > 0 && <text x={WIDTH - PADDING.right - 4} y={plotTop + 13} textAnchor="end" fontSize="11" fontWeight="600" fill="#863c30"
            stroke="#FFFFFF" strokeWidth="3" paintOrder="stroke" fontFamily={FONT}>
            {outsideCount} observation{outsideCount === 1 ? '' : 's'} outside the axis range
          </text>}

          {suppressed && (suppressed.trials > 0 || suppressed.shortObservations > 0) && <text x={PADDING.left + 4} y={plotTop + 13}
            fontSize="11" fontWeight="600" fill="#4b5a73" stroke="#FFFFFF" strokeWidth="3" paintOrder="stroke" fontFamily={FONT}>
            {[suppressed.trials ? `${suppressed.trials} low-trial session${suppressed.trials === 1 ? '' : 's'}` : null,
              suppressed.shortObservations ? `${suppressed.shortObservations} short observation${suppressed.shortObservations === 1 ? '' : 's'}` : null]
              .filter(Boolean).join(' · ')} hidden by the graphing policy
          </text>}

          {showPhaseLabels && lineLabels.map(({ line, x, row }, index) => <g key={line.id || index}>
            <rect x={Math.min(x - 4, WIDTH - PADDING.right - 150)} y={4 + row * 24} width="150" height="20" rx="3" fill="#294f3d" opacity="0.92" />
            <text x={Math.min(x + 2, WIDTH - PADDING.right - 144)} y={18 + row * 24} fontSize="11" fontWeight="500" fill="#FFFFFF" fontFamily={FONT}>
              {fitText(line.label, 140)}
            </text>
            <title>{`${line.label} · ${line.date}${line.isAutomated ? ' · automated' : ''}`}</title>
          </g>)}

          {milestoneMarkers.map(milestone => <g key={`${milestone.kind}-${milestone.date}`}>
            <polygon points={`${milestone.x},${plotTop + GRAPH_HEIGHT - 7} ${milestone.x - 5},${plotTop + GRAPH_HEIGHT + 4} ${milestone.x + 5},${plotTop + GRAPH_HEIGHT + 4}`}
              fill={milestone.kind === 'Introduced' ? '#4b5a73' : '#294f3d'} opacity="0.9" />
            <title>{`${milestone.label} · ${milestone.date}`}</title>
          </g>)}

          {(annotations?.graphNotes || []).map((note, index) => {
            const x = getAnnotationX(note.date);
            if (x == null) return null;
            return <g key={note.id || index} className="chart-point">
              <circle cx={x} cy={chartHeight - PADDING.bottom + 12} r="8" fill={note.color || '#34634c'} stroke="#FFFFFF" strokeWidth="1.5" />
              <text x={x} y={chartHeight - PADDING.bottom + 15.5} textAnchor="middle" fontSize="10" fontWeight="600" fontFamily={FONT} fill={chartMarkerInk(note.color || '#34634c')}>N</text>
              <title>{`Note by ${note.staffName} (${note.date}):\n${note.noteText}`}</title>
            </g>;
          })}

          {noteLabels.map(label => {
            const boxTop = plotTop - label.rowY - label.boxHeight;
            return <line key={`leader-${label.key}`} x1={label.x} y1={BAND.top + BAND.height + 4}
              x2={label.boxLeft + label.width / 2} y2={boxTop}
              stroke={label.note.color || '#34634c'} strokeWidth="1" opacity="0.5" pointerEvents="none" />;
          })}
          {noteLabels.map(label => {
            const boxTop = plotTop - label.rowY - label.boxHeight;
            return <g key={`label-${label.key}`} className="chart-note-label">
              <rect x={label.boxLeft} y={boxTop} width={label.width} height={label.boxHeight} rx="3"
                fill="#FFFFFF" stroke={label.note.color || '#34634c'} strokeWidth="1.1" pointerEvents="none" />
              {label.lines.map((line, index) => <text key={index} x={label.boxLeft + 7} y={boxTop + 6 + index * 14}
                fontSize="11" fontWeight="500" fill={CHART_INK} fontFamily={FONT} pointerEvents="none">
                {line}
              </text>)}
              <title>{`Note by ${label.note.staffName} (${label.date}): ${label.text}`}</title>
            </g>;
          })}

          {allKeys.map((key, index) => {
            const every = Math.ceil(allKeys.length / (aggregation === 'Weekly' ? 7 : aggregation === 'Monthly' ? 10 : 14));
            const last = index === allKeys.length - 1;
            if (every > 1 && index % every !== 0 && !(last && index % every >= every / 2)) return null;
            const projected = forecastKeys.includes(key);
            return <text key={key} x={getX(key)} y={chartHeight - PADDING.bottom + 36} textAnchor="middle" fontSize="12" fill={projected ? '#4b5a73' : CHART_MUTED} fontStyle={projected ? 'italic' : undefined} fontFamily={FONT}>
              {formatChartDate(key, aggregation)}
            </text>;
          })}
          <text x={PADDING.left + GRAPH_WIDTH / 2} y={chartHeight - 8} textAnchor="middle" fontSize="13" fontWeight="500" fill={CHART_INK} fontFamily={FONT}>
            {aggregation === 'Per Session' ? 'Session timeline' : 'Observation date'}
          </text>

          <rect x={PADDING.left - 10} y={plotTop} width={GRAPH_WIDTH + 20} height={GRAPH_HEIGHT} fill="transparent" className="chart-hit-area"
            onPointerMove={event => { setPointerActive(true); setActiveKey(keyAtClientX(event.clientX)); }}
            onPointerLeave={() => { setPointerActive(false); setActiveKey(null); }}
            onClick={event => { const key = keyAtClientX(event.clientX); if (key) onSelect?.(key); }} />
        </svg>
        {tooltipKey && tooltipPoints.length > 0 && <div className={`chart-tooltip${tooltipLeft > 62 ? ' chart-tooltip--left' : ''}`} style={{ left: `${tooltipLeft}%`, top: `${Math.max(4, tooltipTop)}%` }} aria-hidden="true">
          <strong>{formatChartDate(tooltipKey, aggregation)}</strong>
          {tooltipPoints.map(({ series, point }) => <span key={series.id} className="chart-tooltip-row">
            <i style={{ background: series.color }} />{series.name}{series.isSummary ? ' (combined)' : ''}<b>{point.displayVal}</b>
          </span>)}
          {tooltipPoints[0].point.therapist && <small>{tooltipPoints[0].point.therapist}</small>}
          {tooltipPoints[0].point.range && <small>Range across targets: {tooltipPoints[0].point.range.min}–{tooltipPoints[0].point.range.max}</small>}
          <small className="chart-tooltip-hint">{onSelect ? 'Click or press Enter for details' : ''}</small>
        </div>}
      </div>
    </div>
    <p className="sr-only" aria-live="polite">{announce}</p>
  </div>;
});

export default TargetChart;
