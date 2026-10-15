import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, ArrowLeft, Edit3, Trash2, ShieldCheck } from '../ui/Icons';
import { formatChartDate } from '../../utils/chartTheme';
import { calculateMetricPoint, getObservationKey } from '../../utils/analyticsMetrics';
import { PROMPT_COLORS, PROMPT_INK, formatClock, formatLongDate, formatNumber, phaseOnDate, childBuckets } from '../../utils/targetAnalytics';
import { fieldsFor } from '../../utils/recording';
import {
  EDIT_REASONS, valuesFromRow, validateObservationEdit, validateDeletion, observationType, describeAuditEntry, billingNote, OBSERVATION_TYPES
} from '../../utils/observations';

const ROLE_NAMES = { RBT: 'Registered Behavior Technician', BCBA: 'Board Certified Behavior Analyst', BCaBA: 'Board Certified Assistant Behavior Analyst' };
const CODE_NAMES = { '97153': 'Direct treatment (97153)', '97155': 'Protocol modification (97155)', '97156': 'Caregiver guidance (97156)' };
const IOA_METHODS = { TrialByTrial: 'Trial-by-trial', IntervalByInterval: 'Interval-by-interval', TotalCount: 'Total count', TotalDuration: 'Total duration' };

// Drill-down from a plotted point to the sessions and trials behind it.
export default function ObservationInspector({
  selection, rows, targets, templates = [], services, abcEntries = [], view, onClose, onStep, canStep,
  canEdit = true, viewOnlyReason = '', supervisionRecords = [], onCorrectObservation, onDeleteObservation
}) {
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
      <RowDetail row={detail} target={targets.get(detail.targetId)} templates={templates} service={services.get(detail.serviceSessionId)} abcEntries={abcEntries}
        canEdit={canEdit} viewOnlyReason={viewOnlyReason} onCorrectObservation={onCorrectObservation} onDeleteObservation={onDeleteObservation}
        supervisionRecords={supervisionRecords.filter(record => record.serviceId === detail.serviceSessionId)} />
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

function RowDetail({ row, target, templates, service, abcEntries, canEdit = true, viewOnlyReason = '', supervisionRecords = [], onCorrectObservation, onDeleteObservation }) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [draft, setDraft] = useState(() => ({ values: valuesFromRow(row, target), reason: EDIT_REASONS[0], note: '', staffName: '' }));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('');
  const type = observationType(row);
  const phase = phaseOnDate(target, row.timestamp);
  const template = templates.find(item => item.id === target?.promptHierarchyId);
  const related = abcEntries.filter(entry => entry.serviceSessionId && entry.serviceSessionId === row.serviceSessionId && entry.behaviors.includes(target?.name));
  return <article className="inspector-detail" aria-label={`${target?.name} on ${formatLongDate(row.timestamp)}`}>
    <div className="inspector-detail-head">
      <div><h4>{target?.name}</h4><p>{formatLongDate(row.timestamp)} at {formatClock(row.timestamp)} · session {row.sessionNumber}
        {row.enteredManually ? ` · ${row.collectionContext || 'manually entered'}` : ''}</p></div>
      <div className="inspector-detail-labels">
        {phase && <span className="status-label">{phase}</span>}
        {type !== 'Primary' && <span className="status-label status-label--excluded" title={OBSERVATION_TYPES[type].hint}>{OBSERVATION_TYPES[type].label} · excluded from totals</span>}
        {row.billedAfterService && <span className="status-label status-label--billed">Post-billing change</span>}
      </div>
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
        {row.collectionContext && <div><dt>Collected from</dt><dd>{row.collectionContext}<small>{row.enteredManually ? 'Entered manually, not from a session note' : 'Session recording'}</small></dd></div>}
        {row.note && <div><dt>Data point note</dt><dd>{row.note}</dd></div>}
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
    {supervisionRecords.length > 0 && <div className="inspector-supervision">
      <h5><ShieldCheck size={16} />Supervision &amp; IOA observations in this session ({supervisionRecords.length})</h5>
      <p className="field-hint">Stored with the session for verification; excluded from this learner’s chart totals.</p>
      <ul>{supervisionRecords.map(record => <li key={record.id}>
        <strong>{record.label}</strong>
        <span>{record.observer}{record.minutes ? ` · ${record.minutes} min overlap` : ''}{record.agreement != null ? ` · mean agreement ${record.agreement}%` : ''}</span>
        <small>{record.detail}{record.targets.length ? ` · ${record.targets.join(', ')}` : ''}</small>
      </li>)}</ul>
    </div>}

    {(row.editHistory?.length > 0) && <div className="inspector-audit">
      <h5>Change history ({row.editHistory.length})</h5>
      <ul>{row.editHistory.map((entry, index) => <li key={index}>
        <strong>{describeAuditEntry(entry)}</strong>
        <span>{entry.at}{entry.staffName ? ` · ${entry.staffName}` : ''}</span>
        <small>{entry.note || (entry.before?.value != null || entry.after?.value != null
          ? `Value ${entry.before?.value ?? '—'} → ${entry.after?.value ?? 'removed'}`
          : 'Measurement updated')}{entry.billedAfterService ? ' · appointment already billed' : ''}</small>
      </li>)}</ul>
      {billingNote(row) && <p className="field-hint">{billingNote(row)}</p>}
    </div>}

    {canEdit ? <div className="inspector-actions-block">
      {!editing && !removing && <div className="inspector-edit-buttons">
        <button type="button" className="button button--secondary" onClick={() => { setEditing(true); setStatus(''); }}><Edit3 size={16} />Correct this observation</button>
        <button type="button" className="button button--danger" onClick={() => { setRemoving(true); setStatus(''); }}><Trash2 size={16} />Delete</button>
      </div>}
      {status && <p className="field-hint" role="status">{status}</p>}
      {editing && <form className="observation-edit" noValidate onSubmit={event => {
        event.preventDefault();
        const found = validateObservationEdit({ values: draft.values, reason: draft.reason, missingDataMode: row.missingDataMode }, target);
        setErrors(found);
        if (Object.keys(found).length) return;
        onCorrectObservation?.(row.id, { values: draft.values, reason: draft.reason, note: draft.note, staffName: draft.staffName.trim(), at: row.timestamp, billed: Boolean(row.billedAfterService), target });
        setEditing(false);
        setStatus(`Correction saved. ${billingNote(row) || 'The chart and tables now use the corrected value.'}`);
      }}>
        <h5>Correct the measurement</h5>
        <p className="field-hint">Correcting after an appointment was billed is supported: the change is recorded in the audit trail and the appointment does not need to be released and rebilled.</p>
        <div className="observation-edit-grid">
          {fieldsFor(target?.type).map(field => <label key={field.key}>{field.label}
            {field.text
              ? <textarea rows={3} value={draft.values[field.key] || ''} onChange={event => setDraft(previous => ({ ...previous, values: { ...previous.values, [field.key]: event.target.value } }))} />
              : <input type="number" step="any" inputMode="decimal" value={draft.values[field.key] || ''}
                onChange={event => setDraft(previous => ({ ...previous, values: { ...previous.values, [field.key]: event.target.value } }))} />}
            {errors[field.key] && <small className="field-error" role="alert">{errors[field.key]}</small>}
          </label>)}
        </div>
        <label>Reason<select value={draft.reason} onChange={event => setDraft(previous => ({ ...previous, reason: event.target.value }))}>
          {EDIT_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
        </select>{errors.reason && <small className="field-error" role="alert">{errors.reason}</small>}</label>
        <label>Note for the audit trail<textarea rows={2} maxLength={500} value={draft.note} onChange={event => setDraft(previous => ({ ...previous, note: event.target.value }))} placeholder="What was wrong, and what was corrected?" /></label>
        <label>Your name and role<input type="text" maxLength={100} value={draft.staffName} onChange={event => setDraft(previous => ({ ...previous, staffName: event.target.value }))} placeholder="Sarah Jenkins, BCBA" /></label>
        <div className="form-actions">
          <button type="button" className="button button--tertiary" onClick={() => { setEditing(false); setErrors({}); }}>Cancel</button>
          <button type="submit" className="button button--primary">Save correction</button>
        </div>
      </form>}
      {removing && <form className="observation-delete" noValidate onSubmit={event => {
        event.preventDefault();
        const found = validateDeletion({ reason: draft.reason, note: draft.note });
        setErrors(found);
        if (Object.keys(found).length) return;
        onDeleteObservation?.(row.id, { reason: draft.reason, note: draft.note, staffName: draft.staffName.trim(), at: row.timestamp, billed: Boolean(row.billedAfterService) });
        setRemoving(false);
        setStatus('Observation removed. An audit entry keeps the reason for the change.');
      }}>
        <h5>Remove this observation</h5>
        <p className="field-hint">The measurement is removed from the graph and totals. A deletion entry stays in the client’s change history.</p>
        <label>Reason<select value={draft.reason} onChange={event => setDraft(previous => ({ ...previous, reason: event.target.value }))}>
          {EDIT_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
        </select>{errors.reason && <small className="field-error" role="alert">{errors.reason}</small>}</label>
        <label>Note<textarea rows={2} maxLength={500} value={draft.note} onChange={event => setDraft(previous => ({ ...previous, note: event.target.value }))} placeholder="Optional detail for the audit trail" />{errors.note && <small className="field-error" role="alert">{errors.note}</small>}</label>
        <div className="form-actions">
          <button type="button" className="button button--tertiary" onClick={() => { setRemoving(false); setErrors({}); }}>Keep the observation</button>
          <button type="submit" className="button button--danger">Remove observation</button>
        </div>
      </form>}
    </div> : <p className="field-hint">{viewOnlyReason || 'View-only access: observations cannot be corrected or removed.'}</p>}

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
