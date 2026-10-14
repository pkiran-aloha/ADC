import React, { useState } from 'react';
import { X, StickyNote } from 'lucide-react';

export default function GraphNoteModal({ isOpen, onClose, onSave, defaultTargetId }) {
  const [date, setDate] = useState('2026-10-05');
  const [noteText, setNoteText] = useState('Medication adjustment reported by parent; observation notes appended.');
  const [staffName, setStaffName] = useState('Sarah Jenkins, BCBA');
  const [color, setColor] = useState('#F59E0B');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      targetId: defaultTargetId,
      date,
      noteText,
      staffName,
      color
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
        
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            <StickyNote className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800">Add Graph Note (Annotation)</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
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
              <label className="block font-semibold text-slate-700 mb-1">Staff / Author</label>
              <input
                type="text"
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Note Content</label>
            <textarea
              required
              rows={3}
              placeholder="Enter qualitative notes, session conditions, or environmental changes..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Marker Color</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded-md border border-slate-300 cursor-pointer p-0.5"
              />
              <span className="font-mono text-slate-600 text-xs">{color}</span>
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
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-xs transition-colors"
            >
              + Add Graph Note
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
