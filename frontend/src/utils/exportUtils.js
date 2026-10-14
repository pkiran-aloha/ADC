import JSZip from 'jszip';

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

// Convert SVG DOM Element to downloadable SVG file
export function exportSvgElement(svgElement, fileName = 'chart.svg') {
  if (!svgElement) return;
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);

  // Add namespaces if missing
  if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Prepend XML declaration
  source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
  downloadFile(source, fileName, 'image/svg+xml;charset=utf-8');
}

// Convert SVG Element to high-res PNG download
export function exportPngFromSvg(svgElement, fileName = 'chart.png', backgroundColor = '#ffffff') {
  if (!svgElement) return;

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const URL = window.URL || window.webkitURL || window;
  const blobURL = URL.createObjectURL(svgBlob);

  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    const scale = 2; // high-dpi crisp rendering
    const rect = svgElement.getBoundingClientRect();
    canvas.width = (rect.width || 800) * scale;
    canvas.height = (rect.height || 450) * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }
    }, 'image/png');

    URL.revokeObjectURL(blobURL);
  };
  image.src = blobURL;
}

// Export CSV for Overall Targets Mastered
export function exportMasteryCsv(data, programName = 'Program') {
  const headers = ['Date', 'Cumulative Mastered Targets', 'Newly Mastered Targets'];
  const rows = data.map(d => [
    d.date,
    d.cumulativeCount,
    `"${(d.newlyMastered || []).join('; ')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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
    `"${r.timestamp || ''}"`,
    r.sessionNumber || 1,
    `"${r.targetName || r.targetId || ''}"`,
    `"${r.therapistName || ''}"`,
    r.value !== null && r.value !== undefined ? r.value : '',
    r.correctCount !== null && r.correctCount !== undefined ? r.correctCount : '',
    r.totalTrials !== null && r.totalTrials !== undefined ? r.totalTrials : '',
    r.totalTrials && r.correctCount !== undefined ? Math.round((r.correctCount / r.totalTrials) * 100) + '%' : '',
    r.occurredIntervals ?? '',
    r.totalIntervals ?? '',
    r.durationSeconds !== null && r.durationSeconds !== undefined ? r.durationSeconds : '',
    r.occurrenceCount !== null && r.occurrenceCount !== undefined ? r.occurrenceCount : '',
    r.lessonDurationMinutes || '',
    `"${(r.qualitativeEntry || '').replace(/"/g, '""')}"`,
    `"${r.missingDataMode || 'Tracked'}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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
    `"${e.timestamp || ''}"`,
    `"${e.therapist || ''}"`,
    `"${(e.antecedents || []).join('; ')}"`,
    `"${(e.behaviors || []).join('; ')}"`,
    `"${(e.consequences || []).join('; ')}"`,
    `"${e.location || ''}"`,
    `"${(e.notes || '').replace(/"/g, '""')}"`,
    e.intensity || 1,
    e.durationMinutes || 5
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const safeName = clientName.replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadFile(csvContent, `ABC_Data_${safeName}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
}

// Future Scope #1: Multi-Selection Raw Data Export with Structured Zip Output
export async function exportStructuredZip({ clientName, programs, allRawRecords }) {
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
        `"${r.timestamp}"`,
        r.sessionNumber || 1,
        `"${r.therapistName}"`,
        r.value ?? '',
        r.correctCount ?? '',
        r.totalTrials ?? '',
        r.occurredIntervals ?? '',
        r.totalIntervals ?? '',
        r.durationSeconds ?? '',
        r.occurrenceCount ?? '',
        r.lessonDurationMinutes ?? '',
        `"${(r.qualitativeEntry || '').replace(/"/g, '""')}"`,
        `"${r.missingDataMode || 'Tracked'}"`
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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
