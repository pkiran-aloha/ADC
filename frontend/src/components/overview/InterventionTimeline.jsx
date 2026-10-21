import { useMemo, useState } from 'react';
import SectionHeader from '../ui/SectionHeader';
import SegmentedControl from '../ui/SegmentedControl';
import EmptyState from '../ui/EmptyState';
import { ArrowUpRight, Clock } from '../ui/Icons';
import { formatScopeDate } from '../../utils/analyticsScope';
import {
  TIMELINE_FILTERS, TIMELINE_KINDS, TIMELINE_LIMIT, buildInterventionTimeline,
  describeTimelineEvent, filterTimelineEvents, groupTimelineByMonth
} from '../../utils/interventionTimeline';

// One chronological, date-deduped feed for the whole client: phase transitions (with the phase
// line recorded alongside them folded in), intervention lines, phase ranges and graph notes.
// Selecting an event opens that target's chart in target analysis through the same focus
// request the attention cards and health matrix use, scoped to the event's date.
export default function InterventionTimeline({
  programs = [], phaseLines = [], phaseRanges = [], graphNotes = [],
  asOfDate, windowStart = null, programScope = 'all', rangePhrase = 'the selected range',
  onOpen
}) {
  const [filterId, setFilterId] = useState('all');
  const [expanded, setExpanded] = useState(false);

  const timeline = useMemo(
    () => buildInterventionTimeline({ programs, phaseLines, phaseRanges, graphNotes, asOfDate, windowStart, programScope }),
    [programs, phaseLines, phaseRanges, graphNotes, asOfDate, windowStart, programScope]
  );
  const events = useMemo(() => filterTimelineEvents(timeline.events, filterId), [timeline.events, filterId]);
  // The feed is capped until the reviewer asks for the full history; both slices are memoized so
  // a scope change recomputes the merge once, not once per render.
  const visible = useMemo(() => (expanded ? events : events.slice(0, TIMELINE_LIMIT)), [events, expanded]);
  const groups = useMemo(() => groupTimelineByMonth(visible), [visible]);

  const contextCount = timeline.counts.line + timeline.counts.range + timeline.counts.note;
  const filterOptions = TIMELINE_FILTERS.map(filter => {
    if (filter.id === 'all') return { value: filter.id, label: `All (${timeline.total})`, accessibleLabel: `All ${timeline.total} events` };
    if (filter.id === 'phases') return { value: filter.id, label: `Phase changes (${timeline.counts.phase})`, accessibleLabel: `Phase changes, ${timeline.counts.phase} events` };
    return { value: filter.id, label: `Notes & ranges (${contextCount})`, accessibleLabel: `Phase lines, ranges and graph notes, ${contextCount} events` };
  });

  return <section className="panel timeline-panel" aria-labelledby="timeline-title">
    <SectionHeader id="timeline-title" title="Intervention timeline"
      description={`Phase changes, phase lines, ranges and graph notes merged into one dated feed for ${rangePhrase}.`}
      help="Events come from what each target already records: its phase history, phase lines, phase ranges and graph notes. A phase change absorbs the automated phase line — or an identically worded manual line — recorded for the same target on the same date, so each change appears once. Manual intervention lines, ranges and notes stay separate. Select an event to open that target's chart scoped to its date; use the table below for a plain-text view."
      actions={<SegmentedControl label="Timeline events" value={filterId} onChange={value => { setFilterId(value); setExpanded(false); }}
        options={filterOptions} />} />
    <div className="panel-body">
      <p className="timeline-scope">
        <span>{timeline.total} event{timeline.total === 1 ? '' : 's'} · {timeline.counts.phase} phase change{timeline.counts.phase === 1 ? '' : 's'} · newest first</span>
        {timeline.lastDate && <span>Last change {formatScopeDate(timeline.lastDate)}</span>}
      </p>
      {!timeline.total ? (
        <EmptyState icon={Clock} title="No recorded changes in this range."
          description="Try a longer time range above, or add a phase line or graph note to a target in target analysis." />
      ) : !events.length ? (
        <p className="field-hint">No events match this filter. Choose “All” to see the whole feed.</p>
      ) : <>
        <div className="timeline-groups">
          {groups.map(group => <section key={group.id} className="timeline-group" aria-labelledby={`timeline-month-${group.id}`}>
            <h3 id={`timeline-month-${group.id}`} className="timeline-month">{group.label}</h3>
            <ol className="timeline-feed">
              {group.events.map(event => <li key={event.key} className={`timeline-item timeline-item--${event.tone}`}>
                <span className="timeline-item__dot" aria-hidden="true" />
                <button type="button" className="timeline-event" aria-label={describeTimelineEvent(event)}
                  onClick={() => onOpen?.(event)}>
                  <time className="timeline-event__date" dateTime={event.date}>{formatScopeDate(event.date)}</time>
                  <span className="timeline-event__body">
                    <span className="timeline-event__top">
                      <span className={`stat-chip stat-chip--${event.tone}`}>{TIMELINE_KINDS[event.kind].label}</span>
                      {event.kind === 'phase' && <span className="timeline-event__phase">{event.phaseLabel}</span>}
                      {event.companions.length > 0 && <span className="timeline-event__flag">
                        {event.companions.some(companion => companion.automated) ? 'Automated line merged' : 'Phase line merged'}
                      </span>}
                    </span>
                    <strong className="timeline-event__title">{event.title}</strong>
                    <small className="timeline-event__meta">{event.targetName} · {event.programName}</small>
                    {event.kind === 'range' && event.endDate && <small className="timeline-event__meta">Runs through {formatScopeDate(event.endDate)}</small>}
                    {event.companions.length > 0 && <small className="timeline-event__meta">
                      Also recorded: {event.companions.map(companion => companion.label).join(' · ')}
                    </small>}
                    {event.detail && event.kind !== 'range' && <small className="timeline-event__meta">{event.detail}</small>}
                  </span>
                  <span className="timeline-event__action" aria-hidden="true"><ArrowUpRight size={16} /></span>
                </button>
              </li>)}
            </ol>
          </section>)}
        </div>
        {events.length > TIMELINE_LIMIT && <div className="timeline-more">
          <button type="button" className="button button--secondary" aria-expanded={expanded}
            onClick={() => setExpanded(value => !value)}>
            {expanded ? 'Show fewer events' : `Show all ${events.length} events`}
          </button>
        </div>}
        <details className="chart-data timeline-data">
          <summary>View timeline as a table ({events.length})</summary>
          <div className="data-table-scroll" tabIndex={0} role="region" aria-label="Intervention timeline events">
            <table className="data-table timeline-table">
              <caption className="sr-only">Intervention timeline for {rangePhrase}: every merged event, newest first</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">Event</th><th scope="col">Kind</th><th scope="col">Target &amp; program</th><th scope="col">Source</th></tr></thead>
              <tbody>{events.map(event => <tr key={event.key}>
                <td>{formatScopeDate(event.date)}{event.kind === 'range' && event.endDate ? ` – ${formatScopeDate(event.endDate)}` : ''}</td>
                <td>{event.title}{event.companions.length ? ` (with ${event.companions.map(companion => companion.label).join(', ')})` : ''}</td>
                <td>{TIMELINE_KINDS[event.kind].label}</td>
                <td>{event.targetName}<small>{event.programName}</small></td>
                <td>{event.source}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </details>
        <p className="analysis-footnote">A phase change absorbs the phase line recorded with it on the same date; ranges, notes and unrelated intervention lines stay separate events. Select a row to open that target in target analysis, scoped to that date. Everything here is read from the records already shown on the target graphs.</p>
      </>}
    </div>
  </section>;
}
