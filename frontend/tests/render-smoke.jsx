// Server-side render of the analytics sections. Playwright cannot install its browser in
// every environment, so this script catches the runtime errors a type-check or a bundle
// cannot: wrong prop shapes, missing data fields and helpers that throw while rendering.
// Run it with:  npm run smoke
import './dom-stub.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import seed from '../../data/clinicalSeed.json' with { type: 'json' };
import { CLINICAL_STANDARDS, PROMPT_HIERARCHY_TEMPLATES, SEED_AS_OF_DATE } from '../src/data/mockData.js';
import ClientSpecificSection from '../src/components/ClientSpecificSection.jsx';
import AbcDataSection from '../src/components/AbcDataSection.jsx';
import ServiceQualitySection from '../src/components/ServiceQualitySection.jsx';
import ReportsSection from '../src/components/ReportsSection.jsx';
import OverallMasterySection from '../src/components/OverallMasterySection.jsx';
import ProgressHeatmap from '../src/components/overview/ProgressHeatmap.jsx';
import PortfolioTriage from '../src/components/overview/PortfolioTriage.jsx';
import InterventionTimeline from '../src/components/overview/InterventionTimeline.jsx';
import OverviewScopeControls from '../src/components/overview/OverviewScopeControls.jsx';
import TrendExplorer from '../src/components/overview/TrendExplorer.jsx';
import DataEntryModal from '../src/components/Modals/DataEntryModal.jsx';
import RecordSessionModal from '../src/components/Modals/RecordSessionModal.jsx';
import PhaseLineModal from '../src/components/Modals/PhaseLineModal.jsx';
import App from '../src/App.jsx';
import { supervisorObservations } from '../src/utils/observations.js';
import { resolveScopeWindow, scopePrograms, weekCountFor } from '../src/utils/analyticsScope.js';
import { ALL_PROGRAMS_ID, cumulativeMasterySeries } from '../src/utils/targetAnalytics.js';
import { buildExplorerCatalog } from '../src/utils/trendExplorer.js';

const client = seed.clients[0];
const programs = seed.programs.filter(program => program.clientId === client.id);
const sessions = seed.sessionData;
const serviceSessions = seed.serviceSessions.filter(session => session.clientId === client.id);
const abcEntries = seed.abcEntries;
const behaviorTargets = programs.filter(program => program.category === 'BehaviorReduction').flatMap(program => program.targets);
const behaviorRows = sessions.filter(row => behaviorTargets.some(target => target.id === row.targetId));
const annotations = { phaseLines: seed.phaseLines, phaseRanges: seed.phaseRanges, graphNotes: seed.graphNotes };
const supervisionRecords = supervisorObservations(serviceSessions, sessions, {
  targetNameById: new Map(programs.flatMap(program => program.targets).map(target => [target.id, target.name]))
});
const noop = () => {};
// Phase 2 shared scope, resolved exactly as App does it so the smoke cases exercise the real
// window, week count and program filtering.
const clientSessions = sessions.filter(row => row.clientId === client.id);
const scopeWindow = resolveScopeWindow({ asOfDate: SEED_AS_OF_DATE, rangeId: '90D', programs, sessions: clientSessions });
const scopedPrograms = scopePrograms(programs, 'all');
const behaviorPrograms = scopePrograms(programs, 'behavior');
const scopeCounts = { total: scopedPrograms.length, skill: scopedPrograms.filter(program => program.category === 'SkillAcquisition').length, behavior: scopedPrograms.filter(program => program.category === 'BehaviorReduction').length };
const skillPrograms = scopedPrograms.filter(program => program.category === 'SkillAcquisition');
const masteryData = cumulativeMasterySeries(skillPrograms, { from: scopeWindow.start, to: scopeWindow.asOfDate });
const explorerCatalog = buildExplorerCatalog({ programs, sessions: clientSessions, asOfDate: SEED_AS_OF_DATE });
const firstSkillTarget = skillPrograms[0].targets[0];
const firstBehaviorTarget = behaviorTargets[0];

// The dialogs render through createPortal, which the server renderer refuses, so they are
// only exercised when this script runs with a DOM available (Playwright covers them in CI).
const portalCases = [
  ['DataEntryModal', DataEntryModal, {
    isOpen: true, onClose: noop, client, programs, sessions,
    onAddPoint: noop, onImportPoints: noop, canEdit: true
  }, ['data point']],
  ['RecordSessionModal', RecordSessionModal, {
    isOpen: true, onClose: noop, programs, selectedClientId: client.id,
    sessions, serviceSessions, onSaveSession: noop
  }, ['Record']],
  ['PhaseLineModal', PhaseLineModal, {
    isOpen: true, onClose: noop, onSave: noop,
    target: programs[0].targets[0], scopeTargets: programs[0].targets.map(target => ({ id: target.id, name: target.name, phase: target.phase }))
  }, ['phase line']]
];

