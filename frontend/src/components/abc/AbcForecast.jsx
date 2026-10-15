import { useMemo, useState } from 'react';
import { ForestPlot } from './AbcVisuals';
import { buildSessionDataset, trainSessionForecastModel, forecastTrend, weeksUntilBelow, abcExamples, trainNaiveBayes, evaluateNaiveBayes } from '../../utils/predictiveModels';
import { formatNumber, formatLongDate } from '../../utils/targetAnalytics';
import { addDays, dayNumber } from '../../utils/stats';
import { CHART_GRID, CHART_MUTED, CHART_INK } from '../../utils/chartTheme';

const FONT = 'Geist, sans-serif';

// Transparent forecasting from the behavior data and ABC context. Every model reports
// how it performed on later, unseen sessions before its predictions are shown.
export default function AbcForecast({ entries, config, behaviorTargets, serviceSessions, sessionRows, primarySetting }) {
  const [targetId, setTargetId] = useState(behaviorTargets[0]?.id || '');
  const target = behaviorTargets.find(item => item.id === targetId) || behaviorTargets[0];
  const [scenario, setScenario] = useState({});
  const [hours, setHours] = useState('typical');
  const interval = target?.type === 'IntervalData';
  const since = target?.phaseHistory?.find(entry => entry.phase === 'Acquisition')?.date || null;
  const dataset = useMemo(() => target ? buildSessionDataset({ sessions: serviceSessions, rows: sessionRows, target, primarySetting, since }) : [], [serviceSessions, sessionRows, target, primarySetting, since]);
  const model = useMemo(() => trainSessionForecastModel(dataset), [dataset]);
  const series = useMemo(() => sessionRows.filter(row => row.targetId === target?.id && row.value != null).map(row => ({
    date: row.timestamp.slice(0, 10), count: interval ? row.occurredIntervals : row.occurrenceCount,
    exposure: interval ? row.totalIntervals : row.lessonDurationMinutes / 60
  })), [sessionRows, target, interval]);
  const trend = useMemo(() => forecastTrend(series, { weeks: 8, horizonWeeks: 2 }), [series]);
  const examples = useMemo(() => abcExamples(entries), [entries]);
  const bayes = useMemo(() => trainNaiveBayes(examples, example => example.behavior), [examples]);
  const evaluation = useMemo(() => evaluateNaiveBayes(examples, example => example.behavior), [examples]);
  const [situation, setSituation] = useState({ antecedent: '', location: '', block: '', events: '' });
  if (!target) return <p className="field-hint">No behavior-reduction targets are defined for this client.</p>;

  const exposure = interval ? model.typicalExposure : hours === 'typical' ? model.typicalExposure : Number(hours);
  const prediction = !model.insufficient ? model.predict(scenario, { exposure }) : null;
  const calm = !model.insufficient ? model.predict({}, { exposure }) : null;
  const unitNoun = interval ? 'scored intervals' : 'episodes';
  const quality = model.insufficient ? null : model.improvement >= 0.05 ? ['positive', 'More accurate than the recent average']
    : model.improvement > -0.05 ? ['neutral', 'Similar to the recent average'] : ['attention', 'Less accurate than the recent average'];
  const rule = target.masteryRule;
  const perSessionThreshold = rule?.measure === 'count' ? rule.threshold : null;
  const weeks = perSessionThreshold != null ? weeksUntilBelow(trend, perSessionThreshold) : null;
  const situationFeatures = {
    antecedents: situation.antecedent ? [situation.antecedent] : [], location: situation.location || null,
    block: situation.block || null, events: situation.events ? [situation.events] : ['None reported']
  };
  const likely = bayes.n ? bayes.predict(situationFeatures) : [];
  const blocks = [...new Set(examples.map(example => example.features.block))].sort();
  const locations = [...new Set(examples.map(example => example.features.location))].sort();

  return <div className="abc-forecast">
    <div className="abc-patterns-toolbar">
      <div className="control-field"><label htmlFor="forecast-behavior">Forecast behavior</label>
        <select id="forecast-behavior" value={target.id} onChange={event => { setTargetId(event.target.value); setScenario({}); }}>
          {behaviorTargets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></div>
      <p className="field-hint">Models train on treatment-phase sessions{since ? ` since ${formatLongDate(since)}` : ''} and are checked against later sessions they never saw.</p>
    </div>
    <div className="abc-grid">
      <article className="abc-card abc-card--wide" aria-labelledby="forecast-next">
        <h3 id="forecast-next">Next-session outlook</h3>
        {model.insufficient ? <p className="field-hint">At least {35} measured sessions are needed; {model.n} are available.</p> : <div className="forecast-layout">
          <fieldset className="scenario">
            <legend>Planned session</legend>
            {!interval && <div className="control-field"><label htmlFor="forecast-length">Session length</label>
              <select id="forecast-length" value={hours} onChange={event => setHours(event.target.value)}>
                <option value="typical">Typical ({formatNumber(model.typicalExposure)} h)</option>{[1, 2, 3, 4].map(value => <option key={value} value={value}>{value} hours</option>)}
              </select></div>}
            {model.features.map(feature => <label key={feature.key} className="popover-option scenario-option">
              <input type="checkbox" checked={Boolean(scenario[feature.key])} onChange={event => setScenario(previous => ({ ...previous, [feature.key]: event.target.checked }))} />
              <span>{feature.label}<small className="block text-slate-500">{feature.group}</small></span>
            </label>)}
          </fieldset>
          <div className="forecast-result" aria-live="polite">
            <span>Expected {unitNoun}</span>
            <strong>{formatNumber(prediction.expected, 1)}</strong>
            <p>80% range {prediction.low}–{prediction.high} {unitNoun}{interval ? ` of ${formatNumber(exposure, 0)}` : ` in ${formatNumber(exposure)} h`}</p>
            {Object.values(scenario).some(Boolean) && <p className="forecast-delta">×{formatNumber(prediction.expected / Math.max(1e-9, calm.expected), 2)} compared with the same session without these conditions</p>}
            <p className="forecast-trend">Trend: ×{formatNumber(model.weeklyChange, 2)} per week{model.weeklyChangeInterval ? ` (95% CI ×${formatNumber(model.weeklyChangeInterval[0], 2)}–×${formatNumber(model.weeklyChangeInterval[1], 2)})` : ''}</p>
          </div>
          <div className="forecast-drivers">
            <h4>What changes the expected rate</h4>
            <ForestPlot effects={model.rateRatios.map(item => ({ label: item.label, ratio: item.ratio, low: item.low, high: item.high, n: item.n }))} />
          </div>
          <div className="model-card">
            <h4>Model check <span className={`stat-chip stat-chip--${quality[0]}`}>{quality[1]}</span></h4>
            <p>Tested on {model.testN} later sessions ({formatLongDate(model.testPeriod[0])} – {formatLongDate(model.testPeriod[1])}): average error {formatNumber(model.maeModel, 2)} vs {formatNumber(model.maeNaive, 2)} for the last-five-session average ({model.improvement >= 0 ? `${Math.round(model.improvement * 100)}% lower` : `${Math.round(-model.improvement * 100)}% higher`}). 80% ranges contained {Math.round(model.coverage * 100)}% of outcomes.</p>
            <p className="analysis-footnote">Poisson regression with an exposure offset, a time trend and session context, refit every four sessions (rolling origin). Small samples make individual forecasts uncertain; use them to plan support, not to make clinical decisions.</p>
          </div>
        </div>}
      </article>
      <article className="abc-card abc-card--wide" aria-labelledby="forecast-trend">
        <h3 id="forecast-trend">Two-week outlook</h3>
        {trend ? <>
          <TrendChart series={series} trend={trend} interval={interval} />
          <p className="abc-card-note">Expected {interval ? `${formatNumber(trend.current.rate * 100)}% of intervals` : `${formatNumber(trend.current.rate, 2)} ${unitNoun} per hour`} now, changing ×{formatNumber(trend.weeklyChange, 2)} per week over the last {trend.window} sessions.
            {perSessionThreshold != null && (weeks === 0 ? ` A typical session already averages at or below the criterion level (≤ ${perSessionThreshold} per session); the rule also needs ${rule.consecutiveSessions} consecutive sessions.`
              : weeks != null ? ` At this pace a typical session averages ≤ ${perSessionThreshold} per session around ${formatLongDate(addDays(series.at(-1).date, Math.round(weeks * 7)))}.` : ' At this pace the criterion level is not reached within six months.')}</p>
        </> : <p className="field-hint">Not enough recent sessions to project a trend.</p>}
      </article>
      <article className="abc-card abc-card--wide" aria-labelledby="forecast-likely">
        <h3 id="forecast-likely">Which behavior is likely in a situation?</h3>
        <div className="situation-grid">
          <div className="control-field"><label htmlFor="situation-antecedent">Antecedent</label><select id="situation-antecedent" value={situation.antecedent} onChange={event => setSituation(previous => ({ ...previous, antecedent: event.target.value }))}><option value="">Any</option>{(config?.antecedents || []).map(item => <option key={item} value={item}>{item}</option>)}</select></div>
          <div className="control-field"><label htmlFor="situation-location">Location</label><select id="situation-location" value={situation.location} onChange={event => setSituation(previous => ({ ...previous, location: event.target.value }))}><option value="">Any</option>{locations.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
          <div className="control-field"><label htmlFor="situation-time">Time of day</label><select id="situation-time" value={situation.block} onChange={event => setSituation(previous => ({ ...previous, block: event.target.value }))}><option value="">Any</option>{blocks.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
          <div className="control-field"><label htmlFor="situation-event">Setting event</label><select id="situation-event" value={situation.events} onChange={event => setSituation(previous => ({ ...previous, events: event.target.value }))}><option value="">None reported</option>{(config?.settingEvents || []).map(item => <option key={item} value={item}>{item}</option>)}</select></div>
        </div>
        <ul className="likely-list">{likely.map(item => <li key={item.label}><span>{item.label}</span><i style={{ width: `${Math.max(2, item.probability * 100)}%` }} /><b>{Math.round(item.probability * 100)}%</b></li>)}</ul>
        {!evaluation.insufficient && <p className="abc-card-note">Naive Bayes over antecedents, location, time, weekday and setting events. On the latest {evaluation.testN} records it named the right behavior {Math.round(evaluation.accuracy * 100)}% of the time (top two: {Math.round(evaluation.topTwo * 100)}%) versus {Math.round(evaluation.majorityAccuracy * 100)}% by always guessing “{evaluation.majority}”{evaluation.pValue < 0.05 ? '' : ' — not a reliable improvement yet'}.</p>}
      </article>
    </div>
  </div>;
}

function TrendChart({ series, trend, interval }) {
  const width = 760;
  const height = 230;
  const pad = { left: 52, right: 24, top: 16, bottom: 30 };
  const lastDate = series.at(-1).date;
  const start = addDays(lastDate, -84);
  const weekly = new Map();
  for (const point of series) {
    if (point.date < start) continue;
    const week = Math.floor((dayNumber(point.date) - dayNumber(start)) / 7);
    const current = weekly.get(week) || { count: 0, exposure: 0, days: [] };
    weekly.set(week, { count: current.count + point.count, exposure: current.exposure + point.exposure, days: [...current.days, dayNumber(point.date)] });
  }
  const factor = interval ? 100 : 1;
  const observed = [...weekly.values()].map(value => ({ day: Math.round(value.days.reduce((a, b) => a + b, 0) / value.days.length), rate: (factor * value.count) / value.exposure }));
  const projection = trend.forecast.map(point => ({ day: dayNumber(lastDate) + point.weeksAhead * 7, rate: factor * point.rate, low: factor * point.rateLow, high: factor * point.rateHigh }));
  const history = [-8, -6, -4, -2].map(weeks => ({ day: dayNumber(lastDate) + weeks * 7, rate: factor * trend.at(weeks).rate }));
  const maxRate = Math.max(0.1, ...observed.map(point => point.rate), ...projection.map(point => point.high)) * 1.1;
  const x = day => pad.left + ((day - dayNumber(start)) / (dayNumber(lastDate) + 14 - dayNumber(start))) * (width - pad.left - pad.right);
  const y = rate => pad.top + (1 - rate / maxRate) * (height - pad.top - pad.bottom);
  const band = [...projection.map(point => `${x(point.day)},${y(point.high)}`), ...[...projection].reverse().map(point => `${x(point.day)},${y(point.low)}`)].join(' ');
  return <div className="chart-scroll" tabIndex={0} role="region" aria-label="Weekly rate with a two-week projection">
    <svg viewBox={`0 0 ${width} ${height}`} className="aux-chart" role="img" aria-label={`Weekly ${interval ? 'percent of intervals' : 'episodes per hour'} for the last 12 weeks with a two-week projection and 80% band.`}>
      {[0, 0.25, 0.5, 0.75, 1].map(fraction => <g key={fraction}><line x1={pad.left} x2={width - pad.right} y1={y(maxRate * fraction)} y2={y(maxRate * fraction)} stroke={CHART_GRID} strokeDasharray="2 3" />
        <text x={pad.left - 6} y={y(maxRate * fraction) + 3} textAnchor="end" fontSize="10" fill={CHART_MUTED} fontFamily={FONT}>{formatNumber(maxRate * fraction, maxRate < 2 ? 2 : 1)}</text></g>)}
      <rect x={x(dayNumber(lastDate))} y={pad.top} width={x(dayNumber(lastDate) + 14) - x(dayNumber(lastDate))} height={height - pad.top - pad.bottom} fill="#697b96" opacity="0.06" />
      <polygon points={band} fill="#697b96" opacity="0.18" />
      <path d={[...history, ...projection].map((point, index) => `${index ? 'L' : 'M'} ${x(point.day)} ${y(point.rate)}`).join(' ')} fill="none" stroke="#4b5a73" strokeWidth="2" strokeDasharray="5 4" />
      {observed.map(point => <circle key={point.day} cx={x(point.day)} cy={y(point.rate)} r="4" fill="#346b52"><title>{`Week around ${addDays(start, point.day - dayNumber(start))}: ${formatNumber(point.rate, 2)}${interval ? '%' : ' per hour'}`}</title></circle>)}
      <text x={x(dayNumber(lastDate) + 7)} y={pad.top + 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="#4b5a73" fontFamily={FONT}>Projection</text>
      {[0, 28, 56, 84, 98].map(offset => <text key={offset} x={x(dayNumber(start) + offset)} y={height - 8} textAnchor="middle" fontSize="10" fill={CHART_MUTED} fontFamily={FONT}>{addDays(start, offset).slice(5)}</text>)}
      <text x={-(height / 2)} y="12" transform="rotate(-90)" textAnchor="middle" fontSize="11" fontWeight="500" fill={CHART_INK} fontFamily={FONT}>{interval ? '% of intervals' : 'Per hour'}</text>
    </svg>
  </div>;
}
