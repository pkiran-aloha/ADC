import { useMemo, useState } from 'react';
import {
  BEHAVIOR_PHASES, behaviorPhaseOf, countByCategory, filterPrograms, partitionByArchive, PROGRAM_CATEGORIES, PROGRAM_STATUSES, PROGRAM_STATUS_LABELS,
  TARGET_TYPE_LABELS
} from '../utils/programManagement';
import ProgramFormModal from './Modals/ProgramFormModal';
import ProgramView from './ProgramView';
import LessonDialog from './Modals/LessonDialog';
import AbcConfiguration from './AbcConfiguration';
import LessonNotes from './LessonNotes';
import ConfirmDialog from './ui/ConfirmDialog';
import EmptyState from './ui/EmptyState';
import Popover from './ui/Popover';
import {
  Archive, ArrowCounterClockwise, Copy, Ellipsis, Layers, Notebook, Edit3 as PencilSimple, Plus, Target, X
} from './ui/Icons';

// The Programs workspace: where a plan is defined, as opposed to the analytics
// that read it. Three tabs over one client scope, sharing the client the
// workspace is already scoped to.
const TABS = [
  { id: 'skill', label: 'Skill acquisition', category: PROGRAM_CATEGORIES.SKILL, icon: Target },
  { id: 'behavior', label: 'Behavior reduction', category: PROGRAM_CATEGORIES.BEHAVIOR, icon: Layers },
  { id: 'abc', label: 'ABC data recording', category: null, icon: Notebook },
  { id: 'notes', label: 'Lesson notes', category: null, icon: Notebook }
];

