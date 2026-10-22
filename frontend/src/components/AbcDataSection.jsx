import { useState, useMemo, useRef, lazy, Suspense } from 'react';
import { BarChart2, Table as TableIcon, LayoutList, RotateCw, ChevronLeft, ChevronRight, X } from './ui/Icons';
import SectionHeader from './ui/SectionHeader';
import ExportMenu from './ui/ExportMenu';
import SegmentedControl from './ui/SegmentedControl';
import SectionJumpNav from './ui/SectionJumpNav';
import EmptyState, { AnalyticsSkeleton } from './ui/EmptyState';
import { exportAbcDataCsv, exportSvgElement, exportPngFromSvg } from '../utils/exportUtils';
import { seriesColor, formatChartDate, CHART_GRID, CHART_MUTED, CHART_INK } from '../utils/chartTheme';
import { weekdayOf, timeBlock } from '../utils/abcAnalytics';
import { SEED_AS_OF_DATE } from '../data/mockData';

const AbcPatterns = lazy(() => import('./abc/AbcPatterns'));
const AbcForecast = lazy(() => import('./abc/AbcForecast'));
const RANGES = ['Past 3 Days', 'Past 5 Days', 'Past 7 Days', 'Past 1 Month', 'Past 3 Months', 'Past 6 Months', 'All'];
const FILTER_LABELS = { date: 'Date', behavior: 'Behavior', antecedent: 'Antecedent', consequence: 'Consequence', weekday: 'Weekday', block: 'Hour' };

