// Descriptive ABC analytics (BACB TCO F.5). These summaries describe correlations in
// recorded episodes; they do not establish function. A functional analysis (F.6) is
// needed to confirm hypotheses (Pence et al., 2009; Thompson & Iwata, 2007).
import { mean } from './stats.js';

export const FUNCTIONS = ['Escape', 'Attention', 'Tangible', 'Sensory', 'None'];
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const unique = values => [...new Set(values)];
const minutesOf = clock => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
export const clockLabel = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function weekdayOf(date) {
  const day = new Date(`${date.slice(0, 10)}T12:00:00Z`).getUTCDay();
  return WEEKDAYS[(day + 6) % 7];
}

export function timeBlock(timestamp, blockMinutes = 30) {
  const minutes = minutesOf(timestamp.slice(11, 16));
  return clockLabel(Math.floor(minutes / blockMinutes) * blockMinutes);
}

// Phase of a behavior target on a date, from its phase history.
export function phaseOn(target, date) {
  const history = target?.phaseHistory || [];
  let phase = history.length ? null : target?.phase || null;
  for (const entry of history) if (entry.date <= date.slice(0, 10)) phase = entry.phase;
  return phase;
}

// Entry-level contingency table between two multi-valued fields: an entry with two
// antecedents and one behavior contributes one count to each antecedent/behavior pair.
export function contingency(entries, rowsOf, columnsOf, { rowOrder = [], columnOrder = [] } = {}) {
  const counts = new Map();
  const rowTotals = new Map();
  const columnTotals = new Map();
  for (const entry of entries) {
    const rows = unique(rowsOf(entry));
    const columns = unique(columnsOf(entry));
    rows.forEach(row => rowTotals.set(row, (rowTotals.get(row) || 0) + 1));
    columns.forEach(column => columnTotals.set(column, (columnTotals.get(column) || 0) + 1));
    for (const row of rows) for (const column of columns) counts.set(`${row}\u0000${column}`, (counts.get(`${row}\u0000${column}`) || 0) + 1);
  }
  const order = (preferred, totals) => [...preferred.filter(item => totals.has(item)),
    ...[...totals.keys()].filter(item => !preferred.includes(item)).sort((a, b) => totals.get(b) - totals.get(a))];
  const rows = order(rowOrder, rowTotals);
  const columns = order(columnOrder, columnTotals);
  const total = entries.length;
  const count = (row, column) => counts.get(`${row}\u0000${column}`) || 0;
  return {
    rows, columns, total, rowTotals, columnTotals, count,
    // P(row | column), e.g. P(antecedent | behavior); "lift" compares it with P(row)
    // across all recorded episodes (a within-ABC reference, not a true background).
    rowGivenColumn: (row, column) => (columnTotals.get(column) ? count(row, column) / columnTotals.get(column) : null),
    columnGivenRow: (row, column) => (rowTotals.get(row) ? count(row, column) / rowTotals.get(row) : null),
    lift: (row, column) => {
      const conditional = columnTotals.get(column) ? count(row, column) / columnTotals.get(column) : null;
      const overall = total ? (rowTotals.get(row) || 0) / total : null;
      return conditional != null && overall ? conditional / overall : null;
    }
  };
}

// Share of each behavior's episodes followed by a consequence that would deliver each
// reinforcer type, using the configured consequence-to-function catalog.
export function functionProfile(entries, behaviors, consequenceFunctions = {}) {
  return behaviors.map(behavior => {
    const relevant = entries.filter(entry => entry.behaviors.includes(behavior));
    const counts = Object.fromEntries(FUNCTIONS.map(name => [name, 0]));
    for (const entry of relevant) {
      for (const fn of unique(entry.consequences.map(consequence => consequenceFunctions[consequence] || 'None'))) counts[fn] += 1;
    }
    const shares = Object.fromEntries(FUNCTIONS.map(name => [name, relevant.length ? counts[name] / relevant.length : 0]));
    const social = FUNCTIONS.filter(name => name !== 'None');
    const leading = social.reduce((best, name) => (shares[name] > (shares[best] ?? -1) ? name : best), social[0]);
    return { behavior, n: relevant.length, counts, shares, leading: relevant.length ? leading : null,
      leadingShare: relevant.length ? shares[leading] : 0 };
  });
}

