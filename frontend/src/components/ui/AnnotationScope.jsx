// Phase lines, ranges and notes are usually recorded once for a whole program, but the
// graph stores them per target. This fieldset lets a clinician write the annotation once
// and place it on several targets at the same time.
export default function AnnotationScope({ targets = [], primaryId, selectedIds = [], onChange, label = 'Apply to', hint }) {
  if (targets.length <= 1) return null;
  const others = targets.filter(target => target.id !== primaryId);
  const selectedOthers = others.filter(target => selectedIds.includes(target.id));
  const allSelected = selectedOthers.length === others.length;
  function toggle(id) {
    onChange(selectedIds.includes(id) ? selectedIds.filter(value => value !== id) : [...selectedIds, id]);
  }
  return <fieldset className="annotation-scope">
    <legend>{label}</legend>
    <p className="field-hint">{hint || 'Write the annotation once and add it to other targets in the same program. Duplicates on a target are skipped.'}</p>
    <label className="annotation-scope-item annotation-scope-item--primary">
      <input type="checkbox" checked disabled />
      <span>{targets.find(target => target.id === primaryId)?.name || 'This target'}</span>
      <small>current graph</small>
    </label>
    {others.length > 0 && <>
      <div className="annotation-scope-actions">
        <button type="button" className="chip-button" onClick={() => onChange(allSelected ? [] : others.map(target => target.id))}>
          {allSelected ? 'Clear other targets' : `Select all ${others.length} other target${others.length === 1 ? '' : 's'}`}
        </button>
        <span className="field-hint" role="status">{selectedOthers.length + 1} of {targets.length} targets selected</span>
      </div>
      <ul className="annotation-scope-list">{others.map(target => <li key={target.id}>
        <label className="annotation-scope-item">
          <input type="checkbox" checked={selectedIds.includes(target.id)} onChange={() => toggle(target.id)} />
          <span>{target.name}</span>
          {target.phase && <small>{target.phase}</small>}
        </label>
      </li>)}</ul>
    </>}
  </fieldset>;
}
