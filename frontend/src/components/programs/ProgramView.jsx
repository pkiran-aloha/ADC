import { useState } from 'react';
import TargetFormModal from '../Modals/TargetFormModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import Dialog from '../ui/Dialog';
import EmptyState from '../ui/EmptyState';
import { Field } from '../ui/Field';
import StatusControl from './StatusControl';
import {
  FIELD_LIMITS, MATERIAL_LIMITS_TEXT, PHASE_LABELS, PROGRAM_STATUSES, SCOPE_LABELS, TARGET_PHASES, TARGET_TYPE_LABELS,
  describeConfiguration, describeMastery, historyToCsv, materialHref, moveInOrder, orderedTargets, programSummary, statusLabel, targetTypeTabs, toValueList
} from '../../utils/programManagement';
import { CUSTOM_FIELD_DEFINITIONS, PROMPT_HIERARCHY_TEMPLATES } from '../../data/mockData';
import {
  ArrowDownIcon, ArrowLeft, ArrowUpIcon, Download, Edit3, Plus, Target, Trash2
} from '../ui/Icons';

// The program page: what the program is, how far along it is, and its targets as cards.
// Targets, the program's own details and its history sit on three tabs, so the page stays one
// idea at a time. A program with no targets is documentation, and the empty state says so.
const PAGE_TABS = [{ id: 'targets', label: 'Targets' }, { id: 'details', label: 'Program details' }, { id: 'history', label: 'History' }];

