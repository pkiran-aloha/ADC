import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, PlusCircle } from 'lucide-react';

export default function RecordTrialModal({
  isOpen,
  onClose,
  programs = [],
  selectedClientId,
  onRecordTrial,
  onUpdatePhase
}) {
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [value, setValue] = useState(80);
  const [correctCount, setCorrectCount] = useState(8);
  const [totalTrials, setTotalTrials] = useState(10);
  const [durationSeconds, setDurationSeconds] = useState(180);
  const [occurrenceCount, setOccurrenceCount] = useState(5);
  const [therapistName, setTherapistName] = useState('Sarah Jenkins, BCBA');
  const [qualitativeEntry, setQualitativeEntry] = useState('');

  // Behavior reduction missing data handling (Section 8.2)
  const [isBehaviorTarget, setIsBehaviorTarget] = useState(false);
  const [missingDataMode, setMissingDataMode] = useState('ZeroOut');

  // Target Phase Change simulation (Section 11.1)
  const [showPhaseChangePrompt, setShowPhaseChangePrompt] = useState(false);
  const [newPhase, setNewPhase] = useState('Maintenance');
  const [phaseLineLabel, setPhaseLineLabel] = useState('Maintenance Phase Start');

  if (!isOpen) return null;

  // Flatten all targets across programs
  const allTargets = [];
  programs.forEach(p => {
    p.targets.forEach(t => {
      allTargets.push({ ...t, programName: p.name, category: p.category });
    });
  });

  const currentTarget = allTargets.find(t => t.id === selectedTargetId) || allTargets[0];

  const handleTargetChange = (e) => {
    const tid = e.target.value;
    setSelectedTargetId(tid);
    const tgt = allTargets.find(t => t.id === tid);
    if (tgt && tgt.category === 'BehaviorReduction') {
      setIsBehaviorTarget(true);
    } else {
      setIsBehaviorTarget(false);
    }
  };

  const handleSaveTrial = (e) => {
    e.preventDefault();
    if (!currentTarget) return;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

    let finalVal = value;
    if (currentTarget.type === 'TrialByTrial') {
      finalVal = totalTrials > 0 ? Math.round((correctCount / totalTrials) * 100) : 0;
    } else if (currentTarget.type === 'Duration') {
      finalVal = durationSeconds;
    } else if (currentTarget.type === 'Frequency') {
      finalVal = occurrenceCount;
    }

    onRecordTrial({
      clientId: selectedClientId,
      targetId: currentTarget.id,
      timestamp,
      therapistName,
      value: finalVal,
      correctCount,
      totalTrials,
      durationSeconds,
      occurrenceCount,
      qualitativeEntry,
      missingDataMode: isBehaviorTarget ? missingDataMode : null
    });

    // Check if user also wanted to update phase
    if (showPhaseChangePrompt) {
      onUpdatePhase({
        targetId: currentTarget.id,
        newPhase,
        addPhaseLine: true,
        phaseLineLabel
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            <PlusCircle className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Record Lesson Trial & Target Entry</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveTrial} className="p-5 space-y-4 text-xs">
          {/* Target Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Program & Target</label>
            <select
              value={selectedTargetId || (currentTarget ? currentTarget.id : '')}
              onChange={handleTargetChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              {allTargets.map(t => (
                <option key={t.id} value={t.id}>
                  [{t.category === 'SkillAcquisition' ? 'SA' : 'BR'}] {t.programName} ➔ {t.name} ({t.type})
                </option>
              ))}
            </select>
          </div>

          {/* Therapist Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Recording Staff / Therapist</label>
              <select
                value={therapistName}
                onChange={(e) => setTherapistName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="Sarah Jenkins, BCBA">Sarah Jenkins, BCBA</option>
                <option value="Joe Ronald, RBT">Joe Ronald, RBT</option>
                <option value="Maya Patel, RBT">Maya Patel, RBT</option>
                <option value="David Kim, RBT">David Kim, RBT</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Type</label>
              <input
                type="text"
                disabled
                value={currentTarget ? currentTarget.type : ''}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-600"
              />
            </div>
          </div>

          {/* Dynamic input based on target type */}
          {currentTarget && currentTarget.type === 'TrialByTrial' && (
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 space-y-2">
              <span className="font-bold text-blue-900 block">Trial by Trial Performance:</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-medium">Correct Trials</label>
                  <input
                    type="number"
                    min="0"
                    max={totalTrials}
                    value={correctCount}
                    onChange={(e) => setCorrectCount(parseInt(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-medium">Total Trials</label>
                  <input
                    type="number"
                    min="1"
                    value={totalTrials}
                    onChange={(e) => setTotalTrials(parseInt(e.target.value) || 1)}
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white"
                  />
                </div>
              </div>
              <p className="text-blue-700 text-[11px] font-semibold">
                Accuracy: {totalTrials > 0 ? Math.round((correctCount / totalTrials) * 100) : 0}% ({correctCount}/{totalTrials})
              </p>
            </div>
          )}

          {currentTarget && currentTarget.type === 'Duration' && (
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 space-y-2">
              <span className="font-bold text-blue-900 block">Duration Data:</span>
              <div>
                <label className="text-slate-600 font-medium">Recorded Duration (seconds)</label>
                <input
                  type="number"
                  min="0"
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(parseInt(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded px-2 py-1 bg-white"
                />
                <p className="text-slate-500 text-[11px] mt-1">
                  Formats on graph as: {Math.floor(durationSeconds / 60).toString().padStart(2, '0')} min {(durationSeconds % 60).toString().padStart(2, '0')} sec
                </p>
              </div>
            </div>
          )}

          {currentTarget && (currentTarget.type === 'Frequency' || currentTarget.type === 'FluencyRate') && (
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 space-y-2">
              <span className="font-bold text-blue-900 block">Frequency Count:</span>
              <div>
                <label className="text-slate-600 font-medium">Number of Occurrences</label>
                <input
                  type="number"
                  min="0"
                  value={occurrenceCount}
                  onChange={(e) => setOccurrenceCount(parseInt(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded px-2 py-1 bg-white"
                />
              </div>
            </div>
          )}

          {currentTarget && currentTarget.type === 'Anecdotal' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Qualitative Observation</label>
              <textarea
                rows={2}
                value={qualitativeEntry}
                onChange={(e) => setQualitativeEntry(e.target.value)}
                placeholder="e.g. Requested snack using full 3-word sentence independently."
                className="w-full border border-slate-300 rounded-lg p-2 text-slate-800"
              />
            </div>
          )}

          {/* Behavior Reduction Data Handling Prompt (Section 8.2) */}
          {(isBehaviorTarget || currentTarget?.category === 'BehaviorReduction') && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center space-x-2 text-amber-900 font-bold mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Behavior Tracking Decision (Section 8.2):</span>
              </div>
              <p className="text-amber-800 text-[11px] mb-2 italic">
                “How would you like your behaviors to be tracked and plotted on Analytics?”
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className={`p-2 rounded border flex flex-col cursor-pointer transition-colors ${missingDataMode === 'ZeroOut' ? 'bg-amber-100/80 border-amber-400 font-bold' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="radio"
                      name="missingMode"
                      value="ZeroOut"
                      checked={missingDataMode === 'ZeroOut'}
                      onChange={() => setMissingDataMode('ZeroOut')}
                    />
                    <span>Zero Out</span>
                  </div>
                  <span className="text-[10px] text-slate-600 font-normal mt-0.5">Plot 0 value (behavior observed & did not occur)</span>
                </label>

                <label className={`p-2 rounded border flex flex-col cursor-pointer transition-colors ${missingDataMode === 'DataNotTracked' ? 'bg-amber-100/80 border-amber-400 font-bold' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="radio"
                      name="missingMode"
                      value="DataNotTracked"
                      checked={missingDataMode === 'DataNotTracked'}
                      onChange={() => setMissingDataMode('DataNotTracked')}
                    />
                    <span>Data Not Tracked</span>
                  </div>
                  <span className="text-[10px] text-slate-600 font-normal mt-0.5">Do not plot data point on this date</span>
                </label>
              </div>
            </div>
          )}

          {/* Simulate Phase Change Prompt (Section 11.1) */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPhaseChangePrompt}
                onChange={(e) => setShowPhaseChangePrompt(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              <span className="font-semibold text-slate-700">Simulate Target Phase Change & Annotation Prompt</span>
            </label>

            {showPhaseChangePrompt && (
              <div className="mt-2.5 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                <p className="text-blue-900 font-medium italic">
                  “Do you wish to plot a phase change line on analytics ({currentTarget?.name}) to highlight the change in phase?”
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-600 font-medium">New Phase</label>
                    <select
                      value={newPhase}
                      onChange={(e) => {
                        setNewPhase(e.target.value);
                        setPhaseLineLabel(`${e.target.value} Phase Start`);
                      }}
                      className="w-full border border-slate-300 rounded px-2 py-1 bg-white text-xs"
                    >
                      <option value="Baseline">Baseline</option>
                      <option value="Acquisition">Acquisition</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Generalization">Generalization</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-600 font-medium">Phase Line Label</label>
                    <input
                      type="text"
                      value={phaseLineLabel}
                      onChange={(e) => setPhaseLineLabel(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1 bg-white text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
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
              Save Session Trial
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
