import { useMemo, useRef, useState } from 'react';
import { Edit3, Plus, Search, Trash2, X } from '../ui/Icons';
import SegmentedControl from '../ui/SegmentedControl';
import ProgramDetails from '../ProgramDetails';
import { programProgressLabel } from '../../utils/targetAnalytics';
import {
  ANALYSIS_CATEGORIES, familyKeyOf, familyTypeOf, incompatibilityReason, selectionScopeCaption
} from '../../utils/measurementFamilies';
import { isExplorerTargetSelected, nextExplorerFocusIndex } from '../../utils/trendExplorer';

const LIFECYCLE_TONE = { mastered: 'positive', paused: 'attention', ended: 'neutral', active: 'neutral' };

// Target analysis selection pane. The first decision is the kind of clinical data to read
// (Programs, Behaviors or ABC Data); Programs and Behaviors then ask for a measurement type
// before targets, because only targets recorded the same way can share one analysis.
//   Left pane   — progressive selection: category → program/type → compatible targets.
//   Center pane — the existing chart workspace, toolbar, inspector and visual analysis.
//   Right rail  — clinical insights, annotations and target definitions.
export default function TrendExplorer({
  catalog,
  dataCategory = 'Programs',
  onDataCategoryChange,
  skillPrograms = [],
  programProgressMap = new Map(),
  selectedProgramId = '',
  onSelectProgram,
  familyOptions = [],
  activeFamilyKey = '',
  onSelectFamily,
  selectedTargetIds = new Set(),
  onToggleTarget,
  onSelectAllCompatible,
  onClearTargets,
  totalCompatibleTargets = 0,
  notice = null,
  onDismissNotice,
  abcSummary = null,
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
  const itemRefs = useRef([]);

  const isBehaviorMode = dataCategory === 'Behaviors';
  const isAbcMode = dataCategory === 'Abc';

  // Groups shown for the active step: one program's targets, or every behavior program.
  const activeGroups = useMemo(() => catalog.groups.filter(group => {
    if (group.category === 'BehaviorReduction') return isBehaviorMode;
    return dataCategory === 'Programs' && group.id === selectedProgramId;
  }), [catalog.groups, dataCategory, isBehaviorMode, selectedProgramId]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return activeGroups.map(group => ({
      group,
      entries: group.targets.filter(entry => !needle
        || [entry.targetName, entry.familyLabel, entry.phaseLabel, entry.statusText]
          .some(value => value && String(value).toLowerCase().includes(needle)))
    }));
  }, [activeGroups, query]);

  const flatRows = useMemo(() => rows.flatMap(group => group.entries), [rows]);
  // Selection counts describe the whole program/behavior roster, not the filtered list,
  // so the caption stays steady while a search is active.
  const allEntries = useMemo(() => activeGroups.flatMap(group => group.targets), [activeGroups]);

  const selectedCount = useMemo(
    () => allEntries.filter(entry => selectedTargetIds.has(entry.targetId)).length,
    [allEntries, selectedTargetIds]
  );

  const activeFamily = familyOptions.find(option => option.key === activeFamilyKey) || null;

  const explorerSelectionState = useMemo(() => ({
    activeCategoryTab: activeCategoryTabOf(dataCategory),
    selectedProgramId,
    selectedBehaviorIds: [...selectedTargetIds],
    activeTargetType: familyTypeOf(activeFamilyKey),
    visibleTargetIds: selectedTargetIds,
    analysisTargetId: focusedEntry?.targetId || ''
  }), [dataCategory, selectedProgramId, selectedTargetIds, activeFamilyKey, focusedEntry]);

  const scopeCaption = selectionScopeCaption({
    category: dataCategory,
    programName: activeGroups[0]?.name || '',
    familyLabel: activeFamily?.label || '',
    selectedCount,
    totalCount: allEntries.length
  });

  function onItemKeyDown(event, index) {
    const nextIndex = nextExplorerFocusIndex(index, event.key, flatRows.length);
    if (nextIndex == null || nextIndex < 0) return;
    event.preventDefault();
    itemRefs.current[nextIndex]?.focus();
  }

  const singleAnnotationScope = activeCategoryTabOf(dataCategory) !== 'Behavior'
    || tabTargets.length <= 1;

  let runningIndex = 0;
  const showRail = !isAbcMode;

  return (
    <div className={`trend-explorer${isAbcMode ? ' trend-explorer--abc' : ''}`}>
      <nav className="trend-explorer__list" aria-label="Target explorer">
        <div className="explorer-head">
          <SegmentedControl
            label="Analysis category"
            value={dataCategory}
            onChange={onDataCategoryChange}
            options={ANALYSIS_CATEGORIES}
            className="explorer-categories explorer-categories--primary"
          />

          {dataCategory === 'Programs' && (
            <div className="explorer-step">
              <span className="explorer-step__number" aria-hidden="true">1</span>
              <div className="control-field program-field explorer-program-picker">
                <label htmlFor="target-program">Program</label>
                <select
                  id="target-program"
                  value={selectedProgramId}
                  onChange={event => onSelectProgram?.(event.target.value)}
                >
                  <option value="">Choose a program</option>
                  {skillPrograms.map(program => (
                    <option key={program.id} value={program.id}>
                      {program.name} · {program.status} · {programProgressLabel(programProgressMap.get(program.id))}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {dataCategory === 'Behaviors' && (
            <p className="explorer-step explorer-step--plain">
              <span className="explorer-step__number" aria-hidden="true">1</span>
              <span>Behavior reduction tracking · all behavior programs for this client</span>
            </p>
          )}
        </div>

        {notice && !isAbcMode && (
          <div className={`explorer-notice explorer-notice--${notice.tone || 'neutral'}`} role="status">
            <p>{notice.text}</p>
            <button type="button" className="icon-button" aria-label="Dismiss selection note" onClick={onDismissNotice}>
              <X size={15} />
            </button>
          </div>
        )}

        {isAbcMode ? (
          <AbcScopePanel summary={abcSummary} />
        ) : (
          <div className="explorer-body">
            {familyOptions.length > 0 && (
              <fieldset className="explorer-family">
                <legend>
                  <span className="explorer-step__number" aria-hidden="true">{dataCategory === 'Programs' ? '2' : '2'}</span>
                  Measurement type
                </legend>
                <div className="explorer-family__chips" role="group" aria-label="Measurement type">
                  {familyOptions.map(option => {
                    const pressed = option.key === activeFamilyKey;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className="explorer-family__chip"
                        aria-pressed={pressed}
                        aria-label={`${option.label}, ${option.count} ${option.count === 1 ? 'target' : 'targets'}${option.hasData ? '' : ', no observations in this range'}`}
                        disabled={!option.hasData}
                        title={option.hasData ? `${option.count} ${option.count === 1 ? 'target' : 'targets'} · ${option.unitHint}` : 'No observations recorded in this range'}
                        onClick={() => onSelectFamily?.(option.key)}
                      >
                        <span>{option.label}</span>
                        <small>{option.count}</small>
                      </button>
                    );
                  })}
                </div>
                <p className="explorer-family__hint">
                  {activeFamily
                    ? familyHint(activeFamily)
                    : 'Choose the measurement type to analyse.'}
                </p>
              </fieldset>
            )}

            <div className="explorer-targets-head">
              <div>
                <p className="explorer-step-label">
                  <span className="explorer-step__number" aria-hidden="true">3</span>
                  Targets
                </p>
                <p className="explorer-count" role="status" aria-live="polite">{scopeCaption}</p>
              </div>
              <div className="explorer-bulk">
                <button type="button" onClick={onSelectAllCompatible} disabled={!totalCompatibleTargets || selectedCount >= totalCompatibleTargets}>All</button>
                <button type="button" onClick={onClearTargets} disabled={!selectedCount}>None</button>
              </div>
            </div>

            <div className="explorer-search">
              <label className="sr-only" htmlFor="explorer-search">Search targets in this selection</label>
              <div className="explorer-search__input">
                <Search size={16} aria-hidden="true" />
                <input
                  id="explorer-search"
                  type="search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search targets…"
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

            <div className="explorer-groups">
              {flatRows.length === 0 ? (
                <div className="explorer-empty">
                  <p>
                    <strong>{query ? 'No matching targets.' : dataCategory === 'Programs' && !selectedProgramId ? 'Choose a program to begin.' : 'No targets in this selection.'}</strong>{' '}
                    {query
                      ? 'Try another search term.'
                      : dataCategory === 'Programs' && !selectedProgramId
                        ? 'Its skill acquisition targets and measurement types will appear here.'
                        : dataCategory === 'Programs'
                          ? 'This program has no recorded targets yet.'
                          : 'No behavior reduction targets were recorded for this client.'}
                  </p>
                  {query && (
                    <button type="button" className="button button--secondary" onClick={() => setQuery('')}>
                      Clear search
                    </button>
                  )}
                </div>
              ) : rows.map(({ group, entries }) => (
                <div className="explorer-group" key={group.id}>
                  {isBehaviorMode && (
                    <p className="explorer-group-label">
                      {group.name}
                      <small>{group.domain ? `${group.domain} · ` : ''}{group.status}</small>
                    </p>
                  )}
                  <ul className="explorer-targets">
                    {entries.map(entry => {
                      const currentFlatIndex = runningIndex;
                      runningIndex += 1;
                      const { focused } = isExplorerTargetSelected(entry, explorerSelectionState);
                      const compatible = !activeFamilyKey || familyKeyOf(entry) === activeFamilyKey;
                      const selected = selectedTargetIds.has(entry.targetId);
                      const reason = compatible ? '' : incompatibilityReason(entry, activeFamilyKey, familyOptions);
                      const chipTone = LIFECYCLE_TONE[entry.lifecycle] || 'neutral';
                      return (
                        <li key={entry.targetId}>
                          <label
                            className={[
                              'explorer-target',
                              selected ? 'explorer-target--plotted' : '',
                              focused ? 'explorer-target--active' : '',
                              compatible ? '' : 'explorer-target--incompatible'
                            ].filter(Boolean).join(' ')}
                            title={reason || undefined}
                          >
                            <input
                              type="checkbox"
                              ref={element => { itemRefs.current[currentFlatIndex] = element; }}
                              className="explorer-target__check"
                              checked={selected}
                              disabled={!compatible}
                              aria-label={`Plot ${entry.targetName} · ${entry.familyLabel} · ${entry.phaseLabel}`}
                              aria-describedby={reason ? `target-reason-${entry.targetId}` : undefined}
                              onChange={() => onToggleTarget?.(entry)}
                              onKeyDown={event => onItemKeyDown(event, currentFlatIndex)}
                            />
                            <span className="explorer-target__body">
                              <span className="explorer-target__row">
                                <strong className="explorer-target__name">{entry.targetName}</strong>
                                <span className={`health-delta health-delta--${entry.tone}`}>{entry.deltaLabel}</span>
                              </span>
                              <span className="explorer-target__meta">
                                <span className={`stat-chip stat-chip--${chipTone}`}>{entry.phaseLabel}</span>
                                <small>{entry.familyLabel}{entry.familyVariant ? ` · ${entry.familyVariant === 'Customized' ? 'prompt-based' : 'binary'}` : ''}</small>
                              </span>
                              {reason && <small className="explorer-target__reason" id={`target-reason-${entry.targetId}`}>{reason}</small>}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="trend-explorer__center">
        {children}
      </div>

      {showRail && (<aside className="trend-explorer__rail" aria-label="Clinical context">
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
      </aside>)}
    </div>
  );
}

function activeCategoryTabOf(dataCategory) {
  return dataCategory === 'Behaviors' ? 'Behavior' : 'SkillAcquisition';
}

// One sentence under the measurement chips: what this family measures, and which
// variations of it can share a chart.
function familyHint(option) {
  const shared = 'Only targets measured this way can be plotted together.';
  switch (option.type) {
    case 'TrialByTrial': {
      const variants = option.variants || [];
      if (variants.includes('Binary') && variants.includes('Customized')) {
        return `Binary and customized (prompt-based) trial-by-trial targets. ${shared}`;
      }
      if (variants.includes('Customized')) return `Customized (prompt-based) trial-by-trial targets. ${shared}`;
      return `Binary trial-by-trial targets. ${shared}`;
    }
    case 'IntervalData':
      return `${option.subType ? `${option.subType} interval` : 'Momentary, partial or whole interval'} recording, read as a percent of intervals. ${shared} Different interval schedules never share one chart.`;
    case 'Frequency':
      return `Frequency counts how many times the response or event occurred. ${shared}`;
    case 'Duration':
      return `Duration measures how long the activity, response or event lasted. ${shared}`;
    case 'FluencyRate':
      return `Rate and fluency use both frequency and duration (rate per minute). ${shared}`;
    case 'Anecdotal':
      return `Question-based narrative answers with client-specific response types. ${shared}`;
    default:
      return shared;
  }
}

// ABC Data keeps its existing workspace in the centre pane; the selection pane simply
// names the antecedent → behavior → consequence structure it is built from.
function AbcScopePanel({ summary }) {
  const structure = summary ? [
    ['Antecedent', summary.antecedents || []],
    ['Behavior', summary.behaviors || []],
    ['Consequence', summary.consequences || []]
  ] : [];
  return (
    <div className="explorer-body explorer-abc">
      <p className="explorer-step-label">
        <span className="explorer-step__number" aria-hidden="true">1</span>
        ABC records
      </p>
      <p className="explorer-count" role="status">
        {summary ? `${summary.entryCount} observations · ${summary.behaviorTargetCount} behavior targets` : 'Loading ABC structure…'}
      </p>
      {structure.map(([label, values]) => (
        <section className="abc-scope-block" key={label} aria-label={`${label} options`}>
          <h3>{label}<span>{values.length}</span></h3>
          {values.length
            ? <ul>{values.map(value => <li key={value}>{value}</li>)}</ul>
            : <p className="field-hint">Not configured for this client.</p>}
        </section>
      ))}
      <p className="field-hint">
        The full ABC workspace — timeline chart, patterns, forecast and the observation log — stays in the centre.
      </p>
    </div>
  );
}
