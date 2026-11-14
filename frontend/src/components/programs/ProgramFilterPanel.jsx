import { useState } from 'react';
import Dialog from '../ui/Dialog';
import { statusLabel } from '../../utils/programManagement';

// One group of choices in the panel: a title, optional tools, and a checkbox per option that
// shows how many programs it would leave.
function FilterGroup({ title, group, items, chosen, isBehavior, empty, extra, onToggle, onClear }) {
  return <fieldset className="pm-filter-group">
    <legend>{title}</legend>
    <div className="pm-filter-tools">
      {extra}
      {chosen.length > 0 && <button type="button" className="button button--tertiary" onClick={() => onClear(group)}>Clear</button>}
    </div>
    {items.length === 0
      ? <p className="pm-note">{empty}</p>
      : <ul>
        {items.map(item => <li key={item.value}>
          <label className="pm-check">
            <input type="checkbox" checked={chosen.includes(item.value)} onChange={() => onToggle(group, item.value)} />
            {group === 'statuses' && <span className={`pm-dot pm-dot--${String(item.value).toLowerCase()}`} aria-hidden="true" />}
            <span className="pm-check-label">{item.label || (group === 'statuses' ? statusLabel(item.value, isBehavior) : item.value)}</span>
            <span className="pm-check-count">{item.count}</span>
          </label>
        </li>)}
      </ul>}
  </fieldset>;
}

// One panel for every filter: status (or phase, for behaviors), tags and, for skill programs,
// lessons. Each choice shows how many programs it would leave, and the panel applies only when
// the clinician presses Show results.
export default function ProgramFilterPanel({ isOpen, onClose, options, value, isBehavior, showLessons, onApply }) {
  const [draft, setDraft] = useState(value);
  const toggle = (group, item) => setDraft(current => ({
    ...current,
    [group]: current[group].includes(item) ? current[group].filter(entry => entry !== item) : [...current[group], item]
  }));
  const set = (group, items) => setDraft(current => ({ ...current, [group]: items }));

  return <Dialog isOpen={isOpen} onClose={onClose} title="Filter" description="Combine filters to narrow the list. Choices within a group show a program when any of them matches.">
    <div className="pm-filter">
      <FilterGroup title={isBehavior ? 'Phase' : 'Status'} group="statuses" items={options.statuses} chosen={draft.statuses} isBehavior={isBehavior}
        empty="Nothing to filter by yet." onToggle={toggle} onClear={group => set(group, [])}
        extra={<button type="button" className="button button--tertiary" onClick={() => set('statuses', options.statuses.map(option => option.value))}>Select all</button>} />
      <FilterGroup title="Tags" group="tags" items={options.tags} chosen={draft.tags} isBehavior={isBehavior}
        empty="No tags have been added yet." onToggle={toggle} onClear={group => set(group, [])} />
      {showLessons && <FilterGroup title="Lessons" group="lessonIds" items={options.lessons} chosen={draft.lessonIds} isBehavior={isBehavior}
        empty="No lessons yet." onToggle={toggle} onClear={group => set(group, [])} />}
      <div className="dialog-actions">
        <button type="button" className="button button--secondary" onClick={() => setDraft({ statuses: [], tags: [], lessonIds: [] })}>Reset</button>
        <button type="button" className="button button--primary" onClick={() => onApply(draft)}>Show results</button>
      </div>
    </div>
  </Dialog>;
}
