import { useEffect, useMemo, useRef, useState } from 'react';
import SectionHeader from '../ui/SectionHeader';
import { MEASUREMENT_LABELS } from '../../utils/formValidation';
import buildTargetHealth, {
  HEALTH_WINDOW_DAYS, PHASE_LABELS, deltaText, filterHealthItems, forecastLabel, healthFilterLabel, trendTone
} from '../../utils/targetHealth';

const LIFECYCLE_TONE = { mastered: 'positive', paused: 'attention', ended: 'neutral', active: 'neutral' };

// One row per measured target: the portfolio-level triage table. Rows are real, keyboard-
// operable controls that drill into the existing target analysis via a focus request.
//
// The matrix is an overview module of its own (placed near the end of the page), so it builds
// its own health rollup from the shared program scope and time range. `filter` is the KPI card
// the reviewer pressed; clearing it returns focus to this panel so the review continues in the
// table instead of dropping to the top of the document.
export default function TargetHealthMatrix({
  programs = [], sessions = [], asOfDate, windowDays = HEALTH_WINDOW_DAYS,
  rangePhrase = 'the last 90 days', filter = null, onClearFilter, onOpen
}) {
  const panelRef = useRef(null);
  const [status, setStatus] = useState('');

  const health = useMemo(
    () => buildTargetHealth({ programs, sessions, asOfDate, windowDays }),
    [programs, sessions, asOfDate, windowDays]
  );
  const items = useMemo(() => filterHealthItems(health.items, filter), [health.items, filter]);

  const rows = useMemo(() => {
    const severity = item => Math.min(...item.flags.map(flag => (flag.tone === 'negative' ? 0 : 1)));
    return [...items].sort((a, b) => {
      if (a.needsReview !== b.needsReview) return a.needsReview ? -1 : 1;
      if (a.needsReview && b.needsReview && severity(a) !== severity(b)) return severity(a) - severity(b);
      if (a.lifecycle !== b.lifecycle) return a.lifecycle.localeCompare(b.lifecycle);
      return a.targetName.localeCompare(b.targetName);
    });
  }, [items]);

  // Announce the filter state where the change is made. The first paint is the page's own
  // arrangement and stays silent; later changes (a KPI card, a scope change or Clear filter)
  // are spoken once through the status region.
  const announced = useRef(null);
  useEffect(() => {
    const signature = `${filter}|${rows.length}|${health.items.length}`;
    if (announced.current === signature) return;
    const firstPaint = announced.current === null;
    announced.current = signature;
    if (firstPaint) return;
    setStatus(filter
      ? `Filter applied: ${healthFilterLabel(filter)}. Showing ${rows.length} of ${health.items.length} targets.`
      : `Filter cleared. Showing all ${health.items.length} target${health.items.length === 1 ? '' : 's'}.`);
  }, [filter, rows.length, health.items.length]);

  function clearFilter() {
    onClearFilter?.();
    // The button that was pressed disappears with the filter, so focus moves to the panel
    // heading region rather than being lost to the document body.
    panelRef.current?.focus({ preventScroll: true });
  }

  function onRowKeyDown(event, item) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onOpen(item);
  }

  return (
    <section className="panel health-matrix-panel" aria-labelledby="health-matrix-title" ref={panelRef} tabIndex={-1}>
      <SectionHeader id="health-matrix-title" title="Target health matrix"
        description={`Every measured target on one screen for ${rangePhrase}. Select a row to open its chart and trials.`}
        help="Trend compares the last 12 weekly points in therapeutic direction — decreasing problem behavior is improving. Forecast uses the target's mastery rule and the current trend; projections assume conditions stay the same and are planning support, not a promise."
        actions={filter ? (
          <span className="matrix-filter">
            <span className="stat-chip stat-chip--attention">Filtered: {healthFilterLabel(filter)} · {rows.length} of {health.items.length}</span>
            <button type="button" className="button button--tertiary" onClick={clearFilter}>Clear filter</button>
          </span>
        ) : null} />
      <div className="panel-body">
        <p className="sr-only" role="status">{status}</p>
        <div className="data-table-scroll" tabIndex={0} role="region" aria-label="Target health matrix; scroll horizontally for all columns">
          <table className="data-table health-matrix">
            <caption className="sr-only">Trend, status, forecast and current level for each measured target over {rangePhrase}</caption>
            <thead>
              <tr>
                <th scope="col">Clinical item</th>
                <th scope="col">Type</th>
                {/* The shared scope decides the window and the panel description names it, so the
                    column does not repeat a day count that would be wrong for 6M, 1Y or ALL. */}
                <th scope="col">Trend</th>
                <th scope="col">Status</th>
                <th scope="col">Forecast</th>
                <th scope="col">Current level</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6}>
                  {filter ? (
                    <>
                      <p className="field-hint">No targets match the “{healthFilterLabel(filter)}” filter.</p>
                      <button type="button" className="button button--secondary" onClick={clearFilter}>Show all targets</button>
                    </>
                  ) : (
                    // Without a filter there is nothing to clear: say what the scope is missing and
                    // point at the controls that change it instead of offering a dead button.
                    <p className="field-hint">No measured targets in this program scope. Choose another program scope or a longer time range above.</p>
                  )}
                </td></tr>
              ) : rows.map(item => {
                const tone = trendTone(item);
                const lifecycleTone = LIFECYCLE_TONE[item.lifecycle] || 'neutral';
                return (
                  <tr key={item.targetId} className="health-matrix__row" tabIndex={0}
                    onClick={() => onOpen(item)}
                    onKeyDown={event => onRowKeyDown(event, item)}
                    aria-label={`${item.targetName}, ${item.programName}, ${deltaText(item)}, ${PHASE_LABELS[item.phase] || item.phase}. Open in target analysis.`}>
                    <td>
                      <strong>{item.targetName}</strong>
                      <small className="block text-slate-500">{item.programName}</small>
                    </td>
                    <td>{MEASUREMENT_LABELS[item.measurementType]}</td>
                    <td><span className={`health-delta health-delta--${tone}`}>{deltaText(item)}</span>
                      {item.trend === 'insufficient' && <small className="block text-slate-500">insufficient history</small>}
                    </td>
                    <td>
                      <span className={`stat-chip stat-chip--${lifecycleTone}`}>{PHASE_LABELS[item.phase] || item.phase}</span>
                      {item.flags.length > 0 && <small className="matrix-flags">{item.flags.map(flag => flag.label).join(' · ')}</small>}
                    </td>
                    <td>{forecastLabel(item)}</td>
                    <td>
                      {item.level ? (
                        <span className="level-bar" role="img"
                          aria-label={`Current level ${item.level.percent} percent of the mastery criterion`}>
                          <span className={`level-bar__fill level-bar__fill--${tone}`} style={{ width: `${item.level.percent}%` }} />
                        </span>
                      ) : <span aria-hidden="true">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="analysis-footnote">Trend percentages are fitted changes relative to each target's own average, so different measurement tools share one vocabulary. Bars compare the latest weekly value with the target's mastery criterion when the units match.</p>
      </div>
    </section>
  );
}
