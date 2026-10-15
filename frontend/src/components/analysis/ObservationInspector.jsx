import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, ArrowLeft } from '../ui/Icons';
import { formatChartDate } from '../../utils/chartTheme';
import { calculateMetricPoint, getObservationKey } from '../../utils/analyticsMetrics';
import { PROMPT_COLORS, PROMPT_INK, formatClock, formatLongDate, formatNumber, phaseOnDate, childBuckets } from '../../utils/targetAnalytics';

const ROLE_NAMES = { RBT: 'Registered Behavior Technician', BCBA: 'Board Certified Behavior Analyst', BCaBA: 'Board Certified Assistant Behavior Analyst' };
const CODE_NAMES = { '97153': 'Direct treatment (97153)', '97155': 'Protocol modification (97155)', '97156': 'Caregiver guidance (97156)' };
const IOA_METHODS = { TrialByTrial: 'Trial-by-trial', IntervalByInterval: 'Interval-by-interval', TotalCount: 'Total count', TotalDuration: 'Total duration' };

// Drill-down from a plotted point to the sessions and trials behind it.
export default function ObservationInspector({ selection, rows, targets, templates = [], services, abcEntries = [], view, onClose, onStep, canStep }) {
  const [path, setPath] = useState([]);
  const [rowId, setRowId] = useState(null);
  const last = path.at(-1);
  const level = last || { aggregation: selection.aggregation, key: selection.key };
  const levelRows = last ? rows.filter(row => getObservationKey(row, last.aggregation) === last.key) : rows;
  const children = selection.aggregation === 'Per Session' ? null : childBuckets(levelRows, level.aggregation);
  const detail = rowId ? rows.find(row => row.id === rowId) : (levelRows.length === 1 ? levelRows[0] : null);
  const targetIds = [...new Set(levelRows.map(row => row.targetId))];
  const summarize = list => targetIds.map(id => {
    const subset = list.filter(row => row.targetId === id);
    if (!subset.length) return null;
    const target = targets.get(id);
    const point = calculateMetricPoint('summary', subset, target?.type || view.targetType, view.durationView, view.rateView, view.frequencyView);
    return { id, name: target?.name || id, display: point.displayVal, n: subset.length };
  }).filter(Boolean);

  const crumbs = [{ label: formatChartDate(selection.key, selection.aggregation), onClick: () => { setPath([]); setRowId(null); } },
    ...path.map((item, index) => ({ label: formatChartDate(item.key, item.aggregation), onClick: () => { setPath(path.slice(0, index + 1)); setRowId(null); } }))];
  if (detail) crumbs.push({ label: `${formatClock(detail.timestamp)} · ${targets.get(detail.targetId)?.name || 'Observation'}` });

  return <section className="inspector" aria-labelledby="inspector-title">
    <header className="inspector-header">
      <div className="min-w-0">
        <h3 id="inspector-title">Observation details</h3>
        <nav aria-label="Drill-down path" className="breadcrumb">
          {crumbs.map((crumb, index) => <span key={`${crumb.label}-${index}`}>
            {index > 0 && <ChevronRight size={13} aria-hidden="true" />}
            {crumb.onClick && index < crumbs.length - 1 ? <button type="button" onClick={crumb.onClick}>{crumb.label}</button> : <strong aria-current="page">{crumb.label}</strong>}
          </span>)}
        </nav>
      </div>
      <div className="inspector-actions">
        <button type="button" className="icon-button icon-button--bordered" aria-label="Previous observation group" disabled={!canStep?.(-1)} onClick={() => { setPath([]); setRowId(null); onStep(-1); }}><ChevronLeft size={18} /></button>
        <button type="button" className="icon-button icon-button--bordered" aria-label="Next observation group" disabled={!canStep?.(1)} onClick={() => { setPath([]); setRowId(null); onStep(1); }}><ChevronRight size={18} /></button>
        <button type="button" className="icon-button icon-button--bordered" aria-label="Close observation details" onClick={onClose}><X size={18} /></button>
      </div>
    </header>

    {detail ? <>
      {(rowId || path.length > 0) && levelRows.length > 1 && <button type="button" className="button button--tertiary inspector-back" onClick={() => setRowId(null)}><ArrowLeft size={16} />All observations in {formatChartDate(level.key, level.aggregation)}</button>}
      <RowDetail row={detail} target={targets.get(detail.targetId)} templates={templates} service={services.get(detail.serviceSessionId)} abcEntries={abcEntries} />
    </> : <>
      <div className="inspector-summary">
        {summarize(levelRows).map(item => <div key={item.id}><span>{item.name}</span><strong>{item.display}</strong><small>{item.n} {item.n === 1 ? 'session' : 'sessions'}</small></div>)}
      </div>
      {children && children.buckets.length > 1 ? <>
        <h4 className="inspector-subtitle">{children.aggregation === 'Weekly' ? 'Weeks' : 'Days'} in this group</h4>
        <ul className="inspector-list">
          {children.buckets.map(([key, list]) => <li key={key}><button type="button" className="inspector-item" onClick={() => setPath([...path, { aggregation: children.aggregation, key }])}>
            <span className="inspector-item-title">{formatChartDate(key, children.aggregation)}</span>
            <span className="inspector-item-meta">{summarize(list).map(item => `${item.name}: ${item.display}`).join(' · ')}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button></li>)}
        </ul>
      </> : <>
        <h4 className="inspector-subtitle">Sessions</h4>
        <ul className="inspector-list">
          {levelRows.map(row => {
            const target = targets.get(row.targetId);
            const service = services.get(row.serviceSessionId);
            const point = calculateMetricPoint('row', [row], target?.type || view.targetType, view.durationView, view.rateView, view.frequencyView);
            return <li key={row.id}><button type="button" className="inspector-item" onClick={() => setRowId(row.id)}>
              <span className="inspector-item-title">{formatLongDate(row.timestamp)} · {formatClock(row.timestamp)}</span>
              <span className="inspector-item-meta">{target?.name}: {row.value == null ? 'Not tracked' : point.displayVal} · {row.therapistName}{service ? ` · ${service.setting}` : ''}{row.ioa ? ` · IOA ${row.ioa.percent}%` : ''}</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button></li>;
          })}
        </ul>
      </>}
    </>}
  </section>;
}

