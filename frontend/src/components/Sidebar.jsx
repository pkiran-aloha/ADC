import { ChartLineUp, Target, Notebook, SidebarSimple, ArrowUpRight, RefreshCw } from './ui/Icons';

const destinations = [
  { id: 'overview', label: 'Progress overview', icon: ChartLineUp },
  { id: 'target-analysis', label: 'Target analysis', icon: Target },
  { id: 'abc-observations', label: 'ABC observations', icon: Notebook }
];

export default function Sidebar({ activeSection = 'overview', collapsed = false, onToggle, hasClient, drawer = false, onNavigate, onResetData }) {
  return <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}${drawer ? ' sidebar--drawer' : ''}`} aria-label="Workspace sidebar">
    <div className="sidebar-heading">
      <p>Workspace</p>
      {!drawer && <button type="button" className="icon-button" onClick={onToggle}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!collapsed}
        aria-controls="workspace-navigation" title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
        <SidebarSimple size={20} />
      </button>}
    </div>
    <nav className="sidebar-nav" id={drawer ? 'mobile-navigation' : 'workspace-navigation'} aria-label={drawer ? 'Mobile analytics navigation' : 'Analytics navigation'}>
      {destinations.map(destination => {
        const Icon = destination.icon;
        const content = <><Icon /><span className="nav-label">{destination.label}</span><span className="nav-tooltip" aria-hidden="true">{destination.label}</span></>;
        return !hasClient && destination.id !== 'overview'
          ? <button key={destination.id} type="button" className="nav-item" disabled title="Choose a client to view analytics">{content}</button>
          : <a key={destination.id} className="nav-item" href={`#${destination.id}`}
            aria-current={activeSection === destination.id ? 'location' : undefined}
            onClick={() => onNavigate?.(destination.id)}>{content}</a>;
      })}
    </nav>
    <div className="sidebar-detail">
      <strong>Reading the charts</strong>
      <p>A measured zero is not an untracked observation. Open a data table for exact values.</p>
    </div>
    <div className="sidebar-footer">
      <strong className="font-medium">Fictional demo</strong>
      <p>Changes stay in this browser.<br />Not for patient records.</p>
      <button type="button" className="button button--tertiary" onClick={onResetData}><RefreshCw size={16} />Reset demo data</button>
      <a href="https://github.com/pkiran-aloha/ADC" target="_blank" rel="noreferrer">About this project<ArrowUpRight size={15} /></a>
    </div>
  </aside>;
}
