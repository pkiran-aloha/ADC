import { SEED_AS_OF_DATE } from '../data/mockData.js';

export function getMinDate(durationFilter) {
  const date = new Date(`${SEED_AS_OF_DATE}T23:59:59`);
  if (durationFilter.endsWith('days')) date.setDate(date.getDate() - Number(durationFilter.split(' ')[0]));
  else if (durationFilter === '2 weeks') date.setDate(date.getDate() - 14);
  else if (durationFilter.endsWith('month') || durationFilter.endsWith('months')) date.setMonth(date.getMonth() - Number(durationFilter.split(' ')[0]));
  else if (durationFilter.endsWith('year') || durationFilter.endsWith('years')) date.setFullYear(date.getFullYear() - Number(durationFilter.split(' ')[0]));
  return date;
}

export function getObservationKey(session, aggregation) {
  if (aggregation === 'Per Session') return String(session.sessionNumber || 1);
  if (aggregation === 'Monthly') return session.timestamp.slice(0, 7);
  if (aggregation === 'Weekly') {
    // Calendar dates, not UTC conversion of the clinician's local time.
    const date = new Date(`${session.timestamp.slice(0, 10)}T12:00:00Z`);
    const day = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() - day + (day === 0 ? -6 : 1));
    return date.toISOString().slice(0, 10);
  }
  return session.timestamp.slice(0, 10);
}

export function sortObservationKeys(keys, aggregation) {
  return [...keys].sort(aggregation === 'Per Session' ? (a, b) => Number(a) - Number(b) : undefined);
}

export function processAggregation(sessions, aggregation, targetType, durationView, rateView, frequencyView) {
  const groups = new Map();
  for (const session of sessions) {
    if (session.missingDataMode === 'DataNotTracked') continue;
    const key = getObservationKey(session, aggregation);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(session);
  }
  return sortObservationKeys(groups.keys(), aggregation).map(key => ({ ...calculateMetricPoint(key, groups.get(key), targetType, durationView, rateView, frequencyView), date: groups.get(key)[0].timestamp.slice(0, 10) }));
}

export function calculateMetricPoint(xKey, records, targetType, durationView, rateView, frequencyView) {
  const therapist = [...new Set(records.map(record => record.therapistName))].join(', ');
  if (targetType === 'TrialByTrial') {
    const total = records.reduce((sum, row) => sum + (row.totalTrials || 1), 0);
    const correct = records.reduce((sum, row) => sum + (row.correctCount || 0), 0);
    const val = total > 0 ? Math.round(100 * correct / total) : 0;
    return { xKey, val, displayVal: `${val}% (${correct}/${total})`, therapist };
  }
  if (targetType === 'Duration') {
    const seconds = records.reduce((sum, row) => sum + (row.durationSeconds ?? row.value ?? 0), 0);
    const count = records.reduce((sum, row) => sum + (row.occurrenceCount ?? (row.durationSeconds > 0 ? 1 : 0)), 0);
    if (durationView === 'Total Count') return { xKey, val: count, displayVal: `${count} occurrences`, therapist };
    const val = durationView === 'Average Duration' ? (count > 0 ? Math.round(seconds / count) : 0) : seconds;
    return { xKey, val, displayVal: `${String(Math.floor(val / 60)).padStart(2, '0')} min ${String(val % 60).padStart(2, '0')} sec`, therapist };
  }
  if (targetType === 'FluencyRate' || targetType === 'Frequency') {
    const count = records.reduce((sum, row) => sum + (row.occurrenceCount ?? row.value ?? 0), 0);
    const minutes = records.reduce((sum, row) => sum + (row.lessonDurationMinutes ?? (targetType === 'FluencyRate' ? 7 : 60)), 0);
    const view = targetType === 'FluencyRate' ? rateView : frequencyView;
    if (view === 'Rate per Minute' || view === 'Rate per Hour') {
      const factor = view === 'Rate per Hour' ? 60 : 1;
      const val = minutes > 0 ? Math.round(100 * factor * count / minutes) / 100 : 0;
      return { xKey, val, displayVal: `${val} per ${factor === 60 ? 'hour' : 'minute'} (${count} in ${minutes} min)`, therapist };
    }
    return { xKey, val: count, displayVal: `${count} occurrences`, therapist };
  }
  if (targetType === 'IntervalData') {
    const total = records.reduce((sum, row) => sum + (row.totalIntervals ?? row.totalTrials ?? 0), 0);
    const scored = records.reduce((sum, row) => sum + (row.occurredIntervals ?? row.correctCount ?? 0), 0);
    const val = total > 0 ? Math.round(100 * scored / total) : 0;
    return { xKey, val, displayVal: `${val}% (${scored}/${total} intervals)`, therapist };
  }
  const val = records.reduce((sum, row) => sum + (row.value || 0), 0);
  return { xKey, val, displayVal: String(val), therapist };
}

export function chartStatistics(seriesData, aggregation, contextKeys = []) {
  const numeric = seriesData.flatMap(series => series.points).filter(point => Number.isFinite(point.val));
  if (!numeric.length) return { averageValue: null, trendlinePoints: null, regressionPoints: null, regressionParams: null };
  const measuredKeys = new Set(numeric.map(point => point.xKey));
  const keys = sortObservationKeys(new Set([...contextKeys, ...measuredKeys]), aggregation);
  const averageValue = Math.round(100 * numeric.reduce((sum, point) => sum + point.val, 0) / numeric.length) / 100;
  if (measuredKeys.size < 2) return { averageValue, trendlinePoints: null, regressionPoints: null, regressionParams: null };
  const xs = numeric.map(point => keys.indexOf(point.xKey));
  const n = numeric.length;
  const sumX = xs.reduce((sum, x) => sum + x, 0);
  const sumY = numeric.reduce((sum, point) => sum + point.val, 0);
  const sumXY = numeric.reduce((sum, point, index) => sum + xs[index] * point.val, 0);
  const sumX2 = xs.reduce((sum, x) => sum + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const meanAt = key => {
    const points = numeric.filter(point => point.xKey === key);
    return points.reduce((sum, point) => sum + point.val, 0) / points.length;
  };
  return {
    averageValue,
    trendlinePoints: { start: { xKey: sortObservationKeys(measuredKeys, aggregation)[0], val: meanAt(sortObservationKeys(measuredKeys, aggregation)[0]) }, end: { xKey: sortObservationKeys(measuredKeys, aggregation).at(-1), val: meanAt(sortObservationKeys(measuredKeys, aggregation).at(-1)) } },
    regressionPoints: { start: { xKey: keys[0], val: intercept }, end: { xKey: keys.at(-1), val: slope * (keys.length - 1) + intercept } },
    regressionParams: { slope: slope.toFixed(2), intercept: intercept.toFixed(2) }
  };
}
