import React from 'react';
import { User, Activity, PlusCircle, RefreshCw, Sparkles, Building2 } from 'lucide-react';

export default function Header({
  clients,
  selectedClientId,
  onSelectClient,
  onOpenRecordModal,
  onResetData
}) {
  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand & Platform Identifier */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-sm">
              W
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">Welina</span>
                <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold border border-blue-200">
                  Analytics Web
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">ABA Clinical Data Visualization & Reporting</p>
            </div>
          </div>

          {/* Client Selector (Section 4.2) */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
              <User className="w-4 h-4 text-slate-500" />
              <div className="text-left">
                <label htmlFor="client-selector" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Select Client
                </label>
                <select
                  id="client-selector"
                  value={selectedClientId || ''}
                  onChange={(e) => onSelectClient(e.target.value || null)}
                  className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="">-- Please select a client --</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name} ({client.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Client Quick Info Badge */}
            {selectedClient && (
              <div className="hidden lg:flex flex-col text-xs bg-blue-50/70 border border-blue-100 rounded-lg px-3 py-1">
                <span className="font-semibold text-blue-900">{selectedClient.supervisingBcba}</span>
                <span className="text-blue-600">{selectedClient.primaryDiagnosis}</span>
              </div>
            )}

            {/* Quick Actions for Testing and Simulation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={onOpenRecordModal}
                disabled={!selectedClientId}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                title="Simulate recording session data with Zero Out and Phase Line prompts"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Record Session Trial</span>
              </button>

              <button
                onClick={onResetData}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                title="Reset clinical demo data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}
