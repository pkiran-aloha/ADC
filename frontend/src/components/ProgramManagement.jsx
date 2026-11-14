import { useMemo, useState } from 'react';
import {
  PROGRAM_CATEGORIES, SCOPE_LABELS, SCOPES, behaviorPhaseOf, countByCategory
} from '../utils/programManagement';
import ProgramFormPage from './programs/ProgramFormPage';
import ProgramListing from './programs/ProgramListing';
import ProgramView from './programs/ProgramView';
import BehaviorView from './programs/BehaviorView';
import { AddToClientDialog, WipeoutDialog } from './programs/LibraryDialogs';
import LessonDialog from './Modals/LessonDialog';
import Dialog from './ui/Dialog';
import AbcConfiguration from './AbcConfiguration';
import LessonNotes from './LessonNotes';
import ConfirmDialog from './ui/ConfirmDialog';
import EmptyState from './ui/EmptyState';
import { Layers, Notebook, Target } from './ui/Icons';

// The Programs workspace: where a plan is defined, as opposed to the analytics that read it.
// Programs live in one of three scopes. Client is one learner's own plan. Organization is the
// practice's shared library. Public is a read-only set of starter programs. ABC recording and
// lesson notes are always about one client, so they exist in the client scope only.
const TABS = [
  { id: 'skill', label: 'Skill acquisition', category: PROGRAM_CATEGORIES.SKILL, icon: Target },
  { id: 'behavior', label: 'Behavior reduction', category: PROGRAM_CATEGORIES.BEHAVIOR, icon: Layers },
  { id: 'abc', label: 'ABC data recording', category: null, icon: Notebook, clientOnly: true },
  { id: 'notes', label: 'Lesson notes', category: null, icon: Notebook, clientOnly: true }
];

const SCOPE_BLURB = {
  client: client => `The plan for ${client?.name || 'this client'}. Changes here show up in the analytics straight away.`,
  organization: () => 'Your practice’s shared library. Programs here hold no learner-specific text and can be added to any client.',
  public: () => 'Starter programs for every practice, read only. Add one to a client or to your organization library to use it.'
};

