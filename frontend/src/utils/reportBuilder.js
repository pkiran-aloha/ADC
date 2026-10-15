// Downloadable, print-ready reports. A clinician selects a report template and the
// targets (or whole programs) to include, and every learner graph comes out in one
// document for clinical reviews, authorizations, audits, reassessments and treatment
// plans. The model and the HTML are built by pure functions so the report content is
// covered by the Node test suite.
import { processAggregation } from './analyticsMetrics.js';
import { seriesColor } from './chartTheme.js';
import { goalInView, targetMilestones, programProgress, introducedOn, masteredOn, daysBetween } from './targetAnalytics.js';
import { evaluateReductionMastery, reductionRuleFor, describeRule, describeReductionRule } from './visualAnalysis.js';
import { chartEligible } from './observations.js';
import { eligibleChartRows, graphStandards } from './graphPreferences.js';
import { reportChartSvg, reportTable, escapeXml } from './reportChart.js';

export const REPORT_TEMPLATES = [
  {
    id: 'clinical-review',
    label: 'Clinical review',
    description: 'Program-by-program graphs with mastery criteria, phase changes and progress notes for a supervision or team meeting.',
    includes: ['Every selected program graph', 'Mastery criteria and current phase', 'Phase-change dates and annotations', 'Data-quality summary']
  },
  {
    id: 'authorization',
    label: 'Authorization request',
    description: 'Dosage against authorization, mastered goals, remaining targets and the graphs that justify continued hours.',
    includes: ['Current acquisition graphs with criterion lines', 'Authorized versus delivered hours', 'Targets mastered since the last request', 'Recommendation section to complete']
  },
  {
    id: 'reassessment',
    label: 'Reassessment',
    description: 'All targets with introduction and mastery dates, acquisition rate and measurement quality for a full reassessment.',
    includes: ['All graphs in the chosen range', 'Target roster with introduction / mastery dates', 'IOA coverage and procedural fidelity', 'Acquisition-rate summary']
  },
  {
    id: 'treatment-plan',
    label: 'Treatment plan progress',
    description: 'Goals, definitions, teaching procedures and current progress pulled straight from the programs.',
    includes: ['Goal and objective text', 'Current phase and mastery rule', 'Progress graphs', 'Supervisor sign-off block']
  }
];

export const REPORT_RANGES = [
  { value: '1 month', label: 'Last month' },
  { value: '3 months', label: 'Last 3 months' },
  { value: '6 months', label: 'Last 6 months' },
  { value: '1 year', label: 'Last year' },
  { value: 'all', label: 'All available data' }
];

export function templateById(id) {
  return REPORT_TEMPLATES.find(template => template.id === id) || REPORT_TEMPLATES[0];
}

