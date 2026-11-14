import { useMemo, useState } from 'react';
import StatusControl from './StatusControl';
import {
  BEHAVIOR_PHASES, MATERIAL_LIMITS_TEXT, SCOPE_LABELS, TARGET_TYPE_LABELS,
  behaviorPhaseOf, describeConfiguration, historyToCsv, materialHref, statusLabel, toValueList
} from '../../utils/programManagement';
import { BEHAVIOR_UNITS, describeBehaviorChange, weeklyBehaviorSeries } from '../../utils/behaviorSummary';
import { CUSTOM_FIELD_DEFINITIONS } from '../../data/mockData';
import { ArrowLeft, Download, Edit3 } from '../ui/Icons';

// The behavior page: the definition, the phase control and the recent measurement together, so
// a clinician does not move between screens to understand one behavior.
export default function BehaviorView({
  program, scope = 'client', canEdit = true, asOf, activity = [], observations = [],
  onBack, onEdit, onRequestPhase, onOpenTarget, onCopyToOrganization, onCopyToClients
}) {
  const [page, setPage] = useState('overview');
  const library = scope !== 'client';
  const isPublic = scope === 'public';
  const writable = canEdit && !isPublic;
  const target = program.targets?.[0];
  const tool = target?.type;
  const phase = behaviorPhaseOf(program);

  const rows = useMemo(() => observations.filter(row => row.targetId === target?.id), [observations, target]);
  const series = useMemo(() => weeklyBehaviorSeries(rows, asOf, 8), [rows, asOf]);
  const change = useMemo(() => describeBehaviorChange(series), [series]);
  const tracked = series.reduce((sum, week) => sum + week.sessions, 0);
  const ids = new Set([program.id, target?.id]);
  const trail = activity.filter(entry => ids.has(entry.entityId));
  const peak = Math.max(0, ...series.map(week => week.mean ?? 0));
  const unit = BEHAVIOR_UNITS[tool] || '';
  const format = value => (value == null ? 'No data' : Number.isInteger(value) ? String(value) : value.toFixed(1));

  const changeText = {
    lower: 'Lower than the previous four weeks',
    higher: 'Higher than the previous four weeks',
    similar: 'Similar to the previous four weeks',
    unknown: 'Not enough tracked sessions to compare two periods'
  }[change.direction];

  return <section aria-labelledby="program-view-title" className="pm-view">
    <nav className="pm-crumbs" aria-label="Breadcrumb">
      <button type="button" className="pm-crumb-link" onClick={onBack}><ArrowLeft size={15} />Programs</button>
      <span aria-hidden="true">/</span>
      <span>{SCOPE_LABELS[scope]} · Behavior reduction</span>
    </nav>

    <header className="pm-view-head">
      <div className="pm-view-title">
        <h2 id="program-view-title">{program.name}</h2>
        <div className="pm-view-meta">
          <StatusControl value={phase} label="Behavior phase" options={BEHAVIOR_PHASES} display={value => statusLabel(value, true)}
            disabled={!writable} onChange={value => onRequestPhase?.(program, value)} />
          <span className="pm-meta-area">{TARGET_TYPE_LABELS[tool] || 'Tool not set'}</span>
          {toValueList(program.treatmentArea).length > 0 && <ul className="pm-meta-list" aria-label="Treatment area">
            {toValueList(program.treatmentArea).map(area => <li key={area} className="pm-meta-area">{area}</li>)}</ul>}
          {toValueList(program.tags).length > 0 && <ul className="pm-meta-list" aria-label="Tags">
            {toValueList(program.tags).map(tag => <li key={tag} className="pm-meta-tag">{tag}</li>)}</ul>}
        </div>
      </div>
      <div className="pm-view-actions">
        {writable && <button type="button" className="button button--secondary" onClick={() => onEdit?.(program)}><Edit3 size={16} />Edit behavior</button>}
        {!library && target && onOpenTarget && <button type="button" className="button button--primary" onClick={() => onOpenTarget(program, target)}>Open full chart</button>}
        {canEdit && scope === 'organization' && <button type="button" className="button button--secondary" onClick={() => onCopyToClients?.([program])}>Add to client</button>}
        {canEdit && isPublic && <>
          <button type="button" className="button button--primary" onClick={() => onCopyToClients?.([program])}>Add to client</button>
          <button type="button" className="button button--secondary" onClick={() => onCopyToOrganization?.([program])}>Add to organization</button>
        </>}
      </div>
    </header>

    {library && <p className="pm-banner" role="note">
      {isPublic ? 'This is a public library behavior. It is read only here. Add it to a client or to your organization library to use it.'
        : 'This is an organization library behavior. It has no learner data, so there is no chart here. Add it to a client to start recording.'}
    </p>}

    <div className="pm-tabs" role="tablist" aria-label="Behavior page">
      {[['overview', 'Definition and data'], ['details', 'Treatment details'], ['history', 'History']].map(([id, label]) =>
        <button key={id} type="button" role="tab" id={`pm-btab-${id}`} aria-selected={page === id} aria-controls={`pm-bpanel-${id}`}
          tabIndex={page === id ? 0 : -1} className="pm-tab" onClick={() => setPage(id)}>
          {label}{id === 'history' && <span className="pm-tab-count">{trail.length}</span>}</button>)}
    </div>

    {page === 'overview' && <div role="tabpanel" id="pm-bpanel-overview" aria-labelledby="pm-btab-overview" className="pm-behavior-grid">
      <section className="pm-panel" aria-labelledby="pm-definition-title">
        <h3 id="pm-definition-title">Operational definition</h3>
        <p className="pm-definition">{program.operationalDefinition || 'No operational definition has been written for this behavior yet. Add one so everyone records it the same way.'}</p>
        <dl className="pm-defs pm-defs--tight">
          <div><dt>Measurement tool</dt><dd>{TARGET_TYPE_LABELS[tool] || 'Not set'}. Fixed after the behavior is saved.</dd></div>
          {describeConfiguration(target) && <div><dt>Interval recording</dt><dd>{describeConfiguration(target)}</dd></div>}
          <div><dt>Phase</dt><dd>{statusLabel(phase, true)}. Open means defined, not yet being reduced.</dd></div>
        </dl>
      </section>

      <section className="pm-panel" aria-labelledby="pm-recent-title">
        <h3 id="pm-recent-title">Recent measurement</h3>
        {library || rows.length === 0
          ? <p className="pm-empty-line">{library ? 'A library behavior has no recorded data.' : 'Nothing has been recorded for this behavior yet. It shows as no data, never as zero.'}</p>
          : <>
            <p className="pm-change"><strong>{changeText}.</strong>{' '}
              {change.direction !== 'unknown' && <span>{format(change.recent)} against {format(change.previous)} {unit}, averaged over tracked sessions.</span>}</p>
            <div className="pm-bars" role="img"
              aria-label={`Weekly average ${unit} for the last eight weeks: ${series.map(week => `${week.start} ${format(week.mean)}`).join('; ')}`}>
              {series.map(week => <div key={week.start} className="pm-bar" title={`${week.start} to ${week.end}: ${format(week.mean)}`}>
                <span className={`pm-bar-fill${week.mean == null ? ' pm-bar-fill--none' : ''}`}
                  style={{ height: week.mean == null ? '4px' : `${Math.max(4, peak ? (week.mean / peak) * 100 : 4)}%` }} />
              </div>)}
            </div>
            <p className="pm-bars-axis"><span>{series[0]?.start}</span><span>{series.at(-1)?.end}</span></p>
            <p className="pm-note">{tracked} tracked {tracked === 1 ? 'session' : 'sessions'} in eight weeks, shown as {unit}. A week with no tracked session is left blank, not drawn as zero. This is decision support, not a determination.</p>
          </>}
      </section>
    </div>}

    {page === 'details' && <div role="tabpanel" id="pm-bpanel-details" aria-labelledby="pm-btab-details" className="pm-details">
      <dl className="pm-defs">
        <div><dt>Treatment area</dt><dd>{toValueList(program.treatmentArea).join(', ') || <span className="pm-none">None</span>}</dd></div>
        <div><dt>Baseline</dt><dd>{program.baseline || <span className="pm-none">{library ? 'Cleared in the library' : 'Not recorded'}</span>}</dd></div>
        <div><dt>Objective</dt><dd>{program.programObjective || <span className="pm-none">{library ? 'Cleared in the library' : 'Not recorded'}</span>}</dd></div>
        {CUSTOM_FIELD_DEFINITIONS.map(definition => <div key={definition.key}><dt>{definition.label}</dt>
          <dd>{program.customFields?.[definition.key] || <span className="pm-none">Not recorded</span>}</dd></div>)}
      </dl>
      <section aria-labelledby="pm-bmaterials-title" className="pm-materials">
        <h3 id="pm-bmaterials-title">Learning materials</h3>
        <p className="pm-note">{MATERIAL_LIMITS_TEXT}</p>
        {(program.learningMaterials || []).length === 0 ? <p className="pm-empty-line">No learning materials are attached.</p>
          : <ul className="pm-files">{program.learningMaterials.map(material => <li key={material.path || material.fileName}>
            <a className="pm-file-name" href={materialHref(material, import.meta.env.BASE_URL)} download={material.fileName}>{material.fileName}</a>
          </li>)}</ul>}
      </section>
    </div>}

    {page === 'history' && <div role="tabpanel" id="pm-bpanel-history" aria-labelledby="pm-btab-history" className="pm-history">
      <div className="pm-history-head">
        <p className="pm-note">Every change to this behavior, newest first. This demo records what changed and when, not who changed it.</p>
        {trail.length > 0 && <button type="button" className="button button--secondary" onClick={() => {
          const url = URL.createObjectURL(new Blob([historyToCsv(trail)], { type: 'text/csv' }));
          const link = Object.assign(document.createElement('a'), { href: url, download: `${program.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-history.csv` });
          link.click();
          URL.revokeObjectURL(url);
        }}><Download size={16} />Export CSV</button>}
      </div>
      {trail.length === 0 ? <p className="pm-empty-line">No changes recorded for this behavior yet.</p>
        : <ol className="pm-timeline">{trail.map(entry => <li key={entry.id}><time>{entry.at}</time><span>{entry.summary}</span></li>)}</ol>}
    </div>}
  </section>;
}
