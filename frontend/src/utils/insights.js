// Data-based decision prompts (BACB TCO H.5-H.7, G.8, C.7, C.8). Each insight states the
// data pattern and a conventional next step; none of them changes the program.
import { mean, median, linearRegression } from './stats.js';
import { stabilityEnvelope, describeRule } from './visualAnalysis.js';
import { formatLongDate, formatNumber } from './targetAnalytics.js';

const LEAST_INTRUSIVE = { 'least-to-most': 'G', 'most-to-least': 'G', 'verbal-fading': 'S' };

export function buildInsights({ target, isBehavior, points, rows, evaluation, comparison, template, ioa, projection, scale = 100, standards }) {
  const insights = [];
  const phase = target?.phase;
  const recent = points.slice(-10);
  const unit = isBehavior ? '' : target?.type === 'TrialByTrial' || target?.type === 'IntervalData' ? ' percentage points' : '';

  if (evaluation?.met) {
    const promoted = (target.phaseHistory || []).some(entry => ['Maintenance', 'Generalization', 'Completed'].includes(entry.phase) && entry.date > evaluation.metDate);
    if (!promoted && ['Acquisition', 'Baseline'].includes(phase) && target.masterySettings === 'Manual') {
      insights.push({ tone: 'attention', title: `Mastery criterion met on ${formatLongDate(evaluation.metDate)}`,
        detail: `The data meet “${describeRule(evaluation.rule)}”. This target uses manual mastery, so it stays in ${phase.toLowerCase()} until a supervisor reviews it.`, reference: 'TCO H.7' });
    } else if (promoted || ['Maintenance', 'Generalization', 'Completed'].includes(phase)) {
      insights.push({ tone: 'positive', title: `Criterion first met after ${evaluation.sessionsToCriterion} teaching sessions`,
        detail: `${evaluation.trialsToCriterion ? `${evaluation.trialsToCriterion} trials and ` : ''}${evaluation.daysToCriterion ?? '–'} days from the start of teaching to criterion (${formatLongDate(evaluation.metDate)}). Use this efficiency measure to compare procedures across targets.`, reference: 'TCO C.7' });
    }
  } else if (evaluation && phase === 'Acquisition' && evaluation.sessions > 0) {
    insights.push({ tone: 'neutral', title: `${evaluation.streak} of ${evaluation.required} consecutive sessions at criterion`,
      detail: `Rule: ${describeRule(evaluation.rule)}. ${evaluation.sessions} teaching sessions so far.`, reference: 'Mastery rule' });
  }

  if (projection?.date && !evaluation?.met && phase === 'Acquisition') {
    insights.push({ tone: 'neutral', title: `At the current trend, criterion level is reached around ${formatLongDate(projection.date)}`,
      detail: `Linear projection of the plotted data (${formatNumber(projection.slopePerWeek)} per week). Projections assume conditions stay the same; use them for planning, not as a promise.`, reference: 'Trend projection' });
  }

  if (!isBehavior && phase === 'Acquisition' && recent.length >= 8) {
    const fit = linearRegression(recent.map((point, index) => ({ x: index, y: point.y })));
    const change = fit ? fit.slope * (recent.length - 1) : 0;
    if (fit && Math.abs(change) < 0.05 * scale) {
      insights.push({ tone: 'attention', title: `No meaningful trend in the last ${recent.length} observations`,
        detail: `Fitted change of ${formatNumber(change)}${unit} across those sessions. Consider modifying the teaching procedure (prompting, reinforcement, task difficulty) before continuing unchanged.`, reference: 'TCO H.7' });
    }
  }

  if (recent.length >= 6 && !isBehavior) {
    const envelope = stabilityEnvelope(recent.map((point, index) => ({ x: index, y: point.y })), { around: 'trend' });
    if (envelope && !envelope.stable) {
      insights.push({ tone: 'attention', title: 'Variable responding',
        detail: `Only ${Math.round(envelope.percentWithin)}% of recent points fall within ±25% of the trend line. Check procedural fidelity, session conditions and motivating operations before changing the program.`, reference: 'Lane & Gast (2014)' });
    }
  }

  if (template && rows.length >= 5 && phase === 'Acquisition') {
    const last = rows.slice(-5);
    const sequence = last.map(row => row.trialSequence || '').join('');
    const prompted = [...sequence].filter(code => code !== 'I');
    const independent = sequence.length ? ([...sequence].filter(code => code === 'I').length / sequence.length) : 1;
    const lightest = LEAST_INTRUSIVE[template.id];
    const share = prompted.length ? prompted.filter(code => code === lightest).length / prompted.length : 0;
    if (independent < 0.6 && share >= 0.5) {
      const level = template.levels[template.codes.indexOf(lightest)]?.toLowerCase();
      insights.push({ tone: 'attention', title: 'Possible prompt dependency',
        detail: `${Math.round(share * 100)}% of prompted trials in the last five sessions needed only a ${level}, yet independence is ${Math.round(independent * 100)}%. Consider a progressive prompt delay or fading the ${level} faster.`, reference: 'TCO G.8' });
    }
  }

  if (isBehavior && comparison?.A && comparison?.B) {
    const firstThree = comparison.B.firstThree;
    if (firstThree > comparison.A.mean * 1.2) {
      insights.push({ tone: 'neutral', title: 'Initial increase after the condition change',
        detail: `The first treatment observations averaged ${formatNumber(firstThree)}, above the baseline mean of ${formatNumber(comparison.A.mean)}. A transient increase is consistent with an extinction burst; look for the later decrease before changing course.`, reference: 'Lerman & Iwata (1995)' });
    }
  }

  if (isBehavior && points.length >= 8) {
    const lastMonth = points.slice(-12);
    const fit = linearRegression(lastMonth.map((point, index) => ({ x: index, y: point.y })));
    const average = mean(lastMonth.map(point => point.y));
    if (fit && average > 0) {
      const relative = (fit.slope * (lastMonth.length - 1)) / average;
      if (relative <= -0.3) insights.push({ tone: 'positive', title: 'Behavior is decreasing', detail: `The recent trend fell by about ${Math.round(-relative * 100)}% across the last ${lastMonth.length} observations.`, reference: 'Visual analysis' });
      else if (relative >= 0.3) insights.push({ tone: 'attention', title: 'Behavior is increasing', detail: `The recent trend rose by about ${Math.round(relative * 100)}% across the last ${lastMonth.length} observations. Review setting events, treatment integrity and reinforcement schedules.`, reference: 'TCO H.5–H.7' });
    }
    const typical = median(points.map(point => point.y));
    const spikes = points.filter(point => point.afterBreak && point.y > Math.max(1, typical * 1.5));
    if (spikes.length) {
      insights.push({ tone: 'neutral', title: `Higher after ${spikes.length === 1 ? 'a break' : 'breaks'} in services`,
        detail: `${spikes.map(point => formatLongDate(point.date)).join(', ')} followed a gap of a week or more and exceeded 1.5× the typical level—consistent with resurgence. Plan booster sessions after scheduled breaks.`, reference: 'TCO H.5' });
    }
  }

  if (phase === 'Generalization' && comparison?.A && comparison?.B && comparison.level.change < -0.1 * scale && !isBehavior) {
    insights.push({ tone: 'attention', title: 'Generalization probes are below earlier levels',
      detail: `The current condition averages ${formatNumber(comparison.B.mean)} versus ${formatNumber(comparison.A.mean)} before. Program common stimuli or train additional exemplars.`, reference: 'TCO G.15' });
  }

  if (ioa && ioa.sessions >= 5) {
    const minimum = standards?.ioa?.minimumCoveragePercent ?? 20;
    if (ioa.coverage < minimum) {
      insights.push({ tone: 'attention', title: `IOA collected in ${Math.round(ioa.coverage)}% of sessions`,
        detail: `Collect interobserver agreement in at least ${minimum}% of sessions (preferably 25–33%) across all phases.`, reference: 'TCO C.8' });
    }
    if (ioa.mean != null && ioa.mean < (standards?.ioa?.minimumAgreementPercent ?? 80)) {
      insights.push({ tone: 'attention', title: `Mean IOA ${formatNumber(ioa.mean)}%`, detail: 'Agreement is below 80%. Review the operational definition and retrain observers before interpreting changes.', reference: 'TCO C.8' });
    }
  }
  return insights;
}
