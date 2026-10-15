import { useState } from 'react';
import SegmentedControl from '../ui/SegmentedControl';
import { formatNumber, formatLongDate, targetMilestones } from '../../utils/targetAnalytics';
import { describeRule, describeReductionRule } from '../../utils/visualAnalysis';

const TABS = [
  { value: 'comparison', label: 'Phase comparison' },
  { value: 'progress', label: 'Progress & decisions' },
  { value: 'quality', label: 'Data quality' },
  { value: 'context', label: 'Context' }
];
const DIMENSIONS = [
  { value: 'clinician', label: 'Clinician' }, { value: 'setting', label: 'Setting' },
  { value: 'time', label: 'Time of day' }, { value: 'weekday', label: 'Weekday' }, { value: 'events', label: 'Setting events' }
];

function Chip({ tone = 'neutral', children }) {
  return <span className={`stat-chip stat-chip--${tone}`}>{children}</span>;
}

const direction = (value, better) => (value == null || Math.abs(value) < 1e-9 ? 'neutral' : (better === 'decrease' ? value < 0 : value > 0) ? 'positive' : 'attention');

export default function AnalysisPanel({
  tab, onTabChange, targetOptions, analysisTargetId, onAnalysisTargetChange, unit,
  comparison, onShowFullHistory, cdcOnChart, onToggleCdc,
  progress, quality, onInspectRow, context
}) {
  return <section className="analysis-panel" aria-labelledby="analysis-title">
    <header className="analysis-header">
      <div className="min-w-0">
        <h3 id="analysis-title">Visual analysis</h3>
        <p>Level, trend, variability, immediacy and overlap for the plotted data—quantified to support, not replace, inspection of the graph.</p>
      </div>
      {targetOptions.length > 1 && <div className="control-field analysis-target-field">
        <label htmlFor="analysis-target">Analyze target</label>
        <select id="analysis-target" value={analysisTargetId} onChange={event => onAnalysisTargetChange(event.target.value)}>
          {targetOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </div>}
    </header>
    <SegmentedControl label="Analysis view" value={tab} onChange={onTabChange} options={TABS} className="analysis-tabs" />
    <div className="analysis-body">
      {tab === 'comparison' && <ComparisonView comparison={comparison} unit={unit} onShowFullHistory={onShowFullHistory} cdcOnChart={cdcOnChart} onToggleCdc={onToggleCdc} />}
      {tab === 'progress' && <ProgressView progress={progress} unit={unit} />}
      {tab === 'quality' && <QualityView quality={quality} onInspectRow={onInspectRow} />}
      {tab === 'context' && <ContextView context={context} unit={unit} />}
    </div>
  </section>;
}

function ComparisonView({ comparison, unit, onShowFullHistory, cdcOnChart, onToggleCdc }) {
  if (!comparison.options.length) {
    return <div className="analysis-empty">
      <p><strong>One condition is visible in this range.</strong> Visual analysis compares adjacent conditions (for example, baseline and intervention).</p>
      <button type="button" className="button button--secondary" onClick={onShowFullHistory}>Show the full history</button>
    </div>;
  }
  const result = comparison.result;
  const option = comparison.options[comparison.index];
  const better = result?.direction;
  const rows = result ? [
    ['Level (mean)', result.A.mean, result.B.mean, <Chip key="level" tone={direction(result.level.change, better)}>{result.level.change >= 0 ? '+' : ''}{formatNumber(result.level.change)} {unit}</Chip>],
    ['Median', result.A.median, result.B.median, <Chip key="median" tone={direction(result.level.medianChange, better)}>{result.level.medianChange >= 0 ? '+' : ''}{formatNumber(result.level.medianChange)}</Chip>],
    ['Trend (per observation)', result.A.slope, result.B.slope, <Chip key="trend" tone={direction(result.B.slope, better)}>{result.B.slope == null ? 'Too few points' : Math.abs(result.B.slope) < 0.01 ? 'Flat' : (better === 'decrease' ? result.B.slope < 0 : result.B.slope > 0) ? 'Therapeutic trend' : 'Counter-therapeutic trend'}</Chip>],
    ['Variability (SD)', result.A.sd, result.B.sd, <Chip key="var" tone={result.B.level.stable ? 'positive' : 'attention'}>{result.B.level.allZero ? 'Stable at zero' : result.B.level.stable ? 'Stable' : 'Variable'} ({Math.round(result.B.level.percentWithin)}% in envelope)</Chip>],
    ['Immediacy (last 3 → first 3)', result.immediacy.before, result.immediacy.after, <Chip key="imm" tone={result.immediacy.improved ? 'positive' : 'attention'}>{result.immediacy.change >= 0 ? '+' : ''}{formatNumber(result.immediacy.change)}</Chip>]
  ] : [];
  return <div className="comparison-view">
    <div className="control-field comparison-select">
      <label htmlFor="analysis-comparison">Compare conditions</label>
      <select id="analysis-comparison" value={comparison.index} onChange={event => comparison.onIndexChange(Number(event.target.value))}>
        {comparison.options.map((item, index) => <option key={item.id} value={index}>{item.label}</option>)}
      </select>
    </div>
    {!result ? <p className="field-hint">Each condition needs at least one plotted observation.</p> : <>
      <div className="data-table-scroll" tabIndex={0} role="region" aria-label="Visual analysis features">
        <table className="stat-table">
          <caption className="sr-only">Six visual-analysis features for {option.label}</caption>
          <thead><tr><th scope="col">Feature</th><th scope="col">{option.before} <small>n={result.A.n}</small></th><th scope="col">{option.after} <small>n={result.B.n}</small></th><th scope="col">Reading</th></tr></thead>
          <tbody>
            {rows.map(([label, before, after, chip]) => <tr key={label}><th scope="row">{label}</th><td>{formatNumber(before, 2)}</td><td>{formatNumber(after, 2)}</td><td>{chip}</td></tr>)}
            <tr><th scope="row">Overlap</th><td colSpan={2}>PND {formatNumber(result.overlap.pnd, 0)}% · PEM {formatNumber(result.overlap.pem, 0)}%</td><td><Chip tone={result.overlap.pnd >= 70 ? 'positive' : result.overlap.pnd >= 50 ? 'neutral' : 'attention'}>{result.overlap.pndMagnitude}</Chip></td></tr>
          </tbody>
        </table>
      </div>
      <div className="effect-grid">
        <div className="effect-card"><span>NAP</span><strong>{formatNumber(result.overlap.nap, 2)}</strong><Chip tone={result.overlap.nap >= 0.93 ? 'positive' : result.overlap.nap >= 0.66 ? 'neutral' : 'attention'}>{result.overlap.napMagnitude}</Chip><small>p {result.overlap.pValue < 0.001 ? '< .001' : `= ${formatNumber(result.overlap.pValue, 3)}`} (one-tailed)</small></div>
        <div className="effect-card"><span>Tau-U (baseline trend corrected)</span><strong>{formatNumber(result.overlap.tauU, 2)}</strong><Chip tone={result.overlap.tauU > 0.6 ? 'positive' : result.overlap.tauU > 0.2 ? 'neutral' : 'attention'}>{result.overlap.tauU < 0 ? `${result.overlap.tauMagnitude} · counter-therapeutic` : result.overlap.tauMagnitude}</Chip><small>Tau {formatNumber(result.overlap.tau, 2)}</small></div>
        <div className={`effect-card effect-card--cdc${result.cdc?.met ? ' is-met' : ''}`}>
          <span>Conservative dual-criterion</span>
          {result.cdc ? <><strong>{result.cdc.count} of {result.cdc.n}</strong>
            <Chip tone={result.cdc.met ? 'positive' : 'attention'}>{result.cdc.met ? 'Reliable change' : 'Not reliable yet'}</Chip>
            <small>{result.cdc.required} needed beyond both lines (binomial p &lt; .05)</small>
            <label className="toggle-control"><input type="checkbox" checked={cdcOnChart} onChange={event => onToggleCdc(event.target.checked)} />Show criterion lines</label></>
            : <small>Needs at least three observations in each condition.</small>}
        </div>
      </div>
      <p className="analysis-footnote">Features follow the What Works Clearinghouse single-case standards (Kratochwill et al., 2010). Bands: NAP weak &lt; .66, strong ≥ .93 (Parker &amp; Vannest, 2009); PND ≥ 70% effective (Scruggs &amp; Mastropieri, 1998); CDC per Fisher, Kelley &amp; Lomas (2003). PND is sensitive to a single extreme baseline point.</p>
    </>}
  </div>;
}

const PROGRAM_STATUSES = ['Teaching', 'Maintaining', 'Generalizing', 'Baselining', 'OnHold', 'Completed', 'Discontinued'];

// Reviewing the data is the moment a clinician knows whether a program should continue,
// pause or move on, so the status can be changed here instead of opening every program.
function ProgramStatusControl({ program, canEdit, onProgramStatusChange }) {
  const [status, setStatus] = useState(program?.status || 'Teaching');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  if (!program) return null;
  const history = program.statusHistory || [];
  return <div className="program-status">
    <h4>Program status · {program.name}</h4>
    <p className="field-hint">Current status: <strong>{program.status}</strong>{history.length ? ` · last changed ${formatLongDate(history.at(-1).date)} (${history.at(-1).status})` : ''}</p>
    {canEdit ? <>
      <div className="form-row">
        <div className="control-field"><label htmlFor="program-status">Update status after reviewing this data</label>
          <select id="program-status" value={status} onChange={event => setStatus(event.target.value)}>
            {PROGRAM_STATUSES.map(value => <option key={value} value={value}>{value}</option>)}
          </select></div>
        <div className="control-field"><label htmlFor="program-status-reason">Reason</label>
          <input id="program-status-reason" type="text" maxLength={120} value={reason} onChange={event => setReason(event.target.value)} placeholder="For example: criterion met, moving to maintenance" /></div>
      </div>
      <button type="button" className="button button--secondary" onClick={() => {
        onProgramStatusChange?.(program.id, status, { reason });
        setMessage(`Program status set to ${status}.`);
        setReason('');
      }}>Update program status</button>
      {message && <p className="field-hint" role="status">{message}</p>}
    </> : <p className="field-hint">View-only access: program status can be reviewed here but not changed.</p>}
  </div>;
}

function ProgressView({ progress, unit }) {
  const { target, evaluation, insights, celeration, phaseSince, program, canEdit, onProgramStatusChange, reduction } = progress;
  if (!target) return <p className="field-hint">Choose a target to review progress.</p>;
  const milestones = targetMilestones(target);
  return <div className="progress-view">
    <div className="kpi-row">
      <div className="kpi"><span>Current phase</span><strong>{target.phase}</strong><small>since {formatLongDate(phaseSince || target.phaseEnteredDate)}</small></div>
      <div className="kpi"><span>Mastery rule</span><strong className="kpi-text">{target.masteryRule ? describeRule(target.masteryRule) : target.masteryCriteria}</strong><small>{target.masterySettings === 'Automatic' ? 'Automatic promotion' : 'Supervisor review'}</small></div>
      {evaluation && <div className="kpi"><span>{evaluation.met ? 'Sessions to criterion' : 'Current streak'}</span><strong>{evaluation.met ? evaluation.sessionsToCriterion : `${evaluation.streak} / ${evaluation.required}`}</strong><small>{evaluation.met ? `${evaluation.trialsToCriterion ? `${evaluation.trialsToCriterion} trials · ` : ''}${evaluation.daysToCriterion ?? '–'} days` : `latest ${formatNumber(evaluation.latest)} ${unit}`}</small></div>}
      {celeration && <div className="kpi"><span>Celeration</span><strong>{celeration.label}</strong><small>bounce ×{formatNumber(celeration.bounce, 1)}</small></div>}
      {reduction && <div className="kpi"><span>Reduction criterion</span>
        <strong>{reduction.met ? 'Met' : `${reduction.sustained}/${reduction.requiredDays} days`}</strong>
        <small>{reduction.criterion ? `Criterion ≤ ${formatNumber(reduction.criterion.value)} (${describeReductionRule({ ...reduction.rule })})` : 'No baseline available'}</small>
        <span className={`stat-chip stat-chip--${reduction.met ? 'positive' : 'attention'}`}>{reduction.met ? `Sustained from ${reduction.firstMetDate}` : reduction.message}</span></div>}
    </div>
    {milestones.length > 0 && <div className="milestone-list">
      <h4>Target timeline</h4>
      <ul>{milestones.map(milestone => <li key={`${milestone.kind}-${milestone.date}`} className={milestone.current ? 'is-current' : undefined}>
        <strong>{milestone.label}</strong><span>{formatLongDate(milestone.date)}</span>
      </li>)}</ul>
      <p className="field-hint">Introduction and mastery dates support acquisition-rate reporting; the same markers appear on the graph.</p>
    </div>}
    <ProgramStatusControl program={program} canEdit={canEdit} onProgramStatusChange={onProgramStatusChange} />
    {insights.length ? <ul className="insight-list">
      {insights.map(insight => <li key={insight.title} className={`insight insight--${insight.tone}`}>
        <strong>{insight.title}</strong><p>{insight.detail}</p><small>{insight.reference}</small>
      </li>)}
    </ul> : <p className="field-hint">No decision prompts for the plotted range.</p>}
  </div>;
}

function QualityView({ quality, onInspectRow }) {
  const { ioa, observers, lowIoa, fidelity, untracked, substitutes, events, standards } = quality;
  return <div className="quality-view">
    <div className="kpi-row">
      <div className="kpi"><span>IOA coverage</span><strong>{ioa.coverage == null ? '–' : `${Math.round(ioa.coverage)}%`}</strong>
        <small>{ioa.checked} of {ioa.sessions} sessions · goal ≥ {standards?.ioa?.minimumCoveragePercent ?? 20}%</small>
        <Chip tone={ioa.meetsCoverage ? 'positive' : 'attention'}>{ioa.meetsCoverage ? 'Meets coverage' : 'Below coverage'}</Chip></div>
      <div className="kpi"><span>Mean agreement</span><strong>{ioa.mean == null ? '–' : `${formatNumber(ioa.mean)}%`}</strong>
        <small>range {ioa.min == null ? '–' : `${formatNumber(ioa.min)}–100%`} · {ioa.methods.join(', ') || 'no checks'}</small>
        {ioa.mean != null && <Chip tone={ioa.mean >= 90 ? 'positive' : ioa.mean >= 80 ? 'neutral' : 'attention'}>{ioa.mean >= 90 ? 'Strong (≥ 90%)' : ioa.mean >= 80 ? 'Acceptable (≥ 80%)' : 'Below 80%'}</Chip>}</div>
      <div className="kpi"><span>Procedural fidelity</span><strong>{fidelity.mean == null ? '–' : `${formatNumber(fidelity.mean)}%`}</strong>
        <small>{fidelity.n} checked sessions{fidelity.below ? ` · ${fidelity.below} below ${standards?.fidelity?.minimumPercent ?? 85}%` : ''}</small></div>
      <div className="kpi"><span>Context flags</span><strong>{untracked + substitutes + events}</strong>
        <small>{untracked} not tracked · {substitutes} substitute staff · {events} with setting events</small></div>
    </div>
    {observers.length > 0 && <div className="quality-block">
      <h4>Agreement by second observer</h4>
      <ul className="bar-list">{observers.map(item => <li key={item.name}><span>{item.name}</span><i style={{ width: `${Math.max(2, item.mean - 50) * 2}%` }} /><b>{formatNumber(item.mean)}% · n={item.n}</b></li>)}</ul>
    </div>}
    <div className="quality-block">
      <h4>Sessions below 80% agreement</h4>
      {lowIoa.length ? <ul className="quality-list">{lowIoa.map(row => <li key={row.id}>
        <button type="button" className="inspector-item inspector-item--stack" onClick={() => onInspectRow(row)}>
          <span className="inspector-item-title">{formatLongDate(row.timestamp)} · {row.ioa.percent}%</span>
          <span className="inspector-item-meta">{row.therapistName} with {row.ioa.observer}</span>
        </button></li>)}</ul> : <p className="field-hint">Every agreement check in this range met 80%.</p>}
    </div>
    <p className="analysis-footnote">IOA standards: at least 20% of sessions (preferably 25–33%) across phases, with agreement of 80% or higher (Cooper, Heron &amp; Heward, 2020; Kratochwill et al., 2010). Procedural fidelity is scored by the supervisor during overlap sessions.</p>
  </div>;
}

function ContextView({ context, unit }) {
  const { dimension, onDimensionChange, groups, highlighted, onHighlight } = context;
  const max = Math.max(1e-9, ...groups.map(group => Math.abs(group.mean ?? 0)));
  return <div className="context-view">
    <SegmentedControl label="Break down by" value={dimension} onChange={onDimensionChange} options={DIMENSIONS} className="context-tabs" />
    {groups.length ? <ul className="context-bars">
      {groups.map(group => <li key={group.label}>
        <button type="button" className="context-bar" aria-pressed={highlighted === group.label} onClick={() => onHighlight(highlighted === group.label ? null : group.label)}>
          <span className="context-bar-label">{group.label}<small>n={group.n}</small></span>
          <span className="context-bar-track" aria-hidden="true"><i style={{ width: `${Math.max(2, (100 * Math.abs(group.mean ?? 0)) / max)}%` }} /></span>
          <b>{formatNumber(group.mean)} {unit}</b>
        </button>
      </li>)}
    </ul> : <p className="field-hint">No session context is available for these observations.</p>}
    <p className="analysis-footnote">Select a group to highlight its observations on the chart. Differences between clinicians or settings can signal generalization needs or treatment-integrity issues; small groups are unreliable.</p>
  </div>;
}
