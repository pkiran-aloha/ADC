import { useRef } from 'react';
import { WORKFLOWS } from '../../data/workflows';
import { Calendar } from './Icons';

// The workflow switcher: one tab per naturally occurring job, with the fictional-demo
// snapshot riding along so every screen keeps its review context. Tabs follow the ARIA
// authoring practices (roving tabindex + arrow keys) and mirror the sidebar.
export default function WorkflowTabs({ activeId, onSelect, snapshotDate }) {
  const listRef = useRef(null);

  function onKeyDown(event) {
    const index = WORKFLOWS.findIndex(workflow => workflow.id === activeId);
    let next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % WORKFLOWS.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + WORKFLOWS.length) % WORKFLOWS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = WORKFLOWS.length - 1;
    if (next === null) return;
    event.preventDefault();
    const target = WORKFLOWS[next];
    onSelect(target.id);
    requestAnimationFrame(() => listRef.current?.querySelector(`#workflow-tab-${target.id}`)?.focus());
  }

  return <div className="workspace-tabs-bar">
    <div className="workspace-tabs-scroll">
      <div className="workspace-tabs" role="tablist" aria-label="Analytics workflows" ref={listRef} onKeyDown={onKeyDown}>
        {WORKFLOWS.map(workflow => {
          const Icon = workflow.icon;
          const selected = workflow.id === activeId;
          return <button key={workflow.id} type="button" role="tab" className={`workspace-tab workspace-tab--${workflow.id}`}
            id={`workflow-tab-${workflow.id}`} aria-controls={`workflow-panel-${workflow.id}`}
            aria-selected={selected} tabIndex={selected ? 0 : -1} title={workflow.summary}
            onClick={() => onSelect(workflow.id)}>
            <span className="workspace-tab-icon" aria-hidden="true"><Icon size={17} /></span>
            <span>{workflow.label}</span>
          </button>;
        })}
      </div>
    </div>
    {snapshotDate && <p className="snapshot snapshot--bar"><Calendar size={16} aria-hidden="true" />
      <span className="snapshot-label">Fictional demo · snapshot</span><strong>{snapshotDate}</strong></p>}
  </div>;
}
