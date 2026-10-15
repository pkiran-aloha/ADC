// Static SVG chart renderer for downloadable, print-ready reports. Reports are generated
// as a standalone HTML document, so the charts are plain SVG strings rather than React
// components. Pure string functions keep the geometry testable in the Node suite.
import { axisTicks, resolveAxisBounds } from './chartScale.js';
import { formatChartDate } from './chartTheme.js';

export const REPORT_CHART = { width: 760, height: 300, pad: { top: 46, right: 28, bottom: 52, left: 62 } };
export const FONT_STACK = 'Geist, Helvetica, Arial, sans-serif';

export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

function fitLabel(text, maxChars = 26) {
  const value = String(text ?? '');
  return value.length <= maxChars ? value : `${value.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

// Print charts keep the ink readable in greyscale: solid series colours, thin gridlines,
// and annotation text in full rather than truncated.
export function reportChartSvg({
  title,
  subtitle = '',
  series = [],
  percent = false,
  yLabel = 'Value',
  goal = null,
  phaseLines = [],
  milestones = [],
  notes = [],
  summary = null,
  width = REPORT_CHART.width,
  height = REPORT_CHART.height
} = {}) {
  const { pad } = REPORT_CHART;
  const graphWidth = width - pad.left - pad.right;
  const graphHeight = height - pad.top - pad.bottom - 22;
  const keys = [...new Set(series.flatMap(item => (item.points || []).map(point => point.xKey)))];
  const values = series.flatMap(item => (item.points || []).map(point => point.val)).filter(Number.isFinite);
  if (!keys.length || !values.length) return '';
  const { min, max } = resolveAxisBounds({}, { dataMax: Math.max(0, ...values), percent, include: goal ? [goal.value] : [] });
  const x = key => pad.left + (keys.length > 1 ? (keys.indexOf(key) / (keys.length - 1)) * graphWidth : graphWidth / 2);
  const y = value => pad.top + graphHeight - ((Math.min(Math.max(value, min), max) - min) / (max - min || 1)) * graphHeight;
  const ticks = axisTicks(min, max, 5);
  const lines = [];

  lines.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);
  lines.push(`<text x="${pad.left}" y="22" font-family="${FONT_STACK}" font-size="15" font-weight="600" fill="#1f2a24">${escapeXml(fitLabel(title, 70))}</text>`);
  if (subtitle) lines.push(`<text x="${pad.left}" y="38" font-family="${FONT_STACK}" font-size="11" fill="#5c6b64">${escapeXml(fitLabel(subtitle, 110))}</text>`);
  for (const tick of ticks) {
    lines.push(`<line x1="${pad.left}" x2="${width - pad.right}" y1="${round(y(tick))}" y2="${round(y(tick))}" stroke="#dfe5e0" stroke-width="1"/>`);
    lines.push(`<text x="${pad.left - 8}" y="${round(y(tick) + 4)}" text-anchor="end" font-family="${FONT_STACK}" font-size="10" fill="#6b7a72">${tick}</text>`);
  }
  lines.push(`<line x1="${pad.left}" x2="${pad.left}" y1="${pad.top}" y2="${pad.top + graphHeight}" stroke="#9aa8a0" stroke-width="1"/>`);
  lines.push(`<line x1="${pad.left}" x2="${width - pad.right}" y1="${pad.top + graphHeight}" y2="${pad.top + graphHeight}" stroke="#9aa8a0" stroke-width="1"/>`);
  lines.push(`<text x="14" y="${pad.top + graphHeight / 2}" transform="rotate(-90 14 ${pad.top + graphHeight / 2})" text-anchor="middle" font-family="${FONT_STACK}" font-size="11" fill="#4a5852">${escapeXml(yLabel)}</text>`);

  // Phase-change lines and the phase names above them.
  for (const line of phaseLines) {
    const position = keys.includes(line.xKey) ? x(line.xKey) : null;
    if (position == null) continue;
    lines.push(`<line x1="${round(position)}" x2="${round(position)}" y1="${pad.top}" y2="${pad.top + graphHeight}" stroke="${escapeXml(line.color || '#294f3d')}" stroke-width="1.4" stroke-dasharray="${line.dotted ? '4 4' : 'none'}"/>`);
    lines.push(`<text x="${round(position + 3)}" y="${pad.top - 6}" font-family="${FONT_STACK}" font-size="10" fill="#294f3d">${escapeXml(fitLabel(line.label, 22))}</text>`);
  }

  for (const item of series) {
    const points = (item.points || []).filter(point => Number.isFinite(point.val));
    if (!points.length) continue;
    if (points.length > 1) {
      lines.push(`<polyline points="${points.map(point => `${round(x(point.xKey))},${round(y(point.val))}`).join(' ')}" fill="none" stroke="${escapeXml(item.color)}" stroke-width="2" stroke-linejoin="round"/>`);
    }
    for (const point of points) {
      const cx = round(x(point.xKey));
      const cy = round(y(point.val));
      lines.push(item.marker === 'squareOpen'
        ? `<rect x="${round(cx - 4)}" y="${round(cy - 4)}" width="8" height="8" fill="#ffffff" stroke="${escapeXml(item.color)}" stroke-width="1.8"/>`
        : `<circle cx="${cx}" cy="${cy}" r="3.4" fill="${escapeXml(item.color)}" stroke="#ffffff" stroke-width="1"/>`);
    }
  }

  if (goal) {
    lines.push(`<line x1="${pad.left}" x2="${width - pad.right}" y1="${round(y(goal.value))}" y2="${round(y(goal.value))}" stroke="#863c30" stroke-width="1.4" stroke-dasharray="6 4"/>`);
    lines.push(`<text x="${width - pad.right - 4}" y="${round(y(goal.value) - 5)}" text-anchor="end" font-family="${FONT_STACK}" font-size="10" fill="#863c30">${escapeXml(goal.label)}</text>`);
  }

  for (const milestone of milestones) {
    const position = keys.includes(milestone.xKey) ? x(milestone.xKey) : null;
    if (position == null) continue;
    lines.push(`<polygon points="${round(position)},${pad.top + graphHeight - 6} ${round(position - 5)},${pad.top + graphHeight + 4} ${round(position + 5)},${pad.top + graphHeight + 4}" fill="#4b5a73"/>`);
    lines.push(`<text x="${round(position)}" y="${pad.top + graphHeight + 18}" text-anchor="middle" font-family="${FONT_STACK}" font-size="9" fill="#4b5a73">${escapeXml(milestone.label)}</text>`);
  }

  // Notes carry their full text: the report is read on paper, where a hover is not available.
  notes.forEach((note, index) => {
    const position = keys.includes(note.xKey) ? x(note.xKey) : null;
    if (position == null) return;
    const top = pad.top + 4 + index * 26;
    lines.push(`<circle cx="${round(position)}" cy="${round(pad.top + graphHeight - 8)}" r="5" fill="${escapeXml(note.color || '#34634c')}"/>`);
    lines.push(`<text x="${Math.min(round(position + 8), width - pad.right - 190)}" y="${top + 9}" font-family="${FONT_STACK}" font-size="9.5" fill="#3d4a44">${escapeXml(fitLabel(`${note.date}: ${note.text}`, 62))}</text>`);
  });

  const labelEvery = Math.ceil(keys.length / 8);
  keys.forEach((key, index) => {
    if (index % labelEvery !== 0 && index !== keys.length - 1) return;
    lines.push(`<text x="${round(x(key))}" y="${pad.top + graphHeight + 34}" text-anchor="middle" font-family="${FONT_STACK}" font-size="10" fill="#6b7a72">${escapeXml(formatChartDate(key))}</text>`);
  });
  lines.push(`<text x="${pad.left + graphWidth / 2}" y="${height - 6}" text-anchor="middle" font-family="${FONT_STACK}" font-size="10" fill="#4a5852">${escapeXml('Date of measurement')}</text>`);

  // Legend, with the summary line called out so a reader knows what the extra series is.
  let legendX = pad.left;
  const legend = [...series.map(item => ({ label: item.name, color: item.color })), ...(summary ? [{ label: summary.label, color: summary.color, dashed: true }] : [])];
  for (const item of legend) {
    lines.push(`<rect x="${legendX}" y="${pad.top + graphHeight + 40}" width="10" height="10" fill="${escapeXml(item.color)}"/>`);
    lines.push(`<text x="${legendX + 15}" y="${pad.top + graphHeight + 49}" font-family="${FONT_STACK}" font-size="10" fill="#3d4a44">${escapeXml(fitLabel(item.label, 40))}${item.dashed ? ' (combined)' : ''}</text>`);
    legendX += 15 + Math.min(40, item.label.length) * 5.6 + 18;
    if (legendX > width - pad.right - 120) break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(`${title}. ${subtitle}`)}">${lines.join('')}</svg>`;
}

// A compact table used for the goal list and the target roster in the report.
export function reportTableSvg() {
  return '';
}

export function reportTable(headers = [], rows = []) {
  const head = headers.map(header => `<th scope="col">${escapeXml(header)}</th>`).join('');
  const body = rows.map(row => `<tr>${row.map(cell => `<td>${escapeXml(cell)}</td>`).join('')}</tr>`).join('');
  return `<table class="report-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
