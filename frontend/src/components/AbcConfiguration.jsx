import { useMemo, useState } from 'react';
import Dialog from './ui/Dialog';
import ConfirmDialog from './ui/ConfirmDialog';
import EmptyState from './ui/EmptyState';
import { Field } from './ui/Field';
import { ABC_LISTS, toValueList, usageCount } from '../utils/programManagement';
import { Edit3, Notebook, Plus, Trash2 } from './ui/Icons';

// The client's ABC vocabulary. The four lists are the words a team records with, so
// they are edited here once and used everywhere. An observation keeps the text it was
// recorded with: removing a value warns how many observations use it, and never rewrites them.
export default function AbcConfiguration({
  configuration, entries = [], behaviorNames = [], canEdit = true,
  onUpdateConfig, onAddValue, onRenameValue, onRemoveValues, onImportBehaviors
}) {
  const storedArea = toValueList(configuration?.treatmentArea).join(', ');
  const storedInstructions = configuration?.teachingInstructions || '';
  const [area, setArea] = useState(storedArea);
  const [instructions, setInstructions] = useState(storedInstructions);
  const [confirming, setConfirming] = useState(null);
  const [importing, setImporting] = useState(false);

  if (!configuration) return <EmptyState title="No ABC configuration." icon={Notebook}
    description="This client has no ABC vocabulary configured." />;

  const dirty = area !== storedArea || instructions !== storedInstructions;

  return <>
    <div className="programs-listing-header">
      <p className="programs-listing-count">{entries.length} recorded ABC observations</p>
    </div>

    <section className="abc-context" aria-label="ABC recording context">
      <Field id="abc-area" label="Treatment area" hint="The domain these observations belong to.">
        <input type="text" value={area} disabled={!canEdit} onChange={event => setArea(event.target.value)} />
      </Field>
      <Field id="abc-instructions" label="Teaching instructions" hint="How the team should record an observation.">
        <textarea rows={3} value={instructions} disabled={!canEdit} onChange={event => setInstructions(event.target.value)} />
      </Field>
      {canEdit && <button type="button" className="button button--secondary" disabled={!dirty}
        onClick={() => onUpdateConfig?.({ treatmentArea: area, teachingInstructions: instructions })}>Save context</button>}
    </section>

    <div className="programs-abc-lists">
      {ABC_LISTS.map(list => <AbcList key={list.key} list={list} values={configuration[list.key] || []}
        entries={entries} canEdit={canEdit} onAdd={onAddValue} onRename={onRenameValue}
        onAskRemove={(values, uses) => setConfirming({ listKey: list.key, values, uses })}
        onImport={list.key === 'behaviors' ? () => setImporting(true) : null} />)}
    </div>

    <ConfirmDialog isOpen={Boolean(confirming)} onClose={() => setConfirming(null)} destructive confirmLabel="Delete"
      title={confirming ? `Are you sure you want to delete ${confirming.values.join(', ')}?` : ''}
      description={confirming && confirming.uses > 0
        ? `${confirming.uses} recorded observation${confirming.uses === 1 ? ' uses' : 's use'} ${confirming.values.length === 1 ? 'this value' : 'these values'}. The observations keep the text they were recorded with; only the list changes.`
        : 'No recorded observation uses this value.'}
      onConfirm={() => { onRemoveValues?.(confirming.listKey, confirming.values); setConfirming(null); }} />

    {importing && <ImportBehaviors names={behaviorNames} existing={configuration.behaviors || []}
      onClose={() => setImporting(false)}
      onAdd={names => { onImportBehaviors?.(names); setImporting(false); }} />}
  </>;
}

