import { useEffect, useMemo, useRef, useState } from 'react';
import ProgramFilterPanel from './ProgramFilterPanel';
import StatusControl from './StatusControl';
import EmptyState from '../ui/EmptyState';
import Popover from '../ui/Popover';
import {
  BEHAVIOR_PHASES, PROGRAM_CATEGORIES, PROGRAM_STATUSES, TARGET_TYPE_LABELS,
  behaviorPhaseOf, filterOptions, filterPrograms, lessonsByProgram, partitionByArchive, statusLabel, statusOf, toValueList
} from '../../utils/programManagement';
import {
  Archive, ArrowCounterClockwise, Copy, Ellipsis, Edit3 as PencilSimple, Filter, Layers, Plus, Search, Target, X
} from '../ui/Icons';

const EMPTY_FILTERS = { statuses: [], tags: [], lessonIds: [] };

export default function ProgramListing({
  scope, category, programs, lessons = [], canEdit, viewOnlyReason, searchLabel,
  onCreate, onOpen, onEdit, onDuplicate, onArchive, onUnarchive, onRequestStatus, onRequestBehaviorPhase,
  onAddToLesson, onNewLesson, onCopyToOrganization, onCopyToClients
}) {
  const isBehavior = category === PROGRAM_CATEGORIES.BEHAVIOR;
  const noun = isBehavior ? 'behavior' : 'program';
  const isClient = scope === 'client';
  const isPublic = scope === 'public';
  const writable = canEdit && !isPublic;

  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  const scoped = useMemo(() => programs.filter(program => program.category === category), [programs, category]);
  const { active, archived } = useMemo(() => partitionByArchive(scoped), [scoped]);
  // The archived view only exists while something is archived. Restoring the last one returns
  // the listing to the working list rather than leaving it showing nothing.
  const viewingArchived = showArchived && archived.length > 0;
  const pool = viewingArchived ? archived : active;
  const memberships = useMemo(() => (isClient ? lessonsByProgram(lessons) : new Map()), [lessons, isClient]);
  const options = useMemo(() => filterOptions(pool, {
    statusValues: isBehavior ? BEHAVIOR_PHASES : PROGRAM_STATUSES, memberships, lessons: isClient && !isBehavior ? lessons : []
  }), [pool, isBehavior, memberships, lessons, isClient]);
  const shown = useMemo(() => filterPrograms(pool, { query, ...filters, memberships }), [pool, query, filters, memberships]);
  const filterCount = filters.statuses.length + filters.tags.length + filters.lessonIds.length;
  const filtering = Boolean(query.trim() || filterCount);
  const chosen = shown.filter(program => selected.has(program.id));
  const selectable = writable || (isPublic && canEdit);
  const allChosen = shown.length > 0 && chosen.length === shown.length;
  const selectAllRef = useRef(null);
  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = chosen.length > 0 && !allChosen; }, [chosen.length, allChosen]);

  const toggle = id => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const reset = () => { setQuery(''); setFilters(EMPTY_FILTERS); };
  const clearSelection = () => setSelected(new Set());

  const filterChips = [
    ...filters.statuses.map(value => ({ group: 'statuses', value, label: statusLabel(value, isBehavior) })),
    ...filters.tags.map(value => ({ group: 'tags', value, label: value })),
    ...filters.lessonIds.map(value => ({ group: 'lessonIds', value, label: lessons.find(lesson => lesson.id === value)?.name || 'Lesson' }))
  ];

  return <>
    <div className="pm-listing-head">
      <p className="pm-count">
        <strong>{viewingArchived ? archived.length : active.length}</strong> {viewingArchived ? 'archived' : 'active'} {(viewingArchived ? archived.length : active.length) === 1 ? noun : `${noun}s`}
        {!viewingArchived && archived.length > 0 && <span className="pm-count-archived"> · {archived.length} archived</span>}
      </p>
      <div className="pm-listing-actions">
        {archived.length > 0 && <button type="button" className="button button--secondary" aria-pressed={viewingArchived}
          onClick={() => { setShowArchived(value => !value); setSelected(new Set()); }}>{viewingArchived ? 'Active list' : 'Archived list'}</button>}
        {writable && <button type="button" className="button button--primary" onClick={() => onCreate?.(category)}>
          <Plus size={16} />{isBehavior ? 'Behavior' : 'Program'}</button>}
      </div>
    </div>

    {!canEdit && <p className="pm-readonly" role="status">View-only access. {viewOnlyReason || 'Programs can be read but not changed.'}</p>}

    <div className="pm-toolbar" role="search" aria-label={searchLabel}>
      <div className="pm-search">
        <Search size={17} aria-hidden="true" />
        <label htmlFor={`pm-search-${scope}-${category}`} className="sr-only">{searchLabel}</label>
        <input id={`pm-search-${scope}-${category}`} type="text" value={query} autoComplete="off"
          placeholder={isBehavior ? 'Search name, tag, tool, treatment area or phase' : `Search name, tag${isClient ? ', lesson' : ''} or status`}
          onChange={event => setQuery(event.target.value)} />
        {query && <button type="button" className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}
      </div>
      <button type="button" className="button button--secondary pm-filter-button" onClick={() => setPanelOpen(true)} aria-haspopup="dialog">
        <Filter size={17} />Filter{filterCount > 0 && <span className="pm-badge" aria-label={`${filterCount} applied`}>{filterCount}</span>}
      </button>
    </div>

    {filterChips.length > 0 && <ul className="pm-chips" aria-label="Applied filters">
      {filterChips.map(chip => <li key={`${chip.group}-${chip.value}`}>
        <button type="button" className="pm-chip" aria-label={`Remove filter ${chip.label}`}
          onClick={() => setFilters(current => ({ ...current, [chip.group]: current[chip.group].filter(item => item !== chip.value) }))}>
          {chip.label}<X size={12} aria-hidden="true" />
        </button>
      </li>)}
      <li><button type="button" className="button button--tertiary" onClick={reset}>Reset</button></li>
    </ul>}
    <p className="sr-only" role="status">{filtering ? `${shown.length} of ${pool.length} shown` : ''}</p>

    {isClient && !isBehavior && !viewingArchived && <details className="pm-lessons">
      <summary><span>Lessons</span><span className="pm-lessons-count">{lessons.length}</span></summary>
      <div className="pm-lessons-body">
        {lessons.length === 0
          ? <p className="pm-note">No lessons yet. A lesson groups programs that are run together, and lesson notes are written against it.</p>
          : <ul>{lessons.map(lesson => <li key={lesson.id}>
            <strong>{lesson.name}</strong>
            <span>{lesson.programIds.map(id => scoped.find(program => program.id === id)?.name).filter(Boolean).join(', ') || 'No programs yet'}</span>
          </li>)}</ul>}
        {writable && <button type="button" className="button button--secondary" onClick={() => onNewLesson?.()}><Plus size={15} />New lesson</button>}
      </div>
    </details>}

    {selectable && chosen.length > 0 && <div className="pm-bulk" role="region" aria-label="Selected items">
      <span className="pm-bulk-count">{chosen.length} selected</span>
      <div className="pm-bulk-actions">
        {isClient && !isBehavior && <button type="button" className="button button--primary" onClick={() => { onAddToLesson?.(chosen); clearSelection(); }}>Add to lesson</button>}
        {isClient && <button type="button" className="button button--secondary" onClick={() => onCopyToOrganization?.(chosen, clearSelection)}>Add to organization</button>}
        {scope === 'organization' && <button type="button" className="button button--primary" onClick={() => onCopyToClients?.(chosen, clearSelection)}>Add to client</button>}
        {isPublic && <>
          <button type="button" className="button button--primary" onClick={() => onCopyToClients?.(chosen, clearSelection)}>Add to client</button>
          <button type="button" className="button button--secondary" onClick={() => onCopyToOrganization?.(chosen, clearSelection)}>Add to organization</button>
        </>}
        <button type="button" className="button button--tertiary" onClick={clearSelection}>Clear selection</button>
      </div>
    </div>}

    {shown.length === 0 && pool.length > 0
      ? <EmptyState title="No results found." icon={Target}
        description="Nothing matches that search and filter. Try fewer words, or reset the filters."
        action={{ label: 'Reset search and filters', onClick: reset }} />
      : shown.length === 0
      ? <EmptyState title={viewingArchived ? `No archived ${noun}s.` : `No ${noun}s yet.`} icon={isBehavior ? Layers : Target}
        description={viewingArchived
          ? 'Archived items keep their history and their recorded data. None are archived here.'
          : isPublic ? 'The public library has nothing in this category.'
          : isBehavior ? 'Define a behavior to say exactly what is counted and how, before anyone records it.'
          : 'Create a program to define what is taught, then add the targets that will be measured.'} />
      : <div className="pm-table-wrap"><table className="pm-table">
        <caption className="sr-only">
          {isBehavior ? 'Behavior reduction' : 'Skill acquisition'} {isPublic ? 'public library' : scope === 'organization' ? 'organization library' : 'programs'}, {shown.length} {shown.length === 1 ? 'row' : 'rows'}
        </caption>
        <thead>
          <tr>
            {selectable && <th scope="col" className="pm-col-check">
              <label className="pm-check pm-check--bare"><input ref={selectAllRef} type="checkbox" checked={allChosen}
                onChange={event => setSelected(event.target.checked ? new Set(shown.map(program => program.id)) : new Set())} />
              <span className="sr-only">Select all {shown.length}</span></label></th>}
            <th scope="col">{isBehavior ? 'Behavior' : 'Program'}</th>
            {isBehavior ? <>
              <th scope="col">Measurement tool</th>
              <th scope="col">Treatment area</th>
              <th scope="col">Phase</th>
            </> : <>
              <th scope="col" className="pm-col-num">Targets</th>
              {isClient && <th scope="col">Lesson</th>}
            </>}
            <th scope="col">Tags</th>
            {!isBehavior && <th scope="col">Status</th>}
            <th scope="col" className="pm-col-actions"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {shown.map(program => {
            const lessonList = memberships.get(program.id) || [];
            const tags = toValueList(program.tags);
            return <tr key={program.id} className={selected.has(program.id) ? 'pm-row--selected' : undefined}>
              {selectable && <td className="pm-col-check"><label className="pm-check pm-check--bare">
                <input type="checkbox" checked={selected.has(program.id)} onChange={() => toggle(program.id)} />
                <span className="sr-only">Select {program.name}</span></label></td>}
              <th scope="row" className="pm-col-name">
                <button type="button" className="pm-name-link" onClick={() => onOpen?.(program)}>{program.name}</button>
              </th>
              {isBehavior ? <>
                <td data-label="Measurement tool">{TARGET_TYPE_LABELS[program.targets?.[0]?.type] || 'Not set'}</td>
                <td data-label="Treatment area">{toValueList(program.treatmentArea).join(', ') || <span className="pm-none">None</span>}</td>
              </> : <>
                <td className="pm-col-num" data-label="Targets">{program.targets?.length || 0}</td>
                {isClient && <td data-label="Lesson">{lessonList.length ? lessonList.map(lesson => lesson.name).join(', ') : <span className="pm-none">Not in a lesson</span>}</td>}
              </>}
              {isBehavior && <td data-label="Phase">
                <StatusControl value={behaviorPhaseOf(program)} label={`Phase of ${program.name}`} options={BEHAVIOR_PHASES}
                  display={value => statusLabel(value, true)} disabled={!writable || viewingArchived}
                  onChange={value => onRequestBehaviorPhase?.(program, value)} />
              </td>}
              <td data-label="Tags">{tags.length === 0 ? <span className="pm-none">None</span>
                : <ul className="pm-tags">{tags.slice(0, 3).map(tag => <li key={tag}>{tag}</li>)}
                  {tags.length > 3 && <li title={tags.slice(3).join(', ')}>+{tags.length - 3}</li>}</ul>}</td>
              {!isBehavior && <td data-label="Status">
                <StatusControl value={statusOf(program)} label={`Status of ${program.name}`} options={PROGRAM_STATUSES}
                  display={value => statusLabel(value, false)} disabled={!writable || viewingArchived}
                  onChange={value => onRequestStatus?.(program, value)} />
              </td>}
              <td className="pm-col-actions">
                <RowActions program={program} scope={scope} writable={writable} canEdit={canEdit} archivedView={viewingArchived}
                  onOpen={onOpen} onEdit={onEdit} onDuplicate={onDuplicate} onArchive={onArchive} onUnarchive={onUnarchive}
                  onCopyToOrganization={onCopyToOrganization} onCopyToClients={onCopyToClients} />
              </td>
            </tr>;
          })}
        </tbody>
      </table></div>}

    {panelOpen && <ProgramFilterPanel isOpen onClose={() => setPanelOpen(false)} options={options} value={filters}
      isBehavior={isBehavior} showLessons={isClient && !isBehavior}
      onApply={next => { setFilters(next); setPanelOpen(false); }} />}
  </>;
}