export default function AbcDataSection({
  client,
  abcEntries = [],
  abcConfiguration = null,
  behaviorTargets = [],
  serviceSessions = [],
  sessionRows = [],
  onRefresh
}) {
  const [analysisMode, setAnalysisMode] = useState('Timeline');
  const [viewMode, setViewMode] = useState('Graph + Data');
  const [durationFilter, setDurationFilter] = useState('Past 1 Month');
  const [showGridlines, setShowGridlines] = useState(true);
  const [logPage, setLogPage] = useState(1);
  const [logFilter, setLogFilter] = useState({});
  const svgRef = useRef(null);
  const logRef = useRef(null);

  const minDate = useMemo(() => {
    const now = new Date(`${SEED_AS_OF_DATE}T23:59:59`);
    let minDate = new Date(now);
    switch (durationFilter) {
      case 'Past 3 Days': minDate.setDate(now.getDate() - 3); break;
      case 'Past 5 Days': minDate.setDate(now.getDate() - 5); break;
      case 'Past 7 Days': minDate.setDate(now.getDate() - 7); break;
      case 'Past 1 Month': minDate.setMonth(now.getMonth() - 1); break;
      case 'Past 3 Months': minDate.setMonth(now.getMonth() - 3); break;
      case 'Past 6 Months': minDate.setMonth(now.getMonth() - 6); break;
      case 'All': minDate = new Date(2020, 0, 1); break;
      default: minDate.setMonth(now.getMonth() - 1); break;
    }
    return minDate;
  }, [durationFilter]);
  const filteredEntries = useMemo(() => !client ? [] : abcEntries.filter(e => new Date(e.timestamp) >= minDate)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), [client, abcEntries, minDate]);
  const sessionsInRange = useMemo(() => serviceSessions.filter(session => new Date(`${session.date}T${session.start}:00`) >= minDate), [serviceSessions, minDate]);
  const rowsInRange = useMemo(() => sessionRows.filter(row => new Date(row.timestamp) >= minDate), [sessionRows, minDate]);

  // Log filters come from the drop-downs or from drilling into a chart or matrix cell.
  const logEntries = useMemo(() => filteredEntries.filter(entry => (!logFilter.date || entry.timestamp.startsWith(logFilter.date))
    && (!logFilter.behavior || entry.behaviors.includes(logFilter.behavior))
    && (!logFilter.antecedent || entry.antecedents.includes(logFilter.antecedent))
    && (!logFilter.consequence || entry.consequences.includes(logFilter.consequence))
    && (!logFilter.weekday || weekdayOf(entry.timestamp) === logFilter.weekday)
    && (!logFilter.block || timeBlock(entry.timestamp, 60) === logFilter.block)), [filteredEntries, logFilter]);

  const { dateKeys, behaviorList, stackedData, maxTotal } = useMemo(() => {
    const datesMap = new Map();
    const behaviorsSet = new Set();
    filteredEntries.forEach(entry => {
      const dateKey = entry.timestamp.substring(0, 10);
      if (!datesMap.has(dateKey)) datesMap.set(dateKey, {});
      (entry.behaviors || ['Other']).forEach(beh => {
        behaviorsSet.add(beh);
        datesMap.get(dateKey)[beh] = (datesMap.get(dateKey)[beh] || 0) + 1;
      });
    });
    const sortedDates = Array.from(datesMap.keys()).sort();
    const bList = Array.from(behaviorsSet);
    const sData = sortedDates.map(date => {
      const counts = datesMap.get(date);
      let total = 0;
      const segments = bList.map(beh => { const count = counts[beh] || 0; total += count; return { behavior: beh, count }; });
      return { date, total, segments };
    });
    return { dateKeys: sortedDates, behaviorList: bList, stackedData: sData, maxTotal: Math.max(3, ...sData.map(day => day.total + 1)) };
  }, [filteredEntries]);

  const handleExport = (type) => {
    if (!client) return;
    if (type === 'csv') return exportAbcDataCsv(logEntries, client.name);
    if (type === 'svg') return exportSvgElement(svgRef.current, `ABC_Data_${client.name}.svg`);
    if (type === 'png') return exportPngFromSvg(svgRef.current, `ABC_Data_${client.name}.png`);
  };

  function drill(filter, focusLog = true) {
    setLogFilter(filter);
    setLogPage(1);
    setAnalysisMode('Timeline');
    if (viewMode === 'Graph') setViewMode('Graph + Data');
    if (focusLog) requestAnimationFrame(() => requestAnimationFrame(() => logRef.current?.scrollIntoView({ block: 'start' })));
  }

  const width = 850;
  const height = 280;
  const padding = { top: 30, right: 30, bottom: 40, left: 55 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const barWidth = Math.min(36, Math.max(10, (graphWidth / Math.max(1, dateKeys.length)) * 0.6));
  const labelEvery = Math.max(1, Math.ceil(dateKeys.length / 14));
  function behaviorColor(behavior) {
    const index = (abcConfiguration?.behaviors || behaviorList).indexOf(behavior);
    return seriesColor(Math.max(index, 0));
  }
  const totalPages = Math.max(1, Math.ceil(logEntries.length / 8));
  const currentPage = Math.min(logPage, totalPages);
  const visibleRows = logEntries.slice((currentPage - 1) * 8, currentPage * 8);
  const activeFilters = Object.entries(logFilter).filter(([, value]) => value);
  const primarySetting = client?.primarySetting || 'Clinic';
  const sectionLinks = analysisMode === 'Timeline' && filteredEntries.length ? [
    ...(viewMode !== 'Data' ? [{ id: 'abc-chart-section', label: 'Timeline chart' }] : []),
    ...(viewMode !== 'Graph' ? [{ id: 'abc-observation-log', label: 'Observation log' }] : [])
  ] : analysisMode === 'Patterns' && filteredEntries.length >= 5 ? [
    { id: 'abc-pattern-antecedents', label: 'Antecedents' },
    { id: 'abc-pattern-consequences', label: 'Consequences' },
    { id: 'abc-pattern-function', label: 'Function profile' },
    { id: 'abc-pattern-setting-events', label: 'Setting events' },
    { id: 'abc-pattern-timing', label: 'Timing' },
    { id: 'abc-pattern-time-of-day', label: 'Time of day' },
    { id: 'abc-pattern-flow', label: 'Event flow' },
    { id: 'abc-pattern-escalation', label: 'Escalation' },
    { id: 'abc-pattern-intensity', label: 'Intensity' }
  ] : [];

  return <section id="abc-observations" className="panel" aria-labelledby="abc-title" tabIndex={-1}>
    <SectionHeader id="abc-title" title="ABC observations" description="Browse observations, the event log, and descriptive patterns."
      help="ABC stands for antecedent, behavior, and consequence. Location and setting events add context. These records describe what was observed; they don’t establish why a behavior occurred—confirm hypotheses with a functional analysis."
      actions={<>
        <ExportMenu label="Export ABC" disabled={!filteredEntries.length} onExport={handleExport} formats={[
          { id: 'csv', label: 'Observation log · CSV' },
          { id: 'svg', label: 'Vector chart · SVG', disabled: viewMode === 'Data' || analysisMode !== 'Timeline' },
          { id: 'png', label: 'Chart image · PNG', disabled: viewMode === 'Data' || analysisMode !== 'Timeline' }
        ]} />
        <button type="button" className="icon-button icon-button--bordered" onClick={onRefresh} aria-label="Refresh ABC observations"><RotateCw size={19} /></button>
      </>} />
    <div className="analysis-filters">
      <SegmentedControl label="ABC analysis" value={analysisMode} onChange={setAnalysisMode} options={[
        { value: 'Timeline', label: 'Timeline' }, { value: 'Patterns', label: 'Patterns' }, { value: 'Forecast', label: 'Forecast' }
      ]} />
      {analysisMode === 'Timeline' && <SegmentedControl label="ABC view" value={viewMode} onChange={setViewMode} options={[
        { value: 'Graph', label: 'Chart', icon: BarChart2 }, { value: 'Data', label: 'Log', icon: TableIcon }, { value: 'Graph + Data', label: 'Both', icon: LayoutList }
      ]} />}
      {analysisMode !== 'Forecast' && <div className="control-field"><label htmlFor="abc-date-range">Date range</label><select id="abc-date-range" value={durationFilter} onChange={event => { setDurationFilter(event.target.value); setLogPage(1); }}>
        {RANGES.map(value => <option key={value} value={value}>{value === 'All' ? 'All records' : value.slice(0, 1) + value.slice(1).toLowerCase()}</option>)}
      </select></div>}
      {analysisMode === 'Timeline' && viewMode !== 'Data' && <button type="button" className="toggle-control" aria-pressed={showGridlines} onClick={() => setShowGridlines(value => !value)}>Gridlines</button>}
    </div>
    {abcConfiguration && <details className="definition-details"><summary>Recording setup<span> · {abcConfiguration.treatmentArea}</span></summary>
      <p className="mt-3"><strong className="font-medium">Teaching instructions:</strong> {abcConfiguration.teachingInstructions}</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-4 mb-2">{[
        ['Antecedents', abcConfiguration.antecedents.map(item => `${item} (${abcConfiguration.antecedentCategories?.[item] || 'Other'})`)],
        ['Behaviors', abcConfiguration.behaviors],
        ['Consequences', abcConfiguration.consequences.map(item => `${item} (${abcConfiguration.consequenceFunctions?.[item] || 'None'})`)],
        ['Locations', abcConfiguration.locations]
      ].map(([label, values]) => <div key={label}><h3 className="font-medium text-slate-800">{label}</h3><ul className="space-y-1 mt-2 list-disc pl-4">{values.map(value => <li key={value}>{value}</li>)}</ul></div>)}</div>
    </details>}
    <SectionJumpNav label="ABC observation sections" items={sectionLinks} />
    <div className="panel-body">
      {analysisMode === 'Patterns' ? <Suspense fallback={<AnalyticsSkeleton />}>
        <AbcPatterns entries={filteredEntries} allEntries={abcEntries} config={abcConfiguration} behaviorTargets={behaviorTargets}
          serviceSessions={sessionsInRange} sessionRows={rowsInRange} onDrill={drill} />
      </Suspense>
        : analysisMode === 'Forecast' ? <Suspense fallback={<AnalyticsSkeleton />}>
          <AbcForecast entries={abcEntries} config={abcConfiguration} behaviorTargets={behaviorTargets} serviceSessions={serviceSessions} sessionRows={sessionRows} primarySetting={primarySetting} />
        </Suspense>
          : !filteredEntries.length ? <EmptyState title="No ABC observations in this range." description="Try a longer date range to see the client’s recorded context."
            action={durationFilter !== 'Past 6 Months' ? { label: 'Show past 6 months', onClick: () => { setDurationFilter('Past 6 Months'); setLogPage(1); } } : undefined} /> : <>
            {viewMode !== 'Data' && <div id="abc-chart-section" className="section-anchor" tabIndex={-1}>
              <div className="chart-scroll" tabIndex={0} role="region" aria-label="ABC behavior distribution chart. Scroll horizontally for the full timeline."><div className="chart-inner chart-inner--quantitative">
                <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label={`Behavior counts across ${dateKeys.length} observation dates. Select a bar segment to filter the observation log. Exact records appear in the observation log.`}>
                  <title>ABC behavior distribution</title><desc>Stacked daily behavior counts. Each segment has a labeled legend; the observation log below gives the complete context.</desc>
                  {[0, Math.round(maxTotal / 2), maxTotal].map((val, idx) => {
                    const y = padding.top + graphHeight - (val / maxTotal) * graphHeight;
                    return <g key={idx}>
                      {showGridlines && <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={CHART_GRID} strokeDasharray="4 4" />}
                      <text x={padding.left - 8} y={y + 3.5} textAnchor="end" fontSize="13" fill={CHART_MUTED} fontFamily="Geist, sans-serif">{val}</text>
                    </g>;
                  })}
                  <text x={-(padding.top + graphHeight / 2)} y="16" transform="rotate(-90)" textAnchor="middle" fontSize="13" fontWeight="500" fill={CHART_INK} fontFamily="Geist, sans-serif">Behaviors recorded</text>
                  {stackedData.map((dayData, dIdx) => {
                    const cx = padding.left + (stackedData.length > 1 ? (dIdx / (stackedData.length - 1)) * (graphWidth - barWidth) + barWidth / 2 : graphWidth / 2);
                    let currentY = padding.top + graphHeight;
                    const selected = logFilter.date === dayData.date;
                    return <g key={dayData.date}>
                      {selected && <rect x={cx - barWidth / 2 - 4} y={padding.top} width={barWidth + 8} height={graphHeight} rx="3" fill="#34634c" opacity="0.08" />}
                      {dayData.segments.map((seg, sIdx) => {
                        if (seg.count === 0) return null;
                        const segHeight = (seg.count / maxTotal) * graphHeight;
                        const sy = currentY - segHeight;
                        currentY = sy;
                        return <g key={sIdx} className="chart-point abc-bar" onClick={() => drill({ date: dayData.date, behavior: seg.behavior })}>
                          <rect x={cx - barWidth / 2} y={sy} width={barWidth} height={segHeight} fill={behaviorColor(seg.behavior)} rx="2" className="transition-opacity hover:opacity-85" />
                          <title>{`Date: ${dayData.date}\nBehavior: ${seg.behavior}\nCount: ${seg.count}\nSelect to filter the log`}</title>
                        </g>;
                      })}
                      {stackedData.length <= 31 && <text x={cx} y={currentY - 6} textAnchor="middle" fontSize="13" fontWeight="500" fill={CHART_INK} fontFamily="Geist, sans-serif">{dayData.total}</text>}
                      {dIdx % labelEvery === 0 && <text x={cx} y={height - padding.bottom + 18} textAnchor="middle" fontSize="12" fill={CHART_MUTED} fontFamily="Geist, sans-serif">{formatChartDate(dayData.date)}</text>}
                    </g>;
                  })}
                  <text x={padding.left + graphWidth / 2} y={height - 6} textAnchor="middle" fontSize="13" fontWeight="500" fill={CHART_INK} fontFamily="Geist, sans-serif">Observation dates</text>
                </svg>
              </div></div>
              <div className="chart-caption"><span>{filteredEntries.length} ABC observations · behaviors may co-occur · select a bar to filter the log</span><span className="scroll-hint">Scroll to see the full chart →</span></div>
              <div className="abc-legend">{behaviorList.map(behavior => <div key={behavior}><span className="legend-swatch" aria-hidden="true"><svg viewBox="0 0 12 12"><rect width="12" height="12" rx="2" fill={behaviorColor(behavior)} /></svg></span><span>{behavior}</span></div>)}</div>
            </div>}
            {viewMode !== 'Graph' && <section id="abc-observation-log" className="observation-log section-anchor" aria-labelledby="observation-log-title" ref={logRef} tabIndex={-1}>
              <div className="observation-log-head">
                <div><h3 id="observation-log-title">Observation log</h3><p>Most recent first · {logEntries.length} {activeFilters.length ? `of ${filteredEntries.length} ` : ''}records</p></div>
                <div className="log-filters">
                  <div className="control-field"><label htmlFor="log-behavior">Behavior</label><select id="log-behavior" value={logFilter.behavior || ''} onChange={event => { setLogFilter(previous => ({ ...previous, behavior: event.target.value || undefined })); setLogPage(1); }}>
                    <option value="">All behaviors</option>{(abcConfiguration?.behaviors || behaviorList).map(item => <option key={item} value={item}>{item}</option>)}</select></div>
                  <div className="control-field"><label htmlFor="log-antecedent">Antecedent</label><select id="log-antecedent" value={logFilter.antecedent || ''} onChange={event => { setLogFilter(previous => ({ ...previous, antecedent: event.target.value || undefined })); setLogPage(1); }}>
                    <option value="">All antecedents</option>{(abcConfiguration?.antecedents || []).map(item => <option key={item} value={item}>{item}</option>)}</select></div>
                  <div className="control-field"><label htmlFor="log-consequence">Consequence</label><select id="log-consequence" value={logFilter.consequence || ''} onChange={event => { setLogFilter(previous => ({ ...previous, consequence: event.target.value || undefined })); setLogPage(1); }}>
                    <option value="">All consequences</option>{(abcConfiguration?.consequences || []).map(item => <option key={item} value={item}>{item}</option>)}</select></div>
                </div>
              </div>
              {activeFilters.length > 0 && <div className="filter-chips" aria-label="Active log filters">
                {activeFilters.map(([key, value]) => <button key={key} type="button" className="filter-chip" onClick={() => { setLogFilter(previous => ({ ...previous, [key]: undefined })); setLogPage(1); }} aria-label={`Remove filter ${FILTER_LABELS[key]}: ${value}`}>
                  <span>{FILTER_LABELS[key]}: <strong>{key === 'date' ? formatChartDate(value) : value}</strong></span><X size={14} />
                </button>)}
                <button type="button" className="button button--tertiary" onClick={() => { setLogFilter({}); setLogPage(1); }}>Clear filters</button>
              </div>}
              {!logEntries.length ? <EmptyState title="No records match these filters." description="Remove a filter to see more of the log." /> : <>
                <div className="data-table-scroll" tabIndex={0} role="region" aria-label="ABC observation log. Scroll horizontally to read all columns.">
                  <table className="data-table abc-table"><caption className="sr-only">Antecedent, behavior, consequence and location records for {client?.name}, {durationFilter.toLowerCase()}.</caption>
                    <thead><tr><th scope="col">Date &amp; time</th><th scope="col">Clinician</th><th scope="col">Antecedent</th><th scope="col">Behavior</th><th scope="col">Consequence</th><th scope="col">Location</th><th scope="col">Notes</th></tr></thead>
                    <tbody>{visibleRows.map(row => <tr key={row.id}>
                      <td className="observation-date"><time dateTime={row.timestamp}>{formatChartDate(row.timestamp.slice(0, 10))}, {row.timestamp.slice(0, 4)}<small className="block text-slate-500 mt-1">{row.timestamp.slice(11, 16)}</small></time>
                        <small className="block text-slate-500 mt-1">Intensity {row.intensity}/5 · {row.durationMinutes} min</small></td>
                      <td className="observation-staff">{row.therapist}</td>
                      <td className="observation-context"><div className="table-tags">{row.antecedents.map((item, index) => <span key={index}>{item}</span>)}</div></td>
                      <td className="observation-context"><div className="table-tags table-tags--behavior">{row.behaviors.map((item, index) => <span key={index}>{item}</span>)}</div></td>
                      <td className="observation-context"><div className="table-tags">{row.consequences.map((item, index) => <span key={index}>{item}</span>)}</div></td>
                      <td className="observation-context">{row.location}</td>
                      <td className="observation-notes"><p>{row.notes || 'No note recorded.'}</p>{row.settingEvents?.length > 0 && <small className="block text-slate-500 mt-1">Setting events: {row.settingEvents.join(', ')}</small>}</td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <div className="chart-caption"><span>Antecedent → behavior → consequence → location</span><span className="scroll-hint">Scroll to see all columns →</span></div>
                {totalPages > 1 && <div className="pagination" aria-label="Observation log pagination"><span>{(currentPage - 1) * 8 + 1}–{Math.min(currentPage * 8, logEntries.length)} of {logEntries.length}</span><button type="button" className="icon-button icon-button--bordered" aria-label="Previous ABC records" disabled={currentPage <= 1} onClick={() => setLogPage(currentPage - 1)}><ChevronLeft size={18} /></button><button type="button" className="icon-button icon-button--bordered" aria-label="Next ABC records" disabled={currentPage >= totalPages} onClick={() => setLogPage(currentPage + 1)}><ChevronRight size={18} /></button></div>}
              </>}
            </section>}
          </>}
    </div>
  </section>;
}
