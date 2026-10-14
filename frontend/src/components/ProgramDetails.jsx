import React from 'react';
import { CUSTOM_FIELD_DEFINITIONS, PROMPT_HIERARCHY_TEMPLATES } from '../data/mockData';

const measurementLabels = {
  TrialByTrial: 'Trial by Trial', Frequency: 'Frequency', Duration: 'Duration',
  IntervalData: 'Interval Data', Anecdotal: 'Anecdotal', FluencyRate: 'Fluency / Rate'
};
const startLabels = {
  LessonStart: 'Lesson Start', Manual: 'Manual', LessonStartCountUp: 'Lesson Start Count Up',
  ManualStartCountUp: 'Manual Start Count Up', ManualStartCountDown: 'Manual Start Count Down'
};
const captureLabels = { Whole: 'Whole', Partial: 'Partial', MomentaryTimeSampling: 'Momentary time sampling' };
const promptById = Object.fromEntries(PROMPT_HIERARCHY_TEMPLATES.map(item => [item.id, item]));
const fieldLabels = Object.fromEntries(CUSTOM_FIELD_DEFINITIONS.map(item => [item.key, item.label]));

export default function ProgramDetails({ programs = [] }) {
  if (!programs.length) return null;

  return (
    <details className="border-b border-slate-200 bg-blue-50/40 px-5 py-3 text-xs text-slate-700">
      <summary className="cursor-pointer font-semibold text-slate-800">
        Program definition{programs.length > 1 ? 's' : ''} · {programs.map(p => `${p.name} (${p.status})`).join(', ')}
        <span className="ml-2 text-blue-700">(view setup &amp; target settings)</span>
      </summary>
      <div className="grid gap-4 mt-3 lg:grid-cols-2">
        {programs.map(program => (
          <div key={program.id} className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900">{program.name}</h3>
              <span className="bg-blue-100 text-blue-800 rounded px-2 py-0.5 font-semibold">{program.status}</span>
            </div>
            <p><strong>Treatment area:</strong> {program.treatmentArea || program.domain || '—'}</p>
            <p><strong>Program objective:</strong> {program.programObjective}</p>
            <p><strong>Teaching instructions:</strong> {program.teachingInstructions}</p>
            {program.baseline && <p><strong>Baseline:</strong> {program.baseline}</p>}
            {!!program.tags?.length && <p><strong>Tags:</strong> {program.tags.join(', ')}</p>}
            {!!program.learningMaterials?.length && (
              <p><strong>Learning materials:</strong>{' '}
                {program.learningMaterials.map((material, index) => (
                  <React.Fragment key={material.path}>
                    {index > 0 && ', '}
                    <a href={`${import.meta.env.BASE_URL}${material.path}`} target="_blank" rel="noreferrer"
                      className="text-blue-700 underline">{material.fileName}</a>
                  </React.Fragment>
                ))}
              </p>
            )}
            {!!Object.keys(program.customFields || {}).length && (
              <p><strong>Custom fields:</strong>{' '}
                {Object.entries(program.customFields).map(([key, value]) => `${fieldLabels[key] || key}: ${value}`).join(' · ')}
              </p>
            )}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              {program.targets.map(target => {
                const hierarchy = promptById[target.promptHierarchyId];
                return (
                  <div key={target.id} className="rounded border border-slate-200 bg-slate-50 p-2.5 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">{target.name}</span>
                      <span className="rounded bg-white border border-slate-200 px-1.5">{measurementLabels[target.type]}</span>
                      <span className="rounded bg-white border border-slate-200 px-1.5">{target.phase}</span>
                    </div>
                    <p><strong>Discriminative stimuli:</strong> {target.discriminativeStimuli}</p>
                    {target.targetInstructions && <p><strong>Target instructions:</strong> {target.targetInstructions}</p>}
                    {hierarchy && <p><strong>Prompt hierarchy:</strong> {hierarchy.name} ({hierarchy.levels.join(' → ')})</p>}
                    {target.intervalSettings && (
                      <p><strong>Interval:</strong> {startLabels[target.intervalSettings.startType]} ·{' '}
                        {target.intervalSettings.intervalLength} ·{' '}
                        {captureLabels[target.intervalSettings.captureType]}
                        {target.intervalSettings.numberOfIntervals != null &&
                          ` · ${target.intervalSettings.numberOfIntervals} intervals`}
                      </p>
                    )}
                    {target.fluencySettings &&
                      <p><strong>Timer start:</strong> {startLabels[target.fluencySettings.startType]}</p>}
                    <p><strong>Mastery:</strong> {target.masterySettings} · {target.masteryCriteria}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