export default function ProgramManagement({
  client, programs = [], lessons = [], abcConfiguration = null, abcEntries = [],
  canEdit = true, viewOnlyReason = '', onCreateProgram, onOpenProgram,
  onUpdateProgram, onDuplicateProgram, onArchiveProgram, onUnarchiveProgram, onAddTarget, onUpdateTarget, onDeleteTargets, onRequestStatus, onRequestPhase, onRequestBehaviorPhase, activity = [], asOf,
  onUpdateAbcConfig, onAddAbcValue, onRenameAbcValue, onRemoveAbcValues, onImportAbcBehaviors, onSaveLesson, onOpenTarget, initialProgramId = null,
  lessonNotes = [], observations = [], onCreateNote, onUpdateNote, onNoteStatus, onSignNote, onRecordNote, onRecordAbcNote
}) {
  const [tab, setTab] = useState('skill');
  const [formOpen, setFormOpen] = useState(false);
  const [formCategory, setFormCategory] = useState(PROGRAM_CATEGORIES.SKILL);
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [pendingTargets, setPendingTargets] = useState(null);
  const [viewing, setViewing] = useState({ id: initialProgramId, adding: false });
  const [lessonDialog, setLessonDialog] = useState(null);

  const counts = useMemo(() => ({
    skill: countByCategory(programs, PROGRAM_CATEGORIES.SKILL),
    behavior: countByCategory(programs, PROGRAM_CATEGORIES.BEHAVIOR),
    notes: lessonNotes.length,
    abc: (abcConfiguration?.antecedents?.length || 0) + (abcConfiguration?.behaviors?.length || 0)
      + (abcConfiguration?.consequences?.length || 0) + (abcConfiguration?.locations?.length || 0)
  }), [programs, abcConfiguration, lessonNotes.length]);

  const lessonNames = useMemo(() => {
    const names = new Map();
    lessons.forEach(lesson => (lesson.programIds || []).forEach(id => {
      if (!names.has(id)) names.set(id, lesson.name);
    }));
    return names;
  }, [lessons]);

  const activeTab = TABS.find(entry => entry.id === tab) || TABS[0];
  const viewingProgram = programs.find(program => program.id === viewing.id) || null;

  function openCreate(category) {
    setFormCategory(category);
    setEditing(null);
    setFormOpen(true);
  }

  // Editing opens the same form with everything already filled in, so the
  // clinician modifies a program rather than recreating it.
  function openEdit(program) {
    setFormCategory(program.category);
    setEditing(program);
    setFormOpen(true);
  }

  function askDuplicate(program) {
    setConfirming({
      title: `Duplicate “${program.name}”?`,
      description: 'The copy carries the program’s fields and its targets, with new identities and no history. It can be changed without affecting the original.',
      confirmLabel: 'Duplicate program',
      onConfirm: () => onDuplicateProgram?.(program)
    });
  }

  function askArchive(program) {
    setConfirming({
      title: `Archive “${program.name}”?`,
      description: 'The program leaves the working list. Its history and the data recorded against it are kept, and it can be restored later.',
      confirmLabel: 'Archive program',
      onConfirm: () => onArchiveProgram?.(program)
    });
  }

  function onUnarchive(program) {
    onUnarchiveProgram?.(program);
  }

  return <section id="programs" aria-labelledby="programs-title" tabIndex={-1}>
    <div className="page-heading">
      <div>
        <p className="eyebrow">Planning</p>
        <h1 id="programs-title">Programs</h1>
        <p className="page-description">
          Define what is taught and how it is measured. Every change here stays in this browser and shows up in the analytics.
        </p>
      </div>
    </div>

    {!client ? <EmptyState title="Choose a client." icon={Target}
      description="A client's programs belong to that client, so pick one before you open this workspace." />
      : <>
        {viewingProgram ? <ProgramView key={viewingProgram.id + (viewing.adding ? '-add' : '')} program={viewingProgram} canEdit={canEdit}
          asOf={asOf} startAdding={viewing.adding} onBack={() => setViewing({ id: null, adding: false })}
          onAddTargets={onAddTarget} onUpdateTarget={onUpdateTarget} onDeleteTargets={onDeleteTargets} onRequestPhase={onRequestPhase} onRequestBehaviorPhase={onRequestBehaviorPhase}
          activity={activity} onOpenAnalysis={onOpenProgram} onOpenTarget={onOpenTarget} /> : <>
        <div className="programs-tabs" role="tablist" aria-label="Program types">
          {TABS.map(entry => {
            const Icon = entry.icon;
            const selected = entry.id === tab;
            // The ABC vocabulary is client-specific, so it stays unavailable until a
            // client is chosen. The other tabs need a client too.
            return <button key={entry.id} type="button" role="tab" id={`programs-tab-${entry.id}`}
              aria-controls={`programs-panel-${entry.id}`} aria-selected={selected}
              tabIndex={selected ? 0 : -1} className={`programs-tab programs-tab--${entry.id}`}
              onClick={() => setTab(entry.id)}>
              <span aria-hidden="true"><Icon size={17} /></span>
              <span>{entry.label}</span>
              <span className="programs-tab-count">{counts[entry.id]}</span>
            </button>;
          })}
        </div>

        <div role="tabpanel" id={`programs-panel-${activeTab.id}`} aria-labelledby={`programs-tab-${activeTab.id}`}>
          {activeTab.id === 'notes'
            ? <LessonNotes notes={lessonNotes} lessons={lessons} programs={programs} observations={observations}
              abcEntries={abcEntries} abcConfiguration={abcConfiguration} canEdit={canEdit} asOf={asOf}
              onCreate={onCreateNote} onUpdate={onUpdateNote} onStatus={onNoteStatus} onSign={onSignNote}
              onRecord={onRecordNote} onRecordAbc={onRecordAbcNote} />
            : activeTab.id === 'abc'
            ? <AbcConfiguration key={client?.id} configuration={abcConfiguration} entries={abcEntries} canEdit={canEdit}
              behaviorNames={programs.filter(program => program.category === PROGRAM_CATEGORIES.BEHAVIOR && !program.archivedAt).map(program => program.name)}
              onUpdateConfig={onUpdateAbcConfig} onAddValue={onAddAbcValue} onRenameValue={onRenameAbcValue}
              onRemoveValues={onRemoveAbcValues} onImportBehaviors={onImportAbcBehaviors} />
            : <ProgramListing category={activeTab.category} programs={programs} lessonNames={lessonNames}
              canEdit={canEdit} viewOnlyReason={viewOnlyReason} lessons={lessons}
              onAddToLesson={selected => setLessonDialog({ programs: selected, lessons })} onNewLesson={() => setLessonDialog({ programs: [], lessons: [] })}
              onCreate={openCreate} onOpen={program => setViewing({ id: program.id, adding: false })}
              onEdit={openEdit} onDuplicate={askDuplicate} onArchive={askArchive} onUnarchive={onUnarchive} onRequestStatus={onRequestStatus} onRequestBehaviorPhase={onRequestBehaviorPhase} />}
        </div>
        </>}

        <ProgramFormModal key={editing?.id || 'new'} isOpen={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }}
          client={client} category={formCategory} program={editing} existing={programs}
          onSave={values => {
            const saved = editing ? onUpdateProgram?.(editing, values) : onCreateProgram?.(values);
            setFormOpen(false);
            setEditing(null);
            // A program with no targets is documentation, not a program. The
            // platform offers the next step straight away.
            if (!editing) setPendingTargets(saved || null);
          }} />

        {lessonDialog && <LessonDialog key={lessonDialog.programs.map(program => program.id).join('|') || 'new'} isOpen
          lessons={lessonDialog.lessons} programs={lessonDialog.programs}
          title={lessonDialog.programs.length ? 'Add to lesson' : 'New lesson'}
          onClose={() => setLessonDialog(null)}
          onSave={values => { onSaveLesson?.(values); setLessonDialog(null); }} />}

        <ConfirmDialog isOpen={Boolean(confirming)} onClose={() => setConfirming(null)}
          title={confirming?.title || ''} description={confirming?.description}
          confirmLabel={confirming?.confirmLabel || 'Confirm'} destructive={confirming?.destructive}
          onConfirm={() => { confirming?.onConfirm(); setConfirming(null); }} />

        {pendingTargets && <div className="programs-prompt" role="dialog" aria-labelledby="programs-prompt-title">
          <div className="programs-prompt-body">
            <h2 id="programs-prompt-title">Do you want to add targets for this created program?</h2>
            <p>Without targets, the program cannot be executed and no data can be recorded against it.</p>
            <div className="dialog-actions">
              <button type="button" className="button button--secondary" onClick={() => setPendingTargets(null)}>Maybe later</button>
              <button type="button" className="button button--primary" onClick={() => {
                setViewing({ id: pendingTargets.id, adding: true });
                setPendingTargets(null);
              }}>Yes, let’s add targets</button>
            </div>
          </div>
        </div>}
      </>}
  </section>;
}

