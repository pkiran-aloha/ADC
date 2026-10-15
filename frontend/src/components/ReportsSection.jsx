import { useMemo, useState } from 'react';
import SectionHeader from './ui/SectionHeader';
import SegmentedControl from './ui/SegmentedControl';
import EmptyState from './ui/EmptyState';
import ExportMenu from './ui/ExportMenu';
import { Printer, Download, Filter } from './ui/Icons';
import { SEED_AS_OF_DATE } from '../data/mockData';
import { downloadFile } from '../utils/exportUtils';
import { readGraphPreferences } from '../utils/graphPreferences';
import {
  REPORT_TEMPLATES, REPORT_RANGES, ROSTER_FILTERS, templateById, rangeStart, targetRoster, rosterCsv,
  buildReportModel, reportHtml, renderReportCharts, reportFileName, reportSummarySentence, rosterStatus
} from '../utils/reportBuilder';
import { formatLongDate } from '../utils/targetAnalytics';
import { MEASUREMENT_LABELS } from '../utils/formValidation';

// One place for the paperwork that surrounds the graphs: a multi-graph, print-ready report
// (clinical reviews, authorizations, reassessments, treatment plans) and a filterable list
// of current, maintenance or mastered targets.
export default function ReportsSection({
  client, programs = [], sessions = [], serviceSessions = [], annotations = { phaseLines: [], graphNotes: [] },
  standards = null, canEdit = true, viewOnlyReason = ''
}) {
  const [templateId, setTemplateId] = useState(REPORT_TEMPLATES[0].id);
  const [range, setRange] = useState('3 months');
  const [scope, setScope] = useState('skill');
  const [includeRoster, setIncludeRoster] = useState(true);
  const [selectedProgramIds, setSelectedProgramIds] = useState(() => new Set(programs.map(program => program.id)));
  const [rosterFilter, setRosterFilter] = useState('mastered');
  const [rosterDateField, setRosterDateField] = useState('introduced');
  const [rosterFrom, setRosterFrom] = useState('');
  const [rosterTo, setRosterTo] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [status, setStatus] = useState('');
  const preferences = useMemo(() => readGraphPreferences(client?.id), [client?.id]);
  const asOfDate = SEED_AS_OF_DATE;

  const scopedPrograms = useMemo(() => {
    const base = programs.filter(program => selectedProgramIds.has(program.id));
    if (scope === 'skill') return base.filter(program => program.category === 'SkillAcquisition');
    if (scope === 'behavior') return base.filter(program => program.category === 'BehaviorReduction');
    return base;
  }, [programs, selectedProgramIds, scope]);

  const roster = useMemo(() => targetRoster({
    programs: scopedPrograms, sessions, statuses: rosterFilter, dateField: rosterDateField,
    from: rosterFrom || null, to: rosterTo || null
  }), [scopedPrograms, sessions, rosterFilter, rosterDateField, rosterFrom, rosterTo]);

  const reportModel = useMemo(() => buildReportModel({
    client, template: templateId, programs: scopedPrograms, sessions, serviceSessions, standards,
    from: rangeStart(asOfDate, range), to: asOfDate, asOfDate, preferences, annotations, includeRoster, preparedBy
  }), [client, templateId, scopedPrograms, sessions, serviceSessions, standards, range, asOfDate, preferences, annotations, includeRoster, preparedBy]);

  const template = templateById(templateId);

  function buildDocument() {
    const charts = renderReportCharts(reportModel);
    const html = reportHtml(reportModel, { charts });
    return { html, charts };
  }

  function downloadReport() {
    const { html, charts } = buildDocument();
    downloadFile(html, reportFileName(reportModel), 'text/html;charset=utf-8;');
    setStatus(`Report prepared with ${Object.keys(charts).length} graphs. Open the downloaded file and print, or choose “Open print view”.`);
  }

  function printReport() {
    const { html, charts } = buildDocument();
    const frame = document.createElement('iframe');
    frame.setAttribute('title', 'Print-ready report');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) { setStatus('This browser blocked the print view. Download the report instead.'); frame.remove(); return; }
    doc.open();
    doc.write(html);
    doc.close();
    setStatus(`Print view prepared with ${Object.keys(charts).length} graphs. Choose “Print” or “Save as PDF”.`);
    setTimeout(() => {
      try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { setStatus('The print dialog could not be opened. Download the report instead.'); }
      setTimeout(() => frame.remove(), 60_000);
    }, 350);
  }

  function downloadRoster() {
    downloadFile(rosterCsv(roster), `Target_roster_${(client?.name || 'client').replace(/[^a-zA-Z0-9]+/g, '_')}_${asOfDate}.csv`, 'text/csv;charset=utf-8;');
    setStatus(`${roster.length} target${roster.length === 1 ? '' : 's'} exported as CSV.`);
  }

  function toggleProgram(id) {
    setSelectedProgramIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (!client) return <section id="reports" className="panel" aria-labelledby="reports-title" tabIndex={-1}>
    <SectionHeader id="reports-title" title="Reports" description="Build a print-ready report and list targets by status." />
    <div className="panel-body"><EmptyState title="Choose a client first." description="Reports are built from one client’s programs, targets and recorded data." /></div>
  </section>;

  return <section id="reports" className="panel" aria-labelledby="reports-title" tabIndex={-1}>
    <SectionHeader id="reports-title" title="Reports" description="One downloadable, print-ready document containing as many learner graphs as you select, plus a target list by status."
      help="Pick a template and the programs to include. Every graph is drawn from the recorded data in the chosen range, with mastery criteria, phase changes and notes already applied. Download the HTML for an archive copy, or open the print view to save a PDF."
      actions={<ExportMenu label="Export reports" onExport={type => { if (type === 'report') downloadReport(); if (type === 'roster') downloadRoster(); }} formats={[
        { id: 'report', label: 'Print-ready report · HTML', disabled: !reportModel.counts.targets },
        { id: 'roster', label: 'Target list · CSV', disabled: !roster.length }
      ]} />} />
    <div className="panel-body">
      {!canEdit && <p className="view-only-notice" role="status">{viewOnlyReason}</p>}
      <div className="reports-layout">
        <article className="reports-builder" aria-labelledby="report-builder-title">
          <h3 id="report-builder-title">Report builder</h3>
          <div className="control-field"><label htmlFor="report-template">Template</label>
            <select id="report-template" value={templateId} onChange={event => setTemplateId(event.target.value)}>
              {REPORT_TEMPLATES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          <p className="field-hint">{template.description}</p>
          <ul className="report-includes">{template.includes.map(item => <li key={item}>{item}</li>)}</ul>
          <div className="form-row">
            <div className="control-field"><label htmlFor="report-range">Date range</label>
              <select id="report-range" value={range} onChange={event => setRange(event.target.value)}>
                {REPORT_RANGES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select></div>
            <div className="control-field"><label htmlFor="report-prepared-by">Prepared by</label>
              <input id="report-prepared-by" type="text" maxLength={100} value={preparedBy} onChange={event => setPreparedBy(event.target.value)} placeholder={client.supervisingBcba} /></div>
          </div>
          <fieldset className="report-scope">
            <legend>Programs to include</legend>
            <label className="toggle-control"><input type="checkbox" checked={includeRoster} onChange={event => setIncludeRoster(event.target.checked)} />Include the target list</label>
            <div className="scope-list">{programs.map(program => <label key={program.id} className="popover-option">
              <input type="checkbox" checked={selectedProgramIds.has(program.id)} onChange={() => toggleProgram(program.id)} />
              <span>{program.name}<small className="block text-slate-500">{program.category === 'BehaviorReduction' ? 'Behavior reduction' : 'Skill acquisition'} · {program.targets.length} targets · {program.status}</small></span>
            </label>)}</div>
          </fieldset>
          <p className="field-hint">{reportSummarySentence(reportModel)}</p>
          {status && <p className="field-hint" role="status">{status}</p>}
          <div className="form-actions">
            <button type="button" className="button button--secondary" onClick={downloadReport} disabled={!reportModel.counts.targets}><Download size={17} />Download report</button>
            <button type="button" className="button button--primary" onClick={printReport} disabled={!reportModel.counts.targets}><Printer size={17} />Open print view</button>
          </div>
          <p className="field-hint">Second-observer and supervision records stay with the session in the report narrative and are excluded from every graph total.</p>
        </article>

        <article className="reports-roster" aria-labelledby="roster-title">
          <h3 id="roster-title">Targets by status</h3>
          <SegmentedControl label="Target status" value={rosterFilter} onChange={setRosterFilter} options={ROSTER_FILTERS.map(item => ({ value: item.value, label: item.label.split(' ')[0] }))} className="roster-filter" />
          <div className="form-row">
            <div className="control-field"><label htmlFor="roster-date-field">Filter dates by</label>
              <select id="roster-date-field" value={rosterDateField} onChange={event => setRosterDateField(event.target.value)}>
                <option value="introduced">Date introduced</option>
                <option value="mastered">Date mastered</option>
              </select></div>
            <div className="control-field"><label htmlFor="roster-from">From</label>
              <input id="roster-from" type="date" value={rosterFrom} onChange={event => setRosterFrom(event.target.value)} /></div>
            <div className="control-field"><label htmlFor="roster-to">To</label>
              <input id="roster-to" type="date" value={rosterTo} onChange={event => setRosterTo(event.target.value)} /></div>
          </div>
          <p className="field-hint"><Filter size={14} /> {ROSTER_FILTERS.find(item => item.value === rosterFilter)?.hint}. {roster.length} target{roster.length === 1 ? '' : 's'} match.</p>
          <div className="roster-actions">
            <SegmentedControl label="Program scope" value={scope} onChange={setScope} options={[
              { value: 'skill', label: 'Skill' }, { value: 'behavior', label: 'Behavior' }, { value: 'all', label: 'All' }
            ]} />
            <button type="button" className="button button--tertiary" disabled={!roster.length} onClick={downloadRoster}><Download size={16} />Export CSV</button>
          </div>
          {!roster.length ? <EmptyState title="No targets match these filters." description="Widen the date range or choose a different status." />
            : <div className="data-table-scroll" tabIndex={0} role="region" aria-label="Target list by status">
              <table className="data-table"><caption className="sr-only">Current acquisition, maintenance and mastered targets for {client.name}</caption>
                <thead><tr><th scope="col">Target</th><th scope="col">Measurement</th><th scope="col">Status</th><th scope="col">Introduced</th><th scope="col">Mastered</th><th scope="col">Last data</th></tr></thead>
                <tbody>{roster.map(row => <tr key={row.id}>
                  <td><strong>{row.name}</strong><small className="block text-slate-500">{row.program}</small></td>
                  <td>{MEASUREMENT_LABELS[row.type] || row.type}</td>
                  <td><span className={`stat-chip stat-chip--${['mastered', 'maintenance'].includes(rosterStatus({ phase: row.phase }).id) ? 'positive' : 'neutral'}`}>{row.status}</span></td>
                  <td>{row.introducedOn ? formatLongDate(row.introducedOn) : '—'}</td>
                  <td>{row.masteredOn ? `${formatLongDate(row.masteredOn)}${row.daysToMastery != null ? ` (${row.daysToMastery} d)` : ''}` : '—'}</td>
                  <td>{row.lastDataDate || '—'}</td>
                </tr>)}</tbody>
              </table>
            </div>}
          <p className="field-hint">Acquisition rate is the number of days between introduction and mastery, shown beside the mastery date.</p>
        </article>
      </div>
    </div>
  </section>;
}