function RowDetail({ row, target, templates, service, abcEntries }) {
  const phase = phaseOnDate(target, row.timestamp);
  const template = templates.find(item => item.id === target?.promptHierarchyId);
  const related = abcEntries.filter(entry => entry.serviceSessionId && entry.serviceSessionId === row.serviceSessionId && entry.behaviors.includes(target?.name));
  return <article className="inspector-detail" aria-label={`${target?.name} on ${formatLongDate(row.timestamp)}`}>
    <div className="inspector-detail-head">
      <div><h4>{target?.name}</h4><p>{formatLongDate(row.timestamp)} at {formatClock(row.timestamp)} · session {row.sessionNumber}</p></div>
      {phase && <span className="status-label">{phase}</span>}
    </div>
    <div className="inspector-detail-grid">
      <dl className="kv-list">
        <div><dt>Measurement</dt><dd>{measurementText(row, target)}</dd></div>
        <div><dt>Recorded by</dt><dd>{row.therapistName}{service?.role ? <small>{ROLE_NAMES[service.role]}</small> : null}</dd></div>
        {service && <div><dt>Appointment</dt><dd>{service.setting} · {service.start}–{service.end} ({service.minutes} min)<small>{CODE_NAMES[service.serviceCode] || service.serviceCode}</small></dd></div>}
        {service?.settingEvents?.length > 0 && <div><dt>Setting events</dt><dd>{service.settingEvents.join(', ')}</dd></div>}
        {row.ioa && <div><dt>Interobserver agreement</dt><dd className={row.ioa.percent < 80 ? 'text-warning' : undefined}>{row.ioa.percent}% · {IOA_METHODS[row.ioa.method]}
          <small>{row.ioa.observer}{row.ioa.total != null ? ` · ${row.ioa.agreements}/${row.ioa.total} agreements` : ` · ${row.ioa.primary} vs ${row.ioa.secondary}`}{row.ioa.percent < 80 ? ' · below the 80% minimum' : ''}</small></dd></div>}
        {service?.supervision && <div><dt>Supervision</dt><dd>{service.supervision.supervisor} observed {service.supervision.minutes} min</dd></div>}
        {service?.fidelity && <div><dt>Procedural fidelity</dt><dd className={service.fidelity.percent < 85 ? 'text-warning' : undefined}>{service.fidelity.percent}%<small>{service.fidelity.correct} of {service.fidelity.total} steps implemented as written</small></dd></div>}
      </dl>
      <div className="inspector-visual">
        {row.missingDataMode === 'DataNotTracked' ? <p className="field-hint">Data were not tracked in this session. It is not treated as a zero.</p>
          : row.trialSequence ? <TrialChips sequence={row.trialSequence} template={template} />
            : row.intervalScores ? <IntervalGrid scores={row.intervalScores} target={target} />
              : target?.type === 'Duration' ? <EpisodeBars row={row} />
                : row.qualitativeEntry ? <blockquote className="inspector-quote">{row.qualitativeEntry}</blockquote>
                  : <RateSummary row={row} target={target} />}
      </div>
    </div>
    {related.length > 0 && <div className="inspector-abc">
      <h5>ABC records in this session ({related.length})</h5>
      <ul>{related.map(entry => <li key={entry.id}><time>{formatClock(entry.timestamp)}</time>
        <span><strong>{entry.antecedents.join(', ')}</strong> → {entry.behaviors.join(' + ')} → {entry.consequences.join(', ')}</span>
        <small>Intensity {entry.intensity}/5 · {entry.durationMinutes} min · {entry.location}</small></li>)}</ul>
    </div>}
  </article>;
}

