import { useState } from 'react';
import Dialog from '../ui/Dialog';
import { WIPED_FIELD_LABELS } from '../../utils/programManagement';

// "Add to client": choose one or more clients. Each chosen client receives its own copy.
export function AddToClientDialog({ isOpen, onClose, onAdd, clients = [], programs = [], source }) {
  const [picked, setPicked] = useState(() => new Set());
  const toggle = id => setPicked(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const copies = programs.length * picked.size;
  return <Dialog isOpen={isOpen} onClose={onClose} title="Add to client"
    description={`${programs.length} selected from the ${source} library. Each client you choose gets its own copy, which starts in Pending and can be changed without affecting the library.`}>
    <div className="pm-filter">
      <ul className="pm-selected-list" aria-label="Selected programs">
        {programs.map(program => <li key={program.id}>{program.name}</li>)}
      </ul>
      <fieldset className="pm-filter-group">
        <legend>Clients</legend>
        <div className="pm-filter-tools">
          <button type="button" className="button button--tertiary" onClick={() => setPicked(new Set(clients.map(client => client.id)))}>Select all</button>
          {picked.size > 0 && <button type="button" className="button button--tertiary" onClick={() => setPicked(new Set())}>Clear</button>}
        </div>
        <ul>
          {clients.map(client => <li key={client.id}>
            <label className="pm-check">
              <input type="checkbox" checked={picked.has(client.id)} onChange={() => toggle(client.id)} />
              <span className="pm-check-label">{client.name}</span>
              <span className="pm-check-count">{client.code}</span>
            </label>
          </li>)}
        </ul>
      </fieldset>
      <div className="dialog-actions">
        <button type="button" className="button button--secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="button button--primary" disabled={picked.size === 0}
          onClick={() => onAdd([...picked])}>
          {picked.size === 0 ? 'Add to client' : `Add ${copies} ${copies === 1 ? 'copy' : 'copies'} to ${picked.size} ${picked.size === 1 ? 'client' : 'clients'}`}
        </button>
      </div>
    </div>
  </Dialog>;
}

// The warning that comes before a client's programs enter the shared library.
export function WipeoutDialog({ isOpen, onClose, onConfirm, programs = [] }) {
  return <Dialog isOpen={isOpen} onClose={onClose} presentation="confirmation" title="Add to the organization library?"
    description="Text written for one learner is cleared from the copy, so client-specific information is not shared.">
    <div className="pm-filter">
      <p className="pm-note">These fields will be cleared in the library copy:</p>
      <ul className="pm-wipe-list">{WIPED_FIELD_LABELS.map(label => <li key={label}>{label}</li>)}</ul>
      <p className="pm-note">
        {programs.length === 1 ? `“${programs[0].name}” is copied` : `${programs.length} programs are copied`}.
        The original is not changed. The clearing is written to the history of each copy.
      </p>
      <div className="dialog-actions">
        <button type="button" className="button button--secondary" onClick={onClose} data-autofocus>Cancel</button>
        <button type="button" className="button button--primary" onClick={onConfirm}>Clear and add</button>
      </div>
    </div>
  </Dialog>;
}
