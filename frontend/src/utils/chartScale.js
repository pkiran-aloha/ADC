// Vertical-axis maths for the hand-written chart: nice ticks and user-set bounds.
// Kept pure so the axis behaviour is covered by the Node test suite.

// Plot types every quantitative measurement can use.
export const CHART_TYPES = [
  { value: 'line', label: 'Line' },
  { value: 'bars', label: 'Bars' },
  { value: 'points', label: 'Points' },
  { value: 'cumulative', label: 'Cumulative' }
];

const CANDIDATE_STEPS = [1, 2, 2.5, 5, 10];

function decimalsFor(step) {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  return 2;
}

// Round a rough gridline spacing up to a readable 1 / 2 / 2.5 / 5 × 10^n step.
export function niceStep(rough) {
  if (!Number.isFinite(rough) || rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = CANDIDATE_STEPS.find(candidate => normalized <= candidate + 1e-9) || 10;
  return step * magnitude;
}

// Gridline values across [min, max] at a readable step (never below min, never past max).
export function axisTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || count < 2) return [Number.isFinite(min) ? min : 0];
  const step = niceStep((max - min) / (count - 1));
  const digits = decimalsFor(step);
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let value = start; value <= max + step * 1e-9; value += step) {
    ticks.push(Math.round(value * 10 ** digits) / 10 ** digits);
  }
  return ticks.length ? ticks : [min, max];
}

// Combine the clinician's optional min/max with the plotted range.
// `include` carries overlay values (goal, envelope, projection) that must stay visible.
export function resolveAxisBounds(bounds = {}, { dataMax = 0, percent = false, include = [] } = {}) {
  const extras = include.filter(value => Number.isFinite(value));
  const peak = Math.max(0, Number.isFinite(dataMax) ? dataMax : 0, ...extras);
  const autoMax = percent ? 100 : Math.max(10, Math.ceil(peak * 1.15));
  let min = Number.isFinite(Number(bounds?.min)) && bounds?.min !== null && bounds?.min !== '' ? Number(bounds.min) : 0;
  let max = Number.isFinite(Number(bounds?.max)) && bounds?.max !== null && bounds?.max !== '' ? Number(bounds.max) : autoMax;
  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max) || max <= min) max = autoMax > min ? autoMax : min + 1;
  return { min, max };
}

// Validation for the axis controls: a clinician may fix one end, both, or neither.
export function validateAxisBounds({ min, max }) {
  const hasMin = min !== '' && min != null;
  const hasMax = max !== '' && max != null;
  if (!hasMin && !hasMax) return { error: '', bounds: { min: null, max: null } };
  if (hasMin && !Number.isFinite(Number(min))) return { error: 'Enter a number for the axis minimum, or leave it blank.', bounds: null };
  if (hasMax && !Number.isFinite(Number(max))) return { error: 'Enter a number for the axis maximum, or leave it blank.', bounds: null };
  if (hasMin && hasMax && Number(max) <= Number(min)) return { error: 'The maximum must be greater than the minimum.', bounds: null };
  if (hasMin && Number(min) < 0) return { error: 'These measurements start at zero, so the minimum cannot be negative.', bounds: null };
  return { error: '', bounds: { min: hasMin ? Number(min) : null, max: hasMax ? Number(max) : null } };
}

export function describeAxisBounds(bounds = {}) {
  const { min, max } = bounds || {};
  if (min == null && max == null) return 'automatic';
  return `${min == null ? 'auto' : min}–${max == null ? 'auto' : max}`;
}

// ---------------------------------------------------------------------------
// Annotation label layout. Round-2 feedback: annotation text has to stay readable in the
// application and in exports, without overlapping. Notes wrap to at most two lines inside
// a box that is sized to the text, and the rows stack into a band above the plot so a
// label never covers a data point or the condition strip.
// ---------------------------------------------------------------------------

export function estimateLabelWidth(text, { fontSize = 11, padding = 14, maxWidth = 320 } = {}) {
  const perCharacter = 0.56 * fontSize;
  return Math.min(maxWidth, Math.max(28, String(text || '').length * perCharacter + padding));
}

// Word-wrap annotation text to the box budget; the last line carries the ellipsis so the
// box and its text always agree (text used to spill out of the rectangle).
export function wrapLabelLines(text, { fontSize = 11, maxWidth = 320, maxLines = 2, padding = 14 } = {}) {
  const perCharacter = 0.56 * fontSize;
  const budget = Math.max(8, Math.floor((maxWidth - padding) / perCharacter));
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= budget) { current = candidate; continue; }
    if (current) lines.push(current);
    current = word.length > budget ? `${word.slice(0, budget - 1)}…` : word;
  }
  if (current) lines.push(current);
  if (!lines.length) lines.push('');
  if (lines.length > maxLines) {
    lines.length = maxLines;
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = `${last.slice(0, Math.max(1, budget - 1)).trimEnd()}…`;
  }
  return lines;
}

// items: [{ x, key, ... }] positioned on the chart. Returns the same items with `row`,
// `boxLeft`, `lines`, `width`, `boxHeight` and `rowY` (distance from the plot top to the
// top of the label's row) so the caller can draw a non-overlapping label band above the plot.
export function layoutNoteLabels(items = [], { minX = 0, maxX = 1000, maxRows = 3, gap = 10, fontSize = 11, maxLabelWidth = 320, lineHeight = 14 } = {}) {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const rows = Array.from({ length: maxRows }, () => []);
  const placed = [];
  for (const item of sorted) {
    const lines = wrapLabelLines(item.text || item.label, { fontSize, maxWidth: maxLabelWidth });
    const width = Math.min(maxLabelWidth, Math.ceil(Math.max(...lines.map(line => line.length)) * 0.56 * fontSize + 14));
    let row = rows.findIndex(rowItems => rowItems.every(existing => Math.abs(existing.center - item.x) >= (existing.width + width) / 2 + gap));
    if (row === -1) row = maxRows - 1;
    const boxLeft = Math.min(Math.max(item.x - width / 2, minX), Math.max(minX, maxX - width));
    rows[row].push({ center: item.x, width });
    placed.push({ ...item, row, lines, width, boxLeft });
  }
  // Rows stack upward from the plot edge: row 0 sits closest to the data, each row is as
  // tall as its tallest box, and every box sits below the condition strip.
  const rowHeights = rows.map((_, index) => Math.max(22, ...placed.filter(place => place.row === index).map(place => place.lines.length * lineHeight + 8), 0));
  let offset = 0;
  for (let index = 0; index < maxRows; index++) {
    for (const place of placed.filter(candidate => candidate.row === index)) {
      place.rowY = offset;
      place.boxHeight = rowHeights[index];
    }
    offset += rowHeights[index] + 5;
  }
  return placed;
}
