import { lazy, Suspense, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import OverallMasterySection from './components/OverallMasterySection';
import PhaseLineModal from './components/Modals/PhaseLineModal';
import PhaseRangeModal from './components/Modals/PhaseRangeModal';
import GraphNoteModal from './components/Modals/GraphNoteModal';
import RecordSessionModal from './components/Modals/RecordSessionModal';
import WorkflowTabs from './components/ui/WorkflowTabs';
import Dialog from './components/ui/Dialog';
import { AnalyticsSkeleton } from './components/ui/EmptyState';
import { useFeedback } from './utils/useFeedback';
import { readAccessLevel, writeAccessLevel, viewOnlyNotice } from './utils/permissions';
import { supervisorObservations } from './utils/observations';
import { workflowFromHash } from './data/workflows';
import { User, Calendar, ChartLineUp, Target, Notebook, CheckCircle2, ArrowRight, ArrowCounterClockwise, AlertTriangle, ShieldCheck } from './components/ui/Icons';
import { apiService } from './services/apiService';
import { SEED_AS_OF_DATE, PROMPT_HIERARCHY_TEMPLATES, CLINICAL_STANDARDS } from './data/mockData';

const ClientSpecificSection = lazy(() => import('./components/ClientSpecificSection'));
const AbcDataSection = lazy(() => import('./components/AbcDataSection'));
const ProgressHeatmap = lazy(() => import('./components/overview/ProgressHeatmap'));
const ServiceQualitySection = lazy(() => import('./components/ServiceQualitySection'));
const ReportsSection = lazy(() => import('./components/ReportsSection'));
const DocumentationSection = lazy(() => import('./components/documentation/DocumentationSection'));
const DataEntryModal = lazy(() => import('./components/Modals/DataEntryModal'));
const initials = name => name.split(' ').map(part => part[0]).slice(0, 2).join('');
const snapshotDate = new Date(`${SEED_AS_OF_DATE}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// Panels can mount behind a Suspense boundary (lazy chunks), so wait for the section to
// exist before moving focus or scrolling to it.
function whenSectionReady(id, callback, tries = 240) {
  const attempt = remaining => {
    const section = document.getElementById(id);
    if (section) { callback(section); return; }
    if (remaining > 0) requestAnimationFrame(() => attempt(remaining - 1));
  };
  requestAnimationFrame(() => attempt(tries));
}

// One tab panel per workflow. Panels mount on first visit and stay mounted (hidden)
// afterwards so charts, filters and drill-down state survive a workflow switch.
function WorkflowPanel({ id, active, children }) {
  return <div className={`workflow-panel${active ? ' workflow-panel--active' : ''}`} role="tabpanel" id={`workflow-panel-${id}`}
    aria-labelledby={`workflow-tab-${id}`} hidden={!active} tabIndex={-1}>{children}</div>;
}

export default function App() {
  const [selectedClientId, setSelectedClientId] = useState('cli-liam');
  // The third argument lets the workspace be server-rendered (npm run smoke) without a browser store.
  const data = useSyncExternalStore(apiService.subscribe, apiService.getSnapshot, apiService.getSnapshot);
  const [masterySelections, setMasterySelections] = useState({});
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordTargetId, setRecordTargetId] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [annotationEditor, setAnnotationEditor] = useState(null);
  // Drill-down requests from summary views (e.g., the progress heat map) re-open the
  // target analysis focused on a program, target and week.
  const [focusRequest, setFocusRequest] = useState(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  // Access level and data entry are workspace-level concerns: a view-only clinician can
  // read and export every analytics view, and anyone with edit access can add probe,
  // school, paper and imported records without leaving the analytics workflow.
  const [accessLevel, setAccessLevelState] = useState(() => readAccessLevel());
  const [entryTab, setEntryTab] = useState(null);
  // The active workflow tab. Deep links (#reports) open that workflow directly.
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window === 'undefined') return 'overview';
    return workflowFromHash(window.location.hash) || 'overview';
  });
  const [visited, setVisited] = useState(() => new Set(['overview']));
  // Record the first visit during render (render-phase adjustment) so the panel that is
  // opening appears in the same paint instead of one effect later.
  if (!visited.has(activeSection)) setVisited(new Set(visited).add(activeSection));
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
  const canEdit = accessLevel === 'full';
  const viewOnlyReason = viewOnlyNotice(accessLevel);
  // Supervision and IOA observations belong to the appointment, not to the learner's chart.
  const supervisionRecords = useMemo(() => supervisorObservations(serviceSessions, sessions, {
    targetNameById: new Map(programs.flatMap(program => program.targets).map(target => [target.id, target.name]))
  }), [serviceSessions, sessions, programs]);

  // Keep the hash pointing at the open workflow (shareable link, no scroll jump) and
  // follow manual hash edits so copied links keep working.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const nextHash = `#${activeSection}`;
    if (window.location.hash !== nextHash) window.history.replaceState(null, '', nextHash);
  }, [activeSection]);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    function syncFromHash() {
      const id = workflowFromHash(window.location.hash);
      if (id) setActiveSection(id);
    }
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

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
  // Switching workflows never leaves the reviewer wondering where they landed: the new
  // panel starts at the top of the workspace and, when the request came from a nav link,
  // receives focus so keyboard and screen-reader users land inside the content.
  function activateWorkflow(id, { focusPanel = false, scrollToTop = true } = {}) {
    setActiveSection(id);
    if (scrollToTop) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    }
    if (focusPanel) {
      whenSectionReady(id, section => section.focus({ preventScroll: true }));
    }
  }
  function navigate(id) {
    setNavigationOpen(false);
    activateWorkflow(id, { focusPanel: true, scrollToTop: false });
  }
  function openAnnotation(kind, target, initialData = null) {
    if (!target) return;
    const program = programs.find(item => item.id === target.programId) || programs.find(item => item.targets.some(entry => entry.id === target.id));
    const scopeTargets = program
      ? program.targets.map(entry => ({ id: entry.id, name: entry.name, phase: entry.phase }))
      : [{ id: target.id, name: target.name }];
    setAnnotationEditor({ kind, target, initialData, scopeTargets });
  }
  // Writing an annotation once and applying it across a program's targets: each target
  // keeps its own copy so the graph, tables and exports stay self-contained, and the
  // service reports how many were skipped as duplicates.
  function saveAnnotation(kind, data) {
    const { applyToIds = [], ...record } = data;
    const bulk = {
      line: targetIds => apiService.addPhaseLinesBulk(targetIds.map(targetId => ({ ...record, targetId }))),
      range: targetIds => apiService.addPhaseRangesBulk(targetIds.map(targetId => ({ ...record, targetId }))),
      note: targetIds => apiService.addGraphNotesBulk(targetIds.map(targetId => ({ ...record, targetId })))
    };
    const operations = {
      line: [() => apiService.addPhaseLine(record), () => apiService.updatePhaseLine(record.id, record), 'Phase line saved.'],
      range: [() => apiService.addPhaseRange(record), () => apiService.updatePhaseRange(record.id, record), 'Phase range saved.'],
      note: [() => apiService.addGraphNote(record), () => apiService.updateGraphNote(record.id, record), 'Graph note saved.']
    };
    const [add, update, message] = operations[kind];
    if (record.id) { update(); saved(message); return; }
    const targetIds = [record.targetId, ...applyToIds.filter(id => id !== record.targetId)];
    if (targetIds.length > 1) {
      const { created, skipped } = bulk[kind](targetIds);
      saved(`${message.replace(/ saved\.$/, '')} on ${created.length} target${created.length === 1 ? '' : 's'}${skipped.length ? ` · ${skipped.length} already had it` : ''}.`);
      return;
    }
    add();
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
    activateWorkflow('target-analysis', { scrollToTop: false });
    whenSectionReady('target-analysis', section => {
      section.scrollIntoView({ block: 'start' });
      section.focus({ preventScroll: true });
    });
  }
  function changeAccessLevel(level) {
    setAccessLevelState(level);
    writeAccessLevel(level);
    notify(level === 'full' ? 'Full access: you can record, correct and configure the graphs.' : 'View-only access: graphs, tables and exports stay available; changes are disabled.');
  }
  function addPoint(point) {
    const created = apiService.addObservation(point);
    saved(apiService.storageError ? 'Added for this session only. Your browser couldn’t save changes.' : 'Data point saved. It is on the graph now.');
    return created;
  }
  function importPoints(points) {
    const created = apiService.addObservations(points);
    saved(`Imported ${created.length} data point${created.length === 1 ? '' : 's'}. They are on the graphs now.`);
    return created;
  }
  function correctObservation(id, patch, audit) {
    apiService.updateObservation(id, patch, audit);
    saved('Correction saved with its reason in the change history.');
  }
  function deleteObservation(id, audit) {
    const result = apiService.deleteObservation(id, audit);
    saved('Observation removed. The removal is documented in the change history.');
    return result;
  }
  function changeProgramStatus(programId, status, options = {}) {
    apiService.updateProgramStatus(programId, status, { ...options, asOf: SEED_AS_OF_DATE });
    saved(`Program status updated to ${status}.`);
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
    onResetData: () => { setNavigationOpen(false); setResetOpen(true); },
    canEdit, viewOnlyReason, accessLevel, onAccessLevelChange: changeAccessLevel,
    onOpenManualEntry: () => { setNavigationOpen(false); setEntryTab('entry'); },
    onOpenImport: () => { setNavigationOpen(false); setEntryTab('import'); }
  };

  const workflowVisible = id => activeSection === id || visited.has(id);

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to analytics</a>
    <Header clients={clients} selectedClientId={selectedClientId} onSelectClient={setSelectedClientId}
      onOpenRecordModal={() => openRecorder()} onResetData={() => setResetOpen(true)}
      onOpenNavigation={() => setNavigationOpen(true)} navigationOpen={navigationOpen}
      onOpenManualEntry={() => setEntryTab('entry')} onOpenImport={() => setEntryTab('import')}
      onBrandClick={() => activateWorkflow('overview', { focusPanel: true })}
      accessLevel={accessLevel} onAccessLevelChange={changeAccessLevel} canEdit={canEdit} />
    <div className={`shell-layout${collapsed ? ' shell-layout--collapsed' : ''}`}>
      <Sidebar {...sidebarProps} collapsed={collapsed} onToggle={toggleNavigation} />
      <main className="app-main" id="main-content" tabIndex={-1}>
        <div className="workspace-content">
          <WorkflowTabs activeId={activeSection} onSelect={id => activateWorkflow(id)} snapshotDate={snapshotDate} />
          {!canEdit && <p className="view-only-notice" role="status">
            <ShieldCheck size={18} aria-hidden="true" />
            <span><strong>View-only analytics access.</strong> {viewOnlyReason || 'Graphs, tables and exports stay available; phase lines, notes, axis settings, program status and data entry are disabled.'}
              <button type="button" className="button button--tertiary" onClick={() => changeAccessLevel('full')}>Switch to full access</button></span>
          </p>}
          {storageError && <div className="storage-warning" role="alert">
            <AlertTriangle size={21} /><div><strong>Changes aren’t being saved.</strong>
              <p>Your browser’s storage is unavailable or full. You can explore this session, but changes may disappear when you reload. Download records before leaving.</p></div>
            <button type="button" className="button button--secondary" onClick={() => apiService.saveAll()}>Retry</button>
          </div>}
          <WorkflowPanel id="overview" active={activeSection === 'overview'}>
            <section id="overview" aria-labelledby="overview-title" tabIndex={-1}>
              <div className="page-heading">
                <div><p className="eyebrow">Reporting &amp; analytics</p>
                  <h1 id="overview-title">Progress overview</h1>
                  <p className="page-description">Review skill acquisition, behavior patterns, and the context behind each observation.</p>
                  <p className="snapshot snapshot--inline"><Calendar size={15} aria-hidden="true" />
                    <span className="snapshot-label">Fictional demo · snapshot</span><strong>{snapshotDate}</strong></p>
                </div>
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
                    { id: 'programs', label: 'Programs', value: programs.length, note: `${skillPrograms.length} skill · ${programs.length - skillPrograms.length} behavior`, icon: Target },
                    { id: 'mastery', label: 'Targets mastered', value: `${masteredCount} / ${skillTargets.length}`, note: 'Across skill programs', icon: CheckCircle2 },
                    { id: 'sessions', label: 'Session observations', value: clientSessions.length, note: 'All measurement types', icon: ChartLineUp },
                    { id: 'abc', label: 'ABC observations', value: abcEntries.length, note: 'Antecedent to consequence', icon: Notebook }
                  ].map(metric => <div className={`metric metric--${metric.id}`} key={metric.label}><dt><span className="metric-icon" aria-hidden="true"><metric.icon size={16} /></span>{metric.label}</dt><dd className="metric-number">{metric.value}</dd><dd className="metric-note">{metric.note}</dd></div>)}
                </dl>
                <OverallMasterySection programs={programs} selectedProgramId={selectedMasteryProgId}
                  onSelectProgram={id => setMasterySelections(value => ({ ...value, [selectedClientId]: id }))} masteryData={masteryData} />
                <Suspense fallback={<AnalyticsSkeleton />}>
                  <ProgressHeatmap key={selectedClientId} programs={programs} sessions={clientSessions} asOfDate={SEED_AS_OF_DATE} onOpen={openTargetWeek} />
                </Suspense>
              </>}
            </section>
          </WorkflowPanel>
          {currentClient && <>
            {workflowVisible('target-analysis') && <WorkflowPanel id="target-analysis" active={activeSection === 'target-analysis'}>
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
                  onRecordClick={openRecorder} onManualEntryClick={() => setEntryTab('entry')}
                  onCorrectObservation={correctObservation} onDeleteObservation={deleteObservation}
                  onProgramStatusChange={changeProgramStatus}
                  canEdit={canEdit} viewOnlyReason={viewOnlyReason} supervisionRecords={supervisionRecords} />
              </Suspense>
            </WorkflowPanel>}
            {workflowVisible('abc-observations') && <WorkflowPanel id="abc-observations" active={activeSection === 'abc-observations'}>
              <Suspense fallback={<AnalyticsSkeleton />}>
                <AbcDataSection key={selectedClientId} client={currentClient} abcEntries={abcEntries}
                  abcConfiguration={apiService.getAbcConfiguration(selectedClientId)} behaviorTargets={behaviorTargets}
                  serviceSessions={serviceSessions} sessionRows={behaviorRows}
                  onRefresh={() => { refreshAll(); notify('ABC observations refreshed from this browser.'); }} />
              </Suspense>
            </WorkflowPanel>}
            {workflowVisible('service-quality') && <WorkflowPanel id="service-quality" active={activeSection === 'service-quality'}>
              <Suspense fallback={<AnalyticsSkeleton />}>
                <ServiceQualitySection key={selectedClientId} client={currentClient} serviceSessions={serviceSessions} sessions={clientSessions}
                  standards={CLINICAL_STANDARDS} asOfDate={SEED_AS_OF_DATE} />
              </Suspense>
            </WorkflowPanel>}
            {workflowVisible('reports') && <WorkflowPanel id="reports" active={activeSection === 'reports'}>
              <Suspense fallback={<AnalyticsSkeleton />}>
                <ReportsSection key={`reports-${selectedClientId}`} client={currentClient} programs={programs} sessions={sessions}
                  serviceSessions={serviceSessions} annotations={annotations} standards={CLINICAL_STANDARDS}
                  canEdit={canEdit} viewOnlyReason={viewOnlyReason} />
              </Suspense>
            </WorkflowPanel>}
          </>}
          {workflowVisible('documentation') && <WorkflowPanel id="documentation" active={activeSection === 'documentation'}>
            <DocumentationSection onClose={() => activateWorkflow('overview')} />
          </WorkflowPanel>}
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
      description="This replaces recorded observations, target-phase changes, and annotations for every fictional client with the original demo records." presentation="confirmation">
      <p className="field-hint">This affects only this browser. Export any records you want to keep before resetting.</p>
      <div className="form-actions"><button type="button" className="button button--secondary" onClick={() => setResetOpen(false)} data-autofocus>Keep my changes</button><button type="button" className="button button--danger" onClick={resetData}>Restore demo data</button></div>
    </Dialog>
    <PhaseLineModal key={`line-${annotationEditor?.initialData?.id || annotationEditor?.target.id || 'closed'}`}
      isOpen={annotationEditor?.kind === 'line'} onClose={() => setAnnotationEditor(null)} onSave={data => saveAnnotation('line', data)}
      target={annotationEditor?.target} initialData={annotationEditor?.initialData} scopeTargets={annotationEditor?.scopeTargets} />
    <PhaseRangeModal key={`range-${annotationEditor?.initialData?.id || annotationEditor?.target.id || 'closed'}`}
      isOpen={annotationEditor?.kind === 'range'} onClose={() => setAnnotationEditor(null)} onSave={data => saveAnnotation('range', data)}
      target={annotationEditor?.target} initialData={annotationEditor?.initialData} scopeTargets={annotationEditor?.scopeTargets} />
    <GraphNoteModal key={`note-${annotationEditor?.initialData?.id || annotationEditor?.target.id || 'closed'}`}
      isOpen={annotationEditor?.kind === 'note'} onClose={() => setAnnotationEditor(null)} onSave={data => saveAnnotation('note', data)}
      target={annotationEditor?.target} initialData={annotationEditor?.initialData} scopeTargets={annotationEditor?.scopeTargets} />
    {recordOpen && <RecordSessionModal isOpen onClose={() => setRecordOpen(false)} programs={programs} selectedClientId={selectedClientId} initialTargetId={recordTargetId}
      sessions={clientSessions} serviceSessions={serviceSessions} onSaveSession={saveSession} />}
    <Suspense fallback={null}>
      <DataEntryModal key={entryTab || 'closed'} isOpen={entryTab !== null} initialTab={entryTab || 'entry'} onClose={() => setEntryTab(null)}
        client={currentClient} programs={programs} sessions={clientSessions} onAddPoint={addPoint} onImportPoints={importPoints}
        canEdit={canEdit} viewOnlyReason={viewOnlyReason} />
    </Suspense>
  </div>;
}
