import { useMemo } from 'react';
import SectionHeader from './ui/SectionHeader';
import { getObservationKey } from '../utils/analyticsMetrics';
import { formatChartDate, CHART_GRID, CHART_MUTED, CHART_INK } from '../utils/chartTheme';
import { addDays, mean } from '../utils/stats';
import { formatNumber, formatClock, formatLongDate } from '../utils/targetAnalytics';
import { activitySnapshot, weeklyActivity, DOCUMENTATION_STATUSES } from '../utils/sessionActivity';

const FONT = 'Geist, sans-serif';
const CODES = [
  { code: '97153', label: 'Direct treatment (RBT)', color: '#346b52' },
  { code: '97155', label: 'BCBA treatment / protocol modification', color: '#697b96' },
  { code: '97156', label: 'Caregiver guidance', color: '#9b7a3d' }
];
const WEEKS = 12;
const monthLabel = month => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// Service delivery and data-quality monitoring: dosage against authorization, attendance,
// interobserver agreement, procedural fidelity and RBT supervision (BACB TCO C.8, C.12, I.7).
export default function ServiceQualitySection({ client, serviceSessions, sessions, standards, asOfDate }) {
  const weeks = useMemo(() => {
    const last = getObservationKey({ timestamp: `${asOfDate}T12:00:00` }, 'Weekly');
    return Array.from({ length: WEEKS }, (_, index) => addDays(last, -7 * (WEEKS - 1 - index)));
  }, [asOfDate]);
  const weekly = useMemo(() => weeks.map(week => {
    const inWeek = serviceSessions.filter(session => getObservationKey({ timestamp: `${session.date}T12:00:00` }, 'Weekly') === week);
    const hours = Object.fromEntries(CODES.map(({ code }) => [code, inWeek.filter(session => session.status === 'Completed' && session.serviceCode === code).reduce((total, session) => total + session.minutes, 0) / 60]));
    const cancelled = inWeek.filter(session => session.status === 'Cancelled').reduce((total, session) => total + session.minutes, 0) / 60;
    const direct = inWeek.filter(session => session.status === 'Completed' && session.serviceCode !== '97156');
    const fidelity = direct.filter(session => session.fidelity).map(session => session.fidelity.percent);
    return { week, hours, cancelled, direct: direct.length, ioa: direct.length ? (100 * direct.filter(session => session.ioaObserver).length) / direct.length : null, fidelity: mean(fidelity) };
  }), [weeks, serviceSessions]);

  const recentStart = addDays(asOfDate, -27);
  const recent = serviceSessions.filter(session => session.date >= recentStart);
  const directRecent = recent.filter(session => session.status === 'Completed' && session.serviceCode !== '97156');
  const directHours = directRecent.reduce((total, session) => total + session.minutes, 0) / 60 / 4;
  const scheduled = serviceSessions.filter(session => session.date >= addDays(asOfDate, -55) && session.serviceCode !== '97156');
  const attendance = scheduled.length ? (100 * scheduled.filter(session => session.status === 'Completed').length) / scheduled.length : null;
  const ioaRows = sessions.filter(row => row.ioa && row.timestamp.slice(0, 10) >= recentStart);
  const ioaCoverage = directRecent.length ? (100 * directRecent.filter(session => session.ioaObserver).length) / directRecent.length : null;
  const fidelityRecent = directRecent.filter(session => session.fidelity).map(session => session.fidelity.percent);
  const fidelityMinimum = standards?.fidelity?.minimumPercent ?? 85;

  const supervision = useMemo(() => {
    const months = [...new Set(serviceSessions.map(session => session.date.slice(0, 7)))].sort().slice(-3);
    return months.map(month => {
      const byRbt = new Map();
      for (const session of serviceSessions) {
        if (session.date.slice(0, 7) !== month || session.status !== 'Completed' || session.role !== 'RBT') continue;
        const item = byRbt.get(session.therapistName) || { name: session.therapistName, minutes: 0, supervised: 0, contacts: 0 };
        item.minutes += session.minutes;
        if (session.supervision) { item.supervised += session.supervision.minutes; item.contacts += 1; }
        byRbt.set(session.therapistName, item);
      }
      return { month, rows: [...byRbt.values()].map(item => ({ ...item, percent: item.minutes ? (100 * item.supervised) / item.minutes : 0 })).sort((a, b) => b.minutes - a.minutes) };
    });
  }, [serviceSessions]);
  const cancellations = useMemo(() => {
    const counts = new Map();
    serviceSessions.filter(session => session.status === 'Cancelled').forEach(session => counts.set(session.cancelReason, (counts.get(session.cancelReason) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [serviceSessions]);
  const minimum = standards?.supervision?.rbtMinimumPercent ?? 5;
  const contactsNeeded = standards?.supervision?.rbtMinimumContactsPerMonth ?? 2;
  // Live view of the current fictional day: what is scheduled, what has been recorded and
  // what still needs documenting — without downloading a session note.
  const activity = useMemo(() => activitySnapshot({ serviceSessions, sessions, asOfDate }), [serviceSessions, sessions, asOfDate]);
  const week = useMemo(() => weeklyActivity({ serviceSessions, sessions, asOfDate, days: 7 }), [serviceSessions, sessions, asOfDate]);
  const weekPeak = Math.max(1, ...week.map(day => day.observations));

  return <section id="service-quality" className="panel" aria-labelledby="service-quality-title" tabIndex={-1}>
    <SectionHeader id="service-quality-title" title="Service & data quality" description="Dosage against authorization, attendance, agreement between observers, procedural fidelity and supervision."
      help="Trustworthy graphs need enough treatment, reliable measurement (IOA) and treatment delivered as written (procedural fidelity). Supervision percentages here cover this client’s sessions only; the BACB 5% requirement applies to each RBT’s total monthly hours across clients." />
    <div className="panel-body">
      <dl className="quality-kpis" aria-label={`${client.name}'s service and data quality summary`}>
        <div className="kpi"><dt>Direct hours per week</dt><dd><strong>{formatNumber(directHours)}</strong><small>last 4 weeks · {client.authorizedHoursPerWeek} authorized ({Math.round((100 * directHours) / client.authorizedHoursPerWeek)}%)</small></dd></div>
        <div className="kpi"><dt>Attendance</dt><dd><strong>{attendance == null ? '–' : `${Math.round(attendance)}%`}</strong><small>sessions kept, last 8 weeks</small></dd></div>
        <div className="kpi"><dt>IOA coverage</dt><dd><strong>{ioaCoverage == null ? '–' : `${Math.round(ioaCoverage)}%`}</strong><small>of sessions · mean {ioaRows.length ? formatNumber(mean(ioaRows.map(row => row.ioa.percent))) : '–'}% agreement</small>
          <span className={`stat-chip stat-chip--${ioaCoverage >= (standards?.ioa?.minimumCoveragePercent ?? 20) ? 'positive' : 'attention'}`}>{ioaCoverage >= (standards?.ioa?.minimumCoveragePercent ?? 20) ? 'Meets ≥ 20%' : 'Below 20%'}</span></dd></div>
        <div className="kpi"><dt>Procedural fidelity</dt><dd><strong>{fidelityRecent.length ? `${formatNumber(mean(fidelityRecent))}%` : '–'}</strong><small>{fidelityRecent.length} checks · {fidelityRecent.filter(value => value < fidelityMinimum).length} below {fidelityMinimum}%</small></dd></div>
      </dl>
      <article className="abc-card abc-card--wide live-activity" aria-labelledby="activity-title">
        <div className="abc-card-head">
          <h3 id="activity-title">Session activity · {formatLongDate(activity.date)}</h3>
          <span className="stat-chip stat-chip--neutral">Demo clock {activity.clock}</span>
        </div>
        <p className="abc-card-note">What is happening on the schedule right now, and which appointments still need documentation. Nothing here requires opening a session note.</p>
        <dl className="quality-kpis quality-kpis--compact" aria-label="Live session activity summary">
          <div className="kpi"><dt>Appointments today</dt><dd><strong>{activity.today}</strong><small>{activity.cancelled} cancelled · {activity.inProgress} in progress</small></dd></div>
          <div className="kpi"><dt>Observations recorded</dt><dd><strong>{activity.observations}</strong><small>{activity.targets} target{activity.targets === 1 ? '' : 's'} · {formatNumber(activity.minutesRecorded)} minutes of data</small></dd></div>
          <div className="kpi"><dt>Documentation</dt><dd><strong>{activity.documentationRate == null ? '–' : `${activity.documentationRate}%`}</strong>
            <small>{activity.documented} of {activity.today} appointments have data</small>
            <span className={`stat-chip stat-chip--${activity.pending.length ? 'attention' : 'positive'}`}>{activity.pending.length ? `${activity.pending.length} pending` : 'All clear'}</span></dd></div>
          <div className="kpi"><dt>Elapsed session time</dt><dd><strong>{formatNumber(activity.elapsedMinutes / 60)} h</strong><small>of {formatNumber(week.reduce((sum, day) => sum + day.minutes, 0) / 60)} h scheduled this week</small></dd></div>
        </dl>
        {activity.appointments.length ? <div className="data-table-scroll" tabIndex={0} role="region" aria-label="Today's appointments with recording progress">
          <table className="stat-table">
            <caption className="sr-only">Appointments on {activity.date} with recording progress and documentation status</caption>
            <thead><tr><th scope="col">Time</th><th scope="col">Appointment</th><th scope="col">Therapist</th><th scope="col">State</th><th scope="col">Observations</th><th scope="col">Documentation</th></tr></thead>
            <tbody>{activity.appointments.map(item => <tr key={item.id}>
              <td>{item.start}–{item.end}</td>
              <td>{item.setting} · {item.serviceCode}{item.settingEvents.length ? <small className="block text-slate-500">Setting events: {item.settingEvents.join(', ')}</small> : null}</td>
              <td>{item.therapistName}{item.supervision ? <small className="block text-slate-500">Supervised by {item.supervision}</small> : null}</td>
              <td><span className={`stat-chip stat-chip--${item.state === 'inProgress' ? 'attention' : item.cancelled ? 'muted' : 'neutral'}`}>{item.cancelled ? 'Cancelled' : item.state === 'inProgress' ? 'In progress' : item.state === 'upcoming' ? 'Upcoming' : 'Finished'}</span></td>
              <td>{item.observations ? `${item.observations} across ${item.targets} target${item.targets === 1 ? '' : 's'}` : '—'}
                {item.lastRecordedAt ? <small className="block text-slate-500">last {formatClock(item.lastRecordedAt)}</small> : null}</td>
              <td>{item.cancelled ? '—' : <><span className={`stat-chip stat-chip--${DOCUMENTATION_STATUSES[item.documentation].tone}`}>{DOCUMENTATION_STATUSES[item.documentation].label}</span>
                {item.minutesRecorded ? <small className="block text-slate-500">{formatNumber(item.minutesRecorded)} min recorded</small> : null}</>}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p className="field-hint">No appointments on the schedule for this fictional day.</p>}
        <div className="week-strip" role="img" aria-label="Observation counts for the last seven days">
          {week.map(day => <div key={day.date}>
            <span className="week-strip-bar" style={{ height: `${Math.max(3, Math.round((64 * day.observations) / weekPeak))}px` }} title={`${day.date}: ${day.observations} observations, ${day.appointments} appointments`} />
            <small>{day.date.slice(8)}</small>
            <span className="sr-only">{day.date}: {day.observations} observations across {day.appointments} appointments</span>
          </div>)}
        </div>
      </article>
      <div className="quality-grid">
        <article className="abc-card abc-card--wide" aria-labelledby="hours-title">
          <h3 id="hours-title">Weekly service hours</h3>
          <HoursChart weekly={weekly} authorized={client.authorizedHoursPerWeek} />
          <ul className="prompt-legend">{CODES.map(item => <li key={item.code}><i style={{ background: item.color }} />{item.label}</li>)}<li><i className="legend-hatch" />Cancelled</li><li><i className="legend-line" />Authorized</li></ul>
        </article>
        <article className="abc-card" aria-labelledby="ioa-trend-title">
          <h3 id="ioa-trend-title">Measurement quality by week</h3>
          <QualityChart weekly={weekly} coverageGoal={standards?.ioa?.minimumCoveragePercent ?? 20} fidelityGoal={fidelityMinimum} />
          <ul className="prompt-legend"><li><i style={{ background: '#527d82' }} />IOA coverage (% of sessions)</li><li><i style={{ background: '#a36959' }} />Fidelity (% of steps)</li></ul>
        </article>
        <article className="abc-card" aria-labelledby="cancel-title">
          <h3 id="cancel-title">Cancellations</h3>
          {cancellations.length ? <ul className="bar-list">{cancellations.map(([reason, count]) => <li key={reason}><span>{reason}</span><i style={{ width: `${(100 * count) / cancellations[0][1]}%`, background: '#9b7a3d' }} /><b>{count}</b></li>)}</ul>
            : <p className="field-hint">No cancelled sessions.</p>}
        </article>
        <article className="abc-card abc-card--wide" aria-labelledby="supervision-title">
          <h3 id="supervision-title">RBT supervision on this case</h3>
          <p className="abc-card-note">BACB: at least {minimum}% of each RBT’s monthly service hours supervised, with at least {contactsNeeded} contacts, one observing the RBT with a client. Overlap sessions below are on this client only.</p>
          <div className="data-table-scroll" tabIndex={0} role="region" aria-label="RBT supervision by month">
            <table className="stat-table">
              <caption className="sr-only">Supervision of RBT hours by month for {client.name}</caption>
              <thead><tr><th scope="col">Month</th><th scope="col">RBT</th><th scope="col">Direct hours</th><th scope="col">Supervised</th><th scope="col">Contacts</th><th scope="col">Status</th></tr></thead>
              <tbody>{supervision.flatMap(({ month, rows }) => rows.map((row, index) => {
                const meets = row.percent >= minimum && row.contacts >= contactsNeeded;
                return <tr key={`${month}-${row.name}`}>
                  {index === 0 ? <th scope="row" rowSpan={rows.length}>{monthLabel(month)}{month === asOfDate.slice(0, 7) ? <small className="block text-slate-500">in progress</small> : null}</th> : null}
                  <td>{row.name}</td><td>{formatNumber(row.minutes / 60)}</td><td>{formatNumber(row.supervised / 60)} h · {formatNumber(row.percent)}%</td><td>{row.contacts}</td>
                  <td><span className={`stat-chip stat-chip--${meets ? 'positive' : month === asOfDate.slice(0, 7) ? 'neutral' : 'attention'}`}>{meets ? 'Meets' : month === asOfDate.slice(0, 7) ? 'On track?' : 'Below'}</span></td>
                </tr>;
              }))}</tbody>
            </table>
          </div>
        </article>
      </div>
    </div>
  </section>;
}

function HoursChart({ weekly, authorized }) {
  const width = 820;
  const height = 230;
  const pad = { left: 44, right: 16, top: 14, bottom: 30 };
  const max = Math.max(authorized * 1.15, ...weekly.map(week => Object.values(week.hours).reduce((a, b) => a + b, 0) + week.cancelled)) || 1;
  const band = (width - pad.left - pad.right) / weekly.length;
  const y = value => pad.top + (1 - value / max) * (height - pad.top - pad.bottom);
  return <div className="chart-scroll" tabIndex={0} role="region" aria-label="Weekly service hours chart">
    <svg viewBox={`0 0 ${width} ${height}`} className="aux-chart" role="img" aria-label={`Weekly hours by service type for the last ${weekly.length} weeks against ${authorized} authorized hours per week.`}>
      <defs><pattern id="cancelled-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#b88d47" strokeWidth="1.6" /></pattern></defs>
      {[0, 0.25, 0.5, 0.75, 1].map(fraction => <g key={fraction}><line x1={pad.left} x2={width - pad.right} y1={y(max * fraction)} y2={y(max * fraction)} stroke={CHART_GRID} strokeDasharray="2 3" />
        <text x={pad.left - 6} y={y(max * fraction) + 3} textAnchor="end" fontSize="10" fill={CHART_MUTED} fontFamily={FONT}>{Math.round(max * fraction)}</text></g>)}
      {weekly.map((week, index) => {
        let top = height - pad.bottom;
        const x = pad.left + index * band + band * 0.2;
        const w = band * 0.6;
        const total = Object.values(week.hours).reduce((a, b) => a + b, 0);
        return <g key={week.week}>
          {CODES.map(({ code, color, label }) => {
            const value = week.hours[code];
            if (!value) return null;
            const h = (value / max) * (height - pad.top - pad.bottom);
            top -= h;
            return <rect key={code} x={x} y={top} width={w} height={h} fill={color}><title>{`Week of ${week.week}: ${formatNumber(value)} h ${label}`}</title></rect>;
          })}
          {week.cancelled > 0 && (() => {
            const h = (week.cancelled / max) * (height - pad.top - pad.bottom);
            top -= h;
            return <rect x={x} y={top} width={w} height={h} fill="url(#cancelled-hatch)" stroke="#b88d47"><title>{`Week of ${week.week}: ${formatNumber(week.cancelled)} h cancelled`}</title></rect>;
          })()}
          <text x={x + w / 2} y={top - 4} textAnchor="middle" fontSize="10" fill={CHART_INK} fontFamily={FONT}>{formatNumber(total)}</text>
          <text x={x + w / 2} y={height - 10} textAnchor="middle" fontSize="10" fill={CHART_MUTED} fontFamily={FONT}>{formatChartDate(week.week)}</text>
        </g>;
      })}
      <line x1={pad.left} x2={width - pad.right} y1={y(authorized)} y2={y(authorized)} stroke="#a34436" strokeWidth="1.6" strokeDasharray="6 4" />
      <text x={width - pad.right - 4} y={y(authorized) - 5} textAnchor="end" fontSize="10" fontWeight="600" fill="#863c30" fontFamily={FONT}>{authorized} h authorized</text>
    </svg>
  </div>;
}

function QualityChart({ weekly, coverageGoal, fidelityGoal }) {
  const width = 440;
  const height = 200;
  const pad = { left: 34, right: 12, top: 12, bottom: 28 };
  const x = index => pad.left + (index / Math.max(1, weekly.length - 1)) * (width - pad.left - pad.right);
  const y = value => pad.top + (1 - value / 100) * (height - pad.top - pad.bottom);
  const line = key => weekly.map((week, index) => ({ index, value: week[key] })).filter(point => point.value != null);
  const path = points => points.map((point, index) => `${index ? 'L' : 'M'} ${x(point.index)} ${y(point.value)}`).join(' ');
  return <div className="chart-scroll" tabIndex={0} role="region" aria-label="IOA coverage and fidelity by week">
    <svg viewBox={`0 0 ${width} ${height}`} className="aux-chart" role="img" aria-label="Weekly IOA coverage and mean procedural fidelity, with goal lines.">
      {[0, 25, 50, 75, 100].map(value => <g key={value}><line x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} stroke={CHART_GRID} strokeDasharray="2 3" />
        <text x={pad.left - 5} y={y(value) + 3} textAnchor="end" fontSize="10" fill={CHART_MUTED} fontFamily={FONT}>{value}</text></g>)}
      <line x1={pad.left} x2={width - pad.right} y1={y(coverageGoal)} y2={y(coverageGoal)} stroke="#527d82" strokeDasharray="6 3" opacity="0.7" />
      <line x1={pad.left} x2={width - pad.right} y1={y(fidelityGoal)} y2={y(fidelityGoal)} stroke="#a36959" strokeDasharray="6 3" opacity="0.7" />
      <path d={path(line('ioa'))} fill="none" stroke="#527d82" strokeWidth="2" />
      <path d={path(line('fidelity'))} fill="none" stroke="#a36959" strokeWidth="2" />
      {line('ioa').map(point => <circle key={`i${point.index}`} cx={x(point.index)} cy={y(point.value)} r="3" fill="#527d82"><title>{`Week of ${weekly[point.index].week}: IOA in ${Math.round(point.value)}% of sessions`}</title></circle>)}
      {line('fidelity').map(point => <circle key={`f${point.index}`} cx={x(point.index)} cy={y(point.value)} r="3" fill="#a36959"><title>{`Week of ${weekly[point.index].week}: fidelity ${formatNumber(point.value)}%`}</title></circle>)}
      {weekly.map((week, index) => index % 3 === 0 && <text key={week.week} x={x(index)} y={height - 8} textAnchor="middle" fontSize="10" fill={CHART_MUTED} fontFamily={FONT}>{formatChartDate(week.week)}</text>)}
    </svg>
  </div>;
}
