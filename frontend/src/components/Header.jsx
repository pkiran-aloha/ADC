import { User, Plus, RefreshCw, List } from './ui/Icons';
import BrandMark from './ui/BrandMark';

export default function Header({ clients, selectedClientId, onSelectClient, onOpenRecordModal, onResetData, onOpenNavigation, navigationOpen }) {
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
        <button type="button" className="button button--primary header-record" disabled={!selectedClientId}
          onClick={onOpenRecordModal}>
          <Plus size={18} /><span>Record observation</span>
        </button>
        <button type="button" className="icon-button header-reset" onClick={onResetData} aria-label="Reset demo data" title="Reset demo data">
          <RefreshCw size={20} />
        </button>
      </div>
    </div>
  </header>;
}
