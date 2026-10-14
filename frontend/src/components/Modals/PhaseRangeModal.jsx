import React, { useState } from 'react';
import { X, Layers } from 'lucide-react';

export default function PhaseRangeModal({ isOpen, onClose, onSave, defaultTargetId }) {
  const [startDate, setStartDate] = useState('2026-09-18');
  const [endDate, setEndDate] = useState('2026-09-25');
  const [label, setLabel] = useState('Intensive Prompt Fading Window');
  const [color, setColor] = useState('#60A5FA33'); // default light blue with alpha

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      targetId: defaultTargetId,
      startDate,
      endDate,
      label,
      color
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
        
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">Add Phase Range</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Phase Range Label</label>
            <input
              type="text"
              required
              placeholder="e.g. Baseline Assessment, Intervention Phase"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Highlight Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value="#3B82F6"
                onChange={(e) => setColor(`${e.target.value}40`)} // add 25% opacity
                className="w-9 h-9 rounded-md border border-slate-300 cursor-pointer p-0.5"
              />
              <span className="text-slate-500 text-xs">Shaded band across graph timeline</span>
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
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs transition-colors"
            >
              + Add Phase Range
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