// Antecedent category -> behavior -> consequence function weights for a flow diagram.
// Each entry contributes a total weight of 1 to each stage so flows add up to entries.
export function sequenceFlows(entries, config) {
  const categories = config?.antecedentCategories || {};
  const functions = config?.consequenceFunctions || {};
  const left = new Map();
  const right = new Map();
  for (const entry of entries) {
    const cats = unique(entry.antecedents.map(name => categories[name] || 'Other'));
    const behaviors = unique(entry.behaviors);
    const fns = unique(entry.consequences.map(name => functions[name] || 'None'));
    for (const cat of cats) for (const behavior of behaviors) {
      const key = `${cat}\u0000${behavior}`;
      left.set(key, (left.get(key) || 0) + 1 / (cats.length * behaviors.length));
    }
    for (const behavior of behaviors) for (const fn of fns) {
      const key = `${behavior}\u0000${fn}`;
      right.set(key, (right.get(key) || 0) + 1 / (behaviors.length * fns.length));
    }
  }
  const split = map => [...map.entries()].map(([key, value]) => {
    const [source, target] = key.split('\u0000');
    return { source, target, value };
  });
  return { left: split(left), right: split(right) };
}

// Observed minutes per date/time block from completed direct-service appointments.
export function observationCoverage(sessions, blockMinutes = 30) {
  const coverage = new Map();
  for (const session of sessions) {
    if (session.status !== 'Completed' || session.serviceCode === '97156') continue;
    const start = minutesOf(session.start);
    const end = minutesOf(session.end);
    for (let block = Math.floor(start / blockMinutes) * blockMinutes; block < end; block += blockMinutes) {
      const observed = Math.min(end, block + blockMinutes) - Math.max(start, block);
      if (observed <= 0) continue;
      const key = `${session.date}|${clockLabel(block)}`;
      coverage.set(key, (coverage.get(key) || 0) + observed);
    }
  }
  return coverage;
}