function AbcList({ list, values, entries, canEdit, onAdd, onRename, onAskRemove, onImport }) {
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [editing, setEditing] = useState(null);
  const [text, setText] = useState('');
  const chosen = values.filter(value => selected.has(value));
  const uses = useMemo(() => chosen.reduce((sum, value) => sum + usageCount(entries, list.key, value), 0), [chosen, entries, list.key]);

  function add(event) {
    event.preventDefault();
    if (onAdd?.(list.key, draft) !== null) setDraft('');
  }

  return <section className="programs-abc-list" aria-label={`${list.label} values`}>
    <header className="abc-list-header">
      <h3>{list.label}</h3>
      {canEdit && onImport && <button type="button" className="button button--tertiary" onClick={onImport}>Import</button>}
    </header>
    {values.length === 0 && <p className="program-form-note">No values yet.</p>}
    <ul className="abc-values">
      {values.map(value => <li key={value}>
        {canEdit && <label className="program-form-check">
          <input type="checkbox" checked={selected.has(value)} onChange={() => setSelected(current => {
            const next = new Set(current);
            if (next.has(value)) next.delete(value); else next.add(value);
            return next;
          })} />
          <span className="sr-only">Select {value}</span>
        </label>}
        {editing === value
          ? <form className="abc-edit" onSubmit={event => {
            event.preventDefault();
            if (onRename?.(list.key, value, text) !== null) setEditing(null);
          }}>
            <input type="text" aria-label={`Rename ${value}`} value={text} onChange={event => setText(event.target.value)} />
            <button type="submit" className="button button--tertiary">Save</button>
            <button type="button" className="button button--tertiary" onClick={() => setEditing(null)}>Cancel</button>
          </form>
          : <>
            <span className="abc-value">{value}</span>
            {canEdit && <button type="button" className="icon-button" aria-label={`Edit ${value}`}
              onClick={() => { setEditing(value); setText(value); }}><Edit3 size={16} /></button>}
          </>}
      </li>)}
    </ul>
    {canEdit && <>
      <form className="abc-add" onSubmit={add}>
        <label htmlFor={`abc-add-${list.key}`} className="sr-only">Add {list.label.toLowerCase()} value</label>
        <input id={`abc-add-${list.key}`} type="text" value={draft} placeholder={`Add ${list.label.toLowerCase()}`}
          onChange={event => setDraft(event.target.value)} />
        <button type="submit" className="button button--secondary" disabled={!draft.trim()}><Plus size={15} />Add</button>
      </form>
      {chosen.length > 0 && <button type="button" className="button button--danger"
        onClick={() => { onAskRemove(chosen, uses); setSelected(new Set()); }}><Trash2 size={15} />Delete selected ({chosen.length})</button>}
    </>}
  </section>;
}

function ImportBehaviors({ names, existing, onClose, onAdd }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const have = new Set(existing.map(item => item.toLowerCase()));
  const available = names.filter(name => !have.has(name.toLowerCase()) && name.toLowerCase().includes(query.toLowerCase()));
  const toggle = name => setPicked(current => {
    const next = new Set(current);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });
  return <Dialog isOpen onClose={onClose} title="Import behaviors"
    description="Add behaviors defined under Behavior Reduction to this ABC list.">
    <div className="field">
      <label htmlFor="abc-import-search">Search behaviors</label>
      <input id="abc-import-search" type="search" value={query} onChange={event => setQuery(event.target.value)} />
    </div>
    {available.length === 0
      ? <p className="program-form-note">{names.length ? 'Every matching behavior is already in the list.' : 'No behaviors are defined under Behavior Reduction.'}</p>
      : <>
        <label className="program-form-check">
          <input type="checkbox" checked={picked.size === available.length && available.length > 0}
            onChange={event => setPicked(event.target.checked ? new Set(available) : new Set())} />
          <span>Select all</span>
        </label>
        <ul className="abc-values">
          {available.map(name => <li key={name}>
            <label className="program-form-check">
              <input type="checkbox" checked={picked.has(name)} onChange={() => toggle(name)} /><span>{name}</span>
            </label>
          </li>)}
        </ul>
      </>}
    <div className="dialog-actions">
      <button type="button" className="button button--secondary" onClick={onClose}>Cancel</button>
      <button type="button" className="button button--primary" disabled={picked.size === 0} onClick={() => onAdd([...picked])}>Add</button>
    </div>
  </Dialog>;
}
