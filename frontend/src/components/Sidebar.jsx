import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  FolderKanban, 
  FileEdit, 
  BarChart3, 
  ChevronRight,
  ShieldAlert,
  Settings
} from 'lucide-react';

export default function Sidebar({ activeNav = 'analytics' }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'program-management', label: 'Program Management', icon: FolderKanban },
    { id: 'lessons', label: 'Lessons / Notes', icon: FileEdit },
    { 
      id: 'reporting', 
      label: 'Reporting & Analytics', 
      icon: BarChart3,
      isGroup: true,
      children: [
        { id: 'analytics', label: 'Analytics', active: true },
        { id: 'mastery-reports', label: 'Mastery Reports', active: false },
        { id: 'session-summaries', label: 'Session Summaries', active: false }
      ]
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col shrink-0 border-r border-slate-800">
      <div className="p-4 border-b border-slate-800">
        <div className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">
          Clinical Portal
        </div>
        <div className="text-sm font-semibold text-white flex items-center justify-between">
          <span>Welina ABA Care</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          if (item.isGroup) {
            return (
              <div key={item.id} className="pt-2">
                <div className="flex items-center px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Icon className="w-4 h-4 mr-2 text-slate-400" />
                  {item.label}
                </div>
                <div className="mt-1 space-y-1 pl-4">
                  {item.children.map(sub => (
                    <div
                      key={sub.id}
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                        sub.active 
                          ? 'bg-blue-600 text-white shadow-xs' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full mr-2.5 bg-current"></span>
                      {sub.label}
                      {sub.active && (
                        <span className="ml-auto text-[10px] bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded font-mono">
                          Active
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 cursor-pointer transition-colors"
            >
              <Icon className="w-4 h-4 mr-3" />
              <span>{item.label}</span>
            </div>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex items-center justify-between mb-1">
          <span>HIPAA Compliant</span>
          <span className="text-emerald-400 font-semibold">Active</span>
        </div>
        <p className="text-[11px] text-slate-400">Version 3.4.1 (Web Analytics)</p>
      </div>
    </aside>
  );
}