// Touchette, MacDonald & Langer (1985) scatterplot: episodes per day and time block,
// with blocks that were never observed kept distinct from observed zeros.
export function scatterplot(entries, sessions, { blockMinutes = 30 } = {}) {
  const coverage = observationCoverage(sessions, blockMinutes);
  const counts = new Map();
  for (const entry of entries) {
    const key = `${entry.timestamp.slice(0, 10)}|${timeBlock(entry.timestamp, blockMinutes)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const dates = unique([...coverage.keys(), ...counts.keys()].map(key => key.split('|')[0])).sort();
  const blocks = unique([...coverage.keys(), ...counts.keys()].map(key => key.split('|')[1])).sort();
  return { dates, blocks, cell: (date, block) => ({ count: counts.get(`${date}|${block}`) || 0, observed: coverage.get(`${date}|${block}`) || 0 }) };
}

// Exposure-adjusted rates (episodes per observed hour) by weekday and time block.
export function weekdayBlockRates(entries, sessions, { blockMinutes = 60 } = {}) {
  const coverage = observationCoverage(sessions, blockMinutes);
  const observed = new Map();
  const counts = new Map();
  for (const [key, minutes] of coverage) {
    const [date, block] = key.split('|');
    const cell = `${weekdayOf(date)}|${block}`;
    observed.set(cell, (observed.get(cell) || 0) + minutes);
  }
  for (const entry of entries) {
    const cell = `${weekdayOf(entry.timestamp)}|${timeBlock(entry.timestamp, blockMinutes)}`;
    counts.set(cell, (counts.get(cell) || 0) + 1);
  }
  const cells = [...observed.keys()].map(key => {
    const [weekday, block] = key.split('|');
    const hours = observed.get(key) / 60;
    const count = counts.get(key) || 0;
    return { weekday, block, hours, count, rate: hours ? count / hours : null };
  });
  const totalHours = cells.reduce((total, cell) => total + cell.hours, 0);
  const totalCount = cells.reduce((total, cell) => total + cell.count, 0);
  const overall = totalHours ? totalCount / totalHours : 0;
  return {
    weekdays: WEEKDAYS.filter(day => cells.some(cell => cell.weekday === day)),
    blocks: unique(cells.map(cell => cell.block)).sort(), overall,
    cell: (weekday, block) => cells.find(item => item.weekday === weekday && item.block === block) || null,
    // Windows with enough observation time and the highest relative rates.
    hotspots: cells.filter(cell => cell.hours >= 3 && cell.count >= 2).map(cell => ({ ...cell, ratio: overall ? cell.rate / overall : null }))
      .sort((a, b) => b.ratio - a.ratio).slice(0, 5)
  };
}

// Lag-sequential summary: how often behavior Y follows behavior X within `withinMinutes`
// in the same appointment, compared with how often Y follows any episode (lift).
export function precursorChains(entries, { withinMinutes = 10 } = {}) {
  const bySession = new Map();
  for (const entry of entries) {
    const key = entry.serviceSessionId || entry.timestamp.slice(0, 10);
    if (!bySession.has(key)) bySession.set(key, []);
    bySession.get(key).push(entry);
  }
  const events = [];
  for (const list of bySession.values()) {
    list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    list.forEach(entry => entry.behaviors.forEach((behavior, order) => events.push({ behavior, minute: minutesOf(entry.timestamp.slice(11, 16)) + order * 0.5, session: list })));
  }
  const behaviors = unique(entries.flatMap(entry => entry.behaviors));
  const followed = new Map();
  const sources = new Map();
  const anyFollowed = new Map();
  const grouped = new Map();
  for (const event of events) {
    if (!grouped.has(event.session)) grouped.set(event.session, []);
    grouped.get(event.session).push(event);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.minute - b.minute);
    list.forEach((event, index) => {
      sources.set(event.behavior, (sources.get(event.behavior) || 0) + 1);
      const next = new Set();
      for (let position = index + 1; position < list.length && list[position].minute - event.minute <= withinMinutes; position++) next.add(list[position].behavior);
      for (const behavior of next) {
        followed.set(`${event.behavior}\u0000${behavior}`, (followed.get(`${event.behavior}\u0000${behavior}`) || 0) + 1);
        anyFollowed.set(behavior, (anyFollowed.get(behavior) || 0) + 1);
      }
    });
  }
  const totalEvents = events.length;
  const chains = [];
  for (const from of behaviors) {
    for (const to of behaviors) {
      const n = followed.get(`${from}\u0000${to}`) || 0;
      const base = totalEvents ? (anyFollowed.get(to) || 0) / totalEvents : 0;
      const probability = sources.get(from) ? n / sources.get(from) : 0;
      chains.push({ from, to, n, probability, base, lift: base ? probability / base : null, sources: sources.get(from) || 0 });
    }
  }
  return { behaviors, chains: chains.sort((a, b) => b.probability - a.probability), withinMinutes };
}

// Setting events as motivating operations: observed episodes in sessions with an event
// versus what nearby sessions without events predict (stratified by time, +/-14 days),
// so the declining treatment trend does not masquerade as an event effect.
export function settingEventEffects(rows, sessions, behaviorTargetIds, { windowDays = 14 } = {}) {
  const ids = new Set(behaviorTargetIds);
  const bySession = new Map();
  for (const row of rows) {
    if (!ids.has(row.targetId) || row.value == null || row.occurrenceCount == null) continue;
    bySession.set(row.serviceSessionId, (bySession.get(row.serviceSessionId) || 0) + row.occurrenceCount);
  }
  const observedSessions = sessions.filter(session => bySession.has(session.id)).map(session => ({
    ...session, episodes: bySession.get(session.id), hours: session.minutes / 60,
    day: Math.round(new Date(`${session.date}T12:00:00Z`).getTime() / 86400000)
  }));
  const events = unique(observedSessions.flatMap(session => session.settingEvents || []));
  return events.map(event => {
    let observed = 0;
    let expected = 0;
    let n = 0;
    for (const session of observedSessions) {
      if (!(session.settingEvents || []).includes(event)) continue;
      const neighbours = observedSessions.filter(other => !(other.settingEvents || []).length && Math.abs(other.day - session.day) <= windowDays);
      const hours = neighbours.reduce((total, other) => total + other.hours, 0);
      if (!hours) continue;
      const rate = neighbours.reduce((total, other) => total + other.episodes, 0) / hours;
      observed += session.episodes;
      expected += rate * session.hours;
      n += 1;
    }
    const ratio = expected > 0 ? observed / expected : null;
    const spread = observed > 0 ? 1.96 / Math.sqrt(observed) : null;
    return { event, sessions: n, observed, expected, ratio,
      low: ratio && spread ? ratio * Math.exp(-spread) : null, high: ratio && spread ? ratio * Math.exp(spread) : null };
  }).filter(effect => effect.sessions >= 2).sort((a, b) => (b.ratio || 0) - (a.ratio || 0));
}

// Weekly mean intensity and episode duration per behavior.
export function intensityTrend(entries, behaviors) {
  const weekOf = date => {
    const value = new Date(`${date.slice(0, 10)}T12:00:00Z`);
    const day = value.getUTCDay();
    value.setUTCDate(value.getUTCDate() - day + (day === 0 ? -6 : 1));
    return value.toISOString().slice(0, 10);
  };
  const weeks = unique(entries.map(entry => weekOf(entry.timestamp))).sort();
  return {
    weeks,
    series: behaviors.map(behavior => ({
      behavior,
      points: weeks.map(week => {
        const relevant = entries.filter(entry => entry.behaviors.includes(behavior) && weekOf(entry.timestamp) === week);
        return { week, n: relevant.length, intensity: mean(relevant.map(entry => entry.intensity)),
          duration: mean(relevant.map(entry => entry.durationMinutes)) };
      })
    }))
  };
}

export function pareto(entries, field) {
  const counts = new Map();
  for (const entry of entries) for (const value of unique(entry[field] || [])) counts.set(value, (counts.get(value) || 0) + 1);
  const total = entries.length;
  let running = 0;
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => {
    running += count;
    return { label, count, share: total ? count / total : 0, cumulative: total ? running / total : 0 };
  });
}

// ---------------------------------------------------------------------------
// Time-of-day patterns. Clinicians asked to record event timestamps and read them as a
// clock-time scatterplot (toileting and behavior-reduction analysis), so events can be
// compared across the day rather than only across dates.
// ---------------------------------------------------------------------------

export function clockMinutes(timestamp) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timestamp || '')) return null;
  return Number(timestamp.slice(11, 13)) * 60 + Number(timestamp.slice(14, 16));
}

// One point per event: date for the x-axis, clock time for the y-axis.
export function timeOfDayPattern(entries = [], { binMinutes = 60, behaviors = [] } = {}) {
  const points = [];
  for (const entry of entries) {
    const minutes = clockMinutes(entry.timestamp);
    if (minutes == null) continue;
    const names = (entry.behaviors || []).filter(name => !behaviors.length || behaviors.includes(name));
    if (!names.length && behaviors.length) continue;
    points.push({
      id: entry.id,
      date: entry.timestamp.slice(0, 10),
      timestamp: entry.timestamp,
      minutes,
      block: Math.floor(minutes / binMinutes) * binMinutes,
      intensity: entry.intensity ?? null,
      durationMinutes: entry.durationMinutes ?? null,
      behavior: names[0] || 'Behavior',
      behaviors: names,
      antecedents: entry.antecedents || [],
      consequences: entry.consequences || []
    });
  }
  const bins = new Map();
  for (const point of points) {
    const bin = bins.get(point.block) || { block: point.block, label: `${clockLabel(point.block)}–${clockLabel(point.block + binMinutes)}`, count: 0, intensityTotal: 0, intensityCount: 0, behaviors: new Map() };
    bin.count += 1;
    if (Number.isFinite(point.intensity)) { bin.intensityTotal += point.intensity; bin.intensityCount += 1; }
    bin.behaviors.set(point.behavior, (bin.behaviors.get(point.behavior) || 0) + 1);
    bins.set(point.block, bin);
  }
  const ordered = [...bins.values()].sort((a, b) => a.block - b.block).map(bin => ({
    ...bin,
    meanIntensity: bin.intensityCount ? Math.round((bin.intensityTotal / bin.intensityCount) * 10) / 10 : null,
    behaviors: [...bin.behaviors.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
  }));
  const total = points.length;
  const peak = ordered.reduce((best, bin) => (!best || bin.count > best.count ? bin : best), null);
  const earliest = points.reduce((best, point) => (!best || point.minutes < best.minutes ? point : best), null);
  const latest = points.reduce((best, point) => (!best || point.minutes > best.minutes ? point : best), null);
  return {
    points,
    bins: ordered.map(bin => ({ ...bin, share: total ? bin.count / total : 0 })),
    total,
    peak,
    earliest: earliest?.minutes ?? null,
    latest: latest?.minutes ?? null,
    dateRange: points.length ? { from: points.map(point => point.date).sort()[0], to: points.map(point => point.date).sort().at(-1) } : null
  };
}

// Events by hour of the day, split into morning / afternoon / evening, for the summary
// sentence above the scatterplot.
export function timeOfDayShares(pattern) {
  const buckets = [{ id: 'morning', label: 'Morning (06:00–12:00)', count: 0 }, { id: 'afternoon', label: 'Afternoon (12:00–17:00)', count: 0 }, { id: 'evening', label: 'Evening (17:00–22:00)', count: 0 }, { id: 'other', label: 'Outside 06:00–22:00', count: 0 }];
  for (const point of pattern.points || []) {
    const bucket = point.minutes >= 360 && point.minutes < 720 ? buckets[0] : point.minutes >= 720 && point.minutes < 1020 ? buckets[1] : point.minutes >= 1020 && point.minutes <= 1320 ? buckets[2] : buckets[3];
    bucket.count += 1;
  }
  const total = pattern.total || 0;
  return buckets.map(bucket => ({ ...bucket, share: total ? bucket.count / total : 0 }));
}
