import { useMemo, useRef, useState } from 'react';
import { Edit3, Plus, Search, Trash2, X } from '../ui/Icons';
import SegmentedControl from '../ui/SegmentedControl';
import Popover from '../ui/Popover';
import ProgramDetails from '../ProgramDetails';
import { MEASUREMENT_LABELS } from '../../utils/formValidation';
import { programProgressLabel } from '../../utils/targetAnalytics';
import {
  explorerSummaryCaption, filterExplorerGroups, isExplorerProgramSelected,
  isExplorerTargetSelected, nextExplorerFocusIndex
} from '../../utils/trendExplorer';

const LIFECYCLE_TONE = { mastered: 'positive', paused: 'attention', ended: 'neutral', active: 'neutral' };

// Target explorer: current scope stays visible while target browsing and selection changes
// remain on demand. The center keeps the graph primary; the context rail separates status,
// annotations and definitions into keyboard-operable tabs. Full decision details live in
// Visual analysis, with one priority insight summarized next to the graph.
export default function TrendExplorer({
  catalog,
  selection,
  skillPrograms = [],
  programProgressMap = new Map(),
  allBehaviors = [],
  behaviorQuickPicks = [],
  onSelectCategory,
  onSelectProgramDropdown,
  onToggleBehaviorId,
  onSelectBehaviorPreset,
  onSelectProgramGroup,
  onSelectTargetItem,
  insights = [],
  focusedEntry = null,
  annotationTarget = null,
  tabTargets = [],
  onAnnotationTargetChange,
  activeAnnotations = { phaseLines: [], phaseRanges: [], graphNotes: [] },
  onAddPhaseLineClick,
  onAddPhaseRangeClick,
  onAddGraphNoteClick,
  onEditAnnotation,
  onDeletePhaseLine,
  onDeletePhaseRange,
  onDeleteGraphNote,
  canEdit = true,
  viewOnlyReason = '',
  detailPrograms = [],
  activeTarget = null,
  onReviewInsights,
  children
}) {
  const [query, setQuery] = useState('');
  const [listScope, setListScope] = useState('All');
  const itemRefs = useRef([]);
  const targetListRef = useRef(null);
  const contextTabRefs = useRef([]);
  const [contextTab, setContextTab] = useState('context');

  const categoryOptions = useMemo(() => ([
    { value: 'All', label: 'All', accessibleLabel: 'All categories' },
    { value: 'SkillAcquisition', label: 'Skills', accessibleLabel: 'Skill acquisition' },
    {
      value: 'Behavior',
      label: `Behaviors (${allBehaviors.length})`,
      accessibleLabel: `Behavior reduction (${allBehaviors.length})`
    }
  ]), [allBehaviors.length]);

  const filteredGroups = useMemo(
    () => filterExplorerGroups(catalog.groups, { query, category: listScope }),
    [catalog.groups, query, listScope]
  );

  const flatTargets = useMemo(
    () => filteredGroups.flatMap(group => group.targets),
    [filteredGroups]
  );

  const summary = useMemo(
    () => explorerSummaryCaption({ filteredGroups, query, category: listScope }),
    [filteredGroups, query, listScope]
  );

  function handleCategorySwitch(nextScope) {
    setListScope(nextScope);
    if (nextScope === 'SkillAcquisition' || nextScope === 'Behavior') {
      onSelectCategory(nextScope);
    }
  }

  function onItemKeyDown(event, index) {
    const nextIndex = nextExplorerFocusIndex(index, event.key, flatTargets.length);
    if (nextIndex == null || nextIndex < 0) return;
    event.preventDefault();
    itemRefs.current[nextIndex]?.focus();
  }

  function onContextTabKeyDown(event) {
    const tabs = ['context', 'annotations', 'details'];
    const index = tabs.indexOf(document.activeElement?.dataset?.contextTab);
    if (index < 0) return;
    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setContextTab(tabs[nextIndex]);
    contextTabRefs.current[nextIndex]?.focus();
  }

  const singleAnnotationScope = selection.activeCategoryTab !== 'Behavior'
    || selection.selectedBehaviorIds.length <= 1;

  let runningIndex = 0;

  return (
    <div className="trend-explorer">
      <nav className="trend-explorer__list" aria-label="Target explorer">
        <div className="explorer-head">
          <div className="explorer-current-scope">
            <span className="explorer-current-scope__label">Current selection</span>
            <strong>{selection.activeCategoryTab === 'Behavior'
              ? `Behavior reduction · ${selection.selectedBehaviorIds.length} selected`
              : `Skill acquisition · ${skillPrograms.find(program => program.id === selection.selectedProgramId)?.name || 'Choose a program'}`}</strong>
            {activeTarget && <span className="explorer-current-scope__focus">Analysis focus · {activeTarget.name}</span>}
            <details className="explorer-change-selection">
              <summary>Change selection</summary>
              <div className="explorer-selection-controls">
                <div className="explorer-search">
            <label htmlFor="explorer-search">Search targets or programs</label>
            <div className="explorer-search__input">
              <Search size={16} aria-hidden="true" />
              <input
                id="explorer-search"
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Filter by target, program or phase…"
              />
              {query && (
                <button
                  type="button"
                  className="icon-button explorer-search__clear"
                  aria-label="Clear target search"
                  onClick={() => setQuery('')}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          <SegmentedControl
            label="Program category"
            value={listScope}
            onChange={handleCategorySwitch}
            options={categoryOptions}
            className="explorer-categories"
          />

          {selection.activeCategoryTab === 'SkillAcquisition' ? (
            <div className="control-field program-field explorer-program-picker">
              <label htmlFor="target-program">Program</label>
              <select
                id="target-program"
                value={selection.selectedProgramId}
                onChange={event => onSelectProgramDropdown(event.target.value)}
              >
                <option value="">Choose a program</option>
                {skillPrograms.map(program => (
                  <option key={program.id} value={program.id}>
                    {program.name} · {program.status} · {programProgressLabel(programProgressMap.get(program.id))}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="control-field program-field explorer-behavior-picker">
              <span className="control-label">Compare behaviors</span>
              <Popover label={`Choose behaviors (${selection.selectedBehaviorIds.length})`}>
                <p className="popover-label">Select one or more behaviors</p>
                <div className="quick-picks" role="group" aria-label="Quick behavior selections">
                  {behaviorQuickPicks.map(preset => (
                    <button
                      type="button"
                      key={preset.id}
                      className="chip-button"
                      aria-pressed={
                        preset.ids.length === selection.selectedBehaviorIds.length
                        && preset.ids.every(id => selection.selectedBehaviorIds.includes(id))
                      }
                      onClick={() => onSelectBehaviorPreset(preset.ids)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {allBehaviors.map(behavior => (
                  <label key={behavior.id} className="popover-option">
                    <input
                      type="checkbox"
                      checked={selection.selectedBehaviorIds.includes(behavior.id)}
                      onChange={event => onToggleBehaviorId(behavior.id, event.target.checked)}
                    />
                    <span>
                      {behavior.name}
                      <small className="block text-slate-500">
                        {MEASUREMENT_LABELS[behavior.type]} · {behavior.functionHypothesis} function
                      </small>
                    </span>
                  </label>
                ))}
              </Popover>
            </div>
          )}

                <p className="explorer-count" role="status" aria-live="polite">{summary}</p>
              </div>
            </details>
          </div>
        </div>

        <details className="explorer-target-list" ref={targetListRef}>
          <summary>Browse targets <span>· {flatTargets.length} target{flatTargets.length === 1 ? '' : 's'}</span></summary>
          <div className="explorer-groups">
          {filteredGroups.length === 0 ? (
            <div className="explorer-empty">
              <p><strong>No matching targets.</strong> Try another search term or show all categories.</p>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => { setQuery(''); setListScope('All'); }}
              >
                Reset search
              </button>
            </div>
          ) : filteredGroups.map(group => {
            const groupActive = isExplorerProgramSelected(group, selection);
            return (
              <div className="explorer-group" key={group.id}>
                <button
                  type="button"
                  className={`explorer-program${groupActive ? ' explorer-program--active' : ''}`}
                  aria-pressed={groupActive}
                  aria-label={`Select program: ${group.name}`}
                  onClick={() => onSelectProgramGroup(group)}
                >
                  <span className="explorer-program__name">{group.name}</span>
                  <small className="explorer-program__meta">
                    {group.category === 'BehaviorReduction'
                      ? `${group.domain ? `${group.domain} · ` : ''}${group.status}`
                      : group.progressLabel}
                  </small>
                </button>
                <ul className="explorer-targets">
                  {group.targets.map(entry => {
                    const currentFlatIndex = runningIndex;
                    runningIndex += 1;
                    const { plotted, focused } = isExplorerTargetSelected(entry, selection);
                    const chipTone = LIFECYCLE_TONE[entry.lifecycle] || 'neutral';
                    const reasonText = entry.flags.length
                      ? `, ${entry.flags.map(flag => flag.label).join('; ')}`
                      : '';
                    return (
                      <li key={entry.targetId}>
                        <button
                          type="button"
                          ref={element => { itemRefs.current[currentFlatIndex] = element; }}
                          className={`explorer-target${focused ? ' explorer-target--active' : plotted ? ' explorer-target--plotted' : ''}`}
                          aria-current={focused ? 'true' : undefined}
                          aria-label={`${entry.targetName}, ${group.name}, ${entry.phaseLabel}, ${entry.deltaLabel} (${entry.statusText})${reasonText}`}
                            onClick={() => {
                              onSelectTargetItem(entry);
                              if (targetListRef.current) {
                                targetListRef.current.open = false;
                                requestAnimationFrame(() => targetListRef.current?.querySelector('summary')?.focus());
                              }
                            }}
                          onKeyDown={event => onItemKeyDown(event, currentFlatIndex)}
                        >
                          <span className="explorer-target__row">
                            <strong className="explorer-target__name">{entry.targetName}</strong>
                            <span className={`health-delta health-delta--${entry.tone}`}>{entry.deltaLabel}</span>
                          </span>
                          <span className="explorer-target__meta">
                            <span className={`stat-chip stat-chip--${chipTone}`}>{entry.phaseLabel}</span>
                            <small>{entry.measurementLabel}</small>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          </div>
        </details>
      </nav>

      <div className="trend-explorer__center">
        {children}
      </div>

      <aside className="trend-explorer__rail" aria-label="Target context, annotations and details">
        <div className="rail-tabs" role="tablist" aria-label="Target analysis details" onKeyDown={onContextTabKeyDown}>
          {[
            { id: 'context', label: 'Context' },
            { id: 'annotations', label: 'Annotations' },
            { id: 'details', label: 'Target details' }
          ].map((tab, index) => <button key={tab.id} type="button" role="tab" id={`explorer-${tab.id}-tab`}
            data-context-tab={tab.id} aria-selected={contextTab === tab.id} aria-controls={`explorer-${tab.id}-panel`}
            tabIndex={contextTab === tab.id ? 0 : -1} ref={node => { contextTabRefs.current[index] = node; }}
            onClick={() => setContextTab(tab.id)}>{tab.label}{tab.id === 'context' && insights.length > 0 ? ` (${insights.length})` : ''}</button>)}
        </div>

        <section className="rail-card" id="explorer-context-panel" role="tabpanel" tabIndex={0} aria-labelledby="explorer-context-tab" hidden={contextTab !== 'context'}>
          <div className="rail-card__head"><h3>Clinical context</h3>
            {focusedEntry && <span className={`health-delta health-delta--${focusedEntry.tone}`}>{focusedEntry.deltaLabel}</span>}
          </div>
          {focusedEntry ? <p className="rail-target-summary">
            <strong>{focusedEntry.targetName}</strong>
            <span><span className={`stat-chip stat-chip--${LIFECYCLE_TONE[focusedEntry.lifecycle] || 'neutral'}`}>{focusedEntry.phaseLabel}</span>
              <small>{focusedEntry.statusText} · 90 days</small></span>
          </p> : <p className="field-hint">Select a target to see its current phase and recent status.</p>}
          <p className="field-hint">{insights.length
            ? `${insights.length} clinical decision prompt${insights.length === 1 ? '' : 's'} for this chart. Review the full details in Progress & decisions below.`
            : activeTarget ? 'No decision prompts for the currently plotted range.' : 'Select a target to inspect clinical decision prompts.'}</p>
          {insights.length > 0 && <button type="button" className="button button--secondary rail-review-insights" onClick={onReviewInsights}>
            Review decision prompts
          </button>}
        </section>

        <section className="rail-card" id="explorer-annotations-panel" role="tabpanel" tabIndex={0} aria-labelledby="explorer-annotations-tab" hidden={contextTab !== 'annotations'}>
          <div className="rail-card__head">
            <h3 id="explorer-annotations-title">Annotations</h3>
          </div>
          {!singleAnnotationScope ? (
            <p className="field-hint">
              Select a single behavior in the list to add or edit phase lines, ranges and notes.
            </p>
          ) : (
            <>
              {tabTargets.length > 1 && (
                <div className="control-field mb-3">
                  <label htmlFor="rail-annotation-target">Annotation target</label>
                  <select
                    id="rail-annotation-target"
                    aria-label="Annotation target"
                    value={annotationTarget?.id || ''}
                    onChange={event => onAnnotationTargetChange(event.target.value)}
                  >
                    {tabTargets.map(target => (
                      <option key={target.id} value={target.id}>{target.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="annotation-actions rail-annotation-actions" title={canEdit ? undefined : viewOnlyReason}>
                <button type="button" disabled={!annotationTarget || !canEdit} onClick={() => onAddPhaseLineClick?.(annotationTarget)}>
                  <Plus size={14} />Phase line
                </button>
                <button type="button" disabled={!annotationTarget || !canEdit} onClick={() => onAddPhaseRangeClick?.(annotationTarget)}>
                  <Plus size={14} />Phase range
                </button>
                <button type="button" disabled={!annotationTarget || !canEdit} onClick={() => onAddGraphNoteClick?.(annotationTarget)}>
                  <Plus size={14} />Note
                </button>
              </div>
              {annotationTarget && (
                <div className="annotations-list rail-annotations-list">
                  <span className="legend-title">Annotations · {annotationTarget.name}</span>
                  <div className="annotations-grid rail-annotations-grid">
                    {[
                      ['line', 'Phase lines', activeAnnotations.phaseLines, onDeletePhaseLine],
                      ['range', 'Phase ranges', activeAnnotations.phaseRanges, onDeletePhaseRange],
                      ['note', 'Graph notes', activeAnnotations.graphNotes, onDeleteGraphNote]
                    ].map(([kind, title, records, remove]) => (
                      <div className="annotation-group" key={kind}>
                        <h4>{title} ({records.length})</h4>
                        {!records.length && <p className="annotation-empty">None added for this target.</p>}
                        {records.map(record => (
                          <div className="annotation-item" key={record.id}>
                            <div>
                              <p>{record.label || record.noteText}</p>
                              <small>
                                {kind === 'range' ? `${record.startDate} – ${record.endDate}` : record.date}
                                {record.staffName ? ` · ${record.staffName}` : ''}
                                {record.isAutomated ? ' · automated' : ''}
                              </small>
                            </div>
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  className="icon-button"
                                  aria-label={`Edit ${record.label || 'graph note'}`}
                                  onClick={() => onEditAnnotation?.(kind, record, annotationTarget)}
                                >
                                  <Edit3 size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-button delete-button"
                                  aria-label={`Delete ${record.label || 'graph note'}`}
                                  onClick={() => remove?.(record.id)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="rail-card" id="explorer-details-panel" role="tabpanel" tabIndex={0} aria-labelledby="explorer-details-tab" hidden={contextTab !== 'details'}>
          <ProgramDetails programs={detailPrograms} activeTarget={activeTarget} />
        </section>
      </aside>
    </div>
  );
}