export function rangeStart(asOfDate, range) {
  if (range === 'all') return null;
  const months = range === '1 year' ? 12 : Number(String(range).replace(/[^0-9]/g, '')) || 3;
  const date = new Date(`${asOfDate}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

const MASTERED_PHASES = ['Maintenance', 'Generalization', 'Completed'];

export const ROSTER_FILTERS = [
  { value: 'current', label: 'Current acquisition', hint: 'Baseline, acquisition and generalization targets' },
  { value: 'maintenance', label: 'Maintenance & mastery', hint: 'Targets kept under periodic review' },
  { value: 'mastered', label: 'Mastered (maintenance, generalization, completed)', hint: 'Every target that met its criterion' },
  { value: 'all', label: 'All targets', hint: 'Includes on-hold and discontinued targets' }
];

export function rosterStatus(target) {
  if (['Maintenance'].includes(target.phase)) return { id: 'maintenance', label: 'Maintenance' };
  if (['Generalization'].includes(target.phase)) return { id: 'mastered', label: 'Generalizing' };
  if (target.phase === 'Completed') return { id: 'mastered', label: 'Completed' };
  if (['Baseline', 'Acquisition'].includes(target.phase)) return { id: 'current', label: target.phase };
  if (target.phase === 'OnHold') return { id: 'onhold', label: 'On hold' };
  if (target.phase === 'Discontinued') return { id: 'discontinued', label: 'Discontinued' };
  return { id: 'pending', label: target.phase || 'Pending' };
}

// The list of current acquisition, maintenance or mastered targets for a learner, with a
// date filter on when the target was introduced or mastered.
export function targetRoster({ programs = [], sessions = [], from = null, to = null, statuses = 'all', dateField = 'introduced' } = {}) {
  const byTarget = new Map();
  for (const row of sessions) {
    const entry = byTarget.get(row.targetId) || [];
    entry.push(row);
    byTarget.set(row.targetId, entry);
  }
  const rows = [];
  for (const program of programs) {
    for (const target of program.targets || []) {
      const status = rosterStatus(target);
      const matchesStatus = statuses === 'all'
        || (statuses === 'mastered' ? MASTERED_PHASES.includes(target.phase) : status.id === statuses)
        || (statuses === 'maintenance' && status.id === 'maintenance');
      if (!matchesStatus) continue;
      const introduced = introducedOn(target);
      const mastered = masteredOn(target);
      const relevantDate = dateField === 'mastered' ? mastered : introduced;
      if (from && (!relevantDate || relevantDate < from)) continue;
      if (to && (!relevantDate || relevantDate > to)) continue;
      const targetRows = (byTarget.get(target.id) || []).filter(chartEligible).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
      const latest = targetRows.at(-1);
      const baselineRows = targetRows.filter(row => introduced && row.timestamp.slice(0, 10) < introduced);
      const baselineValue = baselineRows.length ? baselineRows.reduce((sum, row) => sum + (row.value || 0), 0) / baselineRows.length : null;
      const currentValue = latest && Number.isFinite(latest.value) ? latest.value : null;
      rows.push({
        id: target.id,
        programId: program.id,
        program: program.name,
        category: program.category,
        name: target.name,
        type: target.type,
        phase: target.phase,
        status: status.label,
        statusId: status.id,
        introducedOn: introduced,
        masteredOn: mastered,
        daysToMastery: daysBetween(introduced, mastered),
        lastDataDate: latest ? latest.timestamp.slice(0, 10) : null,
        dataPoints: targetRows.length,
        baselineValue,
        currentValue,
        change: baselineValue != null && currentValue != null ? Math.round((currentValue - baselineValue) * 10) / 10 : null,
        masteryCriteria: target.masteryCriteria || (target.masteryRule ? describeRule(target.masteryRule) : ''),
        masterySettings: target.masterySettings || null,
        objective: program.programObjective || program.description || '',
        teachingInstructions: program.teachingInstructions || ''
      });
    }
  }
  return rows.sort((a, b) => a.program.localeCompare(b.program) || String(a.introducedOn || '').localeCompare(String(b.introducedOn || '')));
}

export function rosterCsv(rows = []) {
  const headers = ['Program', 'Target', 'Measurement', 'Current phase', 'Status', 'Introduced', 'Mastered', 'Days to mastery', 'Last data', 'Data points', 'Baseline', 'Latest', 'Change', 'Mastery criteria'];
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map(row => [row.program, row.name, row.type, row.phase, row.status, row.introducedOn, row.masteredOn,
    row.daysToMastery, row.lastDataDate, row.dataPoints, row.baselineValue, row.currentValue, row.change, row.masteryCriteria].map(escape).join(','))].join('\n');
}

// One chart per target, in the chart's own units, with the target's criterion line.
export function chartForTarget(target, rows, { standards = null, preferences = {}, aggregation = 'Per Day', colorIndex = 0, noteByTarget = [] } = {}) {
  const targetRows = rows.filter(row => row.targetId === target.id);
  const { rows: eligible } = eligibleChartRows(targetRows.filter(chartEligible), target, preferences, standards);
  const points = eligible.length ? processAggregation(eligible, aggregation, target.type, 'Total Duration', 'Rate per Day', 'Raw Frequency') : [];
  const percent = ['TrialByTrial', 'IntervalData'].includes(target.type);
  const goal = goalInView(target, { targetType: target.type, durationView: 'Total Duration', rateView: 'Rate per Day', frequencyView: 'Raw Frequency' }, aggregation);
  const milestones = targetMilestones(target).filter(milestone => points.some(point => point.xKey === milestone.date));
  return {
    id: `chart-${target.id}`,
    targetId: target.id,
    title: target.name,
    subtitle: `${target.type} · ${points.length} data point${points.length === 1 ? '' : 's'} · current phase ${target.phase}`,
    series: points.length ? [{ id: target.id, name: target.name, color: target.color || seriesColor(colorIndex), points }] : [],
    percent,
    yLabel: percent ? '% correct' : target.type === 'Duration' ? 'Seconds' : 'Count / rate',
    goal,
    milestones: milestones.map(milestone => ({ xKey: milestone.date, label: milestone.kind })),
    notes: noteByTarget.filter(note => note.targetId === target.id && points.some(point => point.xKey === note.date))
      .map(note => ({ xKey: note.date, text: note.noteText, color: note.color })),
    phaseLines: (noteByTarget.phaseLines || []).filter(line => line.targetId === target.id && points.some(point => point.xKey === line.date))
      .map(line => ({ xKey: line.date, label: line.label, color: line.color, dotted: line.style === 'Dotted' }))
  };
}

function dataQualitySummary({ sessions = [], serviceSessions = [], standards = null, from = null }) {
  const inRange = row => !from || row.timestamp.slice(0, 10) >= from;
  const rows = sessions.filter(row => inRange(row) && row.missingDataMode !== 'DataNotTracked');
  const ioaRows = rows.filter(row => row.ioa);
  const services = serviceSessions.filter(session => !from || session.date >= from);
  const completed = services.filter(session => session.status === 'Completed');
  const fidelity = completed.filter(session => session.fidelity).map(session => session.fidelity.percent);
  const supervision = completed.filter(session => session.supervision);
  const coverage = completed.length ? Math.round((100 * completed.filter(session => session.ioaObserver).length) / completed.length) : null;
  const meanAgreement = ioaRows.length ? Math.round((rows.filter(row => row.ioa).reduce((sum, row) => sum + row.ioa.percent, 0) / ioaRows.length) * 10) / 10 : null;
  return {
    sessions: completed.length,
    cancelled: services.length - completed.length,
    observations: rows.length,
    ioaChecks: ioaRows.length,
    ioaCoverage: coverage,
    meanAgreement,
    fidelitySessions: fidelity.length,
    meanFidelity: fidelity.length ? Math.round((fidelity.reduce((sum, value) => sum + value, 0) / fidelity.length) * 10) / 10 : null,
    supervisionHours: Math.round((supervision.reduce((sum, session) => sum + session.supervision.minutes, 0) / 60) * 10) / 10,
    minimums: {
      ioaCoverage: standards?.ioa?.minimumCoveragePercent ?? 20,
      ioaAgreement: standards?.ioa?.minimumAgreementPercent ?? 80,
      fidelity: standards?.fidelity?.minimumPercent ?? 85
    },
    // Stated in the report so a reader knows why some sessions are absent from the graphs.
    graphing: graphStandards(standards),
    belowTrialFloor: rows.filter(row => row.totalTrials != null && row.totalTrials < graphStandards(standards).minimumTrialsPerDataPoint).length
  };
}

// The complete report model: metadata, charts (one per target), tables and narrative
// prompts. Rendering to HTML is a separate step so the same model can feed a preview.
export function buildReportModel({
  client, template, programs = [], sessions = [], serviceSessions = [], standards = null,
  from = null, to = null, asOfDate, preferences = {}, aggregation = 'Per Day', annotations = { phaseLines: [], graphNotes: [] },
  statuses = 'all', includeRoster = true, preparedBy = ''
} = {}) {
  const chosen = templateById(template);
  const programList = programs.filter(program => program.category === 'SkillAcquisition' || chosen.id === 'reassessment' || chosen.id === 'clinical-review');
  const roster = targetRoster({ programs: programList, sessions, from, to, statuses });
  const rosterIds = new Set(roster.map(row => row.id));
  const targetEntries = programList.flatMap(program => (program.targets || []).filter(target => rosterIds.has(target.id)).map(target => ({ program, target })));
  const charts = targetEntries.map(({ target }, index) => chartForTarget(target, sessions, {
    standards, preferences, aggregation, colorIndex: index,
    noteByTarget: annotations.graphNotes || []
  })).map((chart, index) => ({ ...chart, phaseLines: chart.phaseLines.length ? chart.phaseLines : (annotations.phaseLines || []).filter(line => line.targetId === targetEntries[index].target.id).map(line => ({ xKey: line.date, label: line.label, color: line.color, dotted: line.style === 'Dotted' })) }));
  const quality = dataQualitySummary({ sessions, serviceSessions, standards, from });
  const progress = programList.map(program => {
    const summary = programProgress(program, sessions);
    const behaviorTargets = (program.targets || []).filter(target => target.category === 'BehaviorReduction' || program.category === 'BehaviorReduction');
    const reduction = behaviorTargets.length
      ? behaviorTargets.map(target => {
        const rule = reductionRuleFor(target, standards);
        const rows = sessions
          .filter(row => row.targetId === target.id && Number.isFinite(row.value) && chartEligible(row))
          .map(row => ({ timestamp: row.timestamp, value: row.value }));
        return { name: target.name, rule, result: rows.length ? evaluateReductionMastery(rows, rule, { sustainedDays: rule.sustainedDays, reductionPercent: rule.reductionPercent }) : null };
      })
      : [];
    return { program, summary, reduction };
  });
  const reductionLines = progress.flatMap(item => item.reduction.map(entry => {
    if (!entry.result) return `${entry.name}: no reduction-rule measurement in range`;
    const { met, firstMetDate, sustained, requiredDays, criterion } = entry.result;
    const rule = describeReductionRule(entry.rule);
    if (met) return `${entry.name}: reduction criterion met (${rule})${firstMetDate ? `, sustained from ${firstMetDate}` : ''}`;
    return `${entry.name}: ${sustained} of ${requiredDays} days sustained below${criterion ? ` ${criterion.value}` : ''} (${rule})`;
  }));
  const mastered = roster.filter(row => MASTERED_PHASES.includes(row.phase));
  const acquisition = roster.filter(row => ['Baseline', 'Acquisition', 'Generalization'].includes(row.phase));

  const sections = [];
  if (['clinical-review', 'reassessment', 'treatment-plan'].includes(chosen.id)) {
    sections.push({
      id: 'summary',
      heading: 'Learner and service summary',
      bullets: [
        `${client?.name || 'Learner'} (${client?.code || '—'}) · ${client?.primaryDiagnosis || '—'}`,
        `Supervising clinician: ${client?.supervisingBcba || '—'} · Service model: ${client?.serviceModel || '—'}`,
        `${progress.length} programs · ${roster.length} targets in scope · ${acquisition.length} in current acquisition · ${mastered.length} mastered`,
        `Authorized hours: ${client?.authorizedHoursPerWeek ?? '—'} per week · ${quality.sessions} completed appointments in range`
      ]
    });
  }
  if (chosen.id === 'authorization') {
    const directHours = Math.round((quality.sessions * 2) / 4 * 10) / 10;
    sections.push({
      id: 'request',
      heading: 'Request summary',
      bullets: [
        `Requested hours: ${client?.authorizedHoursPerWeek ?? '—'} per week (complete before submission)`,
        `Delivered: ${quality.sessions} appointments across the selected range${directHours ? ` · approximately ${directHours} direct hours per week` : ''}`,
        `${mastered.length} targets met their mastery criterion; ${acquisition.length} targets remain in acquisition`,
        quality.ioaCoverage != null ? `Measurement quality: IOA on ${quality.ioaCoverage}% of sessions (minimum ${quality.minimums.ioaCoverage}%), mean agreement ${quality.meanAgreement ?? '—'}%` : 'Measurement quality: no IOA checks in range'
      ],
      narrative: [
        'Progress since the last authorization: [describe the change in level, trend and variability for the targets above].',
        'Clinical need for continued hours: [link each remaining target to the graphs in this report].',
        'Recommendation: [requested hours, service code mix and the date of the next review].'
      ]
    });
  }
  if (chosen.id === 'treatment-plan') {
    sections.push({
      id: 'goals',
      heading: 'Goals, procedures and current progress',
      tables: [{
        heading: 'Goal list',
        headers: ['Program', 'Goal / objective', 'Measurement', 'Mastery criterion', 'Current phase', 'Latest value'],
        rows: roster.map(row => [row.program, row.objective || row.name, row.type, row.masteryCriteria || '—', row.phase, row.currentValue ?? '—'])
      }],
      narrative: [
        'Teaching procedures: [confirm the procedures in each program setup and note any changes made this period].',
        'Caregiver participation: [describe caregiver training delivered in this period].',
        'Discharge plan: [describe the plan for mastered targets and the criteria for fading services].'
      ]
    });
  }
  if (chosen.id === 'reassessment') {
    sections.push({
      id: 'roster',
      heading: 'Target roster',
      tables: [{
        heading: 'Current acquisition, maintenance and mastered targets',
        headers: ['Program', 'Target', 'Status', 'Introduced', 'Mastered', 'Days to mastery', 'Last data', 'Points'],
        rows: roster.map(row => [row.program, row.name, row.status, row.introducedOn || '—', row.masteredOn || '—', row.daysToMastery ?? '—', row.lastDataDate || '—', row.dataPoints])
      }]
    });
    const rates = mastered.filter(row => row.daysToMastery != null);
    sections.push({
      id: 'acquisition-rate',
      heading: 'Acquisition rate',
      bullets: rates.length
        ? [
          `Mean days from introduction to mastery: ${Math.round(rates.reduce((sum, row) => sum + row.daysToMastery, 0) / rates.length)} days across ${rates.length} mastered targets`,
          `Fastest: ${[...rates].sort((a, b) => a.daysToMastery - b.daysToMastery)[0].name} (${[...rates].sort((a, b) => a.daysToMastery - b.daysToMastery)[0].daysToMastery} days)`,
          `Slowest: ${[...rates].sort((a, b) => b.daysToMastery - a.daysToMastery)[0].name} (${[...rates].sort((a, b) => b.daysToMastery - a.daysToMastery)[0].daysToMastery} days)`
        ]
        : ['No target in this range has both an introduction date and a mastery date yet.']
    });
  }
  if (reductionLines.length) {
    sections.push({
      id: 'reduction',
      heading: 'Behavior-reduction criteria',
      bullets: reductionLines
    });
  }
  sections.push({
    id: 'quality',
    heading: 'Measurement and treatment integrity',
    bullets: [
      `Interobserver agreement: ${quality.ioaChecks} checks${quality.ioaCoverage != null ? ` on ${quality.ioaCoverage}% of completed sessions` : ''}${quality.meanAgreement != null ? `, mean agreement ${quality.meanAgreement}%` : ''} (minimum ${quality.minimums.ioaAgreement}% agreement, ${quality.minimums.ioaCoverage}% of sessions)`,
      `Procedural fidelity: ${quality.fidelitySessions ? `${quality.meanFidelity}% mean across ${quality.fidelitySessions} checks (minimum ${quality.minimums.fidelity}%)` : 'no fidelity checks in range'}`,
      `Supervision: ${quality.supervisionHours} hours of BCBA overlap recorded in range`,
      `Graphing policy: sessions with fewer than ${quality.graphing.minimumTrialsPerDataPoint} trials${quality.graphing.minimumMinutesPerDataPoint ? ` or under ${quality.graphing.minimumMinutesPerDataPoint} minute of observation` : ''} are excluded from the graphs${quality.belowTrialFloor ? ` — ${quality.belowTrialFloor} observation${quality.belowTrialFloor === 1 ? '' : 's'} in this range fall below the floor and remain in the data tables` : ''}`,
      'Second-observer and supervision records are stored with the session and excluded from the learner’s chart totals.'
    ]
  });
  sections.push({
    id: 'signoff',
    heading: 'Clinical sign-off',
    bullets: [`Prepared by: ${preparedBy || '______________________'}  Date: ${asOfDate}`, 'Reviewed by (BCBA): ______________________  Date: __________', 'Parent / guardian acknowledgement: ______________________  Date: __________']
  });

  return {
    template: chosen,
    title: `${chosen.label} — ${client?.name || 'Learner'}`,
    subtitle: `${client?.code || ''}${client?.primaryDiagnosis ? ` · ${client.primaryDiagnosis}` : ''}`.trim(),
    generatedAt: asOfDate,
    range: { from, to, label: from ? `${from} to ${to || asOfDate}` : `All data to ${to || asOfDate}` },
    meta: [
      { label: 'Template', value: chosen.label },
      { label: 'Range', value: from ? `${from} → ${to || asOfDate}` : `All data → ${to || asOfDate}` },
      { label: 'Programs', value: String(programList.length) },
      { label: 'Targets', value: String(roster.length) },
      { label: 'Data points', value: String(quality.observations) }
    ],
    sections,
    charts,
    roster: includeRoster ? roster : [],
    quality,
    counts: { programs: programList.length, targets: roster.length, charts: charts.filter(chart => chart.series.length).length, emptyCharts: charts.filter(chart => !chart.series.length).length }
  };
}

export function reportFileName(model) {
  const safe = value => String(value || 'report').replace(/[^a-zA-Z0-9_-]+/g, '_');
  return `${safe(model.title)}_${safe(model.generatedAt)}.html`;
}

export function rosterFileName(model) {
  return `Target_roster_${String(model?.subtitle || 'learner').split('·')[0].trim().replace(/[^a-zA-Z0-9]+/g, '_')}_${model?.generatedAt || ''}.csv`;
}

// A standalone document: no scripts, no external assets, print styles included, so the
// file can be archived, emailed or printed without the workspace.
export function reportHtml(model, { charts = {}, printHint = true } = {}) {
  const sections = model.sections.map(section => {
    const parts = [`<section class="report-section" id="${escapeXml(section.id)}"><h2>${escapeXml(section.heading)}</h2>`];
    if (section.bullets?.length) parts.push(`<ul>${section.bullets.map(item => `<li>${escapeXml(item)}</li>`).join('')}</ul>`);
    for (const table of section.tables || []) {
      parts.push(`<h3>${escapeXml(table.heading)}</h3>${reportTable(table.headers, table.rows)}`);
    }
    if (section.narrative?.length) {
      parts.push(`<div class="report-narrative"><h3>Notes for the clinician</h3>${section.narrative.map(item => `<p contenteditable="true">${escapeXml(item)}</p>`).join('')}</div>`);
    }
    parts.push('</section>');
    return parts.join('');
  }).join('');

  const chartBlocks = model.charts.length
    ? `<section class="report-section report-charts"><h2>Graphs (${model.counts.charts} of ${model.charts.length} targets with data)</h2>
        ${model.charts.map(chart => {
    const svg = charts[chart.id];
    if (!svg) return `<div class="report-chart"><h3>${escapeXml(chart.title)}</h3><p class="report-empty">No measured data for this target in the selected range${chart.phaseLines?.length ? ' (phase-change lines only)' : ''}.</p></div>`;
    return `<div class="report-chart"><h3>${escapeXml(chart.title)}</h3><p class="report-chart-note">${escapeXml(chart.subtitle)}</p>${svg}</div>`;
  }).join('')}
      </section>`
    : '';

  const rosterBlock = model.roster?.length
    ? `<section class="report-section"><h2>Target list</h2>${reportTable(
      ['Program', 'Target', 'Status', 'Introduced', 'Mastered', 'Last data', 'Points'],
      model.roster.map(row => [row.program, row.name, row.status, row.introducedOn || '—', row.masteredOn || '—', row.lastDataDate || '—', row.dataPoints])
    )}</section>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeXml(model.title)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: Geist, Helvetica, Arial, sans-serif; color: #1f2a24; margin: 32px; line-height: 1.5; }
  header.report-header { border-bottom: 2px solid #294f3d; padding-bottom: 12px; margin-bottom: 20px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 24px 0 8px; border-bottom: 1px solid #dfe5e0; padding-bottom: 4px; }
  h3 { font-size: 13px; margin: 16px 0 6px; }
  .report-subtitle { color: #4a5852; margin: 0; }
  .report-meta { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 12px; font-size: 12px; }
  .report-meta dt { color: #6b7a72; text-transform: uppercase; letter-spacing: 0.04em; font-size: 10px; }
  .report-meta dd { margin: 2px 0 0; font-weight: 600; }
  ul { padding-left: 20px; } li { margin-bottom: 4px; }
  table.report-table { border-collapse: collapse; width: 100%; font-size: 11.5px; margin-bottom: 12px; }
  table.report-table th, table.report-table td { border: 1px solid #dfe5e0; padding: 5px 7px; text-align: left; vertical-align: top; }
  table.report-table th { background: #f4f7f5; }
  .report-chart { page-break-inside: avoid; margin-bottom: 18px; }
  .report-chart svg { width: 100%; height: auto; border: 1px solid #e6ebe8; }
  .report-empty { color: #6b7a72; font-size: 11.5px; }
  .report-narrative p { background: #f7f9f8; border-left: 3px solid #71957f; padding: 8px 10px; margin: 6px 0; font-size: 12px; }
  .print-hint { background: #eef4f0; padding: 10px 12px; border-radius: 4px; font-size: 12px; }
  footer.report-footer { margin-top: 28px; border-top: 1px solid #dfe5e0; padding-top: 10px; font-size: 10.5px; color: #6b7a72; }
  @media print {
    body { margin: 12mm; }
    .print-hint { display: none; }
    .report-section { page-break-inside: auto; }
    .report-chart { page-break-after: always; }
    .report-chart:last-child { page-break-after: auto; }
  }
</style></head>
<body>
<header class="report-header">
  <h1>${escapeXml(model.title)}</h1>
  <p class="report-subtitle">${escapeXml(model.subtitle)}</p>
  <dl class="report-meta">${model.meta.map(item => `<div><dt>${escapeXml(item.label)}</dt><dd>${escapeXml(item.value)}</dd></div>`).join('')}</dl>
</header>
${printHint ? '<p class="print-hint">This file is print-ready: use your browser’s Print command and choose “Save as PDF” for an archive copy. Graph pages break between targets.</p>' : ''}
${sections}
${rosterBlock}
${chartBlocks}
<footer class="report-footer">
  ${escapeXml(model.template.description)}<br/>
  Generated ${escapeXml(model.generatedAt)} from fictional demo records in the Welina analytics workspace. Graphs show measured observations only; second-observer and supervision records are excluded from totals. Not a clinical determination.
</footer>
</body></html>`;
}

// Charts are rendered by the component (which owns the SVG helpers) and passed in, so the
// builder stays free of layout concerns while the report stays self-contained.
export function renderReportCharts(model) {
  const charts = {};
  for (const chart of model.charts) {
    if (!chart.series.length) continue;
    charts[chart.id] = reportChartSvg({
      title: chart.title,
      subtitle: `${chart.subtitle} · ${model.range.label}`,
      series: chart.series,
      percent: chart.percent,
      yLabel: chart.yLabel,
      goal: chart.goal,
      phaseLines: chart.phaseLines,
      milestones: chart.milestones,
      notes: chart.notes
    });
  }
  return charts;
}

// Summary sentence used by the Reports section before the document is generated.
export function reportSummarySentence(model) {
  const { counts, quality, range } = model;
  const mastery = model.roster.filter(row => MASTERED_PHASES.includes(row.phase)).length;
  return `${counts.programs} programs · ${counts.targets} targets · ${counts.charts} graphs (${counts.emptyCharts} without data in range) · ${quality.observations} data points · ${mastery} mastered · ${range.label}`;
}

export function reportPrefill(model) {
  return model.meta.map(item => `${item.label}: ${item.value}`).join('\n');
}
