// Spreadsheet import for historical and externally collected data (implementation
// transitions, offline / paper workflows). The parser, column mapping and per-row
// validation are pure functions so an import can be previewed and tested without a DOM.
import { isValidDate } from './formValidation.js';
import { DATA_SOURCES, DEFAULT_DATA_SOURCE, sourceLabel } from './dataEntry.js';

// Accepts the stored value ("Probe") or the label a spreadsheet usually carries.
export function matchSource(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return DEFAULT_DATA_SOURCE;
  const match = DATA_SOURCES.find(source => source.value.toLowerCase() === value || source.label.toLowerCase() === value);
  return match ? match.value : null;
}

// Columns a clinician can map from their spreadsheet. Aliases cover the wording used in
// common data sheets, so an import usually needs no editing before upload.
export const IMPORT_FIELDS = [
  { key: 'date', label: 'Date', required: true, aliases: ['date', 'observation date', 'session date', 'day', 'data date', 'date collected'] },
  { key: 'time', label: 'Time', aliases: ['time', 'start time', 'clock time'] },
  { key: 'target', label: 'Target', required: true, aliases: ['target', 'target name', 'program', 'skill', 'behavior', 'goal'] },
  { key: 'correct', label: 'Correct trials', aliases: ['correct', 'correct trials', 'correct responses', 'independent', 'successes'] },
  { key: 'total', label: 'Total trials', aliases: ['total', 'total trials', 'trials', 'opportunities'] },
  { key: 'scored', label: 'Intervals scored', aliases: ['scored', 'intervals scored', 'occurred intervals', 'occurrences scored'] },
  { key: 'intervals', label: 'Total intervals', aliases: ['intervals', 'total intervals', 'interval count'] },
  { key: 'durationSeconds', label: 'Duration (seconds)', aliases: ['duration', 'duration seconds', 'seconds', 'total duration'] },
  { key: 'occurrences', label: 'Occurrences', aliases: ['occurrence count', 'frequency', 'count', 'episodes', 'occurrences'] },
  { key: 'minutes', label: 'Observation minutes', aliases: ['minutes', 'observation minutes', 'lesson minutes', 'session length'] },
  { key: 'value', label: 'Value / percent', aliases: ['value', 'percent', 'percentage', 'accuracy', 'score', 'rate'] },
  { key: 'source', label: 'Source', aliases: ['source', 'collection', 'context', 'data source', 'setting'] },
  { key: 'clinician', label: 'Collected by', aliases: ['clinician', 'therapist', 'rbt', 'staff', 'recorder', 'collector', 'collected by', 'data collector'] },
  { key: 'note', label: 'Note', aliases: ['note', 'notes', 'comment', 'comments', 'context note'] }
];


// RFC 4180-ish CSV parsing: quoted fields, embedded commas and doubled quotes.
export function parseCsv(text = '') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = false;
      } else field += character;
      continue;
    }
    if (character === '"') { quoted = true; continue; }
    if (character === ',' || character === '\t' || character === ';') { pushField(); continue; }
    if (character === '\r') continue;
    if (character === '\n') { pushField(); pushRow(); continue; }
    field += character;
  }
  if (field !== '' || row.length) { pushField(); pushRow(); }
  const cleaned = rows.map(cells => cells.map(cell => cell.trim())).filter(cells => cells.some(cell => cell !== ''));
  if (!cleaned.length) return { headers: [], rows: [] };
  const [headers, ...body] = cleaned;
  return { headers, rows: body };
}

