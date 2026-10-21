import { CUSTOM_FIELD_DEFINITIONS, PROMPT_HIERARCHY_TEMPLATES } from '../data/mockData';
import { MEASUREMENT_LABELS } from '../utils/formValidation';

const startLabels = {
  LessonStart: 'Lesson start',
  Manual: 'Manual',
  LessonStartCountUp: 'Lesson start · count up',
  ManualStartCountUp: 'Manual · count up',
  ManualStartCountDown: 'Manual · count down'
};
const captureLabels = {
  Whole: 'Whole interval',
  Partial: 'Partial interval',
  MomentaryTimeSampling: 'Momentary time sampling'
};
const promptById = Object.fromEntries(PROMPT_HIERARCHY_TEMPLATES.map(item => [item.id, item]));
const fieldLabels = Object.fromEntries(CUSTOM_FIELD_DEFINITIONS.map(item => [item.key, item.label]));

function TargetDefinitionContent({ target, showHeading = true }) {
  if (!target) return null;
  const hierarchy = promptById[target.promptHierarchyId];
  return (
    <section className="target-definition" aria-label={`${target.name} settings`}>
      <div className="flex flex-wrap items-center gap-2">
        {showHeading && <h4>{target.name}</h4>}
        <span className="status-label">{MEASUREMENT_LABELS[target.type]}</span>
        <span className="status-label">{target.phase === 'OnHold' ? 'On hold' : target.phase}</span>
      </div>
      <p><strong>Discriminative stimuli:</strong> {target.discriminativeStimuli}</p>
      {target.targetInstructions && <p><strong>Target instructions:</strong> {target.targetInstructions}</p>}
      {hierarchy && <p><strong>Prompt hierarchy:</strong> {hierarchy.name} · {hierarchy.levels.join(' → ')}</p>}
      {target.intervalSettings && (
        <p>
          <strong>Interval:</strong> {startLabels[target.intervalSettings.startType]} · {target.intervalSettings.intervalLength} · {captureLabels[target.intervalSettings.captureType]}
          {target.intervalSettings.numberOfIntervals != null && ` · ${target.intervalSettings.numberOfIntervals} intervals`}
        </p>
      )}
      {target.fluencySettings && <p><strong>Timer start:</strong> {startLabels[target.fluencySettings.startType]}</p>}
      {target.functionHypothesis && <p><strong>Function hypothesis:</strong> {target.functionHypothesis}</p>}
      {target.intervention && <p><strong>Intervention:</strong> {target.intervention}</p>}
      <p><strong>Mastery:</strong> {target.masterySettings} · {target.masteryCriteria}</p>
    </section>
  );
}

// Renders clinical definitions as visible right-rail cards rather than hiding SD, prompt
// hierarchy, mastery criteria and learning materials behind a top-of-page disclosure.
// Extended program procedures and additional targets remain one click away inside each
// program card so the rail stays scannable at eye level beside the chart.
export default function ProgramDetails({ programs = [], activeTarget = null }) {
  if (!programs.length) return null;
  const focusedTarget = activeTarget || programs[0]?.targets?.[0] || null;

  return (
    <div className="rail-definitions">
      {focusedTarget && (
        <section className="rail-card" aria-labelledby="explorer-target-def-title">
          <div className="rail-card__head">
            <h3 id="explorer-target-def-title">Target definition</h3>
          </div>
          <TargetDefinitionContent target={focusedTarget} />
        </section>
      )}
      {programs.map(program => {
        const otherTargets = program.targets.filter(target => target.id !== focusedTarget?.id);
        return (
          <article key={program.id} className="rail-card program-definition" aria-label={`${program.name} definition`}>
            <header className="rail-card__head">
              <h3>{program.name}</h3>
              <span className="status-label">{program.status}</span>
            </header>
            <div className="definition-copy">
              <p><strong>Treatment area:</strong> {program.treatmentArea || program.domain || 'Not specified'}</p>
              <p><strong>Objective:</strong> {program.programObjective}</p>
              {focusedTarget && program.targets.some(target => target.id === focusedTarget.id) && promptById[focusedTarget.promptHierarchyId] && (
                <p>
                  <strong>Prompt hierarchy:</strong> {promptById[focusedTarget.promptHierarchyId].name} · {promptById[focusedTarget.promptHierarchyId].levels.join(' → ')}
                </p>
              )}
              {!!program.learningMaterials?.length && (
                <div>
                  <strong>Learning materials</strong>
                  <ul className="material-links">
                    {program.learningMaterials.map(material => (
                      <li key={material.path}>
                        <a href={`${import.meta.env.BASE_URL}${material.path}`} download={material.fileName}>
                          {material.fileName}<span className="sr-only"> · download learning material</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <details className="definition-details rail-setup-details">
              <summary>
                Program setup<span> · procedures &amp; all {program.targets.length} {program.targets.length === 1 ? 'target' : 'targets'}</span>
              </summary>
              <div className="definition-copy">
                <p><strong>Teaching instructions:</strong> {program.teachingInstructions}</p>
                {program.baseline && <p><strong>Baseline:</strong> {program.baseline}</p>}
                {!!program.tags?.length && <p><strong>Tags:</strong> {program.tags.join(', ')}</p>}
                {!!Object.keys(program.customFields || {}).length && (
                  <p>
                    <strong>Custom fields:</strong>{' '}
                    {Object.entries(program.customFields).map(([key, value]) => `${fieldLabels[key] || key}: ${value}`).join(' · ')}
                  </p>
                )}
              </div>
              {otherTargets.length > 0 && (
                <div className="target-definitions">
                  {otherTargets.map(target => <TargetDefinitionContent key={target.id} target={target} />)}
                </div>
              )}
            </details>
          </article>
        );
      })}
    </div>
  );
}
