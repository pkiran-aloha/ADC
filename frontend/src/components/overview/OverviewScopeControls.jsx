import SegmentedControl from '../ui/SegmentedControl';
import { Calendar } from '../ui/Icons';
import { PROGRAM_SCOPES, SCOPE_RANGES, programScopeById, scopeCaption } from '../../utils/analyticsScope';

// The one shared scope for the whole overview. Lifted into App state and read by the portfolio
// triage, the intervention timeline, the mastery chart and the weekly progress map, so the
// landing page answers a single question instead of each section carrying its own date filter.
// Program scope is a derived view of the existing program categories — no new entity.
export default function OverviewScopeControls({
  programScope = 'all', rangeId = '90D', window, counts = null,
  onProgramScopeChange, onRangeChange
}) {
  const scope = programScopeById(programScope);
  const caption = scopeCaption(window, { programScope, counts });
  return <section className="overview-scope" aria-labelledby="overview-scope-title">
    <h2 className="sr-only" id="overview-scope-title">Progress overview scope</h2>
    <div className="overview-scope__field">
      <span className="overview-scope__label" aria-hidden="true">Programs</span>
      <SegmentedControl label="Program scope" value={programScope} onChange={onProgramScopeChange}
        options={PROGRAM_SCOPES.map(entry => ({
          value: entry.id, label: entry.short, accessibleLabel: entry.label
        }))} />
    </div>
    <div className="overview-scope__field">
      <span className="overview-scope__label" aria-hidden="true">Time range</span>
      <SegmentedControl label="Time range" value={rangeId} onChange={onRangeChange}
        options={SCOPE_RANGES.map(entry => ({
          value: entry.id, label: entry.short, accessibleLabel: entry.accessibleLabel
        }))} />
    </div>
    <p className="overview-scope__summary" role="status">
      <Calendar size={15} aria-hidden="true" />
      <span>{caption}</span>
    </p>
    <p className="sr-only">{scope.description}. The range applies to the status cards, the attention centre,
      the health matrix, the intervention timeline, the mastery chart and the weekly progress map.</p>
  </section>;
}
