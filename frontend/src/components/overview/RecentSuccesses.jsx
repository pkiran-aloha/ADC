import SectionHeader from '../ui/SectionHeader';
import { Check } from '../ui/Icons';
import { formatShortDate } from '../../utils/targetAnalytics';
import { PHASE_LABELS } from '../../utils/targetHealth';

const SUCCESS_LIMIT = 5;

// Mastery transitions from the last 30 days, drawn from the targets' existing phase
// histories — no new event collection, and nothing here changes target phases.
export default function RecentSuccesses({ successes = [], onUseInReport }) {
  const visible = successes.slice(0, SUCCESS_LIMIT);
  return (
    <section className="panel" aria-labelledby="successes-title">
      <SectionHeader id="successes-title" title="Recent successes"
        description="Mastery transitions from the last 30 days."
        help="A success is logged when a target enters maintenance, generalization or completed, using the phase history already recorded on the target."
        actions={<button type="button" className="button button--tertiary" onClick={onUseInReport}
          disabled={!visible.length}>Use in report</button>} />
      <div className="panel-body">
        {!visible.length ? (
          <p className="field-hint successes-empty">No mastery transitions in the last 30 days.</p>
        ) : (
          <ol className="success-list">
            {visible.map((success, index) => (
              <li className="success-row" key={`${success.targetId}-${success.date}-${index}`}>
                <span className="success-row__icon" aria-hidden="true"><Check size={16} /></span>
                <span className="success-row__body">
                  <strong>{success.targetName}</strong>
                  <small>{success.programName}</small>
                </span>
                <span className="success-row__meta">
                  <span className="stat-chip stat-chip--positive">{PHASE_LABELS[success.phase] || success.phase}</span>
                  <time dateTime={success.date}>{formatShortDate(success.date)}</time>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
