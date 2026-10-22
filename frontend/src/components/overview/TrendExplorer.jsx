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

// Phase 3 Trend explorer: wraps Target analysis in a three-pane layout without removing
// any existing chart control, deep link or focus-request behaviour.
//   Left pane   — searchable target list grouped by program, with phase and 90d trend delta.
//   Center pane — existing TargetChart, full toolbar, inspector and visual analysis.
//   Right rail  — clinical insights (`buildInsights`), annotations and visible definitions.
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
  children
}) {
  const [query, setQuery] = useState('');
  const [listScope, setListScope] = useState('All');
  const itemRefs = useRef([]);

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
              ? `${selection.selectedBehaviorIds.length} behavior${selection.selectedBehaviorIds.length === 1 ? '' : 's'}`
              : (skillPrograms.find(program => program.id === selection.selectedProgramId)?.name || 'Choose a program')}</strong>
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
                          onClick={() => onSelectTargetItem(entry)}
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
      </nav>

      <div className="trend-explorer__center">
        {children}
      </div>

      <aside className="trend-explorer__rail" aria-label="Clinical context">
        <section className="rail-card" aria-labelledby="explorer-insights-title">
          <div className="rail-card__head">
            <h3 id="explorer-insights-title">Clinical context</h3>
            {focusedEntry && (
              <span className={`health-delta health-delta--${focusedEntry.tone}`}>
                {focusedEntry.deltaLabel}
              </span>
            )}
          </div>
          {focusedEntry && (
            <p className="rail-target-summary">
              <strong>{focusedEntry.targetName}</strong>
              <span>
                <span className={`stat-chip stat-chip--${LIFECYCLE_TONE[focusedEntry.lifecycle] || 'neutral'}`}>
                  {focusedEntry.phaseLabel}
                </span>
                <small>{focusedEntry.statusText} (90d)</small>
              </span>
            </p>
          )}
          {insights.length > 0 ? (
            <ul className="insight-list rail-insights">
              {insights.map(insight => (
                <li key={insight.title} className={`insight insight--${insight.tone}`}>
                  <strong>{insight.title}</strong>
                  <p>{insight.detail}</p>
                  <small>{insight.reference}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field-hint">
              {activeTarget
                ? 'No decision prompts for the currently plotted range.'
                : 'Select a target to inspect clinical decision prompts.'}
            </p>
          )}
        </section>

        <section className="rail-card" aria-labelledby="explorer-annotations-title">
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

        <ProgramDetails programs={detailPrograms} activeTarget={activeTarget} />
      </aside>
    </div>
  );
}
