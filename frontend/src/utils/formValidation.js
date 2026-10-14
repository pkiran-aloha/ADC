export function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateAnnotation(values, kind) {
  const errors = {};
  if (kind === 'range') {
    if (!isValidDate(values.startDate)) errors.startDate = 'Choose a valid start date.';
    if (!isValidDate(values.endDate)) errors.endDate = 'Choose a valid end date.';
    if (!errors.startDate && !errors.endDate && values.endDate < values.startDate) errors.endDate = 'The end date must be on or after the start date.';
  } else if (!isValidDate(values.date)) errors.date = 'Choose a valid date.';
  if (kind === 'note') {
    if (!values.noteText?.trim()) errors.noteText = 'Enter a note before saving.';
    if (!values.staffName?.trim()) errors.staffName = 'Enter the author’s name.';
  } else if (!values.label?.trim()) errors.label = 'Give this annotation a short label.';
  if (!/^#[0-9a-f]{6}$/i.test(values.color || '')) errors.color = 'Choose a valid color.';
  return errors;
}

export const PHASES = ['Baseline', 'Pending', 'Acquisition', 'Maintenance', 'Generalization', 'Completed', 'OnHold', 'Discontinued'];
export const MEASUREMENT_LABELS = {
  TrialByTrial: 'Trial by trial', Duration: 'Duration', Frequency: 'Frequency',
  IntervalData: 'Interval data', Anecdotal: 'Anecdotal', FluencyRate: 'Fluency / rate'
};

export function validateRecording(values, target) {
  const errors = {};
  if (!target) errors.targetId = 'Choose a target to record an observation.';
  if (!values.therapistName?.trim()) errors.therapistName = 'Choose a recording clinician.';
  const dateTime = values.timestamp || '';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTime) || !isValidDate(dateTime.slice(0, 10)) || Number(dateTime.slice(11, 13)) > 23 || Number(dateTime.slice(14, 16)) > 59) {
    errors.timestamp = 'Choose a valid observation date and time.';
  }
  function number(key, label, min = 0, integer = true) {
    const value = values[key];
    if (value == null || (typeof value === 'string' && value.trim() === '') || !Number.isFinite(Number(value)) || Number(value) < min || (integer && !Number.isInteger(Number(value)))) {
      errors[key] = `Enter ${integer ? 'a whole number' : 'a number'} ${min === 0 ? 'of 0 or more' : `of ${min} or more`} for ${label.toLowerCase()}.`;
    }
  }
  const untracked = target?.category === 'BehaviorReduction' && values.missingDataMode === 'DataNotTracked';
  if (target && !untracked) {
    switch (target.type) {
      case 'TrialByTrial':
        number('correctCount', 'correct trials'); number('totalTrials', 'total trials', 1);
        if (!errors.correctCount && !errors.totalTrials && Number(values.correctCount) > Number(values.totalTrials)) errors.correctCount = 'Correct trials cannot exceed total trials.';
        break;
      case 'IntervalData':
        number('occurredIntervals', 'intervals with occurrence'); number('totalIntervals', 'total intervals', 1);
        if (!errors.occurredIntervals && !errors.totalIntervals && Number(values.occurredIntervals) > Number(values.totalIntervals)) errors.occurredIntervals = 'Scored intervals cannot exceed total intervals.';
        if (target.intervalSettings?.numberOfIntervals && !errors.totalIntervals && Number(values.totalIntervals) !== target.intervalSettings.numberOfIntervals) errors.totalIntervals = `This target uses ${target.intervalSettings.numberOfIntervals} intervals.`;
        break;
      case 'Duration': number('durationSeconds', 'duration in seconds'); break;
      case 'Frequency':
      case 'FluencyRate':
        number('occurrenceCount', 'occurrences'); number('lessonDurationMinutes', 'observation minutes', 0.1, false);
        break;
      case 'Anecdotal':
        if (!values.qualitativeEntry?.trim()) errors.qualitativeEntry = 'Describe the observation before saving.';
        break;
    }
  }
  if (values.showPhaseChangePrompt) {
    if (!PHASES.includes(values.newPhase)) errors.newPhase = 'Choose a valid target phase.';
    if (!values.phaseLineLabel?.trim()) errors.phaseLineLabel = 'Give the phase line a short label.';
  }
  return errors;
}
