import { lazy, Suspense, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import OverallMasterySection from './components/OverallMasterySection';
import PhaseLineModal from './components/Modals/PhaseLineModal';
import PhaseRangeModal from './components/Modals/PhaseRangeModal';
import GraphNoteModal from './components/Modals/GraphNoteModal';
import RecordSessionModal from './components/Modals/RecordSessionModal';
import Dialog from './components/ui/Dialog';
import { AnalyticsSkeleton } from './components/ui/EmptyState';
import { useFeedback } from './utils/useFeedback';
import { User, Calendar, ChartLineUp, Target, Notebook, CheckCircle2, ArrowRight, ArrowCounterClockwise, AlertTriangle } from './components/ui/Icons';
import { apiService } from './services/apiService';
import { SEED_AS_OF_DATE, PROMPT_HIERARCHY_TEMPLATES, CLINICAL_STANDARDS } from './data/mockData';

const ClientSpecificSection = lazy(() => import('./components/ClientSpecificSection'));
const AbcDataSection = lazy(() => import('./components/AbcDataSection'));
const ProgressHeatmap = lazy(() => import('./components/overview/ProgressHeatmap'));
const ServiceQualitySection = lazy(() => import('./components/ServiceQualitySection'));
const initials = name => name.split(' ').map(part => part[0]).slice(0, 2).join('');
const snapshotDate = new Date(`${SEED_AS_OF_DATE}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export default function App() {
  const [selectedClientId, setSelectedClientId] = useState('cli-liam');
  const data = useSyncExternalStore(apiService.subscribe, apiService.getSnapshot);
  const [masterySelections, setMasterySelections] = useState({});
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordTargetId, setRecordTargetId] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [annotationEditor, setAnnotationEditor] = useState(null);
  // Drill-down requests from summary views (e.g., the progress heat map) re-open the
  // target analysis focused on a program, target and week.
  const [focusRequest, setFocusRequest] = useState(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('welina_navigation_collapsed') === 'true'; } catch { return false; }
  });
  const storageError = data.storageError;
  const notify = useFeedback();

  // Subscribe to the existing browser-local service; changes produce stable snapshots.
  const clients = data.clients;
  const programs = useMemo(() => data.programs.filter(program => program.clientId === selectedClientId), [data.programs, selectedClientId]);
  const sessions = data.sessions;
  const abcEntries = useMemo(() => data.abcEntries.filter(entry => entry.clientId === selectedClientId), [data.abcEntries, selectedClientId]);
  const serviceSessions = useMemo(() => data.serviceSessions.filter(session => session.clientId === selectedClientId), [data.serviceSessions, selectedClientId]);
  const clientFocus = focusRequest?.clientId === selectedClientId ? focusRequest : null;
  const behaviorTargets = useMemo(() => programs.filter(program => program.category === 'BehaviorReduction').flatMap(program => program.targets), [programs]);
  const behaviorRows = useMemo(() => {
    const ids = new Set(behaviorTargets.map(target => target.id));
    return sessions.filter(row => ids.has(row.targetId));
  }, [sessions, behaviorTargets]);
  const annotations = useMemo(() => ({ phaseLines: data.phaseLines, phaseRanges: data.phaseRanges, graphNotes: data.graphNotes }), [data.phaseLines, data.phaseRanges, data.graphNotes]);
  const currentClient = clients.find(client => client.id === selectedClientId);
  const skillPrograms = programs.filter(program => program.category === 'SkillAcquisition');
  const chosenMasteryId = masterySelections[selectedClientId];
  const selectedMasteryProgId = chosenMasteryId === '' ? '' : skillPrograms.some(program => program.id === chosenMasteryId) ? chosenMasteryId : skillPrograms[0]?.id || '';
  const masteryData = apiService.getCumulativeMastery(selectedClientId, selectedMasteryProgId);
  const clientSessions = sessions.filter(session => session.clientId === selectedClientId);
  const skillTargets = skillPrograms.flatMap(program => program.targets);
  const masteredCount = skillTargets.filter(target => ['Maintenance', 'Generalization', 'Completed'].includes(target.phase)).length;

  useEffect(() => {
    // Measure all sections together: intersection callbacks only include changed
    // entries and can otherwise leave the previous panel marked as current.
    let frame = null;
    function updateActiveSection() {
      frame = null;
      const threshold = (document.querySelector('.app-header')?.getBoundingClientRect().height || 0) + 40;
      let current = 'overview';
      for (const id of ['overview', 'target-analysis', 'abc-observations', 'service-quality']) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= threshold) current = id;
      }
      setActiveSection(current);
    }
    function schedule() { if (frame === null) frame = requestAnimationFrame(updateActiveSection); }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const mutation = new MutationObserver(schedule);
    mutation.observe(document.getElementById('main-content'), { childList: true, subtree: true });
    schedule();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      mutation.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [selectedClientId]);

  function refreshAll() { apiService.publishSnapshot(); }
  function saved(message) {
    notify(apiService.storageError ? 'Updated for this session only. Your browser couldn’t save changes.' : message, apiService.storageError ? 'error' : 'success');
  }
  function toggleNavigation() {
    setCollapsed(value => {
      try { localStorage.setItem('welina_navigation_collapsed', String(!value)); } catch { /* Navigation still works without persistence. */ }
      return !value;
    });
  }
  function navigate(id) {
    setActiveSection(id);
    if (navigationOpen) {
      setNavigationOpen(false);
      requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }));
    }
  }
  function openAnnotation(kind, target, initialData = null) {
    if (!target) return;
    setAnnotationEditor({ kind, target, initialData });
  }
  function saveAnnotation(kind, data) {
    const operations = {
      line: [() => apiService.addPhaseLine(data), () => apiService.updatePhaseLine(data.id, data), 'Phase line saved.'],
      range: [() => apiService.addPhaseRange(data), () => apiService.updatePhaseRange(data.id, data), 'Phase range saved.'],
      note: [() => apiService.addGraphNote(data), () => apiService.updateGraphNote(data.id, data), 'Graph note saved.']
    };
    const [add, update, message] = operations[kind];
    if (data.id) update(); else add();
    saved(message);
  }
  function resetData() {
    apiService.resetToDefault();
    saved('Demo data restored. Your navigation preferences haven’t changed.');
    setResetOpen(false);
  }
  function openTargetWeek({ program, target, week }) {
    setFocusRequest({
      clientId: selectedClientId, nonce: Date.now(), category: program.category === 'BehaviorReduction' ? 'Behavior' : 'SkillAcquisition',
      programId: program.category === 'SkillAcquisition' ? program.id : undefined, behaviorIds: program.category === 'BehaviorReduction' ? [target.id] : undefined,
      targetType: target.type, durationFilter: '3 months', aggregation: 'Weekly', selectedKey: week, analysisTargetId: target.id
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const section = document.getElementById('target-analysis');
      section?.scrollIntoView({ block: 'start' });
      section?.focus({ preventScroll: true });
    }));
  }
  function openRecorder(target = null) {
    setRecordTargetId(target?.id || '');
    setRecordOpen(true);
  }
  // The recorder saves a whole session at once: every target row, plus any phase changes.
  // Keeping the sheet open is confirmed inside it, so the toast is only for closing saves.
  function saveSession({ points, phases, keepOpen }) {
    apiService.recordTrials(points);
    if (phases.length) apiService.updateTargetPhases(phases);
    if (keepOpen) return;
    notify(apiService.storageError ? 'Updated for this session only. Your browser couldn’t save changes.' : `Saved ${points.length} observation${points.length === 1 ? '' : 's'} to this browser.`, apiService.storageError ? 'error' : 'success');
  }

  const sidebarProps = {
    activeSection, hasClient: Boolean(selectedClientId), onNavigate: navigate,
    onResetData: () => { setNavigationOpen(false); setResetOpen(true); }
  };

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to analytics</a>
    <Header clients={clients} selectedClientId={selectedClientId} onSelectClient={setSelectedClientId}
      onOpenRecordModal={() => openRecorder()} onResetData={() => setResetOpen(true)}
      onOpenNavigation={() => setNavigationOpen(true)} navigationOpen={navigationOpen} />
    <div className={`shell-layout${collapsed ? ' shell-layout--collapsed' : ''}`}>
      <Sidebar {...sidebarProps} collapsed={collapsed} onToggle={toggleNavigation} />
      <main className="app-main" id="main-content" tabIndex={-1}>
        <div className="workspace-content">
          {storageError && <div className="storage-warning" role="alert">
            <AlertTriangle size={21} /><div><strong>Changes aren’t being saved.</strong>
              <p>Your browser’s storage is unavailable or full. You can explore this session, but changes may disappear when you reload. Download records before leaving.</p></div>
            <button type="button" className="button button--secondary" onClick={() => apiService.saveAll()}>Retry</button>
          </div>}
          <section id="overview" aria-labelledby="overview-title" tabIndex={-1}>
            <div className="page-heading">
              <div><p className="eyebrow">Reporting &amp; analytics</p>
                <h1 id="overview-title">Progress overview</h1>
                <p className="page-description">Review skill acquisition, behavior patterns, and the context behind each observation.</p>
              </div>
              <div className="snapshot"><Calendar size={18} /><div><span className="snapshot-label">Fictional demo · snapshot</span><strong>{snapshotDate}</strong></div></div>
            </div>
            {!currentClient ? <div className="getting-started">
              <div className="empty-state-icon ml-0"><User size={26} /></div>
              <h2>Start with a client.</h2>
              <p>Choose a fictional client to explore their programs and observations. Each workspace keeps its records separate.</p>
              <div className="client-choices">{clients.map(client => <button key={client.id} type="button" className="client-choice" onClick={() => setSelectedClientId(client.id)}>
                <span className="client-avatar" aria-hidden="true">{initials(client.name)}</span>
                <div><strong>{client.name}</strong><small>{client.code} · {client.location}</small></div><ArrowRight size={20} />
              </button>)}</div>
            </div> : <>
              <div className="client-summary">
                <div className="client-avatar" aria-hidden="true">{initials(currentClient.name)}</div>
                <div className="client-identity"><h2>{currentClient.name}</h2>
                  <p><span className="client-code">{currentClient.code}</span><span className="client-diagnosis">{currentClient.primaryDiagnosis}</span></p>
                </div>
                <div className="client-supervisor"><span>Supervising clinician</span><strong>{currentClient.supervisingBcba}</strong></div>
                <button type="button" className="button button--tertiary" onClick={() => document.getElementById('client-selector').focus()}><span>Change client</span><ArrowRight size={17} /></button>
              </div>
              <dl className="metrics-strip" aria-label={`${currentClient.name}'s demo data summary`}>
                {[
                  { label: 'Programs', value: programs.length, note: `${skillPrograms.length} skill · ${programs.length - skillPrograms.length} behavior`, icon: Target },
                  { label: 'Targets mastered', value: `${masteredCount} / ${skillTargets.length}`, note: 'Across skill programs', icon: CheckCircle2 },
                  { label: 'Session observations', value: clientSessions.length, note: 'All measurement types', icon: ChartLineUp },
                  { label: 'ABC observations', value: abcEntries.length, note: 'Antecedent to consequence', icon: Notebook }
                ].map(metric => <div className="metric" key={metric.label}><dt><metric.icon size={15} />{metric.label}</dt><dd className="metric-number">{metric.value}</dd><dd className="metric-note">{metric.note}</dd></div>)}
              </dl>
              <OverallMasterySection programs={programs} selectedProgramId={selectedMasteryProgId}
                onSelectProgram={id => setMasterySelections(value => ({ ...value, [selectedClientId]: id }))} masteryData={masteryData} />
              <Suspense fallback={<AnalyticsSkeleton />}>
                <ProgressHeatmap key={selectedClientId} programs={programs} sessions={clientSessions} asOfDate={SEED_AS_OF_DATE} onOpen={openTargetWeek} />
              </Suspense>
            </>}
          </section>
          {currentClient && <>
            <Suspense fallback={<AnalyticsSkeleton />}>
              <ClientSpecificSection key={`${selectedClientId}-${clientFocus?.nonce || 0}`} client={currentClient} programs={programs} sessions={sessions} annotations={annotations}
                serviceSessions={serviceSessions} abcEntries={abcEntries} templates={PROMPT_HIERARCHY_TEMPLATES} standards={CLINICAL_STANDARDS} initialFocus={clientFocus}
                onAddPhaseLineClick={target => openAnnotation('line', target)}
                onAddPhaseRangeClick={target => openAnnotation('range', target)}
                onAddGraphNoteClick={target => openAnnotation('note', target)}
                onEditAnnotation={(kind, record, target) => openAnnotation(kind, target, record)}
                onDeletePhaseLine={id => { apiService.deletePhaseLine(id); saved('Phase line removed.'); }}
                onDeletePhaseRange={id => { apiService.deletePhaseRange(id); saved('Phase range removed.'); }}
                onDeleteGraphNote={id => { apiService.deleteGraphNote(id); saved('Graph note removed.'); }}
                onRefresh={() => { refreshAll(); notify('Target analysis refreshed from this browser.'); }}
                onRecordClick={openRecorder} />
            </Suspense>
            <Suspense fallback={<AnalyticsSkeleton />}>
              <AbcDataSection key={selectedClientId} client={currentClient} abcEntries={abcEntries}
                abcConfiguration={apiService.getAbcConfiguration(selectedClientId)} behaviorTargets={behaviorTargets}
                serviceSessions={serviceSessions} sessionRows={behaviorRows}
                onRefresh={() => { refreshAll(); notify('ABC observations refreshed from this browser.'); }} />
            </Suspense>
            <Suspense fallback={<AnalyticsSkeleton />}>
              <ServiceQualitySection key={selectedClientId} client={currentClient} serviceSessions={serviceSessions} sessions={clientSessions}
                standards={CLINICAL_STANDARDS} asOfDate={SEED_AS_OF_DATE} />
            </Suspense>
          </>}
          <footer className="workspace-footer">
            <p>Fictional records. Stored on this device. Not for clinical decisions.</p>
            <nav aria-label="Demo information"><a href={`${import.meta.env.BASE_URL}privacy.html`}>Privacy</a><a href={`${import.meta.env.BASE_URL}terms.html`}>Terms of use</a></nav>
          </footer>
        </div>
      </main>
    </div>

    <Dialog isOpen={navigationOpen} onClose={() => setNavigationOpen(false)} title="Workspace" presentation="navigation">
      <Sidebar {...sidebarProps} drawer />
    </Dialog>
    <Dialog isOpen={resetOpen} onClose={() => setResetOpen(false)} title="Restore demo data?" icon={ArrowCounterClockwise}
      description="This replaces recorded observations, target-phase changes, and annotations for all three fictional clients with the original demo records." presentation="confirmation">
      <p className="field-hint">This affects only this browser. Export any records you want to keep before resetting.</p>
      <div className="form-actions"><button type="button" className="button button--secondary" onClick={() => setResetOpen(false)} data-autofocus>Keep my changes</button><button type="button" className="button button--danger" onClick={resetData}>Restore demo data</button></div>
    </Dialog>
    <PhaseLineModal key={`line-${annotationEditor?.initialData?.id || annotationEditor?.target.id || 'closed'}`}
      isOpen={annotationEditor?.kind === 'line'} onClose={() => setAnnotationEditor(null)} onSave={data => saveAnnotation('line', data)}
      target={annotationEditor?.target} initialData={annotationEditor?.initialData} />
    <PhaseRangeModal key={`range-${annotationEditor?.initialData?.id || annotationEditor?.target.id || 'closed'}`}
      isOpen={annotationEditor?.kind === 'range'} onClose={() => setAnnotationEditor(null)} onSave={data => saveAnnotation('range', data)}
      target={annotationEditor?.target} initialData={annotationEditor?.initialData} />
    <GraphNoteModal key={`note-${annotationEditor?.initialData?.id || annotationEditor?.target.id || 'closed'}`}
      isOpen={annotationEditor?.kind === 'note'} onClose={() => setAnnotationEditor(null)} onSave={data => saveAnnotation('note', data)}
      target={annotationEditor?.target} initialData={annotationEditor?.initialData} />
    {recordOpen && <RecordSessionModal isOpen onClose={() => setRecordOpen(false)} programs={programs} selectedClientId={selectedClientId} initialTargetId={recordTargetId}
      sessions={clientSessions} serviceSessions={serviceSessions} onSaveSession={saveSession} />}
  </div>;
}