export function normalizeHeader(header) {
  // Compare on letters and digits only, so "DurationSeconds" and "Duration seconds"
  // are the same column and a stray bracket never breaks a match.
  return String(header || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// How well a spreadsheet header matches one of a field's aliases. An exact match wins,
// then a header that starts with the alias ("durationseconds" → "duration"), then a
// header that contains it. The reverse direction is deliberately excluded: it made
// "Total" claim the duration column.
function aliasScore(header, alias) {
  if (!header || !alias) return -1;
  if (header === alias) return 3;
  if (alias.length >= 4 && header.startsWith(alias)) return 2;
  if (alias.length >= 5 && header.includes(alias)) return 1;
  return -1;
}

const normalizedAliases = new Map(IMPORT_FIELDS.map(field => [field.key, field.aliases.map(normalizeHeader)]));

// field -> column index, using the best alias match for each field.
export function suggestMapping(headers = []) {
  const normalized = headers.map(normalizeHeader);
  const mapping = {};
  for (const field of IMPORT_FIELDS) {
    const aliases = normalizedAliases.get(field.key);
    let best = null;
    normalized.forEach((header, index) => {
      const score = Math.max(...aliases.map(alias => aliasScore(header, alias)));
      if (score < 0) return;
      if (!best || score > best.score) best = { index, score };
    });
    if (best) mapping[field.key] = best.index;
  }
  return mapping;
}

export function requiredFieldsMissing(mapping = {}) {
  return IMPORT_FIELDS.filter(field => field.required && mapping[field.key] == null).map(field => field.label);
}

const cleanNumber = value => {
  if (value == null) return null;
  const stripped = String(value).replace(/[%\s,]/g, '');
  if (stripped === '') return null;
  const number = Number(stripped);
  return Number.isFinite(number) ? number : null;
};

// The values the target needs, taken from whichever columns the sheet provides.
export function valuesForTarget(target, cells, mapping) {
  const at = key => (mapping[key] == null ? null : cells[mapping[key]]);
  const values = {};
  const notes = [];
  switch (target.type) {
    case 'TrialByTrial': {
      let correct = cleanNumber(at('correct'));
      let total = cleanNumber(at('total'));
      const percent = cleanNumber(at('value'));
      if ((correct == null || total == null) && percent != null) {
        total = total ?? 10;
        correct = Math.round((percent / 100) * total);
        notes.push('percent converted to trials with a 10-trial assumption');
      }
      if (correct != null) values.correctCount = String(correct);
      if (total != null) values.totalTrials = String(total);
      break;
    }
    case 'IntervalData': {
      const scored = cleanNumber(at('scored')) ?? cleanNumber(at('occurrences'));
      const intervals = cleanNumber(at('intervals')) ?? target.intervalSettings?.numberOfIntervals ?? null;
      if (scored != null) values.occurredIntervals = String(scored);
      if (intervals != null) values.totalIntervals = String(intervals);
      break;
    }
    case 'Duration': {
      const seconds = cleanNumber(at('durationSeconds')) ?? cleanNumber(at('value'));
      const episodes = cleanNumber(at('occurrences'));
      if (seconds != null) values.durationSeconds = String(seconds);
      if (episodes != null && episodes > 1) notes.push('episode count ignored: the target records total duration');
      break;
    }
    case 'Frequency':
    case 'FluencyRate': {
      const count = cleanNumber(at('occurrences')) ?? cleanNumber(at('value'));
      const minutes = cleanNumber(at('minutes'));
      if (count != null) values.occurrenceCount = String(count);
      values.lessonDurationMinutes = String(minutes ?? (target.type === 'FluencyRate' ? 1 : 30));
      if (minutes == null) notes.push(`assumed ${values.lessonDurationMinutes} minutes of observation`);
      if (cleanNumber(at('total')) != null) notes.push('trial columns ignored for this measurement type');
      break;
    }
    case 'Anecdotal': {
      values.qualitativeEntry = String(at('note') || at('value') || '').trim();
      break;
    }
    default:
      values.value = String(at('value') ?? '');
  }
  return { values, notes };
}

function validateValues(values, target) {
  const errors = {};
  const numeric = (key, min, integer, label, required = true) => {
    const value = values[key];
    if (value == null || value === '') { if (required) errors[key] = `Missing ${label}.`; return; }
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || (integer && !Number.isInteger(number))) errors[key] = `Invalid ${label}.`;
  };
  switch (target.type) {
    case 'TrialByTrial':
      numeric('correctCount', 0, true, 'correct trials');
      numeric('totalTrials', 1, true, 'total trials');
      if (!errors.correctCount && !errors.totalTrials && Number(values.correctCount) > Number(values.totalTrials)) errors.correctCount = 'Correct trials exceed total trials.';
      break;
    case 'IntervalData':
      numeric('occurredIntervals', 0, true, 'intervals scored');
      numeric('totalIntervals', 1, true, 'total intervals');
      if (!errors.occurredIntervals && !errors.totalIntervals && Number(values.occurredIntervals) > Number(values.totalIntervals)) errors.occurredIntervals = 'Scored intervals exceed total intervals.';
      break;
    case 'Duration': numeric('durationSeconds', 0, true, 'duration in seconds'); break;
    case 'Frequency':
    case 'FluencyRate':
      numeric('occurrenceCount', 0, true, 'occurrences');
      numeric('lessonDurationMinutes', 0.1, false, 'observation minutes');
      break;
    case 'Anecdotal':
      if (!values.qualitativeEntry) errors.qualitativeEntry = 'Missing observation text.';
      break;
    default:
      if (values.value === '' || values.value == null) errors.value = 'Missing value.';
  }
  return errors;
}

// Turn a spreadsheet into rows the workspace can store, with one error list per row so
// nothing is imported silently wrong.
export function importSpreadsheet(text, { targets = [], clinicians = [], defaultSource = DEFAULT_DATA_SOURCE, mapping = null } = {}) {
  const { headers, rows } = parseCsv(text);
  const resolvedMapping = mapping || suggestMapping(headers);
  const missingRequired = requiredFieldsMissing(resolvedMapping);
  const targetByName = new Map();
  for (const target of targets) {
    targetByName.set(target.name.trim().toLowerCase(), target);
    targetByName.set(target.id.toLowerCase(), target);
  }
  const records = rows.map((cells, index) => {
    const at = key => (resolvedMapping[key] == null ? '' : String(cells[resolvedMapping[key]] ?? '').trim());
    const errors = {};
    const date = at('date');
    const normalizedDate = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)
      ? `${date.split('/')[2]}-${date.split('/')[0].padStart(2, '0')}-${date.split('/')[1].padStart(2, '0')}`
      : date;
    if (!isValidDate(normalizedDate)) errors.date = 'Missing or unreadable date.';
    const time = (at('time').match(/^(\d{1,2}):(\d{2})/) || [])[0] || '09:00';
    const targetName = at('target');
    const target = targetByName.get(targetName.toLowerCase());
    if (!targetName) errors.target = 'Missing target name.';
    else if (!target) errors.target = `No target named “${targetName}” for this client.`;
    const sourceRaw = at('source') || defaultSource;
    const matchedSource = matchSource(sourceRaw);
    if (!matchedSource) errors.source = `Unrecognized source “${sourceRaw}”.`;
    const clinician = at('clinician') || clinicians[0] || 'Imported record';
    let values = {};
    const notes = [];
    if (target) {
      const built = valuesForTarget(target, cells, resolvedMapping);
      values = built.values;
      notes.push(...built.notes);
      Object.assign(errors, validateValues(values, target));
    }
    return {
      line: index + 2,
      date: normalizedDate,
      time,
      targetId: target?.id || '',
      targetName: target?.name || targetName,
      source: matchedSource || defaultSource,
      sourceLabel: sourceLabel(matchedSource || at('source') || defaultSource),
      clinician,
      note: at('note'),
      values,
      notes,
      errors,
      ok: Object.keys(errors).length === 0 && !missingRequired.length
    };
  });
  return {
    headers,
    mapping: resolvedMapping,
    missingRequired,
    records,
    summary: importSummary(records, missingRequired)
  };
}

