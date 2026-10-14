import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import OverallMasterySection from './components/OverallMasterySection';
import ClientSpecificSection from './components/ClientSpecificSection';
import AbcDataSection from './components/AbcDataSection';
import PhaseLineModal from './components/Modals/PhaseLineModal';
import PhaseRangeModal from './components/Modals/PhaseRangeModal';
import GraphNoteModal from './components/Modals/GraphNoteModal';
import RecordTrialModal from './components/Modals/RecordTrialModal';
import { apiService } from './services/apiService';
import { User, ShieldCheck, Sparkles, AlertCircle, ArrowUpRight, Terminal } from 'lucide-react';

export default function App() {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('cli-liam'); // Default to Liam for immediate preview
  const [programs, setPrograms] = useState([]);
  const [selectedMasteryProgId, setSelectedMasteryProgId] = useState('');
  const [masteryData, setMasteryData] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [abcEntries, setAbcEntries] = useState([]);
  const [annotations, setAnnotations] = useState({ phaseLines: [], phaseRanges: [], graphNotes: [] });

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isPhaseLineModalOpen, setIsPhaseLineModalOpen] = useState(false);
  const [isPhaseRangeModalOpen, setIsPhaseRangeModalOpen] = useState(false);
  const [isGraphNoteModalOpen, setIsGraphNoteModalOpen] = useState(false);

  // Load clients on mount
  useEffect(() => {
    loadClients();
  }, []);

  // When selectedClientId changes, load client-specific data
  useEffect(() => {
    if (selectedClientId) {
      loadClientData(selectedClientId);
    } else {
      setPrograms([]);
      setMasteryData([]);
      setSessions([]);
      setAbcEntries([]);
      setAnnotations({ phaseLines: [], phaseRanges: [], graphNotes: [] });
    }
  }, [selectedClientId]);

  // When mastery program changes
  useEffect(() => {
    if (selectedClientId && selectedMasteryProgId) {
      const data = apiService.getCumulativeMastery(selectedClientId, selectedMasteryProgId);
      setMasteryData(data);
    } else {
      setMasteryData([]);
    }
  }, [selectedClientId, selectedMasteryProgId]);

  const loadClients = () => {
    const list = apiService.getClients();
    setClients(list);
  };

  const loadClientData = (clientId) => {
    const progs = apiService.getPrograms(clientId);
    setPrograms(progs);

    // Pick first skill program for Overall Targets Mastered
    const firstSkill = progs.find(p => p.category === 'SkillAcquisition');
    if (firstSkill) {
      setSelectedMasteryProgId(firstSkill.id);
      const mData = apiService.getCumulativeMastery(clientId, firstSkill.id);
      setMasteryData(mData);
    } else {
      setSelectedMasteryProgId('');
      setMasteryData([]);
    }

    // Load sessions
    setSessions(apiService.sessions);

    // Load ABC data
    const abc = apiService.getAbcData(clientId, 'All');
    setAbcEntries(abc);

    // Load annotations
    setAnnotations({
      phaseLines: apiService.phaseLines,
      phaseRanges: apiService.phaseRanges,
      graphNotes: apiService.graphNotes
    });
  };

  const refreshAll = () => {
    if (selectedClientId) {
      loadClientData(selectedClientId);
    }
  };

  const handleResetData = () => {
    if (confirm('Reset all demo analytics data to initial state?')) {
      apiService.resetToDefault();
      loadClients();
      if (selectedClientId) loadClientData(selectedClientId);
    }
  };

  // Annotation handlers
  const handleSavePhaseLine = (line) => {
    apiService.addPhaseLine(line);
    refreshAll();
  };

  const handleDeletePhaseLine = (id) => {
    apiService.deletePhaseLine(id);
    refreshAll();
  };

  const handleSavePhaseRange = (range) => {
    apiService.addPhaseRange(range);
    refreshAll();
  };

  const handleDeletePhaseRange = (id) => {
    apiService.deletePhaseRange(id);
    refreshAll();
  };

  const handleSaveGraphNote = (note) => {
    apiService.addGraphNote(note);
    refreshAll();
  };

  const handleDeleteGraphNote = (id) => {
    apiService.deleteGraphNote(id);
    refreshAll();
  };

  const handleRecordTrial = (data) => {
    apiService.recordTrial(data);
    refreshAll();
  };

  const handleUpdatePhase = (payload) => {
    apiService.updateTargetPhase(payload);
    refreshAll();
  };

  const currentClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased">
      
      {/* Top Application Header */}
      <Header
        clients={clients}
        selectedClientId={selectedClientId}
        onSelectClient={setSelectedClientId}
        onOpenRecordModal={() => setIsRecordModalOpen(true)}
        onResetData={handleResetData}
      />

      <div className="flex-1 flex max-w-full overflow-hidden">
        
        {/* Left Welina Navigation Sidebar */}
        <Sidebar activeNav="analytics" />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Architecture & Live Integration Banner */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-xl p-4 sm:p-5 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="bg-blue-500/30 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-400/40 uppercase tracking-wide">
                    ASP.NET Core Web API + React
                  </span>
                  <span className="bg-emerald-500/30 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-400/40 uppercase tracking-wide">
                    GitHub Pages Hosted
                  </span>
                </div>
                <h1 className="text-lg font-bold tracking-tight">
                  Welina Applied Behavior Analysis (ABA) Analytics Module
                </h1>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Transforms session trials into interactive graphs: Overall Targets Mastered, Client-Specific Targets & Behaviors, Phase Change Line annotations, Therapist breakdown splits, and contextual ABC (Antecedent-Behavior-Consequence-Location) tracking.
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => setIsRecordModalOpen(true)}
                  disabled={!selectedClientId}
                  className="px-3.5 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Simulate Session Notes</span>
                </button>
              </div>
            </div>

            {/* Section 4.1: Initial Landing State Prompt when No Client is Selected */}
            {!selectedClientId ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center my-8 shadow-xs">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4 text-blue-600">
                  <User className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  Please select a client at the top to view data.
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
                  When no client is selected, analytics sections remain inactive to prevent cross-client data mixing. Choose a client from the dropdown above to load therapy records.
                </p>
                <div className="mt-6 flex justify-center space-x-3">
                  {clients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClientId(c.id)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
                    >
                      Select {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Section A: Overall Targets Mastered (Section 5) */}
                <OverallMasterySection
                  programs={programs}
                  selectedProgramId={selectedMasteryProgId}
                  onSelectProgram={setSelectedMasteryProgId}
                  masteryData={masteryData}
                  isDisabled={!selectedClientId}
                />

                {/* Section B: Client-Specific Program and Target Data (Sections 6 - 21) */}
                <ClientSpecificSection
                  client={currentClient}
                  programs={programs}
                  sessions={sessions}
                  annotations={annotations}
                  onAddPhaseLineClick={() => setIsPhaseLineModalOpen(true)}
                  onAddPhaseRangeClick={() => setIsPhaseRangeModalOpen(true)}
                  onAddGraphNoteClick={() => setIsGraphNoteModalOpen(true)}
                  onDeletePhaseLine={handleDeletePhaseLine}
                  onDeletePhaseRange={handleDeletePhaseRange}
                  onDeleteGraphNote={handleDeleteGraphNote}
                  onRefresh={refreshAll}
                  isDisabled={!selectedClientId}
                />

                {/* Section C: ABC Data Recording (Section 24) */}
                <AbcDataSection
                  client={currentClient}
                  abcEntries={abcEntries}
                  isDisabled={!selectedClientId}
                  onRefresh={refreshAll}
                />
              </>
            )}

          </div>
        </main>
      </div>

      {/* Modals */}
      <PhaseLineModal
        isOpen={isPhaseLineModalOpen}
        onClose={() => setIsPhaseLineModalOpen(false)}
        onSave={handleSavePhaseLine}
        defaultTargetId={programs[0]?.targets[0]?.id || ''}
      />

      <PhaseRangeModal
        isOpen={isPhaseRangeModalOpen}
        onClose={() => setIsPhaseRangeModalOpen(false)}
        onSave={handleSavePhaseRange}
        defaultTargetId={programs[0]?.targets[0]?.id || ''}
      />

      <GraphNoteModal
        isOpen={isGraphNoteModalOpen}
        onClose={() => setIsGraphNoteModalOpen(false)}
        onSave={handleSaveGraphNote}
        defaultTargetId={programs[0]?.targets[0]?.id || ''}
      />

      <RecordTrialModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        programs={programs}
        selectedClientId={selectedClientId}
        onRecordTrial={handleRecordTrial}
        onUpdatePhase={handleUpdatePhase}
      />

    </div>
  );
}
