import React, { useState } from 'react';
import { X, BookmarkPlus } from 'lucide-react';

export default function PhaseLineModal({ isOpen, onClose, onSave, defaultTargetId }) {
  const [date, setDate] = useState('2026-10-01');
  const [label, setLabel] = useState('Intervention Phase 2');
  const [style, setStyle] = useState('Solid'); // Solid vs Dotted
  const [color, setColor] = useState('#2563EB');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      targetId: defaultTargetId,
      date,
      label,
      style,
      color,
      isAutomated: false,
      source: 'Manual'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            <BookmarkPlus className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">Add Phase Change Line</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form (Section 10.4 & 11) */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Phase Label</label>
            <input
              type="text"
              required
              placeholder="e.g. Baseline, Intervention Start, Maintenance"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Line Style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="Solid">Solid Line (Visual Break)</option>
                <option value="Dotted">Dotted Line (Continuous)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Line Color</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-9 h-9 rounded-md border border-slate-300 cursor-pointer p-0.5"
                />
                <span className="font-mono text-slate-600 text-xs">{color}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs transition-colors"
            >
              + Add Phase Change Line
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