export default function ProgramManagement({
  client, clients = [], programs = [], orgPrograms = [], publicPrograms = [], lessons = [], abcConfiguration = null, abcEntries = [],
  canEdit = true, viewOnlyReason = '', onCreateProgram, onOpenProgram,
  onUpdateProgram, onDuplicateProgram, onArchiveProgram, onUnarchiveProgram, onAddTarget, onUpdateTarget, onDeleteTargets,
  onRequestStatus, onRequestPhase, onRequestBehaviorPhase, activity = [], asOf,
  onUpdateAbcConfig, onAddAbcValue, onRenameAbcValue, onRemoveAbcValues, onImportAbcBehaviors, onSaveLesson, onOpenTarget,
  onCopyToOrganization, onCopyToClients, onReorderTargets, onResetTargetOrder, onBulkEditTargets, initialProgramId = null,
  lessonNotes = [], observations = [], onCreateNote, onUpdateNote, onNoteStatus, onSignNote, onRecordNote, onRecordAbcNote, onAddNoteTargets, onRemoveNoteAbc
}) {
  const [scope, setScope] = useState('client');
  const [tab, setTab] = useState('skill');
  const [screen, setScreen] = useState(() => (initialProgramId ? { mode: 'view', id: initialProgramId, adding: false } : { mode: 'list' }));
  const [confirming, setConfirming] = useState(null);
  const [pendingTargets, setPendingTargets] = useState(null);
  const [lessonDialog, setLessonDialog] = useState(null);
  const [wipe, setWipe] = useState(null);
  const [clientDialog, setClientDialog] = useState(null);

  const scoped = scope === 'client' ? programs : scope === 'organization' ? orgPrograms : publicPrograms;
  const isClient = scope === 'client';
  const counts = useMemo(() => ({
    skill: countByCategory(scoped, PROGRAM_CATEGORIES.SKILL),
    behavior: countByCategory(scoped, PROGRAM_CATEGORIES.BEHAVIOR),
    notes: lessonNotes.length,
    abc: (abcConfiguration?.antecedents?.length || 0) + (abcConfiguration?.behaviors?.length || 0)
      + (abcConfiguration?.consequences?.length || 0) + (abcConfiguration?.locations?.length || 0)
  }), [scoped, abcConfiguration, lessonNotes.length]);
  const scopeCounts = useMemo(() => Object.fromEntries(SCOPES.map(id => {
    const pool = id === 'client' ? programs : id === 'organization' ? orgPrograms : publicPrograms;
    return [id, pool.filter(program => !program.archivedAt).length];
  })), [programs, orgPrograms, publicPrograms]);

  const activeTab = TABS.find(entry => entry.id === tab) || TABS[0];
  const viewing = screen.mode === 'view' || screen.mode === 'form' ? [...programs, ...orgPrograms, ...publicPrograms].find(program => program.id === (screen.id || screen.programId)) : null;
  const toList = () => setScreen({ mode: 'list' });

  function changeScope(next) {
    setScope(next);
    setScreen({ mode: 'list' });
    if (TABS.find(entry => entry.id === tab)?.clientOnly && next !== 'client') setTab('skill');
  }

  const noun = program => (program?.category === PROGRAM_CATEGORIES.BEHAVIOR ? 'behavior' : 'program');

  function askDuplicate(program) {
    setConfirming({
      title: `Duplicate “${program.name}”?`,
      description: 'The copy carries the fields and the targets, with new identities and no history. It starts in Pending and can be changed without affecting the original.',
      confirmLabel: `Duplicate ${noun(program)}`,
      onConfirm: () => onDuplicateProgram?.(program)
    });
  }
  function askArchive(program) {
    setConfirming({
      title: `Archive “${program.name}”?`,
      description: 'It leaves the working list and the active analytics. Its history and the data recorded against it are kept, and it can be restored from the archived list.',
      confirmLabel: `Archive ${noun(program)}`,
      onConfirm: () => onArchiveProgram?.(program)
    });
  }
  function askUnarchive(program) {
    setConfirming({
      title: `Unarchive “${program.name}”?`,
      description: 'It returns to the working list and is available again for use.',
      confirmLabel: `Unarchive ${noun(program)}`,
      onConfirm: () => onUnarchiveProgram?.(program)
    });
  }

  // Add to organization. Leaving a client clears client-specific text, so that is confirmed first.
  function askCopyToOrganization(selected, done) {
    if (scope === 'client') setWipe({ programs: selected, done });
    else { onCopyToOrganization?.(selected); done?.(); }
  }
  function askCopyToClients(selected, done) {
    setClientDialog({ programs: selected, done });
  }

  function save(values) {
    const editing = screen.programId ? viewing : null;
    if (!editing) {
      const created = onCreateProgram?.(values, scope);
      // A program with no targets is documentation, not a program. The platform offers the
      // next step straight away.
      if (created && created.category !== PROGRAM_CATEGORIES.BEHAVIOR) setPendingTargets(created);
      toList();
      return;
    }
    // A status or phase changed in the form goes through the same dated change and phase-line
    // question as everywhere else. Cancelling that question keeps the form open and saves nothing.
    const rest = () => { onUpdateProgram?.(editing, values); toList(); };
    if (editing.category === PROGRAM_CATEGORIES.BEHAVIOR) {
      if (values.behaviorPhase !== behaviorPhaseOf(editing)) onRequestBehaviorPhase?.(editing, values.behaviorPhase, { commit: rest });
      else rest();
    } else if (values.status !== editing.status) onRequestStatus?.(editing, values.status, { commit: rest });
    else rest();
  }

  return <section id="programs" aria-labelledby="programs-title" tabIndex={-1}>
    <div className="page-heading">
      <div>
        <p className="eyebrow">Planning</p>
        <h1 id="programs-title">Programs</h1>
        <p className="page-description">
          Define what is taught and how it is measured. Every change here stays in this browser.
        </p>
      </div>
    </div>

    {screen.mode === 'form'
      ? <ProgramFormPage key={screen.programId || `new-${screen.category}-${scope}`} category={viewing?.category || screen.category} scope={scope} client={client}
        program={screen.programId ? viewing : null} asOf={asOf}
        existing={scoped.filter(program => program.id !== screen.programId)}
        onSave={save} onCancel={() => (screen.programId && screen.from === 'view' ? setScreen({ mode: 'view', id: screen.programId, adding: false }) : toList())}
        onOpenTargets={program => setScreen({ mode: 'view', id: program.id, adding: false })} />
      : screen.mode === 'view' && viewing
      ? (viewing.category === PROGRAM_CATEGORIES.BEHAVIOR
        ? <BehaviorView key={viewing.id} program={viewing} scope={scope} canEdit={canEdit} asOf={asOf} activity={activity}
          observations={isClient ? observations : []} onBack={toList}
          onEdit={program => setScreen({ mode: 'form', programId: program.id, from: 'view' })}
          onRequestPhase={onRequestBehaviorPhase} onOpenTarget={onOpenTarget}
          onCopyToOrganization={selected => askCopyToOrganization(selected)} onCopyToClients={selected => askCopyToClients(selected)} />
        : <ProgramView key={viewing.id + (screen.adding ? '-add' : '')} program={viewing} scope={scope} canEdit={canEdit} asOf={asOf}
          startAdding={screen.adding} activity={activity} onBack={toList}
          onEdit={program => setScreen({ mode: 'form', programId: program.id, from: 'view' })}
          onAddTargets={onAddTarget} onUpdateTarget={onUpdateTarget} onDeleteTargets={onDeleteTargets}
          onRequestPhase={onRequestPhase} onRequestStatus={onRequestStatus}
          onOpenAnalysis={onOpenProgram} onOpenTarget={onOpenTarget}
          onReorder={onReorderTargets} onResetOrder={onResetTargetOrder} onBulkEdit={onBulkEditTargets}
          onCopyToOrganization={selected => askCopyToOrganization(selected)} onCopyToClients={selected => askCopyToClients(selected)} />)
      : <>
        <div className="pm-scope">
          <div className="pm-scope-switch" role="group" aria-label="Scope">
            {SCOPES.map(id => <button key={id} type="button" aria-pressed={scope === id} className="pm-scope-button" onClick={() => changeScope(id)}>
              {SCOPE_LABELS[id]}<span className="pm-scope-count">{scopeCounts[id]}</span></button>)}
          </div>
          <p className="pm-scope-blurb">{SCOPE_BLURB[scope](client)}</p>
        </div>

        {isClient && !client
          ? <EmptyState title="Choose a client." icon={Target}
            description="A client's programs belong to that client, so pick one before you open this scope. The organization and public libraries do not need a client." />
          : <>
            <div className="pm-tabs" role="tablist" aria-label="Program types">
              {TABS.map(entry => {
                const Icon = entry.icon;
                const selected = entry.id === tab;
                const disabled = entry.clientOnly && !isClient;
                return <button key={entry.id} type="button" role="tab" id={`programs-tab-${entry.id}`} disabled={disabled}
                  aria-controls={`programs-panel-${entry.id}`} aria-selected={selected} title={disabled ? 'This is always about one client, so it is in the Client scope only.' : undefined}
                  tabIndex={selected ? 0 : -1} className={`pm-tab programs-tab--${entry.id}`}
                  onClick={() => setTab(entry.id)}>
                  <span aria-hidden="true"><Icon size={17} /></span>
                  <span>{entry.label}</span>
                  <span className="pm-tab-count">{entry.clientOnly && !isClient ? '–' : counts[entry.id]}</span>
                </button>;
              })}
            </div>

            <div role="tabpanel" id={`programs-panel-${activeTab.id}`} aria-labelledby={`programs-tab-${activeTab.id}`}>
              {activeTab.id === 'notes'
                ? <LessonNotes notes={lessonNotes} lessons={lessons} programs={programs} observations={observations}
                  abcEntries={abcEntries} abcConfiguration={abcConfiguration} canEdit={canEdit} asOf={asOf}
                  onCreate={onCreateNote} onUpdate={onUpdateNote} onStatus={onNoteStatus} onSign={onSignNote}
                  onRecord={onRecordNote} onRecordAbc={onRecordAbcNote}
                  onAddTargets={onAddNoteTargets} onRemoveAbc={onRemoveNoteAbc} />
                : activeTab.id === 'abc'
                ? <AbcConfiguration key={client?.id} configuration={abcConfiguration} entries={abcEntries} canEdit={canEdit}
                  behaviorNames={programs.filter(program => program.category === PROGRAM_CATEGORIES.BEHAVIOR && !program.archivedAt).map(program => program.name)}
                  onUpdateConfig={onUpdateAbcConfig} onAddValue={onAddAbcValue} onRenameValue={onRenameAbcValue}
                  onRemoveValues={onRemoveAbcValues} onImportBehaviors={onImportAbcBehaviors} />
                : <ProgramListing key={`${scope}-${activeTab.id}`} scope={scope} category={activeTab.category} programs={scoped} lessons={isClient ? lessons : []}
                  canEdit={canEdit} viewOnlyReason={viewOnlyReason}
                  searchLabel={activeTab.category === PROGRAM_CATEGORIES.BEHAVIOR ? 'Search behaviors' : 'Search programs'}
                  onCreate={category => setScreen({ mode: 'form', category, programId: null })}
                  onOpen={program => setScreen({ mode: 'view', id: program.id, adding: false })}
                  onEdit={program => setScreen({ mode: 'form', programId: program.id, from: 'list' })}
                  onDuplicate={askDuplicate} onArchive={askArchive} onUnarchive={askUnarchive}
                  onRequestStatus={onRequestStatus} onRequestBehaviorPhase={onRequestBehaviorPhase}
                  onAddToLesson={selected => setLessonDialog({ programs: selected, lessons })} onNewLesson={() => setLessonDialog({ programs: [], lessons: [] })}
                  onCopyToOrganization={askCopyToOrganization} onCopyToClients={askCopyToClients} />}
            </div>
          </>}
      </>}

    {lessonDialog && <LessonDialog key={lessonDialog.programs.map(program => program.id).join('|') || 'new'} isOpen
      lessons={lessonDialog.lessons} programs={lessonDialog.programs}
      title={lessonDialog.programs.length ? 'Add to lesson' : 'New lesson'}
      onClose={() => setLessonDialog(null)}
      onSave={values => { onSaveLesson?.(values); setLessonDialog(null); }} />}

    <ConfirmDialog isOpen={Boolean(confirming)} onClose={() => setConfirming(null)}
      title={confirming?.title || ''} description={confirming?.description}
      confirmLabel={confirming?.confirmLabel || 'Confirm'} destructive={confirming?.destructive}
      onConfirm={() => { confirming?.onConfirm(); setConfirming(null); }} />

    {wipe && <WipeoutDialog isOpen programs={wipe.programs} onClose={() => setWipe(null)}
      onConfirm={() => { onCopyToOrganization?.(wipe.programs); wipe.done?.(); setWipe(null); }} />}

    {clientDialog && <AddToClientDialog isOpen clients={clients} programs={clientDialog.programs}
      source={scope === 'public' ? 'public' : 'organization'} onClose={() => setClientDialog(null)}
      onAdd={clientIds => { onCopyToClients?.(clientDialog.programs, clientIds); clientDialog.done?.(); setClientDialog(null); }} />}

    {pendingTargets && <Dialog isOpen onClose={() => setPendingTargets(null)} presentation="confirmation"
      title="Do you want to add targets for this created program?"
      description="Without targets, the program cannot be executed and no data can be recorded against it.">
      <div className="form-actions">
        <button type="button" className="button button--secondary" data-autofocus onClick={() => setPendingTargets(null)}>Maybe later</button>
        <button type="button" className="button button--primary" onClick={() => {
          setScreen({ mode: 'view', id: pendingTargets.id, adding: true });
          setPendingTargets(null);
        }}>Yes, let’s add</button>
      </div>
    </Dialog>}

  </section>;
}

export { TABS as PROGRAM_TABS };
