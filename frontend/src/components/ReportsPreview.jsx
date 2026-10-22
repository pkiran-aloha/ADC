import { forwardRef } from 'react';
import { Download, Printer, Settings2 } from './ui/Icons';

// In-page preview of the report the clinician is about to download or print. It renders the
// same model used for the HTML document (titles, sections, tables, graphs and the roster) so
// the generated output can be reviewed without leaving the workspace or downloading a file.
// Graphs are injected as SVG data URLs: vector-legible, inert, and never re-parsed as HTML.
function chartDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ReportsPreview = forwardRef(function ReportsPreview({
  model, charts = {}, stale = false, generatedAt = '', onDownload, onPrint, onEditSettings, headingRef
}, ref) {
  const chartWithData = model.charts.filter(chart => charts[chart.id]);
  return <section className="report-preview" id="report-preview" ref={ref} tabIndex={-1}
    role="region" aria-labelledby="report-preview-title">
    <div className="report-preview__bar">
      <div className="report-preview__actions">
        <button type="button" className="button button--primary" onClick={onDownload}>
          <Download size={17} aria-hidden="true" />Download HTML
        </button>
        <button type="button" className="button button--secondary" onClick={onPrint}>
          <Printer size={17} aria-hidden="true" />Open print view
        </button>
        <button type="button" className="button button--tertiary" onClick={onEditSettings}>
          <Settings2 size={17} aria-hidden="true" />Edit settings
        </button>
      </div>
      <p className="field-hint" role="status">
        {stale
          ? 'Settings changed since this preview was generated. Generate the preview again to review the new document.'
          : `Preview generated ${generatedAt}. Downloads and the print view use the current settings.`}
      </p>
    </div>

    <header className="report-preview__head">
      <p className="eyebrow">Generated report</p>
      <h3 id="report-preview-title" tabIndex={-1} ref={headingRef}>{model.title}</h3>
      <p className="report-preview__subtitle">{model.subtitle}</p>
      <dl className="report-preview__meta">
        {model.meta.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      </dl>
    </header>

    {model.sections.map(section => <article key={section.id} className="report-preview__section" aria-labelledby={`report-preview-${section.id}`}>
      <h4 id={`report-preview-${section.id}`}>{section.heading}</h4>
      {!!section.bullets?.length && <ul>{section.bullets.map(item => <li key={item}>{item}</li>)}</ul>}
      {(section.tables || []).map(table => <div key={table.heading} className="report-preview__table">
        <h5>{table.heading}</h5>
        <div className="data-table-scroll" tabIndex={0} role="region" aria-label={`${table.heading} table`}>
          <table className="data-table"><thead><tr>{table.headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
            <tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => cellIndex === 0
              ? <th key={cellIndex} scope="row">{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>)}
      {!!section.narrative?.length && <div className="report-preview__narrative">
        <h5>Notes for the clinician</h5>
        {section.narrative.map(item => <p key={item}>{item}</p>)}
      </div>}
    </article>)}

    {model.roster?.length > 0 && <section className="report-preview__section" aria-labelledby="report-preview-roster">
      <h4 id="report-preview-roster">Target list</h4>
      <div className="data-table-scroll" tabIndex={0} role="region" aria-label="Report target list">
        <table className="data-table">
          <caption className="sr-only">Targets included in this report with status and dates</caption>
          <thead><tr>{['Program', 'Target', 'Status', 'Introduced', 'Mastered', 'Last data', 'Points'].map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
          <tbody>{model.roster.map(row => <tr key={row.id}>
            <td>{row.program}</td><td>{row.name}</td><td>{row.status}</td>
            <td>{row.introducedOn || '—'}</td><td>{row.masteredOn || '—'}</td>
            <td>{row.lastDataDate || '—'}</td><td>{row.dataPoints}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>}

    <section className="report-preview__section" aria-labelledby="report-preview-graphs">
      <h4 id="report-preview-graphs">Graphs ({chartWithData.length} of {model.charts.length} targets with data)</h4>
      {!model.charts.length && <p className="field-hint">No targets are in scope for this template and date range.</p>}
      <div className="report-preview__charts">
        {model.charts.map(chart => <figure key={chart.id} className="report-preview__chart">
          <figcaption><strong>{chart.title}</strong><span>{chart.subtitle}</span></figcaption>
          {charts[chart.id]
            ? <div className="report-preview__chart-scroll" tabIndex={0} role="region" aria-label={`Graph: ${chart.title}`}>
              <img src={chartDataUrl(charts[chart.id])} alt={`Graph: ${chart.title}. ${chart.subtitle}`} loading="lazy" />
            </div>
            : <p className="field-hint">No measured data for this target in the selected range.</p>}
          {charts[chart.id] && <p className="report-preview__chart-hint">Scroll sideways to read the full graph.</p>}
        </figure>)}
      </div>
    </section>

    <footer className="report-preview__footer">
      <div className="report-preview__footer-actions">
        <button type="button" className="button button--secondary" onClick={onDownload}>
          <Download size={17} aria-hidden="true" />Download HTML
        </button>
        <button type="button" className="button button--tertiary" onClick={onPrint}>
          <Printer size={17} aria-hidden="true" />Open print view
        </button>
      </div>
      <p>{model.template?.description}</p>
      <p>Generated {model.generatedAt} from fictional demo records in the Welina analytics workspace. Graphs show measured observations only; second-observer and supervision records are excluded from totals. Not a clinical determination.</p>
    </footer>
  </section>;
});

export default ReportsPreview;
