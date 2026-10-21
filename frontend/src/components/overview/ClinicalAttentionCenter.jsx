import SectionHeader from '../ui/SectionHeader';
import { CheckCircle2 } from '../ui/Icons';
import { MEASUREMENT_LABELS } from '../../utils/formValidation';
import { deltaText } from '../../utils/targetHealth';

// Accessible mini sparkline from the same weekly points used for the trend fit.
function Sparkline({ points, tone }) {
  const values = points.slice(-12).map(point => point.val).filter(value => Number.isFinite(value));
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coordinates = values
    .map((value, index) => {
      const x = 2 + (index / (values.length - 1)) * 116;
      const y = 28 - 2 - ((value - min) / span) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg className={`health-spark health-spark--${tone}`} viewBox="0 0 120 32" role="img"
      aria-label={`Sparkline of ${values.length} weekly values ending at ${values.at(-1)}`}>
      <polyline points={coordinates} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Ranked triage cards. The leading flag sets the card tone; every card opens the target's
// chart through the existing focus-request drilldown (no new navigation mechanism).
export default function ClinicalAttentionCenter({ items = [], onOpen, onViewAll, rangePhrase = 'the last 90 days' }) {
  return (
    <section className="panel" aria-labelledby="attention-title">
      <SectionHeader id="attention-title" title="Clinical attention center"
        description={`Targets that need a clinical look, ranked by severity over ${rangePhrase}.`}
        help="Cards combine direction-aware trend checks with plateau, variability, staleness and post-mastery regression rules. A behavior that is decreasing reads as improving. Select any card to open that target's chart."
        actions={<button type="button" className="button button--tertiary" onClick={onViewAll}>View all</button>} />
      <div className="panel-body">
        {!items.length ? (
          <div className="attention-empty">
            <CheckCircle2 size={24} aria-hidden="true" />
            <p><strong>No items currently need review.</strong> Keep collecting data; new plateau, variability or staleness signals will appear here.</p>
          </div>
        ) : (
          <div className="attention-grid">
            {items.map(item => {
              const lead = item.flags[0];
              const tone = lead?.tone === 'negative' ? 'negative' : 'attention';
              const reason = item.flags.map(flag => flag.label).join(' · ');
              return (
                <button type="button" key={item.targetId} className={`attention-card attention-card--${tone}`}
                  aria-label={`${item.targetName}, ${reason}. Open in target analysis.`}
                  onClick={() => onOpen(item)}>
                  <span className="attention-card__top">
                    <span className={`stat-chip stat-chip--${tone}`}>{lead.label}</span>
                    <span className={`attention-card__delta health-delta health-delta--${tone}`}>{deltaText(item)}</span>
                  </span>
                  <strong className="attention-card__name">{item.targetName}</strong>
                  <span className="attention-card__meta">{item.programName} · {MEASUREMENT_LABELS[item.measurementType]}</span>
                  <span className="attention-card__reason">{reason}</span>
                  <Sparkline points={item.points} tone={tone} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