function measurementText(row, target) {
  if (row.value == null && row.missingDataMode === 'DataNotTracked') return 'Not tracked';
  switch (target?.type) {
    case 'TrialByTrial': return `${row.correctCount}/${row.totalTrials} independent (${row.value}%)`;
    case 'IntervalData': return `${row.occurredIntervals}/${row.totalIntervals} intervals (${row.value}%)`;
    case 'Duration': return `${Math.floor(row.durationSeconds / 60)} min ${row.durationSeconds % 60} sec across ${row.occurrenceCount} ${row.occurrenceCount === 1 ? 'episode' : 'episodes'}`;
    case 'FluencyRate': return `${row.occurrenceCount} correct, ${row.errorCount ?? 0} errors in ${row.lessonDurationMinutes} min`;
    case 'Frequency': return `${row.occurrenceCount} in ${row.lessonDurationMinutes} min (${formatNumber((60 * row.occurrenceCount) / row.lessonDurationMinutes)} per hour)`;
    case 'Anecdotal': return 'Narrative note';
    default: return String(row.value ?? '');
  }
}

function TrialChips({ sequence, template }) {
  const codes = template?.codes || [];
  const levels = template?.levels || [];
  const name = code => levels[codes.indexOf(code)] || code;
  const prompted = [...sequence].filter(code => code !== 'I');
  const common = prompted.length ? Object.entries(prompted.reduce((counts, code) => ({ ...counts, [code]: (counts[code] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0][0] : null;
  return <figure className="micro-visual">
    <figcaption>Trial-by-trial prompt levels · {template?.name}</figcaption>
    <ol className="trial-chips" aria-label={`Trial sequence: ${[...sequence].map((code, index) => `trial ${index + 1} ${name(code)}`).join(', ')}`}>
      {[...sequence].map((code, index) => <li key={index} className="trial-chip" style={{ background: PROMPT_COLORS[code], color: PROMPT_INK[code] }} title={`Trial ${index + 1}: ${name(code)}`}>{code}</li>)}
    </ol>
    <p className="micro-note">{[...sequence].filter(code => code === 'I').length} of {sequence.length} independent{common ? ` · most frequent prompt: ${name(common)}` : ''}</p>
    <ul className="prompt-legend">{codes.map(code => <li key={code}><i style={{ background: PROMPT_COLORS[code] }} />{code} = {name(code)}</li>)}</ul>
  </figure>;
}

function IntervalGrid({ scores, target }) {
  const settings = target?.intervalSettings;
  const scored = [...scores].filter(score => score === '1').length;
  return <figure className="micro-visual">
    <figcaption>{settings?.captureType === 'MomentaryTimeSampling' ? 'Momentary time samples' : `${settings?.captureType || ''} intervals`} · {settings?.intervalLength} each</figcaption>
    <ol className="interval-grid" aria-label={`${scored} of ${scores.length} intervals scored`}>
      {[...scores].map((score, index) => <li key={index} className={score === '1' ? 'is-scored' : undefined} title={`Interval ${index + 1}: ${score === '1' ? 'scored' : 'not scored'}`} />)}
    </ol>
    <p className="micro-note">{scored} of {scores.length} intervals scored · longest run {Math.max(0, ...scores.split('0').map(run => run.length))}</p>
  </figure>;
}

function EpisodeBars({ row }) {
  const episodes = row.episodeDurations || (row.durationSeconds ? [row.durationSeconds] : []);
  const longest = Math.max(1, ...episodes);
  if (!episodes.length) return <p className="field-hint">Measured zero: the behavior did not occur during this observation.</p>;
  return <figure className="micro-visual">
    <figcaption>Episodes in recorded order</figcaption>
    <ol className="episode-bars">
      {episodes.map((seconds, index) => <li key={index}><span>#{index + 1}</span><i style={{ width: `${Math.max(4, (100 * seconds) / longest)}%` }} /><b>{seconds}s</b></li>)}
    </ol>
    <p className="micro-note">Average {Math.round(row.durationSeconds / episodes.length)}s per episode · longest {longest}s</p>
  </figure>;
}

function RateSummary({ row, target }) {
  const minutes = row.lessonDurationMinutes || 1;
  const correct = row.occurrenceCount ?? row.value ?? 0;
  const errors = row.errorCount;
  return <figure className="micro-visual">
    <figcaption>{target?.type === 'FluencyRate' ? 'Timing result' : 'Count and observation time'}</figcaption>
    <div className="rate-summary">
      <div><strong>{formatNumber(correct / minutes, 2)}</strong><span>{target?.type === 'FluencyRate' ? 'correct per minute' : 'per minute'}</span></div>
      {errors != null && <div><strong>{formatNumber(errors / minutes, 2)}</strong><span>errors per minute</span></div>}
      {errors != null && correct + errors > 0 && <div><strong>{Math.round((100 * correct) / (correct + errors))}%</strong><span>accuracy</span></div>}
      {target?.type === 'Frequency' && <div><strong>{formatNumber((60 * correct) / minutes)}</strong><span>per hour</span></div>}
    </div>
  </figure>;
}