export function importSummary(records = [], missingRequired = []) {
  const ok = records.filter(record => record.ok);
  const dates = ok.map(record => record.date).filter(Boolean).sort();
  const targets = new Set(ok.map(record => record.targetName));
  return {
    total: records.length,
    ready: ok.length,
    errors: records.length - ok.length,
    targets: targets.size,
    targetNames: [...targets].sort(),
    firstDate: dates[0] || null,
    lastDate: dates.at(-1) || null,
    missingRequired
  };
}

// The rows that can be saved, in the shape the recording service expects.
export function pointsFromImport(records = [], targets = [], { clientId, nextSessionNumber = () => 1 } = {}) {
  const byId = new Map(targets.map(target => [target.id, target]));
  return records.filter(record => record.ok).map(record => {
    const target = byId.get(record.targetId);
    const untracked = false;
    return {
      clientId,
      targetId: record.targetId,
      timestamp: `${record.date}T${record.time}`,
      therapistName: record.clinician,
      sessionNumber: nextSessionNumber ? nextSessionNumber(record.targetId) : undefined,
      dataSource: record.source,
      collectionContext: sourceLabel(record.source),
      enteredManually: true,
      observationType: 'Primary',
      note: record.note || undefined,
      sourceLine: record.line,
      untracked,
      ...record.values,
      ...valuesToStored(record.values, target)
    };
  });
}

