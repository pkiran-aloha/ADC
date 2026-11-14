// The public library: best-practice programs and behaviors that every practice can reuse.
//
// In the platform a super user manages this library. Here it is a fixed, read-only set of
// fictional starter programs, so the "Add to client" and "Add to organization" journeys can
// be exercised honestly. Nothing in it describes a real learner, and nothing here changes.

const AS_OF = '2026-10-14';

function target(programId, key, fields) {
  return {
    id: `pub-${programId}-${key}`,
    programId: `pub-${programId}`,
    description: '',
    phase: 'Pending',
    phaseEnteredDate: AS_OF,
    phaseHistory: [],
    masterySettings: 'Automatic',
    color: '#3B82F6',
    ...fields
  };
}

const rule = (measure, comparison, threshold, consecutiveSessions) => ({ measure, comparison, threshold, consecutiveSessions });

function skill(key, fields, targets) {
  const id = `pub-${key}`;
  return {
    id, clientId: null, scope: 'public', category: 'SkillAcquisition', status: 'Pending', archivedAt: null,
    domain: fields.treatmentArea[0], description: fields.programObjective, baseline: '',
    learningMaterials: [], customFields: {}, statusHistory: [], ...fields,
    targets: targets.map(([targetKey, targetFields]) => target(key, targetKey, targetFields))
  };
}

function behavior(key, fields, tool) {
  const id = `pub-${key}`;
  return {
    id, clientId: null, scope: 'public', category: 'BehaviorReduction', status: 'Pending', behaviorPhase: 'Open',
    archivedAt: null, domain: 'Behavior Reduction', description: fields.programObjective, baseline: '',
    learningMaterials: [], customFields: {}, statusHistory: [], teachingInstructions: '', ...fields,
    targets: [target(key, 'measure', {
      name: fields.name, phase: 'Open', masterySettings: 'Manual', discriminativeStimuli: '', color: '#EF4444', ...tool
    })]
  };
}

