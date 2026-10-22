import { useMemo } from 'react';
import buildTargetHealth, { ATTENTION_LIMIT, HEALTH_WINDOW_DAYS } from '../../utils/targetHealth';
import ClientKpiStrip from './ClientKpiStrip';
import ClinicalAttentionCenter from './ClinicalAttentionCenter';
import RecentSuccesses from './RecentSuccesses';

// Phase 1 portfolio triage: KPI cards, an attention center and recent successes. Every
// drilldown reuses the App-level focus-request channel, so the client -> program -> target
// structure and the target analysis screen stay untouched.
//
// Phase 2 adds the shared overview scope: `programs` arrives already filtered by program
// scope, and `windowDays`/`rangePhrase` come from the App-level time range. Nothing else about
// the triage changes, and the defaults keep it usable on its own.
//
// The target health matrix is its own overview module (the app places it near the end of the
// page), so the KPI filter lives in App: `filter` is the active KPI filter and
// `onFilterChange`/`onViewAll` ask the page to apply it and take the reviewer to the matrix. No
// module is hidden — the numbers and the table they describe are simply ordered separately.
export default function PortfolioTriage({
  programs, sessions, asOfDate, onOpenTarget, onUseInReport,
  windowDays = HEALTH_WINDOW_DAYS, rangePhrase = 'the last 90 days',
  filter = null, onFilterChange, onViewAll
}) {
  const health = useMemo(
    () => buildTargetHealth({ programs, sessions, asOfDate, windowDays }),
    [programs, sessions, asOfDate, windowDays]
  );

  return (
    <>
      <h2 className="sr-only">Portfolio status and clinical attention</h2>
      <ClientKpiStrip kpis={health.kpis} activeFilter={filter} onFilterChange={onFilterChange} rangePhrase={rangePhrase} />
      <div className="triage-grid">
        <ClinicalAttentionCenter items={health.attention.slice(0, ATTENTION_LIMIT)} rangePhrase={rangePhrase}
          onOpen={onOpenTarget} onViewAll={onViewAll} />
        <RecentSuccesses successes={health.successes} onUseInReport={onUseInReport} />
      </div>
    </>
  );
}
