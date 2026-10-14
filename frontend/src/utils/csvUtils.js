// Keep commas, quotes, and line breaks intact instead of corrupting clinical notes.
export function csvRow(values) {
  return values.map(value => value == null ? '' : typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : String(value)).join(',');
}