const cases = [
  ['App (whole workspace)', App, {}, ['Progress overview', 'Target analysis', 'Reports']],
  ['ClientSpecificSection', ClientSpecificSection, {
    client, programs, sessions, serviceSessions, abcEntries, annotations,
    templates: PROMPT_HIERARCHY_TEMPLATES, standards: CLINICAL_STANDARDS,
    onAddPhaseLineClick: noop, onAddPhaseRangeClick: noop, onAddGraphNoteClick: noop,
    onDeletePhaseLine: noop, onDeletePhaseRange: noop, onDeleteGraphNote: noop,
    onRefresh: noop, onEditAnnotation: noop, onRecordClick: noop, onManualEntryClick: noop,
    onCorrectObservation: noop, onDeleteObservation: noop, onProgramStatusChange: noop,
    canEdit: true, supervisionRecords
  }, ['Visual analysis', 'record']],
  ['ClientSpecificSection (view only)', ClientSpecificSection, {
    client, programs, sessions, serviceSessions, abcEntries, annotations,
    templates: PROMPT_HIERARCHY_TEMPLATES, standards: CLINICAL_STANDARDS,
    onRefresh: noop, onEditAnnotation: noop, canEdit: false, viewOnlyReason: 'View-only analytics access.', supervisionRecords
  }, ['View-only analytics access']],
  ['AbcDataSection', AbcDataSection, {
    client, abcEntries, abcConfiguration: seed.abcConfigurations[0], behaviorTargets,
    serviceSessions, sessionRows: behaviorRows, onRefresh: noop
  }, ['ABC']],
  ['ServiceQualitySection', ServiceQualitySection, {
    client, serviceSessions, sessions: sessions.filter(row => row.clientId === client.id),
    standards: CLINICAL_STANDARDS, asOfDate: SEED_AS_OF_DATE
  }, ['Session activity', 'supervision']],
  ['ReportsSection', ReportsSection, {
    client, programs, sessions, serviceSessions, annotations, standards: CLINICAL_STANDARDS
  }, ['Report']],
  ['OverallMasterySection', OverallMasterySection, {
    programs, selectedProgramId: programs.find(program => program.category === 'SkillAcquisition')?.id,
    onSelectProgram: noop
  }, ['Mastery']],
  ['OverallMasterySection (all programs, shared range)', OverallMasterySection, {
    programs: scopedPrograms, selectedProgramId: ALL_PROGRAMS_ID, onSelectProgram: noop,
    masteryData, rangePhrase: scopeWindow.phrase
  }, ['Skill mastery', 'All programs', 'Newly mastered in this range', 'Mastered overall']],
  ['ProgressHeatmap', ProgressHeatmap, {
    programs, sessions, asOfDate: SEED_AS_OF_DATE, onOpen: noop
  }, ['Progress']],
  ['ProgressHeatmap (behaviour scope, 13 weeks)', ProgressHeatmap, {
    programs: behaviorPrograms, sessions, asOfDate: SEED_AS_OF_DATE, onOpen: noop,
    weeks: weekCountFor(scopeWindow), programScope: 'behavior'
  }, ['Progress', 'Rows follow the program scope']],
  ['PortfolioTriage', PortfolioTriage, {
    programs, sessions, asOfDate: SEED_AS_OF_DATE, onOpenTarget: noop, onUseInReport: noop
  }, ['Clinical attention center', 'Target health matrix', 'Recent successes']],
  ['PortfolioTriage (shared 90-day scope)', PortfolioTriage, {
    programs: scopedPrograms, sessions: clientSessions, asOfDate: SEED_AS_OF_DATE,
    windowDays: scopeWindow.days, rangePhrase: scopeWindow.phrase, onOpenTarget: noop, onUseInReport: noop
  }, ['Clinical attention center', 'Target health matrix', 'over the last 90 days']],
  ['OverviewScopeControls', OverviewScopeControls, {
    programScope: 'all', rangeId: '90D', window: scopeWindow, counts: scopeCounts,
    onProgramScopeChange: noop, onRangeChange: noop
  }, ['Overview scope', 'Program scope', 'Time range', '16 Jul 2026', 'programs in scope']],
  ['InterventionTimeline (90-day feed)', InterventionTimeline, {
    programs: scopedPrograms, phaseLines: seed.phaseLines, phaseRanges: seed.phaseRanges, graphNotes: seed.graphNotes,
    asOfDate: SEED_AS_OF_DATE, windowStart: scopeWindow.start, programScope: 'all',
    rangePhrase: scopeWindow.phrase, onOpen: noop
  }, ['Intervention timeline', 'Phase change', 'Respond to Hello', 'View timeline as a table']],
  ['InterventionTimeline (empty range)', InterventionTimeline, {
    programs: scopedPrograms, phaseLines: seed.phaseLines, phaseRanges: seed.phaseRanges, graphNotes: seed.graphNotes,
    asOfDate: SEED_AS_OF_DATE, windowStart: SEED_AS_OF_DATE, programScope: 'all',
    rangePhrase: scopeWindow.phrase, onOpen: noop
  }, ['Intervention timeline', 'No recorded changes in this range.']],
  ['TrendExplorer (three-pane shell)', TrendExplorer, {
    catalog: explorerCatalog,
    selection: {
      activeCategoryTab: 'SkillAcquisition',
      selectedProgramId: skillPrograms[0].id,
      selectedBehaviorIds: [firstBehaviorTarget.id],
      activeTargetType: firstSkillTarget.type,
      visibleTargetIds: new Set(skillPrograms[0].targets.map(target => target.id)),
      analysisTargetId: firstSkillTarget.id
    },
    skillPrograms,
    allBehaviors: behaviorTargets,
    onSelectCategory: noop,
    onSelectProgramDropdown: noop,
    onToggleBehaviorId: noop,
    onSelectBehaviorPreset: noop,
    onSelectProgramGroup: noop,
    onSelectTargetItem: noop,
    insights: [{ tone: 'attention', title: 'Plateau prompt', detail: 'Check teaching steps.', reference: 'Lane & Gast (2014)' }],
    focusedEntry: explorerCatalog.items[0],
    annotationTarget: firstSkillTarget,
    tabTargets: [firstSkillTarget],
    onAnnotationTargetChange: noop,
    activeAnnotations: { phaseLines: [], phaseRanges: [], graphNotes: [] },
    detailPrograms: [skillPrograms[0]],
    activeTarget: firstSkillTarget,
    children: createElement('div', null, 'Center chart workspace')
  }, ['Search targets or programs', 'Center chart workspace', 'Clinical context', 'Plateau prompt', 'Target definition', 'Discriminative stimuli:']],
  ['ClientSpecificSection (focus drilldown)', ClientSpecificSection, {
    client, programs, sessions, serviceSessions, abcEntries, annotations,
    templates: PROMPT_HIERARCHY_TEMPLATES, standards: CLINICAL_STANDARDS,
    initialFocus: {
      clientId: client.id,
      category: 'Behavior',
      behaviorIds: [firstBehaviorTarget.id],
      targetType: firstBehaviorTarget.type,
      durationFilter: '3 months',
      aggregation: 'Per Day',
      analysisTargetId: firstBehaviorTarget.id
    },
    onAddPhaseLineClick: noop, onAddPhaseRangeClick: noop, onAddGraphNoteClick: noop,
    onDeletePhaseLine: noop, onDeletePhaseRange: noop, onDeleteGraphNote: noop,
    onRefresh: noop, onEditAnnotation: noop, onRecordClick: noop, onManualEntryClick: noop,
    onCorrectObservation: noop, onDeleteObservation: noop, onProgramStatusChange: noop,
    canEdit: true, supervisionRecords
  }, [firstBehaviorTarget.name, 'Clinical context', 'Target definition', 'Function hypothesis:']],
];

let failures = 0;
const hasDom = typeof document !== 'undefined';
for (const [name, Component, props, expected] of [...cases, ...(hasDom ? portalCases : [])]) {
  try {
    const html = renderToStaticMarkup(createElement(Component, props));
    if (!html.length) throw new Error('rendered nothing');
    const missing = (expected || []).filter(text => !html.toLowerCase().includes(text.toLowerCase()));
    if (missing.length) throw new Error(`missing expected text: ${missing.join(', ')}`);
    console.log(`ok   ${name} (${html.length.toLocaleString()} characters)`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error.message}`);
    if (process.env.SMOKE_STACK) console.error(error.stack);
  }
}
if (!hasDom) console.log(`skip ${portalCases.length} dialogs (they render through a portal and need a browser)`);
console.log(failures ? `\n${failures} section(s) failed to render` : '\nAll sections rendered.');
process.exit(failures ? 1 : 0);