export default function ProgramView({
  program, scope = 'client', canEdit = true, asOf, startAdding = false, activity = [],
  onBack, onEdit, onAddTargets, onUpdateTarget, onDeleteTargets, onRequestPhase, onRequestStatus,
  onOpenAnalysis, onOpenTarget, onReorder, onResetOrder, onBulkEdit, onCopyToOrganization, onCopyToClients
}) {
  const [page, setPage] = useState('targets');
  const [tab, setTab] = useState('All');
  const [adding, setAdding] = useState(startAdding);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [confirming, setConfirming] = useState(null);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [moved, setMoved] = useState('');

  const library = scope !== 'client';
  const isPublic = scope === 'public';
  const writable = canEdit && !isPublic;
  const summary = programSummary(program);
  const tabs = targetTypeTabs(program.targets);
  const activeTab = tabs.includes(tab) ? tab : 'All';
  // The store changes a program in place (targets, phases, order), so these are worked out on
  // every render instead of being cached against the program object.
  const ordered = orderedTargets(program);
  const shown = ordered.filter(target => activeTab === 'All' || target.type === activeTab);
  const ids = new Set([program.id, ...(program.targets || []).map(target => target.id)]);
  const trail = activity.filter(entry => ids.has(entry.entityId));
  const reorderable = writable && activeTab === 'All' && ordered.length > 1;
  const chosen = ordered.filter(target => selected.has(target.id));
  const types = new Set((program.targets || []).map(target => target.type)).size;

  const toggle = id => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const askDelete = targets => setConfirming({
    title: targets.length === 1 ? `Delete “${targets[0].name}”?` : `Delete ${targets.length} targets?`,
    description: 'The targets are removed from this program. Observations already recorded against them are kept.',
    onConfirm: () => { onDeleteTargets?.(program, targets.map(target => target.id)); setSelected(new Set()); }
  });

  function place(id, beforeId) {
    const list = ordered.map(target => target.id);
    const without = list.filter(item => item !== id);
    const at = beforeId ? without.indexOf(beforeId) : without.length;
    without.splice(at < 0 ? without.length : at, 0, id);
    if (without.join() !== list.join()) onReorder?.(program, without);
  }
  function shift(target, delta) {
    const list = ordered.map(item => item.id);
    const next = moveInOrder(list, target.id, delta);
    if (next === list) return;
    onReorder?.(program, next);
    setMoved(`Moved ${target.name} to position ${next.indexOf(target.id) + 1} of ${next.length}.`);
  }

  return <section aria-labelledby="program-view-title" className="pm-view">
    <nav className="pm-crumbs" aria-label="Breadcrumb">
      <button type="button" className="pm-crumb-link" onClick={onBack}><ArrowLeft size={15} />Programs</button>
      <span aria-hidden="true">/</span>
      <span>{SCOPE_LABELS[scope]} · Skill acquisition</span>
    </nav>

    <header className="pm-view-head">
      <div className="pm-view-title">
        <h2 id="program-view-title">{program.name}</h2>
        <div className="pm-view-meta">
          <StatusControl value={program.status} label={`Status of ${program.name}`} options={PROGRAM_STATUSES}
            display={value => statusLabel(value, false)} disabled={!writable}
            onChange={value => onRequestStatus?.(program, value)} />
          {toValueList(program.treatmentArea).length > 0 && <ul className="pm-meta-list" aria-label="Treatment area">
            {toValueList(program.treatmentArea).map(area => <li key={area} className="pm-meta-area">{area}</li>)}</ul>}
          {toValueList(program.tags).length > 0 && <ul className="pm-meta-list" aria-label="Tags">
            {toValueList(program.tags).map(tag => <li key={tag} className="pm-meta-tag">{tag}</li>)}</ul>}
        </div>
      </div>
      <div className="pm-view-actions">
        {writable && <button type="button" className="button button--secondary" onClick={() => onEdit?.(program)}><Edit3 size={16} />Edit program</button>}
        {!library && program.targets?.length > 0 && <button type="button" className="button button--secondary" onClick={() => onOpenAnalysis?.(program)}>Open in target analysis</button>}
        {canEdit && scope === 'organization' && <button type="button" className="button button--secondary" onClick={() => onCopyToClients?.([program])}>Add to client</button>}
        {canEdit && isPublic && <>
          <button type="button" className="button button--primary" onClick={() => onCopyToClients?.([program])}>Add to client</button>
          <button type="button" className="button button--secondary" onClick={() => onCopyToOrganization?.([program])}>Add to organization</button>
        </>}
        {writable && page === 'targets' && <button type="button" className="button button--primary" onClick={() => setAdding(true)}><Plus size={16} />Add target</button>}
      </div>
    </header>

    {library && <p className="pm-banner" role="note">
      {isPublic
        ? 'This is a public library program. It is read only here. Add it to a client or to your organization library to use or change it.'
        : 'This is an organization library program. It has no learner data, so there are no phases or charts here. Add it to a client to start using it.'}
    </p>}

    <dl className="pm-stats" aria-label="Program summary">
      <div><dt>Total targets</dt><dd>{summary.total}</dd></div>
      {library
        ? <div><dt>Measurement types</dt><dd>{types}</dd></div>
        : <>
          <div><dt>Targets mastered</dt><dd>{summary.mastered}</dd></div>
          <div><dt>Completion</dt><dd>{summary.percent}%
            <span className="pm-meter" role="img" aria-label={`${summary.percent} percent of targets mastered`}><span style={{ width: `${summary.percent}%` }} /></span></dd></div>
        </>}
    </dl>

    <div className="pm-tabs" role="tablist" aria-label="Program page">
      {PAGE_TABS.map(entry => <button key={entry.id} type="button" role="tab" id={`pm-tab-${entry.id}`} aria-selected={page === entry.id}
        aria-controls={`pm-panel-${entry.id}`} tabIndex={page === entry.id ? 0 : -1} className="pm-tab" onClick={() => setPage(entry.id)}>
        {entry.label}{entry.id === 'targets' && <span className="pm-tab-count">{summary.total}</span>}{entry.id === 'history' && <span className="pm-tab-count">{trail.length}</span>}
      </button>)}
    </div>

    {page === 'targets' && <div role="tabpanel" id="pm-panel-targets" aria-labelledby="pm-tab-targets">
      <div className="pm-target-bar">
        {tabs.length > 0
          ? <div className="pm-type-tabs" role="group" aria-label="Measurement types">
            {tabs.map(type => <button key={type} type="button" className="pm-type-tab" aria-pressed={activeTab === type}
              onClick={() => setTab(type)}>{type === 'All' ? 'All' : TARGET_TYPE_LABELS[type]}</button>)}
          </div> : <span />}
        <div className="pm-target-tools">
          {writable && shown.length > 1 && <label className="pm-check pm-check--inline">
            <input type="checkbox" checked={chosen.length === ordered.length && ordered.length > 0}
              onChange={event => setSelected(event.target.checked ? new Set(ordered.map(target => target.id)) : new Set())} />
            <span>Select all</span>
          </label>}
          {writable && program.targetOrder && <button type="button" className="button button--tertiary" onClick={() => onResetOrder?.(program)}
            title="Restores the original system-defined order (phase-wise + alphabetical)">Reset order</button>}
        </div>
      </div>
      {reorderable && <p className="pm-note pm-note--tight">
        {program.targetOrder ? 'Custom order. A target you add later joins the end.' : 'Targets are ordered by phase, then alphabetically.'}
        {' '}Drag a card, or use the arrows, to set your own order.
      </p>}
      <p className="sr-only" role="status">{moved}</p>

      {shown.length === 0
        ? <EmptyState title="No targets yet." icon={Target}
          description={isPublic ? 'This public program has no targets.' : 'A program without targets is documentation. Add a target to define what will be measured.'}
          action={writable ? { label: 'Add the first target', onClick: () => setAdding(true) } : undefined} />
        : <ul className="pm-cards">
          {shown.map((target, position) => <li key={target.id}
            className={`pm-card${selected.has(target.id) ? ' pm-card--selected' : ''}${dragId === target.id ? ' pm-card--dragging' : ''}${overId === target.id && dragId && dragId !== target.id ? ' pm-card--over' : ''}`}
            draggable={reorderable || undefined}
            onDragStart={reorderable ? event => { setDragId(target.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', target.id); } : undefined}
            onDragOver={reorderable ? event => { if (dragId) { event.preventDefault(); setOverId(target.id); } } : undefined}
            onDrop={reorderable ? event => { event.preventDefault(); if (dragId) place(dragId, target.id); setDragId(null); setOverId(null); } : undefined}
            onDragEnd={reorderable ? () => { setDragId(null); setOverId(null); } : undefined}>
            {overId === target.id && dragId && dragId !== target.id && <span className="pm-slot" aria-hidden="true">Move here</span>}
            <div className="pm-card-head">
              {writable && <label className="pm-check pm-check--bare"><input type="checkbox" checked={selected.has(target.id)} onChange={() => toggle(target.id)} />
                <span className="sr-only">Select {target.name}</span></label>}
              <h3>{target.name}</h3>
              {reorderable && <div className="pm-reorder">
                <button type="button" className="icon-button" aria-label={`Move ${target.name} earlier`} disabled={position === 0} onClick={() => shift(target, -1)}><ArrowUpIcon size={16} /></button>
                <button type="button" className="icon-button" aria-label={`Move ${target.name} later`} disabled={position === shown.length - 1} onClick={() => shift(target, 1)}><ArrowDownIcon size={16} /></button>
              </div>}
            </div>
            <p className="pm-card-tool">{TARGET_TYPE_LABELS[target.type]}</p>
            <dl className="pm-card-facts">
              <div><dt>Mastery</dt><dd>{describeMastery(target)}</dd></div>
              <div><dt>Discriminative stimuli</dt><dd>{target.discriminativeStimuli || <span className="pm-none">Not set</span>}</dd></div>
              {describeConfiguration(target, PROMPT_HIERARCHY_TEMPLATES) && <div><dt>Recording</dt><dd>{describeConfiguration(target, PROMPT_HIERARCHY_TEMPLATES)}</dd></div>}
              {!isPublic && target.targetInstructions && <div><dt>Instructions</dt><dd>{target.targetInstructions}</dd></div>}
            </dl>
            <div className="pm-card-foot">
              {!library && <div className="pm-card-phase">
                <StatusControl value={target.phase} label={`Phase of ${target.name}`} options={TARGET_PHASES.filter(phase => phase !== 'Open' || target.phase === 'Open')}
                  display={value => PHASE_LABELS[value] || value} disabled={!writable}
                  onChange={value => onRequestPhase?.(program, target, value)} />
                <span className="pm-since">since {target.phaseEnteredDate}</span>
              </div>}
              <div className="pm-card-actions">
                {!library && onOpenTarget && <button type="button" className="button button--tertiary" onClick={() => onOpenTarget(program, target)}>Open chart</button>}
                {writable && <button type="button" className="icon-button" aria-label={`Edit ${target.name}`} onClick={() => setEditing(target)}><Edit3 size={17} /></button>}
                {writable && <button type="button" className="icon-button" aria-label={`Delete ${target.name}`} onClick={() => askDelete([target])}><Trash2 size={17} /></button>}
              </div>
            </div>
          </li>)}
        </ul>}

      {writable && chosen.length > 0 && <div className="pm-bulk pm-bulk--sticky" role="region" aria-label="Selected targets">
        <span className="pm-bulk-count">{chosen.length} selected</span>
        <div className="pm-bulk-actions">
          <button type="button" className="button button--secondary" onClick={() => setBulkEditing(true)}><Edit3 size={16} />Edit selected</button>
          <button type="button" className="button button--danger" onClick={() => askDelete(chosen)}><Trash2 size={16} />Delete selected</button>
          <button type="button" className="button button--tertiary" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      </div>}
    </div>}

    {page === 'details' && <div role="tabpanel" id="pm-panel-details" aria-labelledby="pm-tab-details" className="pm-details">
      <dl className="pm-defs">
        <div><dt>Status</dt><dd>{statusLabel(program.status, false)}</dd></div>
        <div><dt>Treatment area</dt><dd>{toValueList(program.treatmentArea).join(', ') || <span className="pm-none">None</span>}</dd></div>
        <div><dt>Baseline</dt><dd>{program.baseline || <span className="pm-none">{library ? 'Cleared in the library' : 'Not recorded'}</span>}</dd></div>
        <div><dt>Program objective</dt><dd>{program.programObjective || <span className="pm-none">{library ? 'Cleared in the library' : 'Not recorded'}</span>}</dd></div>
        <div><dt>Teaching instructions</dt><dd>{program.teachingInstructions || <span className="pm-none">{library ? 'Cleared in the library' : 'Not recorded'}</span>}</dd></div>
        {CUSTOM_FIELD_DEFINITIONS.map(definition => <div key={definition.key}><dt>{definition.label}</dt>
          <dd>{program.customFields?.[definition.key] || <span className="pm-none">Not recorded</span>}</dd></div>)}
      </dl>
      <section aria-labelledby="pm-materials-title" className="pm-materials">
        <h3 id="pm-materials-title">Learning materials</h3>
        <p className="pm-note">{MATERIAL_LIMITS_TEXT}</p>
        {(program.learningMaterials || []).length === 0
          ? <p className="pm-empty-line">No learning materials are attached.{writable && ' Add them from Edit program.'}</p>
          : <ul className="pm-files">
            {program.learningMaterials.map(material => <li key={material.path || material.fileName}>
              <a className="pm-file-name" href={materialHref(material, import.meta.env.BASE_URL)} download={material.fileName}>{material.fileName}</a>
              {material.size ? <span className="pm-file-size">{Math.max(1, Math.round(material.size / 1024))} KB</span> : null}
            </li>)}
          </ul>}
      </section>
    </div>}

    {page === 'history' && <div role="tabpanel" id="pm-panel-history" aria-labelledby="pm-tab-history" className="pm-history">
      <div className="pm-history-head">
        <p className="pm-note">Every change to this program and its targets, newest first. This demo records what changed and when, not who changed it.</p>
        {trail.length > 0 && <button type="button" className="button button--secondary" onClick={() => {
          const url = URL.createObjectURL(new Blob([historyToCsv(trail)], { type: 'text/csv' }));
          const link = Object.assign(document.createElement('a'), { href: url, download: `${program.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-history.csv` });
          link.click();
          URL.revokeObjectURL(url);
        }}><Download size={16} />Export CSV</button>}
      </div>
      {trail.length === 0 ? <p className="pm-empty-line">No changes recorded for this program yet.</p>
        : <ol className="pm-timeline">{trail.map(entry => <li key={entry.id}><time>{entry.at}</time><span>{entry.summary}</span></li>)}</ol>}
    </div>}

    <ConfirmDialog isOpen={Boolean(confirming)} onClose={() => setConfirming(null)} destructive
      title={confirming?.title || ''} description={confirming?.description} confirmLabel="Delete"
      onConfirm={() => { confirming?.onConfirm(); setConfirming(null); }} />

    {editing && <TargetFormModal key={`edit-${editing.id}`} isOpen program={program} target={editing} asOf={asOf} showPhase={!library}
      onClose={() => setEditing(null)}
      onSave={values => onUpdateTarget?.(editing, values, () => setEditing(null))} />}

    {adding && <TargetFormModal key="add-target" isOpen program={program} asOf={asOf} showPhase={!library}
      initialType={tabs.includes(activeTab) && activeTab !== 'All' ? activeTab : 'TrialByTrial'}
      onClose={() => setAdding(false)}
      onSave={values => { onAddTargets?.(program, values); setAdding(false); }} />}

    {bulkEditing && <BulkEditDialog targets={chosen} showPhase={!library} onClose={() => setBulkEditing(false)}
      onSave={values => { onBulkEdit?.(program, chosen, values); setBulkEditing(false); setSelected(new Set()); }} />}
  </section>;
}

// Edit several targets together. Only what is filled in changes, so a blank field never wipes
// what the targets already say.
function BulkEditDialog({ targets, showPhase, onClose, onSave }) {
  const [phase, setPhase] = useState('');
  const [stimuli, setStimuli] = useState('');
  const [instructions, setInstructions] = useState('');
  const changed = Boolean(phase || stimuli.trim() || instructions.trim());
  return <Dialog isOpen onClose={onClose} title={`Edit ${targets.length} ${targets.length === 1 ? 'target' : 'targets'}`}
    description="Only the fields you fill in change. The measurement tool of a target never changes.">
    <form className="pm-filter" noValidate onSubmit={event => {
      event.preventDefault();
      if (!changed) return;
      onSave({ phase: phase || undefined, ...(stimuli.trim() ? { discriminativeStimuli: stimuli.trim() } : {}), ...(instructions.trim() ? { targetInstructions: instructions.trim() } : {}) });
    }}>
      <ul className="pm-selected-list" aria-label="Targets being edited">{targets.map(target => <li key={target.id}>{target.name}</li>)}</ul>
      {showPhase && <Field id="bulk-phase" label="Phase" hint="Asks once whether to plot a phase change line for all of them.">
        <select value={phase} onChange={event => setPhase(event.target.value)}>
          <option value="">Keep each target’s phase</option>
          {TARGET_PHASES.filter(item => item !== 'Open').map(item => <option key={item} value={item}>{PHASE_LABELS[item]}</option>)}
        </select>
      </Field>}
      <Field id="bulk-stimuli" label="Discriminative stimuli" hint="Leave blank to keep what each target has.">
        <input type="text" value={stimuli} onChange={event => setStimuli(event.target.value)} />
      </Field>
      <Field id="bulk-instructions" label="Target instructions" hint={`Leave blank to keep what each target has. Up to ${FIELD_LIMITS.targetInstructions} characters.`}>
        <textarea rows={3} maxLength={FIELD_LIMITS.targetInstructions} value={instructions} onChange={event => setInstructions(event.target.value)} />
      </Field>
      <div className="dialog-actions">
        <button type="button" className="button button--secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="button button--primary" disabled={!changed}>Apply to {targets.length}</button>
      </div>
    </form>
  </Dialog>;
}
