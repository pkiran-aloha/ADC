import { useMemo, useRef, useState } from 'react';
import buildTargetHealth, { filterHealthItems, ATTENTION_LIMIT } from '../../utils/targetHealth';
import ClientKpiStrip from './ClientKpiStrip';
import ClinicalAttentionCenter from './ClinicalAttentionCenter';
import RecentSuccesses from './RecentSuccesses';
import TargetHealthMatrix from './TargetHealthMatrix';

// Phase 1 portfolio triage: KPI cards, an attention center, recent successes and the
// one-row-per-target health matrix, composed above the existing mastery chart and weekly
// progress map. Every drilldown reuses the App-level focus-request channel, so the
// client -> program -> target structure and the target analysis screen stay untouched.
export default function PortfolioTriage({ programs, sessions, asOfDate, onOpenTarget, onUseInReport }) {
  const health = useMemo(
    () => buildTargetHealth({ programs, sessions, asOfDate }),
    [programs, sessions, asOfDate]
  );
  const [filter, setFilter] = useState(null);
  const matrixRef = useRef(null);

  const visibleItems = useMemo(
    () => filterHealthItems(health.items, filter),
    [health.items, filter]
  );

  function viewAllAttention() {
    setFilter('needsReview');
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    matrixRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  return (
    <>
      <h2 className="sr-only">Portfolio status and clinical triage</h2>
      <ClientKpiStrip kpis={health.kpis} activeFilter={filter} onFilterChange={setFilter} />
      <div className="triage-grid">
        <ClinicalAttentionCenter items={health.attention.slice(0, ATTENTION_LIMIT)}
          onOpen={onOpenTarget} onViewAll={viewAllAttention} />
        <RecentSuccesses successes={health.successes} onUseInReport={onUseInReport} />
      </div>
      <div ref={matrixRef}>
        <TargetHealthMatrix items={visibleItems} filter={filter}
          onClearFilter={() => setFilter(null)} onOpen={onOpenTarget} />
      </div>
    </>
  );
}
