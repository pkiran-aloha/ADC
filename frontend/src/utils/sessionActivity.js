// Live session activity: what is happening on the client's schedule right now, which
// appointments still need documentation, and how productive the recorded sessions were —
// without downloading and reading a completed session note.
import { addDays } from './stats.js';
import { chartEligible } from './observations.js';

const toMinutes = clock => {
  const [hours, minutes] = String(clock || '00:00').split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

export const DOCUMENTATION_STATUSES = {
  complete: { label: 'Documented', tone: 'positive' },
  partial: { label: 'Partially documented', tone: 'neutral' },
  pending: { label: 'Documentation pending', tone: 'attention' },
  cancelled: { label: 'Cancelled', tone: 'muted' }
};

// The demo clock: the latest recorded timestamp, so "today" always has activity to show.
export function demoClock({ sessions = [], serviceSessions = [], asOfDate }) {
  // Recorded observations first (they are what "now" means for documentation), then the
  // end of the most recent completed appointment, then the fixture snapshot date.
  const observed = sessions.map(row => row.timestamp).filter(Boolean).sort();
  if (observed.length) {
    const latest = observed.at(-1);
    return { date: latest.slice(0, 10), time: latest.slice(11, 16) || '12:00' };
  }
  const completed = serviceSessions
    .filter(session => session.status !== 'Cancelled')
    .map(session => `${session.date}T${session.end || session.start || '12:00'}`)
    .filter(Boolean).sort();
  const latest = completed.at(-1) || `${asOfDate}T12:00`;
  return { date: latest.slice(0, 10), time: latest.slice(11, 16) || '12:00' };
}

function observationsFor(serviceId, rows) {
  return rows.filter(row => row.serviceSessionId === serviceId && chartEligible(row));
}

// One row per appointment on the chosen day: progress so far, what was recorded, and
// whether the paperwork behind the billing is ready.
export function activitySnapshot({ serviceSessions = [], sessions = [], asOfDate, day = null }) {
  const clock = demoClock({ sessions, serviceSessions, asOfDate });
  const date = day || clock.date;
  const now = toMinutes(clock.time);
  const appointments = serviceSessions
    .filter(session => session.date === date)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
    .map(session => {
      const observed = observationsFor(session.id, sessions);
      const minutesRecorded = observed.reduce((sum, row) => sum + Number(row.lessonDurationMinutes || 0), 0);
      const targets = [...new Set(observed.map(row => row.targetId))];
      const lastRecorded = observed.map(row => row.timestamp).sort().at(-1) || null;
      const notes = observed.filter(row => row.note || row.qualitativeEntry).length;
      const start = toMinutes(session.start);
      const end = toMinutes(session.end);
      const cancelled = session.status === 'Cancelled';
      const state = cancelled ? 'cancelled' : now < start ? 'upcoming' : now < end ? 'inProgress' : 'finished';
      const status = cancelled ? 'cancelled' : observed.length === 0 ? 'pending' : notes > 0 || minutesRecorded > 0 ? 'complete' : 'partial';
      return {
        id: session.id,
        start: session.start,
        end: session.end,
        label: `${session.setting} · ${session.serviceCode}`,
        therapistName: session.therapistName,
        role: session.role,
        setting: session.setting,
        serviceCode: session.serviceCode,
        status: session.status,
        state,
        cancelled,
        cancelReason: session.cancelReason || null,
        observations: observed.length,
        targets: targets.length,
        minutesRecorded,
        noteCount: notes,
        lastRecordedAt: lastRecorded,
        supervision: session.supervision ? session.supervision.supervisor : null,
        settingEvents: session.settingEvents || [],
        documentation: status
      };
    });
  const completed = appointments.filter(item => !item.cancelled);
  const withObservationData = completed.filter(item => item.observations > 0);
  // Only a finished appointment can be missing its documentation; an appointment still
  // in progress has not had a chance to record anything yet.
  const pending = completed.filter(item => item.state === 'finished' && item.observations === 0);
  const elapsedMinutes = completed.filter(item => item.state !== 'upcoming').reduce((sum, item) => sum + Math.max(0, Math.min(toMinutes(item.end), Math.max(now, toMinutes(item.start))) - toMinutes(item.start)), 0);
  const documentedMinutes = completed.reduce((sum, item) => sum + item.minutesRecorded, 0);

  return {
    date,
    clock: clock.time,
    appointments,
    inProgress: completed.filter(item => item.state === 'inProgress').length,
    today: completed.length,
    cancelled: appointments.length - completed.length,
    documented: withObservationData.length,
    pending,
    pendingIds: pending.map(item => item.id),
    observations: completed.reduce((sum, item) => sum + item.observations, 0),
    targets: new Set(completed.flatMap(item => item.targets)).size,
    minutesRecorded: documentedMinutes,
    elapsedMinutes,
    documentationRate: completed.length ? Math.round((100 * withObservationData.length) / completed.length) : null
  };
}

// A week of productivity for the section header: recorded observations per day, so gaps in
// documentation are visible while there is still time to fill them.
export function weeklyActivity({ serviceSessions = [], sessions = [], asOfDate, days = 7 }) {
  const clock = demoClock({ sessions, serviceSessions, asOfDate });
  const planned = new Map();
  for (const session of serviceSessions) {
    const entry = planned.get(session.date) || { date: session.date, appointments: 0, cancelled: 0, minutes: 0, observations: 0, targets: new Set() };
    entry.appointments += 1;
    if (session.status === 'Cancelled') entry.cancelled += 1;
    else entry.minutes += session.minutes || 0;
    planned.set(session.date, entry);
  }
  for (const row of sessions.filter(chartEligible)) {
    const date = row.timestamp.slice(0, 10);
    const entry = planned.get(date);
    if (!entry) continue;
    entry.observations += 1;
    entry.targets.add(row.targetId);
  }
  const result = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = addDays(clock.date, -index);
    const entry = planned.get(date) || { date, appointments: 0, cancelled: 0, minutes: 0, observations: 0, targets: new Set() };
    result.push({ ...entry, targets: entry.targets.size, hours: Math.round((entry.minutes / 60) * 10) / 10 });
  }
  return result;
}

// The target a clinician last touched, used to point at where to continue recording.
export function lastRecordedTarget(sessions = [], serviceSessions = []) {
  const latest = [...sessions].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp))).at(-1);
  if (!latest) return null;
  const service = serviceSessions.find(item => item.id === latest.serviceSessionId);
  return { targetId: latest.targetId, timestamp: latest.timestamp, serviceId: service?.id || null, setting: service?.setting || null };
}