// The listing: what each program is, how many targets it holds, where it runs,
// and what a clinician can do with it.
function ProgramListing({ category, programs, lessonNames, canEdit, viewOnlyReason, onCreate, onOpen, onEdit, onDuplicate, onArchive, onUnarchive, onRequestStatus, onRequestBehaviorPhase, lessons = [], onAddToLesson, onNewLesson }) {
  const [showArchived, setShowArchived] = useState(false);
  const scoped = useMemo(() => programs.filter(program => program.category === category), [programs, category]);
  const { active, archived } = useMemo(() => partitionByArchive(scoped), [scoped]);
  // The archived view only exists while something is archived. Restoring the
  // last one returns the listing to the working list rather than leaving it
  // showing nothing.
  const viewingArchived = showArchived && archived.length > 0;
  const pool = viewingArchived ? archived : active;
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const shown = useMemo(() => filterPrograms(pool, { query, status: statusFilter, lessonNames }), [pool, query, statusFilter, lessonNames]);
  const filtering = Boolean(query.trim() || statusFilter);
  const isBehavior = category === PROGRAM_CATEGORIES.BEHAVIOR;
  const [selected, setSelected] = useState(() => new Set());
  const selectable = canEdit && !isBehavior && !viewingArchived;
  const chosen = shown.filter(program => selected.has(program.id));
  const toggle = id => setSelected(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return <>
    <div className="programs-listing-header">
      <p className="programs-listing-count">
        {active.length} active {active.length === 1 ? 'program' : 'programs'}
        {archived.length > 0 && <span className="programs-listing-archived"> · {archived.length} archived</span>}
      </p>
      <div className="programs-listing-actions">
        {archived.length > 0 && <button type="button" className="button button--tertiary" onClick={() => setShowArchived(value => !value)}
          aria-pressed={viewingArchived}>{viewingArchived ? 'Show active' : 'Show archived'}</button>}
        {canEdit && <button type="button" className="button button--primary" onClick={() => onCreate?.(category)}>
          <Plus size={16} />New {category === PROGRAM_CATEGORIES.BEHAVIOR ? 'behavior' : 'program'}
        </button>}
      </div>
    </div>

    {!canEdit && <p className="programs-readonly-note" role="status">
      View-only access. {viewOnlyReason || 'Programs can be read but not changed.'}
    </p>}

    <div className="programs-search" role="search" aria-label={isBehavior ? 'Search behaviors' : 'Search programs'}>
      <label htmlFor={`programs-search-${category}`} className="sr-only">{isBehavior ? 'Search behaviors' : 'Search programs'}</label>
      <input id={`programs-search-${category}`} type="text" value={query} autoComplete="off"
        placeholder={isBehavior ? 'Search name, tag, tool, treatment area or phase' : 'Search name, tag, lesson or status'}
        onChange={event => setQuery(event.target.value)} />
      {query && <button type="button" className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}
      <label htmlFor={`programs-filter-${category}`} className="sr-only">{isBehavior ? 'Filter by phase' : 'Filter by status'}</label>
      <select id={`programs-filter-${category}`} value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
        <option value="">{isBehavior ? 'All phases' : 'All statuses'}</option>
        {isBehavior
          ? BEHAVIOR_PHASES.map(phase => <option key={phase} value={phase}>{phase === 'OnHold' ? 'On hold' : phase}</option>)
          : PROGRAM_STATUSES.map(status => <option key={status} value={status}>{PROGRAM_STATUS_LABELS[status]}</option>)}
      </select>
      {filtering && <button type="button" className="button button--tertiary" onClick={() => { setQuery(''); setStatusFilter(''); }}>Reset</button>}
      <p className="sr-only" role="status">{filtering ? `${shown.length} of ${pool.length} shown` : ''}</p>
    </div>

    {!isBehavior && !viewingArchived && <section className="lessons-panel" aria-label="Lessons">
      <header className="abc-list-header">
        <h3>Lessons</h3>
        {canEdit && <button type="button" className="button button--tertiary" onClick={() => onNewLesson?.()}><Plus size={15} />New lesson</button>}
      </header>
      {lessons.length === 0
        ? <p className="program-form-note">No lessons yet. A lesson groups programs that are run together.</p>
        : <ul>{lessons.map(lesson => <li key={lesson.id}>
          <strong>{lesson.name}</strong>
          <span> · {lesson.programIds.map(id => programs.find(program => program.id === id)?.name).filter(Boolean).join(', ') || 'No programs yet'}</span>
        </li>)}</ul>}
    </section>}

    {selectable && chosen.length > 0 && <div className="target-bulk" role="status">
      <span>{chosen.length} selected</span>
      <button type="button" className="button button--primary" onClick={() => { onAddToLesson?.(chosen); setSelected(new Set()); }}>Add to lesson</button>
      <button type="button" className="button button--tertiary" onClick={() => setSelected(new Set())}>Clear selection</button>
    </div>}

    {shown.length === 0 && pool.length > 0
      ? <EmptyState title="No results found." icon={Target}
        description="Nothing matches that search and filter. Try fewer words, or reset the filters." action={{ label: 'Reset search', onClick: () => { setQuery(''); setStatusFilter(''); } }} />
      : shown.length === 0
      ? <EmptyState title={viewingArchived ? 'No archived programs.' : 'No programs yet.'} icon={Target}
        description={viewingArchived
          ? 'Archived programs keep their history and their recorded data. None are archived for this client.'
          : 'Create a program to define what is taught, then add the targets that will be measured.'} />
      : <table className="programs-table">
        <caption className="sr-only">
          {category === PROGRAM_CATEGORIES.BEHAVIOR ? 'Behavior reduction programs' : 'Skill acquisition programs'} for {shown.length} {shown.length === 1 ? 'program' : 'programs'}
        </caption>
        <thead>
          <tr>
            {selectable && <th scope="col"><span className="sr-only">Select</span></th>}
            <th scope="col">{isBehavior ? 'Behavior' : 'Program'}</th>
            {isBehavior ? <>
              <th scope="col">Measurement tool</th>
              <th scope="col">Treatment area</th>
              <th scope="col">Phase</th>
            </> : <>
              <th scope="col">Targets</th>
              <th scope="col">Lesson</th>
              <th scope="col">Status</th>
            </>}
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {shown.map(program => <tr key={program.id}>
            {selectable && <td><label className="program-form-check">
              <input type="checkbox" checked={selected.has(program.id)} onChange={() => toggle(program.id)} />
              <span className="sr-only">Select {program.name}</span></label></td>}
            <th scope="row">
              <button type="button" className="programs-table-name" onClick={() => onOpen?.(program)}>{program.name}</button>
              {program.tags?.length > 0 && <span className="programs-table-tags">{program.tags.join(' · ')}</span>}
            </th>
            {isBehavior ? <>
              <td>{TARGET_TYPE_LABELS[program.targets?.[0]?.type] || '–'}</td>
              <td>{[].concat(program.treatmentArea || []).join(', ') || '–'}</td>
              <td>{canEdit && !viewingArchived
                ? <select className="status-select" aria-label={`Phase of ${program.name}`} value={behaviorPhaseOf(program)}
                  onChange={event => onRequestBehaviorPhase?.(program, event.target.value)}>
                  {BEHAVIOR_PHASES.map(phase => <option key={phase} value={phase}>{phase === 'OnHold' ? 'On hold' : phase}</option>)}
                </select>
                : <span className="status-pill">{behaviorPhaseOf(program)}</span>}</td>
            </> : <>
              <td>{program.targets?.length || 0}</td>
              <td>{lessonNames.get(program.id) || <span className="programs-table-none">Not in a lesson</span>}</td>
              <td>{canEdit && !viewingArchived
              ? <select className="status-select" aria-label={`Status of ${program.name}`} value={program.status}
                onChange={event => onRequestStatus?.(program, event.target.value)}>
                {PROGRAM_STATUSES.map(status => <option key={status} value={status}>{PROGRAM_STATUS_LABELS[status]}</option>)}
              </select>
              : <span className={`status-pill status-pill--${String(program.status || '').toLowerCase()}`}>
                {PROGRAM_STATUS_LABELS[program.status] || program.status}</span>}</td>
            </>}
            <td className="programs-table-actions">
              <button type="button" className="button button--tertiary" onClick={() => onOpen?.(program)}>Open</button>
              {canEdit && <ProgramRowActions program={program} showArchived={viewingArchived}
                onEdit={onEdit} onDuplicate={onDuplicate} onArchive={onArchive} onUnarchive={onUnarchive} />}
            </td>
          </tr>)}
        </tbody>
      </table>}
  </>;
}

// The row's own actions live in an overflow, so the listing stays scannable.
function ProgramRowActions({ program, showArchived, onEdit, onDuplicate, onArchive, onUnarchive }) {
  return <Popover label={`Actions for ${program.name}`} icon={Ellipsis} compact className="overflow-popover">
    {({ close }) => <>
      <button type="button" className="popover-option" onClick={() => { close(true); onEdit?.(program); }}>
        <PencilSimple size={18} aria-hidden="true" /><span>Edit</span>
      </button>
      <button type="button" className="popover-option" onClick={() => { close(true); onDuplicate?.(program); }}>
        <Copy size={18} aria-hidden="true" /><span>Duplicate</span>
      </button>
      {showArchived
        ? <button type="button" className="popover-option" onClick={() => { close(true); onUnarchive?.(program); }}>
          <ArrowCounterClockwise size={18} aria-hidden="true" /><span>Unarchive</span>
        </button>
        : <button type="button" className="popover-option" onClick={() => { close(true); onArchive?.(program); }}>
          <Archive size={18} aria-hidden="true" /><span>Archive</span>
        </button>}
    </>}
  </Popover>;
}

export { TABS as PROGRAM_TABS };