export const PUBLIC_PROGRAMS = [
  skill('requesting', {
    name: 'Requesting Preferred Items (Mand Training)',
    treatmentArea: ['Functional communication'], tags: ['Mand', 'Communication', 'Early learner'],
    programObjective: 'The learner independently requests a preferred item or activity, using a word, sign, picture or device, across people and settings.',
    teachingInstructions: 'Contrast the learner’s motivation: present or withhold a highly preferred item, wait up to five seconds, prompt the request if needed, and deliver the item immediately after a correct request. Fade prompts across sessions.'
  }, [
    ['item', {
      name: 'Requests a preferred item', type: 'TrialByTrial', promptHierarchyId: 'most-to-least',
      discriminativeStimuli: 'A preferred item is visible and out of reach.', masteryRule: rule('percentCorrect', 'atLeast', 80, 3),
      masteryCriteria: 'At least 80% independent requests for 3 sessions'
    }],
    ['activity', {
      name: 'Requests a preferred activity', type: 'TrialByTrial', promptHierarchyId: 'least-to-most',
      discriminativeStimuli: 'A preferred activity is available and the learner is not yet engaged.', masteryRule: rule('percentCorrect', 'atLeast', 80, 3),
      masteryCriteria: 'At least 80% independent requests for 3 sessions'
    }],
    ['initiations', {
      name: 'Spontaneous requests per session', type: 'Frequency', masteryRule: rule('count', 'atLeast', 8, 3),
      masteryCriteria: 'At least 8 spontaneous requests per session for 3 sessions'
    }]
  ]),
  skill('receptive', {
    name: 'Following One-Step Instructions',
    treatmentArea: ['Receptive language'], tags: ['Listener responding', 'Receptive language'],
    programObjective: 'The learner follows a familiar one-step spoken instruction without a gesture or other prompt.',
    teachingInstructions: 'Give the instruction once, in a calm voice, and wait five seconds. Prompt using the assigned hierarchy and reinforce the correct response right away. Rotate the instructions so the learner responds to the words and not to a routine.'
  }, [
    ['actions', {
      name: 'Follows one-step action instructions', type: 'TrialByTrial', promptHierarchyId: 'least-to-most',
      discriminativeStimuli: 'The instructor says the instruction, such as “Clap hands”.', masteryRule: rule('percentCorrect', 'atLeast', 80, 3),
      masteryCriteria: 'At least 80% independent for 3 sessions'
    }],
    ['objects', {
      name: 'Gives a named object on request', type: 'TrialByTrial', promptHierarchyId: 'most-to-least',
      discriminativeStimuli: 'Three objects are on the table and the instructor says “Give me the cup”.', masteryRule: rule('percentCorrect', 'atLeast', 80, 3),
      masteryCriteria: 'At least 80% independent for 3 sessions'
    }]
  ]),
  skill('turn-taking', {
    name: 'Turn Taking in Play',
    treatmentArea: ['Social skills', 'Play and leisure'], tags: ['Social', 'Play'],
    programObjective: 'The learner waits for a partner’s turn and takes their own turn in a simple game, without protest, across partners.',
    teachingInstructions: 'Use a visual turn cue and a short, preferred game. Start with one turn each, praise waiting, and lengthen the wait slowly. Model and prompt the verbal cue “My turn” only if needed.'
  }, [
    ['turns', {
      name: 'Takes turns in a two-person game', type: 'IntervalData',
      intervalSettings: { startType: 'LessonStart', intervalLength: '01:00', captureType: 'Whole', numberOfIntervals: 10 },
      masteryRule: rule('percentIntervals', 'atLeast', 80, 3), masteryCriteria: 'Turn taking in at least 80% of intervals for 3 sessions'
    }],
    ['wait', {
      name: 'Waits for a partner’s turn', type: 'Duration', masteryRule: rule('durationSeconds', 'atLeast', 60, 3),
      masteryCriteria: 'Waits at least 60 seconds for 3 sessions'
    }]
  ]),
  skill('reading-fluency', {
    name: 'Sight Word Fluency',
    treatmentArea: ['Academic', 'Fluency'], tags: ['Reading', 'Fluency', 'Timed probe'],
    programObjective: 'The learner reads a set of known sight words accurately and quickly, within a one-minute timed probe.',
    teachingInstructions: 'Run a one-minute timed probe at the start of the session, count correct and incorrect words, and chart both. Practise missed words, then probe again at the end of the session.'
  }, [
    ['probe', {
      name: 'Correct sight words per minute', type: 'FluencyRate', fluencySettings: { startType: 'ManualStartCountDown' },
      masteryRule: rule('correctPerMinute', 'atLeast', 30, 3), masteryCriteria: 'At least 30 correct per minute for 3 sessions'
    }]
  ]),
  skill('self-help', {
    name: 'Washing Hands (Task Steps)',
    treatmentArea: ['Daily living'], tags: ['Self-help', 'Routine'],
    programObjective: 'The learner washes and dries their hands, from turning on the tap to throwing the towel away, with no prompts.',
    teachingInstructions: 'Teach one step at a time with the steps in the same order each day. Prompt only the step being taught, and reinforce at the end of the routine. Record each step as a separate target.'
  }, [
    ['tap', {
      name: 'Turns on the tap', type: 'TrialByTrial', promptHierarchyId: 'most-to-least',
      discriminativeStimuli: 'The learner is at the sink with dirty hands.', masteryRule: rule('percentCorrect', 'atLeast', 80, 3),
      masteryCriteria: 'At least 80% independent for 3 sessions'
    }],
    ['soap', {
      name: 'Uses soap and rubs hands', type: 'TrialByTrial', promptHierarchyId: 'most-to-least',
      discriminativeStimuli: 'The tap is running and the soap is within reach.', masteryRule: rule('percentCorrect', 'atLeast', 80, 3),
      masteryCriteria: 'At least 80% independent for 3 sessions'
    }],
    ['dry', {
      name: 'Dries hands with a towel', type: 'TrialByTrial', promptHierarchyId: 'most-to-least',
      discriminativeStimuli: 'The hands are rinsed and a towel is on the rail.', masteryRule: rule('percentCorrect', 'atLeast', 80, 3),
      masteryCriteria: 'At least 80% independent for 3 sessions'
    }]
  ]),
  behavior('aggression', {
    name: 'Aggression Toward Others',
    treatmentArea: ['Behavior reduction'], tags: ['Behavior reduction', 'Safety', 'Frequency'],
    programObjective: 'Reduce hitting, kicking and scratching directed at other people, and replace them with a functional alternative.',
    operationalDefinition: 'Any forceful contact of the learner’s hand, foot or nails against another person’s body, such as hitting, kicking, pinching or scratching. Accidental contact during play and contact with objects are not counted. Two episodes are separate when at least ten seconds pass between them.'
  }, { type: 'Frequency' }),
  behavior('elopement', {
    name: 'Elopement',
    treatmentArea: ['Behavior reduction'], tags: ['Behavior reduction', 'Safety', 'Duration'],
    programObjective: 'Reduce the time the learner spends outside the designated area without permission.',
    operationalDefinition: 'The learner moves more than two metres from the designated area, or past a doorway, without permission from an adult. The behavior starts when the learner crosses the boundary and ends when they are back inside it.'
  }, { type: 'Duration' }),
  behavior('off-task', {
    name: 'Off-Task Behavior',
    treatmentArea: ['Behavior reduction'], tags: ['Behavior reduction', 'Engagement', 'Interval'],
    programObjective: 'Increase engagement during seated work by reducing the share of intervals in which the learner is off task.',
    operationalDefinition: 'The learner’s eyes and hands are directed away from the work materials, the instructor or the activity for most of an interval, for example looking around the room, leaving the seat or playing with unrelated items.'
  }, { type: 'IntervalData', intervalSettings: { startType: 'LessonStart', intervalLength: '00:30', captureType: 'Partial', numberOfIntervals: 20 } })
];

export const PUBLIC_LIBRARY_NOTE = 'Starter programs for every practice. They are fictional, read-only here, and managed by a super user on the platform.';