// Each row's own actions live in one menu, so the listing stays easy to scan.
function RowActions({ program, scope, writable, canEdit, archivedView, onOpen, onEdit, onDuplicate, onArchive, onUnarchive, onCopyToOrganization, onCopyToClients }) {
  const item = (close, handler, Icon, text) => <button type="button" className="popover-option" onClick={() => { close(true); handler(); }}>
    {Icon ? <Icon size={18} aria-hidden="true" /> : <span className="pm-menu-gap" aria-hidden="true" />}<span>{text}</span>
  </button>;
  return <Popover label={`Actions for ${program.name}`} icon={Ellipsis} compact className="overflow-popover">
    {({ close }) => <>
      {item(close, () => onOpen?.(program), Target, 'Open')}
      {writable && item(close, () => onEdit?.(program), PencilSimple, 'Edit')}
      {writable && item(close, () => onDuplicate?.(program), Copy, 'Duplicate')}
      {canEdit && scope === 'client' && item(close, () => onCopyToOrganization?.([program]), null, 'Add to organization')}
      {canEdit && scope !== 'client' && item(close, () => onCopyToClients?.([program]), null, 'Add to client')}
      {canEdit && scope === 'public' && item(close, () => onCopyToOrganization?.([program]), null, 'Add to organization')}
      {writable && (archivedView
        ? item(close, () => onUnarchive?.(program), ArrowCounterClockwise, 'Unarchive')
        : item(close, () => onArchive?.(program), Archive, 'Archive'))}
    </>}
  </Popover>;
}
