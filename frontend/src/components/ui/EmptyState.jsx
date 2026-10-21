import { ChartLineUp } from './Icons';

export default function EmptyState({ title, description, action, icon: Icon = ChartLineUp }) {
  return <div className="empty-state">
    <div className="empty-state-icon"><Icon size={26} /></div>
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {action && <button type="button" className="button button--secondary" onClick={action.onClick}>{action.label}</button>}
  </div>;
}

export function AnalyticsSkeleton({ label = 'Loading analytics…' }) {
  return <div className="analytics-skeleton" aria-busy="true" role="status">
    <span className="sr-only">{label}</span>
    <div className="skeleton skeleton-heading" />
    <div className="skeleton skeleton-caption" />
    <div className="skeleton skeleton-toolbar" />
    <div className="skeleton skeleton-chart" />
  </div>;
}
