import { useMemo, useState } from 'react';
import {
  countByCategory, partitionByArchive, PROGRAM_CATEGORIES, PROGRAM_STATUS_LABELS
} from '../utils/programManagement';
import ProgramFormModal from './Modals/ProgramFormModal';
import EmptyState from './ui/EmptyState';
import { Target, Notebook, Layers, Plus } from './ui/Icons';

// The Programs workspace: where a plan is defined, as opposed to the analytics
// that read it. Three tabs over one client scope, sharing the client the
// workspace is already scoped to.
const TABS = [
  { id: 'skill', label: 'Skill acquisition', category: PROGRAM_CATEGORIES.SKILL, icon: Target },
  { id: 'behavior', label: 'Behavior reduction', category: PROGRAM_CATEGORIES.BEHAVIOR, icon: Layers },
  { id: 'abc', label: 'ABC data recording', category: null, icon: Notebook }
];

export default function ProgramManagement({
  client, programs = [], lessons = [], abcConfiguration = null, abcEntries = [],
  canEdit = true, viewOnlyReason = '', onCreateProgram, onOpenProgram, onAddTargets
}) {
  const [tab, setTab] = useState('skill');
  const [formOpen, setFormOpen] = useState(false);
  const [formCategory, setFormCategory] = useState(PROGRAM_CATEGORIES.SKILL);
  const [pendingTargets, setPendingTargets] = useState(null);

  const counts = useMemo(() => ({
    skill: countByCategory(programs, PROGRAM_CATEGORIES.SKILL),
    behavior: countByCategory(programs, PROGRAM_CATEGORIES.BEHAVIOR),
    abc: (abcConfiguration?.antecedents?.length || 0) + (abcConfiguration?.behaviors?.length || 0)
      + (abcConfiguration?.consequences?.length || 0) + (abcConfiguration?.locations?.length || 0)
  }), [programs, abcConfiguration]);

  const lessonNames = useMemo(() => {
    const names = new Map();
    lessons.forEach(lesson => (lesson.programIds || []).forEach(id => {
      if (!names.has(id)) names.set(id, lesson.name);
    }));
    return names;
  }, [lessons]);

  const activeTab = TABS.find(entry => entry.id === tab) || TABS[0];

  function openCreate(category) {
    setFormCategory(category);
    setFormOpen(true);
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
          {activeTab.id === 'abc'
            ? <AbcConfigurationPanel configuration={abcConfiguration} entries={abcEntries} />
            : <ProgramListing category={activeTab.category} programs={programs} lessonNames={lessonNames}
              canEdit={canEdit} viewOnlyReason={viewOnlyReason} onCreate={openCreate} onOpen={onOpenProgram} />}
        </div>

        <ProgramFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} client={client}
          category={formCategory} existing={programs}
          onSave={values => {
            const created = onCreateProgram?.(values);
            setFormOpen(false);
            // A program with no targets is documentation, not a program. The
            // platform offers the next step straight away.
            setPendingTargets(created || null);
          }} />

        {pendingTargets && <div className="programs-prompt" role="dialog" aria-labelledby="programs-prompt-title">
          <div className="programs-prompt-body">
            <h2 id="programs-prompt-title">Do you want to add targets for this created program?</h2>
            <p>Without targets, the program cannot be executed and no data can be recorded against it.</p>
            <div className="dialog-actions">
              <button type="button" className="button button--secondary" onClick={() => setPendingTargets(null)}>Maybe later</button>
              <button type="button" className="button button--primary" onClick={() => {
                onAddTargets?.(pendingTargets);
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
function ProgramListing({ category, programs, lessonNames, canEdit, viewOnlyReason, onCreate, onOpen }) {
  const [showArchived, setShowArchived] = useState(false);
  const scoped = useMemo(() => programs.filter(program => program.category === category), [programs, category]);
  const { active, archived } = useMemo(() => partitionByArchive(scoped), [scoped]);
  const shown = showArchived ? archived : active;

  return <>
    <div className="programs-listing-header">
      <p className="programs-listing-count">
        {active.length} active {active.length === 1 ? 'program' : 'programs'}
        {archived.length > 0 && <span className="programs-listing-archived"> · {archived.length} archived</span>}
      </p>
      <div className="programs-listing-actions">
        {archived.length > 0 && <button type="button" className="button button--tertiary" onClick={() => setShowArchived(value => !value)}
          aria-pressed={showArchived}>{showArchived ? 'Show active' : 'Show archived'}</button>}
        {canEdit && <button type="button" className="button button--primary" onClick={() => onCreate?.(category)}>
          <Plus size={16} />New {category === PROGRAM_CATEGORIES.BEHAVIOR ? 'behavior' : 'program'}
        </button>}
      </div>
    </div>

    {!canEdit && <p className="programs-readonly-note" role="status">
      View-only access. {viewOnlyReason || 'Programs can be read but not changed.'}
    </p>}

    {shown.length === 0
      ? <EmptyState title={showArchived ? 'No archived programs.' : 'No programs yet.'} icon={Target}
        description={showArchived
          ? 'Archived programs keep their history and their recorded data. None are archived for this client.'
          : 'Create a program to define what is taught, then add the targets that will be measured.'} />
      : <table className="programs-table">
        <caption className="sr-only">
          {category === PROGRAM_CATEGORIES.BEHAVIOR ? 'Behavior reduction programs' : 'Skill acquisition programs'} for {shown.length} {shown.length === 1 ? 'program' : 'programs'}
        </caption>
        <thead>
          <tr>
            <th scope="col">Program</th>
            <th scope="col">Targets</th>
            <th scope="col">Lesson</th>
            <th scope="col">Status</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {shown.map(program => <tr key={program.id}>
            <th scope="row">
              <button type="button" className="programs-table-name" onClick={() => onOpen?.(program)}>{program.name}</button>
              {program.tags?.length > 0 && <span className="programs-table-tags">{program.tags.join(' · ')}</span>}
            </th>
            <td>{program.targets?.length || 0}</td>
            <td>{lessonNames.get(program.id) || <span className="programs-table-none">Not in a lesson</span>}</td>
            <td><span className={`status-pill status-pill--${String(program.status || '').toLowerCase()}`}>
              {PROGRAM_STATUS_LABELS[program.status] || program.status}</span></td>
            <td className="programs-table-actions">
              <button type="button" className="button button--tertiary" onClick={() => onOpen?.(program)}>Open</button>
            </td>
          </tr>)}
        </tbody>
      </table>}
  </>;
}

// The ABC vocabulary, for now read-only: the configuration screen arrives with
// the rest of the module's editing work.
function AbcConfigurationPanel({ configuration, entries }) {
  const lists = [
    { key: 'antecedents', label: 'Antecedent' },
    { key: 'behaviors', label: 'Behavior' },
    { key: 'consequences', label: 'Consequence' },
    { key: 'locations', label: 'Location' }
  ];
  if (!configuration) return <EmptyState title="No ABC configuration." icon={Notebook}
    description="This client has no ABC vocabulary configured." />;
  return <>
    <div className="programs-listing-header">
      <p className="programs-listing-count">{entries.length} recorded ABC observations</p>
    </div>
    {configuration.teachingInstructions && <p className="programs-abc-instructions">{configuration.teachingInstructions}</p>}
    <div className="programs-abc-lists">
      {lists.map(list => <div key={list.key} className="programs-abc-list">
        <h3>{list.label}</h3>
        <ul>{(configuration[list.key] || []).map(value => <li key={value}>{value}</li>)}</ul>
      </div>)}
    </div>
  </>;
}

export { TABS as PROGRAM_TABS };