// The stored record keeps both the raw counts and the derived value the chart plots.
function valuesToStored(values, target) {
  switch (target?.type) {
    case 'TrialByTrial': {
      const correct = Number(values.correctCount);
      const total = Number(values.totalTrials);
      return { correctCount: correct, totalTrials: total, value: Math.round((100 * correct) / total) };
    }
    case 'IntervalData': {
      const scored = Number(values.occurredIntervals);
      const total = Number(values.totalIntervals);
      return { occurredIntervals: scored, totalIntervals: total, value: Math.round((100 * scored) / total) };
    }
    case 'Duration':
      return { durationSeconds: Number(values.durationSeconds), occurrenceCount: Number(values.durationSeconds) > 0 ? 1 : 0, value: Number(values.durationSeconds) };
    case 'Frequency':
    case 'FluencyRate':
      return { occurrenceCount: Number(values.occurrenceCount), lessonDurationMinutes: Number(values.lessonDurationMinutes), value: Number(values.occurrenceCount) };
    case 'Anecdotal':
      return { qualitativeEntry: values.qualitativeEntry };
    default:
      return { value: Number(values.value) };
  }
}

export function importErrorCsv(records = []) {
  const rows = records.filter(record => !record.ok);
  const header = 'Line,Target,Date,Problem';
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [header, ...rows.map(record => [record.line, escape(record.targetName), escape(record.date), escape(Object.values(record.errors).join(' '))].join(','))].join('\n');
}

// A starter file with the exact columns this client's targets expect.
export function importTemplateCsv(targets = []) {
  const rows = targets.slice(0, 40).map(target => {
    switch (target.type) {
      case 'TrialByTrial': return ['2026-10-01', '09:00', target.name, '8', '10', '', '', '', '', '', 'School', 'Maya Patel, RBT', 'Probe after recess'];
      case 'IntervalData': return ['2026-10-01', '09:30', target.name, '', '', '6', '12', '', '', '', 'Paper', 'Maya Patel, RBT', ''];
      case 'Duration': return ['2026-10-01', '10:00', target.name, '', '', '', '', '137', '', '', 'Paper', 'Maya Patel, RBT', ''];
      case 'Frequency': case 'FluencyRate': return ['2026-10-01', '10:30', target.name, '', '', '', '', '', '7', '30', 'School', 'Maya Patel, RBT', ''];
      default: return ['2026-10-01', '11:00', target.name, '', '', '', '', '', '', '', 'Assessment', 'Maya Patel, RBT', target.name === '' ? '' : 'Narrative observation'];
    }
  });
  return [['Date', 'Time', 'Target', 'Correct', 'Total', 'Scored', 'Intervals', 'DurationSeconds', 'Occurrences', 'Minutes', 'Source', 'Clinician', 'Note'].join(','), ...rows.map(row => row.map(cell => (/[",]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))].join('\n');
}
