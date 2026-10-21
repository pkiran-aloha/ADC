import { TrendingUp, Activity, Target, AlertTriangle } from '../ui/Icons';

// Five portfolio status cards. Each card is a filter for the health matrix, so a reviewer
// moves from "how is the learner doing?" to the items behind the number in one click.
const CARDS = [
  {
    id: 'improving', tone: 'positive', icon: TrendingUp, label: 'Improving',
    value: kpis => `${kpis.improving.percent}%`,
    note: kpis => `${kpis.improving.count} of ${kpis.classifiableTotal} active item${kpis.classifiableTotal === 1 ? '' : 's'}`,
    count: kpis => kpis.improving.count
  },
  {
    id: 'stable', tone: 'neutral', icon: Activity, label: 'Stable',
    value: kpis => `${kpis.stable.percent}%`,
    note: kpis => `${kpis.stable.count} item${kpis.stable.count === 1 ? '' : 's'} without a meaningful trend`,
    count: kpis => kpis.stable.count
  },
  {
    id: 'declining', tone: 'negative', icon: TrendingUp, iconFlip: true, label: 'Declining',
    value: kpis => `${kpis.declining.percent}%`,
    note: kpis => `${kpis.declining.count} moving in the wrong direction`,
    count: kpis => kpis.declining.count
  },
  {
    id: 'nearMastery', tone: 'positive', icon: Target, label: 'Near mastery',
    value: kpis => String(kpis.nearMastery),
    note: () => 'Criterion close or streak nearly met',
    count: kpis => kpis.nearMastery
  },
  {
    id: 'needsReview', tone: 'attention', icon: AlertTriangle, label: 'Needs review',
    value: kpis => String(kpis.needsReview),
    note: () => 'Flags across the whole portfolio',
    count: kpis => kpis.needsReview
  }
];

export default function ClientKpiStrip({ kpis, activeFilter, onFilterChange, rangePhrase = 'the last 90 days' }) {
  return (
    <div className="kpi-strip" role="group" aria-label={`Portfolio status for ${rangePhrase}`}>
      {CARDS.map(card => {
        const Icon = card.icon;
        const count = card.count(kpis);
        const pressed = activeFilter === card.id;
        const description = card.note(kpis);
        return (
          <button
            type="button"
            key={card.id}
            data-filter={card.id}
            className={`kpi-card kpi-card--${card.tone}${pressed ? ' kpi-card--active' : ''}`}
            aria-pressed={pressed}
            disabled={count === 0}
            aria-label={`${card.label}: ${card.value(kpis)}. ${description}. Filter the target health matrix.`}
            onClick={() => onFilterChange(pressed ? null : card.id)}
          >
            <span className="kpi-card__top">
              <span className="kpi-card__label">{card.label}</span>
              <Icon size={18} className={card.iconFlip ? 'kpi-card__icon kpi-card__icon--flip' : 'kpi-card__icon'} aria-hidden="true" />
            </span>
            <strong className="kpi-card__value">{card.value(kpis)}</strong>
            <span className="kpi-card__note">{description}</span>
          </button>
        );
      })}
    </div>
  );
}
