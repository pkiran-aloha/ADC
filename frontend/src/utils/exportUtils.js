import { csvRow } from './csvUtils';

// Helper to trigger browser file download
export function downloadFile(content, fileName, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export explicit SVG geometry/colors so downloads do not depend on page CSS.
function serializeChart(svgElement) {
  if (!svgElement) throw new Error('No chart is available to export');
  const clone = svgElement.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const { width, height } = svgElement.viewBox.baseVal;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  return new XMLSerializer().serializeToString(clone);
}

export function exportSvgElement(svgElement, fileName = 'chart.svg') {
  const source = serializeChart(svgElement);
  downloadFile('<?xml version="1.0" standalone="no"?>\r\n' + source, fileName, 'image/svg+xml;charset=utf-8');
}

export async function exportPngFromSvg(svgElement, fileName = 'chart.png', backgroundColor = '#ffffff') {
  const source = serializeChart(svgElement);
  await document.fonts.ready;
  const blobURL = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Could not render this chart'));
      image.src = blobURL;
    });
    const canvas = document.createElement('canvas');
    const { width, height } = svgElement.viewBox.baseVal;
    canvas.width = Math.round(width * 2);
    canvas.height = Math.round(height * 2);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image export is unavailable in this browser');
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not create the PNG')), 'image/png'));
    downloadFile(blob, fileName, 'image/png');
  } finally {
    URL.revokeObjectURL(blobURL);
  }
}

// Export CSV for Overall Targets Mastered
export function exportMasteryCsv(data, programName = 'Program') {
  const headers = ['Date', 'Cumulative Mastered Targets', 'Newly Mastered Targets'];
  const rows = data.map(d => [
    d.date,
    d.cumulativeCount,
    (d.newlyMastered || []).join('; ')
  ]);

  const csvContent = [headers.join(','), ...rows.map(csvRow)].join('\n');
  const safeName = programName.replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadFile(csvContent, `Mastery_${safeName}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
}

// Export Raw Data (Section 21) - trial level non-aggregated CSV
export function exportRawTrialDataCsv(records, clientName = 'Client') {
  const headers = [
    'Timestamp',
    'Session Number',
    'Target Name',
    'Therapist Name',
    'Value',
    'Correct Count',
    'Total Trials',
    'Accuracy (%)',
    'Intervals Occurred',
    'Total Intervals',
    'Duration (Seconds)',
    'Occurrence Count',
    'Lesson Duration (Min)',
    'Qualitative Entry',
    'Missing Data Mode'
  ];

  const rows = records.map(r => [
    r.timestamp || '',
    r.sessionNumber || 1,
    r.targetName || r.targetId || '',
    r.therapistName || '',
    r.value !== null && r.value !== undefined ? r.value : '',
    r.correctCount !== null && r.correctCount !== undefined ? r.correctCount : '',
    r.totalTrials !== null && r.totalTrials !== undefined ? r.totalTrials : '',
    r.totalTrials && r.correctCount !== undefined ? Math.round((r.correctCount / r.totalTrials) * 100) + '%' : '',
    r.occurredIntervals ?? '',
    r.totalIntervals ?? '',
    r.durationSeconds !== null && r.durationSeconds !== undefined ? r.durationSeconds : '',
    r.occurrenceCount !== null && r.occurrenceCount !== undefined ? r.occurrenceCount : '',
    r.lessonDurationMinutes || '',
    r.qualitativeEntry || '',
    r.missingDataMode || 'Tracked'
  ]);

  const csvContent = [headers.join(','), ...rows.map(csvRow)].join('\n');
  const safeName = clientName.replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadFile(csvContent, `Raw_Trials_${safeName}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
}

// Export ABC Raw Data (Section 24.9)
export function exportAbcDataCsv(entries, clientName = 'Client') {
  const headers = [
    'Date & Time',
    'Therapist',
    'Antecedents',
    'Behaviors',
    'Consequences',
    'Location',
    'Notes',
    'Intensity',
    'Duration (Min)'
  ];

  const rows = entries.map(e => [
    e.timestamp || '',
    e.therapist || '',
    (e.antecedents || []).join('; '),
    (e.behaviors || []).join('; '),
    (e.consequences || []).join('; '),
    e.location || '',
    e.notes || '',
    e.intensity ?? '',
    e.durationMinutes ?? ''
  ]);

  const csvContent = [headers.join(','), ...rows.map(csvRow)].join('\n');
  const safeName = clientName.replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadFile(csvContent, `ABC_Data_${safeName}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
}

// Future Scope #1: Multi-Selection Raw Data Export with Structured Zip Output
export async function exportStructuredZip({ clientName, programs, allRawRecords }) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const dateStr = new Date().toISOString().split('T')[0];
  const safeClient = clientName.replace(/[^a-zA-Z0-9_-]/g, '_');

  programs.forEach(program => {
    const safeProg = program.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const folder = zip.folder(safeProg);

    program.targets.forEach(tgt => {
      const records = allRawRecords.filter(r => r.targetId === tgt.id);
      const safeTarget = tgt.name.replace(/[^a-zA-Z0-9_-]/g, '_');

      const headers = ['Timestamp', 'Session', 'Therapist', 'Value', 'CorrectCount', 'TotalTrials', 'OccurredIntervals', 'TotalIntervals', 'DurationSeconds', 'OccurrenceCount', 'LessonDurationMinutes', 'Notes', 'MissingDataMode'];
      const rows = records.map(r => [
        r.timestamp || '',
        r.sessionNumber || 1,
        r.therapistName || '',
        r.value ?? '',
        r.correctCount ?? '',
        r.totalTrials ?? '',
        r.occurredIntervals ?? '',
        r.totalIntervals ?? '',
        r.durationSeconds ?? '',
        r.occurrenceCount ?? '',
        r.lessonDurationMinutes ?? '',
        r.qualitativeEntry || '',
        r.missingDataMode || 'Tracked'
      ]);

      const csv = [headers.join(','), ...rows.map(csvRow)].join('\n');
      folder.file(`${safeTarget}_${tgt.type}.csv`, csv);
    });
  });

  const zipContent = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipContent);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeClient}_${dateStr}_Analytics_Export.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
