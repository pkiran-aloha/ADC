import { useMemo, useState } from 'react';
import TargetFormModal from './Modals/TargetFormModal';
import ConfirmDialog from './ui/ConfirmDialog';
import EmptyState from './ui/EmptyState';
import {
  BEHAVIOR_PHASES, behaviorPhaseOf, MATERIAL_LIMITS_TEXT, materialHref, PHASE_LABELS, PROGRAM_STATUS_LABELS, programSummary, sortTargets, TARGET_PHASES, TARGET_TYPE_LABELS, targetTypeTabs
} from '../utils/programManagement';
import { ArrowLeft, Edit3, Plus, Target, Trash2 } from './ui/Icons';

// The program view: what the program is, how far along it is, and its targets as
// cards. A program with no targets is documentation, so the empty state says so.
export default function ProgramView({
  program, canEdit = true, asOf, startAdding = false, activity = [], onBack, onAddTargets, onUpdateTarget, onDeleteTargets, onRequestPhase, onRequestBehaviorPhase, onOpenAnalysis, onOpenTarget, onAddMaterial, onRemoveMaterial
}) {
  const [tab, setTab] = useState('All');
  const [adding, setAdding] = useState(startAdding);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [confirming, setConfirming] = useState(null);
  const [materialError, setMaterialError] = useState('');
  const isBehavior = program.category === 'BehaviorReduction';
  const summary = programSummary(program);
  const tabs = targetTypeTabs(program.targets);
  const activeTab = tabs.includes(tab) ? tab : 'All';
  const ids = useMemo(() => new Set([program.id, ...(program.targets || []).map(target => target.id)]), [program]);
  const trail = useMemo(() => activity.filter(entry => ids.has(entry.entityId)).slice(0, 8), [activity, ids]);
  const toggle = id => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const askDelete = targets => setConfirming({
    title: targets.length === 1 ? `Delete “${targets[0].name}”?` : `Delete ${targets.length} targets?`,
    description: 'The targets are removed from this program. Observations already recorded against them are kept.',
    onConfirm: () => { onDeleteTargets?.(program, targets.map(target => target.id)); setSelected(new Set()); }
  });
  const shown = useMemo(() => sortTargets((program.targets || []).filter(target => activeTab === 'All' || target.type === activeTab)), [program.targets, activeTab]);

  return <section aria-labelledby="program-view-title" className="program-view">
    <button type="button" className="button button--tertiary" onClick={onBack}><ArrowLeft size={16} />Back to programs</button>
    <header className="program-view-header">
      <div>
        <h2 id="program-view-title">{program.name}</h2>
        <p className="program-view-meta">
          <span className={`status-pill status-pill--${String(program.status || '').toLowerCase()}`}>{PROGRAM_STATUS_LABELS[program.status] || program.status}</span>
          {[].concat(program.treatmentArea || []).map(area => <span key={area} className="status-label">{area}</span>)}
          {(program.tags || []).map(tag => <span key={tag} className="status-label">{tag}</span>)}
        </p>
      </div>
      <div className="program-view-actions">
        {program.targets?.length > 0 && <button type="button" className="button button--secondary" onClick={() => onOpenAnalysis?.(program)}>Open in target analysis</button>}
        {canEdit && !isBehavior && <button type="button" className="button button--primary" onClick={() => setAdding(true)}><Plus size={16} />Add target</button>}
      </div>
    </header>

    {isBehavior && <section className="behavior-detail" aria-label="Behavior definition">
      <h3>Operational definition</h3>
      <p>{program.operationalDefinition || 'No operational definition has been written for this behavior yet.'}</p>
      <p className="behavior-detail-meta">
        <span><strong>Measurement tool:</strong> {TARGET_TYPE_LABELS[program.targets?.[0]?.type] || 'Not set'}</span>
        <label className="target-phase-control">Behavior phase
          {canEdit
            ? <select aria-label="Behavior phase" value={behaviorPhaseOf(program)} onChange={event => onRequestBehaviorPhase?.(program, event.target.value)}>
              {BEHAVIOR_PHASES.map(phase => <option key={phase} value={phase}>{phase === 'OnHold' ? 'On hold' : phase}</option>)}
            </select>
            : <strong>{behaviorPhaseOf(program)}</strong>}
        </label>
      </p>
      <p className="field-hint">Open means the behavior is defined but not yet being reduced. The phase of its target describes the measurement and is separate.</p>
    </section>}

    <dl className="program-summary" aria-label="Program summary">
      <div><dt>Total targets</dt><dd>{summary.total}</dd></div>
      <div><dt>Targets mastered</dt><dd>{summary.mastered}</dd></div>
      <div><dt>Completion</dt><dd>{summary.percent}%</dd></div>
    </dl>

    {tabs.length > 0 && <div className="programs-tabs" role="group" aria-label="Measurement types">
      {tabs.map(type => <button key={type} type="button" className="programs-tab" aria-pressed={activeTab === type}
        onClick={() => setTab(type)}>{type === 'All' ? 'All' : TARGET_TYPE_LABELS[type]}</button>)}
    </div>}

    {shown.length === 0
      ? <EmptyState title="No targets yet." icon={Target}
        description="A program without targets is documentation. Add a target to define what will be measured." />
      : <ul className="target-cards">
        {shown.map(target => <li key={target.id} className="target-card">
          <h3>{target.name}</h3>
          <p className="target-card-meta">
            <span className="status-label">{TARGET_TYPE_LABELS[target.type]}</span>
            <span className="status-label">{PHASE_LABELS[target.phase] || target.phase}</span>
            <span className="status-label">{target.masterySettings || 'Automatic'} mastery</span>
          </p>
          {target.discriminativeStimuli && <p><strong>Discriminative stimuli:</strong> {target.discriminativeStimuli}</p>}
          <p className="target-card-date">Since {target.phaseEnteredDate}</p>
          {onOpenTarget && <button type="button" className="button button--tertiary" onClick={() => onOpenTarget(program, target)}>Open chart</button>}
          {canEdit && <label className="target-phase-control">Phase
            <select aria-label={`Phase of ${target.name}`} value={target.phase}
              onChange={event => onRequestPhase?.(program, target, event.target.value)}>
              {TARGET_PHASES.filter(phase => program.category === 'BehaviorReduction' || phase !== 'Open' || target.phase === 'Open')
                .map(phase => <option key={phase} value={phase}>{PHASE_LABELS[phase]}</option>)}
            </select></label>}
          {canEdit && <div className="target-card-actions">
            {!isBehavior && <label className="program-form-check">
              <input type="checkbox" checked={selected.has(target.id)} onChange={() => toggle(target.id)} />
              <span className="sr-only">Select {target.name}</span>
            </label>}
            <button type="button" className="icon-button" aria-label={`Edit ${target.name}`} onClick={() => setEditing(target)}><Edit3 size={17} /></button>
            {!isBehavior && <button type="button" className="icon-button" aria-label={`Delete ${target.name}`} onClick={() => askDelete([target])}><Trash2 size={17} /></button>}
          </div>}
        </li>)}
      </ul>}

    {canEdit && selected.size > 0 && <div className="target-bulk" role="status">
      <span>{selected.size} selected</span>
      <button type="button" className="button button--danger" onClick={() => askDelete((program.targets || []).filter(target => selected.has(target.id)))}>Delete selected</button>
      <button type="button" className="button button--tertiary" onClick={() => setSelected(new Set())}>Clear selection</button>
    </div>}

    <section aria-labelledby="program-materials-title" className="lessons-panel">
      <h3 id="program-materials-title">Learning materials</h3>
      <p className="field-hint">{MATERIAL_LIMITS_TEXT}</p>
      {(program.learningMaterials || []).length === 0
        ? <p className="program-form-note">No learning materials are attached.</p>
        : <ul className="material-links">
          {program.learningMaterials.map(material => <li key={material.path || material.fileName}>
            <a href={materialHref(material, import.meta.env.BASE_URL)} download={material.fileName}>{material.fileName}</a>
            {material.size ? <span className="program-form-note"> · {Math.max(1, Math.round(material.size / 1024))} KB</span> : null}
            {canEdit && typeof material.content === 'string' && <button type="button" className="button button--tertiary"
              aria-label={`Remove ${material.fileName}`} onClick={() => onRemoveMaterial?.(program, material.fileName)}>Remove</button>}
          </li>)}
        </ul>}
      {canEdit && <div className="field">
        <label htmlFor="program-material-input">Attach a text file</label>
        <input id="program-material-input" type="file" accept=".txt,.md,.csv,text/plain"
          onChange={async event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const result = await onAddMaterial?.(program, { fileName: file.name, content: await file.text() });
            setMaterialError(result && !result.ok ? result.reason : '');
          }} />
        {materialError && <p className="field-error" role="alert">{materialError}</p>}
      </div>}
    </section>

    <section aria-labelledby="program-activity-title" className="program-activity">
      <h3 id="program-activity-title">Activity</h3>
      {trail.length === 0 ? <p className="program-form-note">No changes recorded for this program yet.</p>
        : <ul>{trail.map(entry => <li key={entry.id}><span>{entry.at}</span> {entry.summary}</li>)}</ul>}
    </section>

    <ConfirmDialog isOpen={Boolean(confirming)} onClose={() => setConfirming(null)} destructive
      title={confirming?.title || ''} description={confirming?.description} confirmLabel="Delete"
      onConfirm={() => { confirming?.onConfirm(); setConfirming(null); }} />

    {editing && <TargetFormModal key={`edit-${editing.id}`} isOpen program={program} target={editing} asOf={asOf}
      onClose={() => setEditing(null)}
      onSave={values => { onUpdateTarget?.(editing, values); setEditing(null); }} />}

    {adding && <TargetFormModal key="add-target" isOpen program={program} asOf={asOf}
      initialType={tabs.includes(activeTab) && activeTab !== 'All' ? activeTab : 'TrialByTrial'}
      onClose={() => setAdding(false)}
      onSave={values => { onAddTargets?.(program, values); setAdding(false); }} />}
  </section>;
}
