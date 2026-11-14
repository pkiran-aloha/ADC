// A behavior's recent measurement, summarised for the behavior page.
//
// The summary reads the same observations the charts read, and keeps the platform's rule that
// a blank is not a zero: a session where the behavior was not tracked is left out of the
// average, while a session that recorded zero is counted as zero.

const DAY = 86_400_000;
const MEANINGFUL_CHANGE = 0.10;

const dayNumber = iso => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / DAY;
const isoOf = days => new Date(days * DAY).toISOString().slice(0, 10);

export function isTracked(row) {
  return row && row.value != null && Number.isFinite(Number(row.value)) && row.missingDataMode !== 'DataNotTracked';
}

// Weekly means, oldest first. The newest week ends on `asOf`.
export function weeklyBehaviorSeries(rows = [], asOf, weeks = 8) {
  const end = dayNumber(asOf);
  const series = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const last = end - index * 7;
    const first = last - 6;
    const inWeek = rows.filter(row => {
      const day = dayNumber(String(row.timestamp).slice(0, 10));
      return day >= first && day <= last;
    });
    const tracked = inWeek.filter(isTracked);
    series.push({
      start: isoOf(first), end: isoOf(last), sessions: tracked.length, notTracked: inWeek.length - tracked.length,
      mean: tracked.length ? tracked.reduce((sum, row) => sum + Number(row.value), 0) / tracked.length : null
    });
  }
  return series;
}

// Compare the latest four weeks with the four before them. Lower is the therapeutic direction
// for a behavior being reduced; the wording says what happened and leaves the decision to the
// clinician.
export function describeBehaviorChange(series = []) {
  const mean = part => {
    const values = part.filter(week => week.mean != null);
    return values.length ? values.reduce((sum, week) => sum + week.mean, 0) / values.length : null;
  };
  const half = Math.floor(series.length / 2);
  const recent = mean(series.slice(half));
  const previous = mean(series.slice(0, half));
  if (recent == null || previous == null) return { direction: 'unknown', recent, previous };
  if (previous === 0) return { direction: recent === 0 ? 'similar' : 'higher', recent, previous };
  const change = (recent - previous) / previous;
  if (Math.abs(change) < MEANINGFUL_CHANGE) return { direction: 'similar', recent, previous, change };
  return { direction: change < 0 ? 'lower' : 'higher', recent, previous, change };
}

export const BEHAVIOR_UNITS = { Frequency: 'per session', Duration: 'seconds per session', IntervalData: 'percent of intervals' };
