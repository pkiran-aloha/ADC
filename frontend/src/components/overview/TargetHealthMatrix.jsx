import { useMemo } from 'react';
import SectionHeader from '../ui/SectionHeader';
import { MEASUREMENT_LABELS } from '../../utils/formValidation';
import { PHASE_LABELS, deltaText, trendTone, forecastLabel, healthFilterLabel } from '../../utils/targetHealth';

const LIFECYCLE_TONE = { mastered: 'positive', paused: 'attention', ended: 'neutral', active: 'neutral' };

// One row per measured target: the portfolio-level triage table. Rows are real, keyboard-
// operable controls that drill into the existing target analysis via a focus request.
export default function TargetHealthMatrix({ items = [], filter = null, onClearFilter, onOpen }) {
  const rows = useMemo(() => {
    const severity = item => Math.min(...item.flags.map(flag => (flag.tone === 'negative' ? 0 : 1)));
    return [...items].sort((a, b) => {
      if (a.needsReview !== b.needsReview) return a.needsReview ? -1 : 1;
      if (a.needsReview && b.needsReview && severity(a) !== severity(b)) return severity(a) - severity(b);
      if (a.lifecycle !== b.lifecycle) return a.lifecycle.localeCompare(b.lifecycle);
      return a.targetName.localeCompare(b.targetName);
    });
  }, [items]);

  function onRowKeyDown(event, item) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onOpen(item);
  }

  return (
    <section className="panel health-matrix-panel" aria-labelledby="health-matrix-title">
      <SectionHeader id="health-matrix-title" title="Target health matrix"
        description="Every measured target on one screen. Select a row to open its chart and trials."
        help="Trend compares the last 12 weekly points in therapeutic direction — decreasing problem behavior is improving. Forecast uses the target's mastery rule and the current trend; projections assume conditions stay the same and are planning support, not a promise."
        actions={filter ? (
          <span className="matrix-filter">
            <span className="stat-chip stat-chip--attention">Filtered: {healthFilterLabel(filter)} · {rows.length}</span>
            <button type="button" className="button button--tertiary" onClick={onClearFilter}>Clear filter</button>
          </span>
        ) : null} />
      <div className="panel-body">
        <div className="data-table-scroll" tabIndex={0} role="region" aria-label="Target health matrix; scroll horizontally for all columns">
          <table className="data-table health-matrix">
            <caption className="sr-only">Trend, status, forecast and current level for each measured target over the last 90 days</caption>
            <thead>
              <tr>
                <th scope="col">Clinical item</th>
                <th scope="col">Type</th>
                <th scope="col">Trend (90d)</th>
                <th scope="col">Status</th>
                <th scope="col">Forecast</th>
                <th scope="col">Current level</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6}>
                  <p className="field-hint">No targets match the “{healthFilterLabel(filter)}” filter.</p>
                  <button type="button" className="button button--secondary" onClick={onClearFilter}>Show all targets</button>
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
