import { User, Plus, RefreshCw, List, FileCsv, Upload, Eye } from './ui/Icons';
import BrandMark from './ui/BrandMark';
import { ACCESS_LEVELS } from '../utils/permissions';

export default function Header({
  clients, selectedClientId, onSelectClient, onOpenRecordModal, onResetData, onOpenNavigation, navigationOpen,
  onOpenImport, onOpenManualEntry, accessLevel = 'full', onAccessLevelChange, canEdit = true
}) {
  return <header className="app-header">
    <div className="header-inner">
      <button type="button" className="icon-button mobile-nav-toggle" aria-label="Open workspace navigation"
        aria-expanded={navigationOpen} aria-controls="mobile-navigation" onClick={onOpenNavigation}>
        <List size={23} />
      </button>
      <a className="brand" href="#overview" aria-label="Welina — progress overview">
        <BrandMark className="brand-mark" />
        <div><span className="brand-name">Welina</span><span className="brand-caption">Clinical workspace</span></div>
      </a>
      <div className="header-controls">
        <div className="client-picker">
          <User size={19} />
          <label htmlFor="client-selector">Current client</label>
          <select id="client-selector" value={selectedClientId || ''} onChange={event => onSelectClient(event.target.value || null)}>
            <option value="">Choose a client</option>
            {clients.map(client => <option key={client.id} value={client.id}>{client.name} · {client.code}</option>)}
          </select>
        </div>
        <button type="button" className="button button--secondary header-entry" disabled={!selectedClientId || !canEdit}
          onClick={onOpenManualEntry} title={canEdit ? 'Enter probe, school, paper or assessment data' : undefined}>
          <FileCsv size={18} /><span>Add data</span>
        </button>
        <button type="button" className="button button--tertiary header-import" disabled={!selectedClientId || !canEdit}
          onClick={onOpenImport} title={canEdit ? 'Import a spreadsheet of historical or external data' : undefined}>
          <Upload size={18} /><span>Import</span>
        </button>
        <button type="button" className="button button--primary header-record" disabled={!selectedClientId || !canEdit}
          onClick={onOpenRecordModal}>
          <Plus size={18} /><span>Record observation</span>
        </button>
        <div className="access-level">
          <Eye size={18} aria-hidden="true" />
          <label htmlFor="access-level">Access</label>
          <select id="access-level" value={accessLevel} onChange={event => onAccessLevelChange?.(event.target.value)}
            title="Demonstrates role-based analytics access">
            {ACCESS_LEVELS.map(level => <option key={level.id} value={level.id}>{level.label}</option>)}
          </select>
        </div>
        <button type="button" className="icon-button header-reset" onClick={onResetData} aria-label="Reset demo data" title="Reset demo data" disabled={!canEdit}>
          <RefreshCw size={20} />
        </button>
      </div>
    </div>
  </header>;
}
