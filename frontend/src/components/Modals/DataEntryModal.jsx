import { useMemo, useState } from 'react';
import Dialog from '../ui/Dialog';
import SegmentedControl from '../ui/SegmentedControl';
import { Probe, Upload, Download, PlusCircle } from '../ui/Icons';
import { Field } from '../ui/Field';
import { MEASUREMENT_LABELS } from '../../utils/formValidation';
import { SEED_AS_OF_DATE } from '../../data/mockData';
import { fieldsFor } from '../../utils/recording';
import { DATA_SOURCES, manualRow, validateManualEntry, buildManualPoint, sourceLabel } from '../../utils/dataEntry';
import {
  parseCsv, suggestMapping, requiredFieldsMissing, importSpreadsheet, pointsFromImport, importErrorCsv, importTemplateCsv, IMPORT_FIELDS
} from '../../utils/dataImport';
import { formatNumber } from '../../utils/targetAnalytics';

const TAB_OPTIONS = [
  { value: 'entry', label: 'Add a data point' },
  { value: 'import', label: 'Import spreadsheet' }
];

// Probe, school, paper and assessment data entered directly into the workspace, and bulk
// spreadsheets for implementation transitions or offline workflows — neither requires a
// lesson note, and both land on the same graphs as recorded sessions.
export default function DataEntryModal({
  isOpen, onClose, client, programs = [], sessions = [], onAddPoint, onImportPoints,
  canEdit = true, viewOnlyReason = '', initialTab = 'entry'
}) {
  // The header and sidebar open this dialog on a specific tab; App remounts it with a key
  // so the requested tab is the initial state rather than a state change in an effect.
  const [tab, setTab] = useState(initialTab);
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState({});

  const targets = useMemo(() => programs.flatMap(program => program.targets.map(target => ({
    ...target, programName: program.name, category: program.category, programId: program.id
  }))), [programs]);
  const clinicians = useMemo(() => [...new Set(sessions.map(row => row.therapistName).filter(Boolean))].sort(), [sessions]);
  const [targetId, setTargetId] = useState('');
  const selectedTarget = targets.find(target => target.id === targetId) || targets[0] || null;
  const [row, setRow] = useState(() => manualRow(null, { date: SEED_AS_OF_DATE, clinician: clinicians[0] || '' }));
  const [saved, setSaved] = useState([]);

  // The form follows the selected target, keeping anything already typed.
  const activeRow = useMemo(() => {
    const base = manualRow(selectedTarget, { source: row.source, date: row.date, clinician: row.clinician || clinicians[0] || '' });
    return { ...base, values: { ...base.values, ...row.values }, time: row.time, note: row.note, missingDataMode: row.missingDataMode };
  }, [selectedTarget, row, clinicians]);

  // ---- import state ---------------------------------------------------------
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [importSource, setImportSource] = useState('Historical');
  const [importClinician, setImportClinician] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const parsed = useMemo(() => (rawText.trim() ? parseCsv(rawText) : { headers: [], rows: [] }), [rawText]);
  const mapping = useMemo(() => suggestMapping(parsed.headers), [parsed.headers]);
  const missingColumns = useMemo(() => requiredFieldsMissing(mapping), [mapping]);
  const result = useMemo(() => (parsed.rows.length
    ? importSpreadsheet(rawText, { targets, clinicians, defaultSource: importSource })
    : null), [rawText, parsed.rows.length, targets, clinicians, importSource]);
  const readyRecords = result ? result.records.filter(record => record.ok) : [];

  function updateValue(key, value) {
    setRow(previous => ({ ...previous, values: { ...previous.values, [key]: value } }));
  }

  function saveEntry(event, keepOpen = false) {
    event.preventDefault();
    const target = selectedTarget;
    const found = validateManualEntry(activeRow, target);
    setErrors(found);
    if (Object.keys(found).length) { setStatus(''); return; }
    const point = buildManualPoint({ ...activeRow, clinician: activeRow.clinician.trim() }, target, { clientId: client?.id });
    onAddPoint(point);
    setSaved(previous => [...previous, { target: target.name, date: point.timestamp.slice(0, 10), source: sourceLabel(point.dataSource) }]);
    setStatus(`${target.name} recorded from ${sourceLabel(point.dataSource).toLowerCase()} on ${point.timestamp.slice(0, 10)}. It is on the graph now.`);
    if (keepOpen) {
      setRow(previous => ({ ...manualRow(target, { source: previous.source, date: previous.date, clinician: previous.clinician }), values: {} }));
    } else {
      onClose();
    }
  }

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    file.text().then(text => { setRawText(text); setImportStatus(''); }).catch(() => setImportStatus('That file could not be read. Paste the rows instead.'));
  }

  function runImport() {
    if (!readyRecords.length) { setImportStatus('Nothing to import yet: fix the rows marked with a problem.'); return; }
    const points = pointsFromImport(readyRecords.map(record => ({ ...record, clinician: record.clinician || importClinician || clinicians[0] || 'Imported record' })), targets, { clientId: client?.id });
    onImportPoints(points);
    setImportStatus(`Imported ${points.length} observation${points.length === 1 ? '' : 's'} from ${fileName || 'the pasted rows'}. ${result.summary.errors ? `${result.summary.errors} row${result.summary.errors === 1 ? '' : 's'} skipped.` : ''}`);
    setRawText('');
    setFileName('');
  }

  function downloadTemplate() {
    const blob = new Blob([importTemplateCsv(targets)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(client?.name || 'client').replace(/[^a-zA-Z0-9]+/g, '_')}_import_template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function downloadErrors() {
    if (!result) return;
    const blob = new Blob([importErrorCsv(result.records)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'import_rows_to_fix.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (!isOpen) return null;
  return <Dialog isOpen={isOpen} onClose={onClose} presentation="workspace" title="Add or import data" icon={Probe} description="Enter probe, school, paper or assessment data and bulk-import a spreadsheet. Neither needs a lesson note.">
    <SegmentedControl label="Data entry mode" value={tab} onChange={value => { setTab(value); setStatus(''); setErrors({}); }} options={TAB_OPTIONS} />
    {!canEdit && <p className="view-only-notice" role="status">{viewOnlyReason || 'View-only access: data cannot be added or imported.'}</p>}

    {tab === 'entry' ? <form className="form-layout data-entry" noValidate onSubmit={event => saveEntry(event)}>
      <p className="field-hint">Only the target and the measurement are required. Use “Not tracked” instead of zero when the behavior was not measured.</p>
      <div className="form-row">
        <Field id="entry-target" label="Target" error={errors.targetId}>
          <select value={selectedTarget?.id || ''} onChange={event => { setTargetId(event.target.value); setErrors({}); }}>
            {programs.map(program => <optgroup key={program.id} label={program.name}>
              {program.targets.map(target => <option key={target.id} value={target.id}>{target.name} · {MEASUREMENT_LABELS[target.type]}</option>)}
            </optgroup>)}
          </select>
        </Field>
        <Field id="entry-source" label="Where the data came from" error={errors.source}>
          <select value={activeRow.source} onChange={event => setRow(previous => ({ ...previous, source: event.target.value }))}>
            {DATA_SOURCES.map(source => <option key={source.value} value={source.value}>{source.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="form-row">
        <Field id="entry-date" label="Date collected" error={errors.date}>
          <input type="date" value={activeRow.date} onChange={event => setRow(previous => ({ ...previous, date: event.target.value }))} />
        </Field>
        <Field id="entry-time" label="Time" error={errors.time} hint="Timestamps let the workspace read time-of-day patterns.">
          <input type="time" value={activeRow.time} onChange={event => setRow(previous => ({ ...previous, time: event.target.value }))} />
        </Field>
      </div>
      <Field id="entry-clinician" label="Collected by" error={errors.clinician} hint="A name and role, for example “Maya Patel, RBT”.">
        <input type="text" list="entry-clinicians" maxLength={100} placeholder="Who collected the data?" value={activeRow.clinician}
          onChange={event => setRow(previous => ({ ...previous, clinician: event.target.value }))} />
      </Field>
      <datalist id="entry-clinicians">{clinicians.map(name => <option key={name} value={name} />)}</datalist>

      <fieldset className="entry-measurement">
        <legend>{MEASUREMENT_LABELS[selectedTarget?.type] || 'Measurement'} values</legend>
        <div className="observation-edit-grid">
          {fieldsFor(selectedTarget?.type).map(field => <label key={field.key}>{field.label}
            {field.text
              ? <textarea rows={3} value={activeRow.values[field.key] || ''} onChange={event => updateValue(field.key, event.target.value)} placeholder={field.placeholder || ''} />
              : <input type="number" step="any" min="0" inputMode="decimal" placeholder={field.placeholder || ''} value={activeRow.values[field.key] || ''}
                onChange={event => updateValue(field.key, event.target.value)} />}
            {errors[field.key] && <small className="field-error" role="alert">{errors[field.key]}</small>}
          </label>)}
        </div>
        {selectedTarget?.category === 'BehaviorReduction' && <label className="toggle-control"><input type="checkbox" checked={activeRow.missingDataMode === 'NotTracked'}
          onChange={event => setRow(previous => ({ ...previous, missingDataMode: event.target.checked ? 'NotTracked' : 'Observed' }))} />Not measured in this observation</label>}
      </fieldset>

      <Field id="entry-note" label="Note for this data point" hint="Optional context that explains an unusually high or low value.">
        <textarea rows={2} maxLength={500} value={activeRow.note} onChange={event => setRow(previous => ({ ...previous, note: event.target.value }))} placeholder="For example: probe run before lunch, familiar materials." />
      </Field>

      {saved.length > 0 && <div className="entry-saved"><strong>Added in this session ({saved.length})</strong>
        <ul>{saved.slice(-4).map((item, index) => <li key={index}>{item.target} · {item.date} · {item.source}</li>)}</ul></div>}
      {status && <p className="field-hint" role="status">{status}</p>}
      <div className="form-actions">
        <button type="button" className="button button--tertiary" onClick={onClose}>Close</button>
        <button type="button" className="button button--secondary" disabled={!canEdit} onClick={event => saveEntry(event, true)}>Save &amp; add another</button>
        <button type="submit" className="button button--primary" disabled={!canEdit}><PlusCircle size={17} />Add to graph</button>
      </div>
    </form> : <div className="data-import">
      <p className="field-hint">Columns are matched by name: <strong>Date</strong>, <strong>Target</strong> and either trial columns (Correct, Total), interval columns (Scored, Intervals), or Duration / Occurrences + Minutes. Extra columns are ignored.</p>
      <div className="form-row">
        <div className="control-field"><label htmlFor="import-file">Choose a CSV file</label>
          <input id="import-file" type="file" accept=".csv,.tsv,.txt" onChange={handleFile} /></div>
        <div className="control-field"><label htmlFor="import-source">Default source for rows without one</label>
          <select id="import-source" value={importSource} onChange={event => setImportSource(event.target.value)}>
            {DATA_SOURCES.map(source => <option key={source.value} value={source.value}>{source.label}</option>)}
          </select></div>
      </div>
      <div className="form-row">
        <div className="control-field"><label htmlFor="import-clinician">Collected by (optional)</label>
          <input id="import-clinician" type="text" list="entry-clinicians" maxLength={100} placeholder="Defaults to the clinician in the file"
            value={importClinician} onChange={event => setImportClinician(event.target.value)} /></div>
        <div className="control-field"><label htmlFor="import-text">Or paste rows from the spreadsheet</label>
          <textarea id="import-text" rows={5} value={rawText} onChange={event => { setRawText(event.target.value); setFileName(''); }} placeholder="Date,Target,Correct,Total,Source&#10;2026-10-01,Expressive Food Items,8,10,School" /></div>
      </div>
      <div className="import-actions">
        <button type="button" className="button button--tertiary" onClick={downloadTemplate}><Download size={16} />Download template</button>
        {result?.summary.errors > 0 && <button type="button" className="button button--tertiary" onClick={downloadErrors}><Download size={16} />Rows to fix ({result.summary.errors})</button>}
      </div>

      {result && <>
        {missingColumns.length > 0 && <p className="field-error" role="alert">The file is missing required column{missingColumns.length === 1 ? '' : 's'}: {missingColumns.join(', ')}.</p>}
        <dl className="import-summary" aria-label="Import preview">
          <div><dt>Rows found</dt><dd>{result.summary.total}</dd></div>
          <div><dt>Ready to import</dt><dd>{result.summary.ready}</dd></div>
          <div><dt>Rows with problems</dt><dd>{result.summary.errors}</dd></div>
          <div><dt>Targets matched</dt><dd>{result.summary.targets}</dd></div>
          <div><dt>Date range</dt><dd>{result.summary.firstDate ? `${result.summary.firstDate} → ${result.summary.lastDate}` : '—'}</dd></div>
        </dl>
        <p className="field-hint">Matched columns: {IMPORT_FIELDS.filter(field => mapping[field.key] != null).map(field => field.label).join(', ') || 'none yet'}</p>
        {result.records.length > 0 && <div className="data-table-scroll" tabIndex={0} role="region" aria-label="Import preview rows">
          <table className="data-table"><caption className="sr-only">Preview of the rows to import, with any problems</caption>
            <thead><tr><th scope="col">Line</th><th scope="col">Date</th><th scope="col">Target</th><th scope="col">Values</th><th scope="col">Source</th><th scope="col">Status</th></tr></thead>
            <tbody>{result.records.slice(0, 40).map(record => <tr key={record.line} className={record.ok ? undefined : 'row-error'}>
              <td>{record.line}</td><td>{record.date || '—'}</td><td>{record.targetName || '—'}</td>
              <td>{Object.values(record.values).filter(value => value !== '').map(value => formatNumber(Number(value), 2)).join(' / ') || '—'}
                {record.notes.length > 0 && <small className="block text-slate-500">{record.notes.join('; ')}</small>}</td>
              <td>{record.sourceLabel}</td>
              <td>{record.ok ? 'Ready' : Object.values(record.errors).join(' ')}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        {result.records.length > 40 && <p className="field-hint">Showing the first 40 rows. All {result.summary.ready} ready rows will be imported.</p>}
      </>}
      {importStatus && <p className="field-hint" role="status">{importStatus}</p>}
      <div className="form-actions">
        <button type="button" className="button button--tertiary" onClick={onClose}>Close</button>
        <button type="button" className="button button--primary" disabled={!canEdit || !readyRecords.length} onClick={runImport}>
          <Upload size={17} />Import {readyRecords.length || ''} row{readyRecords.length === 1 ? '' : 's'}
        </button>
      </div>
    </div>}
  </Dialog>;
}
