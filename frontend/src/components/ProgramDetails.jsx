import { CUSTOM_FIELD_DEFINITIONS, PROMPT_HIERARCHY_TEMPLATES } from '../data/mockData';
import { MEASUREMENT_LABELS } from '../utils/formValidation';

const startLabels = { LessonStart: 'Lesson start', Manual: 'Manual', LessonStartCountUp: 'Lesson start · count up', ManualStartCountUp: 'Manual · count up', ManualStartCountDown: 'Manual · count down' };
const captureLabels = { Whole: 'Whole interval', Partial: 'Partial interval', MomentaryTimeSampling: 'Momentary time sampling' };
const promptById = Object.fromEntries(PROMPT_HIERARCHY_TEMPLATES.map(item => [item.id, item]));
const fieldLabels = Object.fromEntries(CUSTOM_FIELD_DEFINITIONS.map(item => [item.key, item.label]));

export default function ProgramDetails({ programs = [] }) {
  if (!programs.length) return null;
  return <details className="definition-details">
    <summary>Program setup<span> · {programs.length === 1 ? programs[0].name : `${programs.length} selected behavior programs`}</span></summary>
    <div className="program-definitions">{programs.map(program => <article key={program.id} className="program-definition" aria-label={`${program.name} definition`}>
      <header className="flex flex-wrap items-center justify-between gap-3"><h3>{program.name}</h3><span className="status-label">{program.status}</span></header>
      <div className="definition-copy">
        <p><strong>Treatment area:</strong> {program.treatmentArea || program.domain || 'Not specified'}</p>
        <p><strong>Objective:</strong> {program.programObjective}</p>
        <p><strong>Teaching instructions:</strong> {program.teachingInstructions}</p>
        {program.baseline && <p><strong>Baseline:</strong> {program.baseline}</p>}
        {!!program.tags?.length && <p><strong>Tags:</strong> {program.tags.join(', ')}</p>}
        {!!program.learningMaterials?.length && <div><strong>Learning materials</strong><ul className="material-links">{program.learningMaterials.map(material => <li key={material.path}>
          <a href={`${import.meta.env.BASE_URL}${material.path}`} download={material.fileName}>{material.fileName}<span className="sr-only"> · download learning material</span></a>
        </li>)}</ul></div>}
        {!!Object.keys(program.customFields || {}).length && <p><strong>Custom fields:</strong> {Object.entries(program.customFields).map(([key, value]) => `${fieldLabels[key] || key}: ${value}`).join(' · ')}</p>}
      </div>
      <div className="target-definitions">{program.targets.map(target => {
        const hierarchy = promptById[target.promptHierarchyId];
        return <section key={target.id} className="target-definition" aria-label={`${target.name} settings`}>
          <div className="flex flex-wrap items-center gap-2"><h4>{target.name}</h4><span className="status-label">{MEASUREMENT_LABELS[target.type]}</span><span className="status-label">{target.phase === 'OnHold' ? 'On hold' : target.phase}</span></div>
          <p><strong>Discriminative stimuli:</strong> {target.discriminativeStimuli}</p>
          {target.targetInstructions && <p><strong>Target instructions:</strong> {target.targetInstructions}</p>}
          {hierarchy && <p><strong>Prompt hierarchy:</strong> {hierarchy.name} · {hierarchy.levels.join(' → ')}</p>}
          {target.intervalSettings && <p><strong>Interval:</strong> {startLabels[target.intervalSettings.startType]} · {target.intervalSettings.intervalLength} · {captureLabels[target.intervalSettings.captureType]}{target.intervalSettings.numberOfIntervals != null && ` · ${target.intervalSettings.numberOfIntervals} intervals`}</p>}
          {target.fluencySettings && <p><strong>Timer start:</strong> {startLabels[target.fluencySettings.startType]}</p>}
          <p><strong>Mastery:</strong> {target.masterySettings} · {target.masteryCriteria}</p>
        </section>;
      })}</div>
    </article>)}</div>
  </details>;
}
