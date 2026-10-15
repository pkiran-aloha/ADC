import { useMemo, useState } from 'react';
import SegmentedControl from '../ui/SegmentedControl';
import { calculateMetricPoint, getObservationKey } from '../../utils/analyticsMetrics';
import { formatChartDate, heatColor } from '../../utils/chartTheme';
import { addDays } from '../../utils/stats';
import { MEASUREMENT_LABELS } from '../../utils/formValidation';

const WEEKS = 12;
// Natural unit per measurement tool for the weekly summary.
const VIEW = { TrialByTrial: {}, IntervalData: {}, Duration: { durationView: 'Total Duration' }, Frequency: { frequencyView: 'Rate per Hour' }, FluencyRate: { rateView: 'Rate per Minute' } };

function weeklyValue(rows, type) {
  const view = VIEW[type] || {};
  if (type === 'Duration') {
    const average = rows.reduce((total, row) => total + (row.durationSeconds || 0), 0) / rows.length;
    return { value: average, label: average >= 90 ? `${Math.round(average / 6) / 10}m` : `${Math.round(average)}s` };
  }
  const point = calculateMetricPoint('week', rows, type, view.durationView, view.rateView, view.frequencyView);
  const label = type === 'TrialByTrial' || type === 'IntervalData' ? `${point.val}%` : type === 'FluencyRate' ? `${Math.round(point.val)}/m` : `${Math.round(point.val * 10) / 10}/h`;
  return { value: point.val, label };
}

function ruleThreshold(target) {
  const rule = target.masteryRule;
  if (!rule) return null;
  if (rule.measure === 'intervalCount' && target.intervalSettings?.numberOfIntervals) return (100 * rule.threshold) / target.intervalSettings.numberOfIntervals;
  if (['percentCorrect', 'percentIntervals', 'ratePerHour', 'correctPerMinute', 'durationSeconds'].includes(rule.measure)) return rule.threshold;
  return null;
}

// Each cell summarizes one target-week relative to its own goal (skills) or its own
// baseline (behaviors), so different measurement tools can share one color scale.
export default function ProgressHeatmap({ programs, sessions, asOfDate, onOpen }) {
  const [rowsKind, setRowsKind] = useState('SkillAcquisition');
  const weeks = useMemo(() => {
    const last = getObservationKey({ timestamp: `${asOfDate}T12:00:00` }, 'Weekly');
    return Array.from({ length: WEEKS }, (_, index) => addDays(last, -7 * (WEEKS - 1 - index)));
  }, [asOfDate]);
  const table = useMemo(() => {
    const rows = [];
    for (const program of programs.filter(item => item.category === rowsKind)) {
      for (const target of program.targets) {
        if (target.type === 'Anecdotal') continue;
        const all = sessions.filter(row => row.targetId === target.id && row.value != null);
        if (!all.some(row => row.timestamp.slice(0, 10) >= weeks[0])) continue;
        const baselineEnd = target.phaseHistory?.find(entry => entry.phase !== 'Baseline')?.date;
        const baselineRows = all.filter(row => !baselineEnd || row.timestamp.slice(0, 10) < baselineEnd);
        const baseline = baselineRows.length ? weeklyValue(baselineRows, target.type).value : null;
        const threshold = ruleThreshold(target);
        const cells = weeks.map(week => {
          const weekRows = all.filter(row => getObservationKey(row, 'Weekly') === week);
          if (!weekRows.length) return { week, empty: true };
          const { value, label } = weeklyValue(weekRows, target.type);
          const transitions = (target.phaseHistory || []).filter(entry => entry.date >= week && entry.date <= addDays(week, 6));
          let score;
          if (rowsKind === 'BehaviorReduction') score = baseline ? Math.max(0, Math.min(1, 1 - value / baseline)) : 0.5;
          else score = threshold ? Math.max(0, Math.min(1, value / threshold)) : 0.5;
          return { week, value, label, score, n: weekRows.length, transitions };
        });
        rows.push({ program, target, cells, baseline, threshold });
      }
    }
    return rows;
  }, [programs, sessions, weeks, rowsKind]);

  return <section className="panel progress-heatmap" aria-labelledby="heatmap-title">
    <header className="panel-header">
      <div className="panel-heading">
        <h2 id="heatmap-title">Weekly progress map</h2>
        <p>{rowsKind === 'SkillAcquisition' ? 'Darker cells are closer to the mastery criterion.' : 'Darker cells are further below the behavior’s baseline level.'} Select a cell to open that target and week in the target analysis.</p>
      </div>
      <div className="panel-actions">
        <SegmentedControl label="Progress map rows" value={rowsKind} onChange={setRowsKind}
          options={[{ value: 'SkillAcquisition', label: 'Skills' }, { value: 'BehaviorReduction', label: 'Behaviors' }]} />
      </div>
    </header>
    <div className="panel-body">
      {!table.length ? <p className="field-hint">No measured observations in the last {WEEKS} weeks.</p> : <div className="data-table-scroll heat-scroll" tabIndex={0} role="region" aria-label="Weekly progress map. Scroll horizontally to see all weeks.">
        <table className="heat-table progress-table">
          <caption className="sr-only">Weekly summary for each target over the last {WEEKS} weeks</caption>
          <thead><tr><th scope="col" className="heat-corner">Target</th>{weeks.map(week => <th key={week} scope="col">{formatChartDate(week)}</th>)}</tr></thead>
          <tbody>{table.map(({ program, target, cells, baseline, threshold }) => <tr key={target.id}>
            <th scope="row"><span className="heat-row-label">{target.name}<small>{rowsKind === 'SkillAcquisition' ? program.name : target.functionHypothesis ? `${target.functionHypothesis} function` : ''} · {MEASUREMENT_LABELS[target.type]} · {target.phase}</small></span></th>
            {cells.map(cell => {
              if (cell.empty) return <td key={cell.week}><span className="heat-cell heat-cell--empty" aria-label={`${target.name}, week of ${formatChartDate(cell.week)}: no observations`}>·</span></td>;
              const style = heatColor(0.12 + cell.score * 0.88);
              const context = rowsKind === 'BehaviorReduction' ? (baseline ? `baseline ${Math.round(baseline * 10) / 10}` : '') : (threshold ? `criterion ${Math.round(threshold * 10) / 10}` : '');
              const label = `${target.name}, week of ${formatChartDate(cell.week, 'Weekly')}: ${cell.label} across ${cell.n} ${cell.n === 1 ? 'session' : 'sessions'}${context ? ` (${context})` : ''}${cell.transitions.length ? `; phase change to ${cell.transitions.map(entry => entry.phase).join(', ')}` : ''}. Open in target analysis.`;
              return <td key={cell.week}><button type="button" className="heat-cell" style={style} aria-label={label} title={label}
                onClick={() => onOpen({ program, target, week: cell.week })}>
                {cell.label}{cell.transitions.length > 0 && <i className="phase-marker" aria-hidden="true" />}
              </button></td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>}
      <p className="analysis-footnote">Weekly values use each tool’s natural unit: % correct or % of intervals, average seconds per session, responses per hour or per minute. A dot marks a phase change that week.</p>
    </div>
  </section>;
}
