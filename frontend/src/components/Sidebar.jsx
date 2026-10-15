import { SidebarSimple, ArrowUpRight, RefreshCw, Plus, Upload, Eye } from './ui/Icons';
import { WORKFLOWS } from '../data/workflows';
import { ACCESS_LEVELS } from '../utils/permissions';

export default function Sidebar({
  activeSection = 'overview', collapsed = false, onToggle, hasClient, drawer = false, onNavigate, onResetData,
  canEdit = true, viewOnlyReason = '', onOpenManualEntry, onOpenImport, accessLevel = 'full', onAccessLevelChange
}) {
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
      {WORKFLOWS.map(workflow => {
        const Icon = workflow.icon;
        const content = <><Icon /><span className="nav-label">{workflow.label}</span><span className="nav-tooltip" aria-hidden="true">{workflow.label}</span></>;
        return !hasClient && workflow.id !== 'overview'
          ? <button key={workflow.id} type="button" className="nav-item" disabled title="Choose a client to view analytics">{content}</button>
          : <a key={workflow.id} className="nav-item" href={`#${workflow.id}`}
            aria-current={activeSection === workflow.id ? 'location' : undefined}
            onClick={event => { event.preventDefault(); onNavigate?.(workflow.id); }}>{content}</a>;
      })}
    </nav>
    {hasClient && <div className="sidebar-actions">
      <strong>Data</strong>
      <div className="sidebar-action-buttons">
        <button type="button" className="button button--tertiary" onClick={onOpenManualEntry} disabled={!canEdit}
          title={canEdit ? 'Enter probe, school, paper or assessment data' : 'View-only access'}><Plus size={16} /><span className="nav-label">Add data</span></button>
        <button type="button" className="button button--tertiary" onClick={onOpenImport} disabled={!canEdit}
          title={canEdit ? 'Import a spreadsheet of historical data' : 'View-only access'}><Upload size={16} /><span className="nav-label">Import</span></button>
      </div>
      {/* The header keeps the compact switch on desktop; the drawer needs its own copy. */}
      {drawer && <div className="access-level">
        <Eye size={16} aria-hidden="true" />
        <label htmlFor="access-level-drawer">Access</label>
        <select id="access-level-drawer" value={accessLevel} onChange={event => onAccessLevelChange?.(event.target.value)}>
          {ACCESS_LEVELS.map(level => <option key={level.id} value={level.id}>{level.label}</option>)}
        </select>
      </div>}
    </div>}
    <div className="sidebar-detail">
      <strong>{canEdit ? 'Reading the charts' : 'View-only access'}</strong>
      <p>{canEdit ? 'A measured zero is not an untracked observation. Open a data table for exact values.' : (viewOnlyReason || 'Graphs, tables and exports stay available; changes are disabled.')}</p>
    </div>
    <div className="sidebar-footer">
      <strong className="font-medium">Fictional demo</strong>
      <p>Changes stay in this browser.<br />Not for patient records.</p>
      <button type="button" className="button button--tertiary" onClick={onResetData} disabled={!canEdit}
        title={canEdit ? undefined : 'View-only access' }><RefreshCw size={16} />Reset demo data</button>
      <a href="https://github.com/pkiran-aloha/ADC" target="_blank" rel="noreferrer">About this project<ArrowUpRight size={15} /></a>
    </div>
  </aside>;
}
