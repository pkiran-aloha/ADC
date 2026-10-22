import { useMemo, useState } from 'react';
import { HeatMatrix, FunctionBars, Scatterplot, TimeOfDayScatter, FlowDiagram, ForestPlot, MiniTrend } from './AbcVisuals';
import { FUNCTION_COLORS } from '../../utils/chartTheme';
import {
  contingency, functionProfile, scatterplot, weekdayBlockRates, precursorChains, settingEventEffects, sequenceFlows,
  intensityTrend, phaseOn, timeOfDayPattern, timeOfDayShares, FUNCTIONS, clockLabel
} from '../../utils/abcAnalytics';
import { formatNumber } from '../../utils/targetAnalytics';

const SHOW = [
  { value: 'count', label: 'Counts' },
  { value: 'conditional', label: 'Conditional %' },
  { value: 'lift', label: 'Lift' }
];

// Descriptive patterns in the ABC log. Every cell drills into the matching records.
export default function AbcPatterns({ entries, allEntries, config, behaviorTargets, serviceSessions, sessionRows, onDrill }) {
  const [show, setShow] = useState('conditional');
  const [preIntervention, setPreIntervention] = useState(true);
  const behaviors = useMemo(() => config?.behaviors || [], [config]);
  const targetByName = useMemo(() => new Map(behaviorTargets.map(target => [target.name, target])), [behaviorTargets]);
  const antecedentTable = useMemo(() => contingency(entries, entry => entry.antecedents, entry => entry.behaviors, { rowOrder: config?.antecedents || [], columnOrder: behaviors }), [entries, config, behaviors]);
  const consequenceTable = useMemo(() => contingency(entries, entry => entry.consequences, entry => entry.behaviors, { rowOrder: config?.consequences || [], columnOrder: behaviors }), [entries, config, behaviors]);
  // Function profiles use records made before each behavior's intervention began, when
  // consequences reflected the natural contingencies rather than the treatment protocol.
  const profileEntries = preIntervention
    ? allEntries.filter(entry => entry.behaviors.some(name => phaseOn(targetByName.get(name), entry.timestamp) === 'Baseline'))
    : entries;
  const profiles = useMemo(() => functionProfile(profileEntries, behaviors, config?.consequenceFunctions || {}).map(profile => {
    const noSocial = profileEntries.filter(entry => entry.behaviors.includes(profile.behavior) &&
      entry.consequences.every(name => ['None', 'Sensory'].includes(config?.consequenceFunctions?.[name] || 'None'))).length;
    const automaticShare = profile.n ? noSocial / profile.n : 0;
    return automaticShare > profile.leadingShare ? { ...profile, leading: 'Automatic', leadingShare: automaticShare } : profile;
  }), [profileEntries, behaviors, config]);
  const documented = Object.fromEntries(behaviorTargets.map(target => [target.name, target.functionHypothesis]));
  const plot = useMemo(() => scatterplot(entries, serviceSessions, { blockMinutes: 30 }), [entries, serviceSessions]);
  const rates = useMemo(() => weekdayBlockRates(entries, serviceSessions, { blockMinutes: 60 }), [entries, serviceSessions]);
  const chains = useMemo(() => precursorChains(entries).chains.filter(chain => chain.from !== chain.to && chain.n >= 2).slice(0, 5), [entries]);
  const effects = useMemo(() => settingEventEffects(sessionRows, serviceSessions, behaviorTargets.map(target => target.id)), [sessionRows, serviceSessions, behaviorTargets]);
  const flows = useMemo(() => sequenceFlows(entries, config), [entries, config]);
  const trend = useMemo(() => intensityTrend(entries, behaviors), [entries, behaviors]);
  const dayPattern = useMemo(() => timeOfDayPattern(entries, { binMinutes: 60, behaviors }), [entries, behaviors]);
  const dayShares = useMemo(() => timeOfDayShares(dayPattern), [dayPattern]);

  if (entries.length < 5) return <div className="analysis-empty"><p><strong>Patterns need more records.</strong> Choose a longer date range to analyze antecedents, consequences and timing.</p></div>;
  const cellFor = (table, row, column, kind) => {
    const count = table.count(row, column);
    const conditional = table.rowGivenColumn(row, column);
    const lift = table.lift(row, column);
    const value = show === 'count' ? count : show === 'lift' ? lift : conditional;
    const label = show === 'count' ? String(count) : show === 'lift' ? (lift == null ? '–' : `×${formatNumber(lift, 1)}`) : `${Math.round((conditional || 0) * 100)}%`;
    return {
      count, intensity: show === 'lift' ? Math.max(0, (lift || 0) - 0.5) : value || 0, label,
      title: `${row} with ${column}: ${count} records; ${Math.round((conditional || 0) * 100)}% of ${column} episodes had this ${kind}; lift ×${formatNumber(lift, 2)} versus all episodes`
    };
  };
  return <div className="abc-patterns">
    <div className="abc-patterns-toolbar">
      <div className="control-field"><label htmlFor="abc-matrix-show">Matrix values</label>
        <select id="abc-matrix-show" value={show} onChange={event => setShow(event.target.value)}>{SHOW.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      <p className="field-hint">{entries.length} records in range · select a cell to open the matching records in the log.</p>
    </div>
    <div className="abc-grid">
      <article id="abc-pattern-antecedents" className="abc-card abc-card--wide section-anchor" aria-labelledby="abc-a-b" tabIndex={-1}>
        <h3 id="abc-a-b">Antecedents before each behavior</h3>
        <p className="abc-card-note">Conditional % = share of a behavior’s episodes preceded by the antecedent. Lift compares that share with all recorded episodes (above ×1 = over-represented).</p>
        <HeatMatrix caption="Antecedent by behavior matrix" cornerLabel="Antecedent" rows={antecedentTable.rows} columns={antecedentTable.columns}
          rowHeader={row => <span className="heat-row-label">{row}<small>{config?.antecedentCategories?.[row]}</small></span>}
          cell={(row, column) => cellFor(antecedentTable, row, column, 'antecedent')} onSelect={(row, column) => onDrill({ antecedent: row, behavior: column })} />
      </article>
      <article id="abc-pattern-consequences" className="abc-card abc-card--wide section-anchor" aria-labelledby="abc-b-c" tabIndex={-1}>
        <h3 id="abc-b-c">Consequences after each behavior</h3>
        <p className="abc-card-note">Row labels show the reinforcer each consequence would deliver if it maintained the behavior.</p>
        <HeatMatrix caption="Consequence by behavior matrix" cornerLabel="Consequence" rows={consequenceTable.rows} columns={consequenceTable.columns}
          rowHeader={row => <span className="heat-row-label">{row}<small><i className="function-dot" style={{ background: FUNCTION_COLORS[config?.consequenceFunctions?.[row] || 'None'] }} />{config?.consequenceFunctions?.[row] || 'None'}</small></span>}
          cell={(row, column) => cellFor(consequenceTable, row, column, 'consequence')} onSelect={(row, column) => onDrill({ consequence: row, behavior: column })} />
      </article>
      <article id="abc-pattern-function" className="abc-card section-anchor" aria-labelledby="abc-function" tabIndex={-1}>
        <div className="abc-card-head"><h3 id="abc-function">Descriptive function profile</h3>
          <label className="toggle-control"><input type="checkbox" checked={preIntervention} onChange={event => setPreIntervention(event.target.checked)} />Pre-intervention records</label></div>
        <FunctionBars profiles={profiles} documented={documented} />
        <ul className="prompt-legend">{FUNCTIONS.map(name => <li key={name}><i style={{ background: FUNCTION_COLORS[name] }} />{name === 'None' ? 'No social change' : name}</li>)}</ul>
        <p className="abc-card-note">Correlational only: staff responses such as blocking deliver attention even when escape maintains a behavior. Confirm hypotheses with a functional analysis (BACB TCO F.6).</p>
      </article>
      <article id="abc-pattern-setting-events" className="abc-card section-anchor" aria-labelledby="abc-events" tabIndex={-1}>
        <h3 id="abc-events">Setting events (motivating operations)</h3>
        <p className="abc-card-note">Episodes per hour in sessions with each event, relative to nearby sessions without events (±14 days), from the behavior data.</p>
        <ForestPlot effects={effects.map(effect => ({ label: effect.event, ratio: effect.ratio, low: effect.low, high: effect.high, n: effect.sessions }))} />
      </article>
      <article id="abc-pattern-timing" className="abc-card abc-card--wide section-anchor" aria-labelledby="abc-when" tabIndex={-1}>
        <h3 id="abc-when">When episodes happen</h3>
        <p className="abc-card-note">Scatterplot by date and half hour (Touchette, MacDonald &amp; Langer, 1985). Hatched cells had no session, so they are not zeros.</p>
        <Scatterplot plot={plot} />
        <div className="hotspots">
          <h4>Highest-risk windows (episodes per observed hour)</h4>
          {rates.hotspots.length ? <ul>{rates.hotspots.map(spot => <li key={`${spot.weekday}-${spot.block}`}>
            <button type="button" className="inspector-item inspector-item--stack" onClick={() => onDrill({ weekday: spot.weekday, block: spot.block })}>
              <span className="inspector-item-title">{spot.weekday} {spot.block}–{String(Number(spot.block.slice(0, 2)) + 1).padStart(2, '0')}:00 · ×{formatNumber(spot.ratio, 1)} the average</span>
              <span className="inspector-item-meta">{spot.count} records in {formatNumber(spot.hours, 0)} observed hours · {formatNumber(spot.rate, 2)} per hour</span>
            </button></li>)}</ul> : <p className="field-hint">No window has enough observation time yet.</p>}
        </div>
      </article>
      <article id="abc-pattern-time-of-day" className="abc-card abc-card--wide section-anchor" aria-labelledby="abc-clock" tabIndex={-1}>
        <h3 id="abc-clock">Time of day</h3>
        <p className="abc-card-note">Every recorded event by its timestamp (updated with each new entry), on a 24-hour axis. Use it to time toileting schedules or to see when episodes cluster within the day.</p>
        <TimeOfDayScatter pattern={dayPattern} />
        <div className="hotspots">
          <h4>Share of events by part of day</h4>
          <ul>{dayShares.filter(bucket => bucket.count > 0).map(bucket => <li key={bucket.id}>
            <span className="inspector-item-title">{bucket.label} · {bucket.count} events ({Math.round(bucket.share * 100)}%)</span>
            <span className="inspector-item-meta">{dayPattern.peak ? `Peak hour ${dayPattern.peak.label} with ${dayPattern.peak.count} events` : ''}</span>
          </li>)}</ul>
          {dayPattern.earliest != null && <p className="field-hint">Earliest event {clockLabel(dayPattern.earliest)} · latest {clockLabel(dayPattern.latest)}</p>}
        </div>
      </article>
      <article id="abc-pattern-flow" className="abc-card abc-card--wide section-anchor" aria-labelledby="abc-flow" tabIndex={-1}>
        <h3 id="abc-flow">From trigger to outcome</h3>
        <FlowDiagram flows={flows} behaviors={behaviors} />
      </article>
      <article id="abc-pattern-escalation" className="abc-card section-anchor" aria-labelledby="abc-chains" tabIndex={-1}>
        <h3 id="abc-chains">Escalation chains</h3>
        <p className="abc-card-note">How often one behavior is followed by another within 10 minutes in the same session (lag-sequential).</p>
        {chains.length ? <ul className="chain-list">{chains.map(chain => <li key={`${chain.from}-${chain.to}`}>
          <strong>{chain.from} → {chain.to}</strong>
          <span>{Math.round(chain.probability * 100)}% of {chain.sources} episodes · lift ×{formatNumber(chain.lift, 1)}</span>
          <span className={`stat-chip stat-chip--${chain.lift >= 1.5 ? 'attention' : 'neutral'}`}>{chain.lift >= 1.5 ? 'Possible precursor' : 'Weak link'}</span>
        </li>)}</ul> : <p className="field-hint">No repeated sequences in this range.</p>}
        <p className="abc-card-note">Precursors can be targeted earlier in the chain to prevent escalation.</p>
      </article>
      <article id="abc-pattern-intensity" className="abc-card section-anchor" aria-labelledby="abc-intensity" tabIndex={-1}>
        <h3 id="abc-intensity">Intensity by week</h3>
        <MiniTrend series={trend.series} weeks={trend.weeks} label="Weekly mean intensity per behavior (1–5)" />
      </article>
    </div>
  </div>;
}
