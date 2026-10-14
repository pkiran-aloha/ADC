// Initial seeded clinical datasets for Welina ABA Analytics

export const INITIAL_CLIENTS = [
  {
    id: "cli-liam",
    name: "Liam Miller",
    code: "CL-1042",
    dateOfBirth: "2018-04-12",
    primaryDiagnosis: "Autism Spectrum Disorder (Level 2)",
    supervisingBcba: "Sarah Jenkins, BCBA",
    location: "Metro ABA Center - East"
  },
  {
    id: "cli-emma",
    name: "Emma Watson",
    code: "CL-1088",
    dateOfBirth: "2019-09-21",
    primaryDiagnosis: "ASD with Speech Apraxia",
    supervisingBcba: "David Vance, BCBA",
    location: "Metro ABA Center - North"
  },
  {
    id: "cli-noah",
    name: "Noah Davis",
    code: "CL-1095",
    dateOfBirth: "2017-11-05",
    primaryDiagnosis: "ASD with Sensory Processing Disorder",
    supervisingBcba: "Sarah Jenkins, BCBA",
    location: "In-Home Therapy"
  }
];

export const INITIAL_PROGRAMS = [
  // Liam's Programs
  {
    id: "prog-expressive",
    clientId: "cli-liam",
    name: "Expressive Labeling",
    category: "SkillAcquisition",
    status: "Active",
    domain: "Communication",
    description: "Expressive tacting of common objects, foods, and actions",
    targets: [
      {
        id: "tgt-expr-food",
        programId: "prog-expressive",
        name: "Expressive Food Items",
        description: "Names common foods shown in 2D picture cards",
        type: "TrialByTrial",
        phase: "Generalization",
        phaseEnteredDate: "2026-09-28",
        masteryCriteria: "80% across 3 consecutive sessions",
        color: "#3B82F6"
      },
      {
        id: "tgt-expr-preference",
        programId: "prog-expressive",
        name: "What are your preferences in Food?",
        description: "Qualitative anecdotal notes on food choices and spontaneous requests",
        type: "Anecdotal",
        phase: "Acquisition",
        phaseEnteredDate: "2026-09-10",
        masteryCriteria: "5 spontaneous descriptive entries per week",
        color: "#8B5CF6"
      }
    ]
  },
  {
    id: "prog-playing",
    clientId: "cli-liam",
    name: "Playing with Toys",
    category: "SkillAcquisition",
    status: "Active",
    domain: "Play & Leisure",
    description: "Independent sustained play and interactive social turn-taking",
    targets: [
      {
        id: "tgt-play-independent",
        programId: "prog-playing",
        name: "Independent Play with Legos",
        description: "Engages in sustained block building without teacher prompting",
        type: "Duration",
        phase: "Acquisition",
        phaseEnteredDate: "2026-08-15",
        masteryCriteria: "5 continuous minutes across 3 sessions",
        color: "#2563EB"
      },
      {
        id: "tgt-play-turn-taking",
        programId: "prog-playing",
        name: "Turn Taking in Board Games",
        description: "Waits for peer turn during structured tabletop game",
        type: "IntervalData",
        phase: "Maintenance",
        phaseEnteredDate: "2026-09-20",
        masteryCriteria: "85% intervals without prompt",
        color: "#10B981"
      }
    ]
  },
  {
    id: "prog-manding",
    clientId: "cli-liam",
    name: "Manding - Spontaneous Requests",
    category: "SkillAcquisition",
    status: "Active",
    domain: "Functional Communication",
    description: "Initiating verbal requests for desired items, actions, and assistance",
    targets: [
      {
        id: "tgt-mands-spontaneous",
        programId: "prog-manding",
        name: "Spontaneous 2-Word Mands",
        description: "Requests desired item/activity without verbal prompts",
        type: "Frequency",
        phase: "Acquisition",
        phaseEnteredDate: "2026-09-01",
        masteryCriteria: "15 mands per 1-hour session",
        color: "#F59E0B"
      }
    ]
  },
  {
    id: "prog-fluency",
    clientId: "cli-liam",
    name: "Tact Fluency (Sight Words)",
    category: "SkillAcquisition",
    status: "Active",
    domain: "Academic / Fluency",
    description: "High-rate tacting and reading fluency under timed intervals",
    targets: [
      {
        id: "tgt-sight-words",
        programId: "prog-fluency",
        name: "Rapid Sight Word Tacting",
        description: "Reads primer sight words in timed sprints",
        type: "FluencyRate",
        phase: "Acquisition",
        phaseEnteredDate: "2026-09-18",
        masteryCriteria: "30 words/minute",
        color: "#EC4899"
      }
    ]
  },
  {
    id: "prog-behaviors",
    clientId: "cli-liam",
    name: "Behavior Reduction Plan",
    category: "BehaviorReduction",
    status: "Active",
    domain: "Behavior Reduction",
    description: "Tracking problem behaviors under functional behavior intervention plan",
    targets: [
      {
        id: "br-vocal-disruption",
        programId: "prog-behaviors",
        name: "Vocal Disruption / Screaming",
        description: "High-pitched vocalizations or screaming interfering with instruction",
        type: "Frequency",
        phase: "Acquisition",
        phaseEnteredDate: "2026-07-10",
        masteryCriteria: "< 2 occurrences per session for 4 consecutive days",
        color: "#EF4444"
      },
      {
        id: "br-aggression",
        programId: "prog-behaviors",
        name: "Physical Aggression",
        description: "Hitting, scratching, or kicking directed at staff or peers",
        type: "Frequency",
        phase: "Acquisition",
        phaseEnteredDate: "2026-07-15",
        masteryCriteria: "0 occurrences for 10 consecutive sessions",
        color: "#F97316"
      },
      {
        id: "br-elopement",
        programId: "prog-behaviors",
        name: "Elopement / Leaving Area",
        description: "Moving > 5 feet away from instructional station without permission",
        type: "Duration",
        phase: "Acquisition",
        phaseEnteredDate: "2026-08-01",
        masteryCriteria: "< 30 total seconds per session",
        color: "#DC2626"
      }
    ]
  }
];

export const INITIAL_SESSION_DATA = [
  // Trial by Trial (Expressive Food Items)
  { id: "d-tbt-1", clientId: "cli-liam", targetId: "tgt-expr-food", timestamp: "2026-09-15 09:30", sessionNumber: 1, therapistName: "Sarah Jenkins, BCBA", value: 50, correctCount: 5, totalTrials: 10, lessonDurationMinutes: 45 },
  { id: "d-tbt-2", clientId: "cli-liam", targetId: "tgt-expr-food", timestamp: "2026-09-17 10:15", sessionNumber: 2, therapistName: "Joe Ronald, RBT", value: 60, correctCount: 6, totalTrials: 10, lessonDurationMinutes: 45 },
  { id: "d-tbt-3", clientId: "cli-liam", targetId: "tgt-expr-food", timestamp: "2026-09-19 09:45", sessionNumber: 3, therapistName: "Maya Patel, RBT", value: 60, correctCount: 6, totalTrials: 10, lessonDurationMinutes: 45 },
  { id: "d-tbt-4", clientId: "cli-liam", targetId: "tgt-expr-food", timestamp: "2026-09-22 10:30", sessionNumber: 4, therapistName: "Joe Ronald, RBT", value: 70, correctCount: 7, totalTrials: 10, lessonDurationMinutes: 45 },
  { id: "d-tbt-5", clientId: "cli-liam", targetId: "tgt-expr-food", timestamp: "2026-09-24 10:00", sessionNumber: 5, therapistName: "Sarah Jenkins, BCBA", value: 80, correctCount: 8, totalTrials: 10, lessonDurationMinutes: 45 },
  { id: "d-tbt-6", clientId: "cli-liam", targetId: "tgt-expr-food", timestamp: "2026-09-26 11:15", sessionNumber: 6, therapistName: "Maya Patel, RBT", value: 80, correctCount: 8, totalTrials: 10, lessonDurationMinutes: 45 },
  { id: "d-tbt-7", clientId: "cli-liam", targetId: "tgt-expr-food", timestamp: "2026-09-29 09:30", sessionNumber: 7, therapistName: "Joe Ronald, RBT", value: 90, correctCount: 9, totalTrials: 10, lessonDurationMinutes: 45 },
  { id: "d-tbt-8", clientId: "cli-liam", targetId: "tgt-expr-food", timestamp: "2026-10-01 10:00", sessionNumber: 8, therapistName: "Sarah Jenkins, BCBA", value: 90, correctCount: 9, totalTrials: 10, lessonDurationMinutes: 45 },
  { id: "d-tbt-9", clientId: "cli-liam", targetId: "tgt-expr-food", timestamp: "2026-10-03 10:15", sessionNumber: 9, therapistName: "Maya Patel, RBT", value: 100, correctCount: 10, totalTrials: 10, lessonDurationMinutes: 45 },
  { id: "d-tbt-10", clientId: "cli-liam", targetId: "tgt-expr-food", timestamp: "2026-10-06 09:45", sessionNumber: 10, therapistName: "Joe Ronald, RBT", value: 100, correctCount: 10, totalTrials: 10, lessonDurationMinutes: 45 },
  { id: "d-tbt-11", clientId: "cli-liam", targetId: "tgt-expr-food", timestamp: "2026-10-08 10:30", sessionNumber: 11, therapistName: "Sarah Jenkins, BCBA", value: 100, correctCount: 10, totalTrials: 10, lessonDurationMinutes: 45 },
  { id: "d-tbt-12", clientId: "cli-liam", targetId: "tgt-expr-food", timestamp: "2026-10-10 11:00", sessionNumber: 12, therapistName: "Maya Patel, RBT", value: 100, correctCount: 10, totalTrials: 10, lessonDurationMinutes: 45 },

  // Duration (Independent Play with Legos) - seconds: 158 sec = 02 min 38 sec
  { id: "d-dur-1", clientId: "cli-liam", targetId: "tgt-play-independent", timestamp: "2026-09-16 14:00", sessionNumber: 1, therapistName: "Joe Ronald, RBT", value: 95, durationSeconds: 95, occurrenceCount: 1, lessonDurationMinutes: 50 },
  { id: "d-dur-2", clientId: "cli-liam", targetId: "tgt-play-independent", timestamp: "2026-09-18 14:30", sessionNumber: 2, therapistName: "Sarah Jenkins, BCBA", value: 120, durationSeconds: 120, occurrenceCount: 1, lessonDurationMinutes: 50 },
  { id: "d-dur-3", clientId: "cli-liam", targetId: "tgt-play-independent", timestamp: "2026-09-21 14:15", sessionNumber: 3, therapistName: "Maya Patel, RBT", value: 158, durationSeconds: 158, occurrenceCount: 2, lessonDurationMinutes: 50 },
  { id: "d-dur-4", clientId: "cli-liam", targetId: "tgt-play-independent", timestamp: "2026-09-23 15:00", sessionNumber: 4, therapistName: "Joe Ronald, RBT", value: 185, durationSeconds: 185, occurrenceCount: 2, lessonDurationMinutes: 50 },
  { id: "d-dur-5", clientId: "cli-liam", targetId: "tgt-play-independent", timestamp: "2026-09-25 14:45", sessionNumber: 5, therapistName: "Sarah Jenkins, BCBA", value: 210, durationSeconds: 210, occurrenceCount: 2, lessonDurationMinutes: 50 },
  { id: "d-dur-6", clientId: "cli-liam", targetId: "tgt-play-independent", timestamp: "2026-09-28 14:20", sessionNumber: 6, therapistName: "Maya Patel, RBT", value: 228, durationSeconds: 228, occurrenceCount: 3, lessonDurationMinutes: 50 },
  { id: "d-dur-7", clientId: "cli-liam", targetId: "tgt-play-independent", timestamp: "2026-09-30 15:10", sessionNumber: 7, therapistName: "Joe Ronald, RBT", value: 255, durationSeconds: 255, occurrenceCount: 3, lessonDurationMinutes: 50 },
  { id: "d-dur-8", clientId: "cli-liam", targetId: "tgt-play-independent", timestamp: "2026-10-02 14:30", sessionNumber: 8, therapistName: "Sarah Jenkins, BCBA", value: 280, durationSeconds: 280, occurrenceCount: 3, lessonDurationMinutes: 50 },
  { id: "d-dur-9", clientId: "cli-liam", targetId: "tgt-play-independent", timestamp: "2026-10-05 14:15", sessionNumber: 9, therapistName: "Maya Patel, RBT", value: 310, durationSeconds: 310, occurrenceCount: 4, lessonDurationMinutes: 50 },
  { id: "d-dur-10", clientId: "cli-liam", targetId: "tgt-play-independent", timestamp: "2026-10-07 14:45", sessionNumber: 10, therapistName: "Joe Ronald, RBT", value: 345, durationSeconds: 345, occurrenceCount: 4, lessonDurationMinutes: 50 },
  { id: "d-dur-11", clientId: "cli-liam", targetId: "tgt-play-independent", timestamp: "2026-10-09 15:00", sessionNumber: 11, therapistName: "Sarah Jenkins, BCBA", value: 360, durationSeconds: 360, occurrenceCount: 4, lessonDurationMinutes: 50 },

  // Interval Data (Turn Taking in Board Games)
  { id: "d-int-1", clientId: "cli-liam", targetId: "tgt-play-turn-taking", timestamp: "2026-09-17 11:00", sessionNumber: 1, therapistName: "Sarah Jenkins, BCBA", value: 45, correctCount: 9, totalTrials: 20, lessonDurationMinutes: 40 },
  { id: "d-int-2", clientId: "cli-liam", targetId: "tgt-play-turn-taking", timestamp: "2026-09-19 11:30", sessionNumber: 2, therapistName: "Maya Patel, RBT", value: 55, correctCount: 11, totalTrials: 20, lessonDurationMinutes: 40 },
  { id: "d-int-3", clientId: "cli-liam", targetId: "tgt-play-turn-taking", timestamp: "2026-09-22 11:15", sessionNumber: 3, therapistName: "Joe Ronald, RBT", value: 65, correctCount: 13, totalTrials: 20, lessonDurationMinutes: 40 },
  { id: "d-int-4", clientId: "cli-liam", targetId: "tgt-play-turn-taking", timestamp: "2026-09-25 11:00", sessionNumber: 4, therapistName: "Sarah Jenkins, BCBA", value: 75, correctCount: 15, totalTrials: 20, lessonDurationMinutes: 40 },
  { id: "d-int-5", clientId: "cli-liam", targetId: "tgt-play-turn-taking", timestamp: "2026-09-29 11:30", sessionNumber: 5, therapistName: "Maya Patel, RBT", value: 80, correctCount: 16, totalTrials: 20, lessonDurationMinutes: 40 },
  { id: "d-int-6", clientId: "cli-liam", targetId: "tgt-play-turn-taking", timestamp: "2026-10-02 11:15", sessionNumber: 6, therapistName: "Joe Ronald, RBT", value: 85, correctCount: 17, totalTrials: 20, lessonDurationMinutes: 40 },
  { id: "d-int-7", clientId: "cli-liam", targetId: "tgt-play-turn-taking", timestamp: "2026-10-06 11:00", sessionNumber: 7, therapistName: "Sarah Jenkins, BCBA", value: 90, correctCount: 18, totalTrials: 20, lessonDurationMinutes: 40 },
  { id: "d-int-8", clientId: "cli-liam", targetId: "tgt-play-turn-taking", timestamp: "2026-10-09 11:45", sessionNumber: 8, therapistName: "Maya Patel, RBT", value: 95, correctCount: 19, totalTrials: 20, lessonDurationMinutes: 40 },

  // Anecdotal Data (Preferences in Food)
  { id: "d-anec-1", clientId: "cli-liam", targetId: "tgt-expr-preference", timestamp: "2026-10-12 14:25", sessionNumber: 1, therapistName: "Joe Ronald", qualitativeEntry: "Banana" },
  { id: "d-anec-2", clientId: "cli-liam", targetId: "tgt-expr-preference", timestamp: "2026-10-10 12:45", sessionNumber: 2, therapistName: "Maya Patel", qualitativeEntry: "Spontaneously requested pizza slices during lunch transition." },
  { id: "d-anec-3", clientId: "cli-liam", targetId: "tgt-expr-preference", timestamp: "2026-10-07 13:10", sessionNumber: 3, therapistName: "Sarah Jenkins", qualitativeEntry: "Said 'No broccoli please, want cheddar crackers'." },
  { id: "d-anec-4", clientId: "cli-liam", targetId: "tgt-expr-preference", timestamp: "2026-10-03 14:00", sessionNumber: 4, therapistName: "Joe Ronald", qualitativeEntry: "Pointed to sliced green apples and said 'Apple cool'." },
  { id: "d-anec-5", clientId: "cli-liam", targetId: "tgt-expr-preference", timestamp: "2026-09-29 12:15", sessionNumber: 5, therapistName: "Maya Patel", qualitativeEntry: "Chose strawberry yogurt cup when presented with 2 items." },

  // Fluency / Rate (Rapid Sight Word Tacting) - 24 occurrences in 7 minutes = Rate/Day 24, Rate/Min 3.43, Rate/Hr 205.71
  { id: "d-fl-1", clientId: "cli-liam", targetId: "tgt-sight-words", timestamp: "2026-09-20 15:30", sessionNumber: 1, therapistName: "Sarah Jenkins, BCBA", value: 14, occurrenceCount: 14, lessonDurationMinutes: 7 },
  { id: "d-fl-2", clientId: "cli-liam", targetId: "tgt-sight-words", timestamp: "2026-09-23 15:30", sessionNumber: 2, therapistName: "Joe Ronald, RBT", value: 18, occurrenceCount: 18, lessonDurationMinutes: 7 },
  { id: "d-fl-3", clientId: "cli-liam", targetId: "tgt-sight-words", timestamp: "2026-09-25 15:30", sessionNumber: 3, therapistName: "Maya Patel, RBT", value: 20, occurrenceCount: 20, lessonDurationMinutes: 7 },
  { id: "d-fl-4", clientId: "cli-liam", targetId: "tgt-sight-words", timestamp: "2026-09-28 15:30", sessionNumber: 4, therapistName: "Sarah Jenkins, BCBA", value: 24, occurrenceCount: 24, lessonDurationMinutes: 7 },
  { id: "d-fl-5", clientId: "cli-liam", targetId: "tgt-sight-words", timestamp: "2026-10-02 15:30", sessionNumber: 5, therapistName: "Joe Ronald, RBT", value: 26, occurrenceCount: 26, lessonDurationMinutes: 7 },
  { id: "d-fl-6", clientId: "cli-liam", targetId: "tgt-sight-words", timestamp: "2026-10-06 15:30", sessionNumber: 6, therapistName: "Maya Patel, RBT", value: 29, occurrenceCount: 29, lessonDurationMinutes: 7 },
  { id: "d-fl-7", clientId: "cli-liam", targetId: "tgt-sight-words", timestamp: "2026-10-09 15:30", sessionNumber: 7, therapistName: "Sarah Jenkins, BCBA", value: 32, occurrenceCount: 32, lessonDurationMinutes: 7 },

  // Frequency (Spontaneous Requests)
  { id: "d-fr-1", clientId: "cli-liam", targetId: "tgt-mands-spontaneous", timestamp: "2026-09-18 10:00", sessionNumber: 1, therapistName: "Joe Ronald, RBT", value: 7, occurrenceCount: 7, lessonDurationMinutes: 60 },
  { id: "d-fr-2", clientId: "cli-liam", targetId: "tgt-mands-spontaneous", timestamp: "2026-09-21 10:00", sessionNumber: 2, therapistName: "Maya Patel, RBT", value: 9, occurrenceCount: 9, lessonDurationMinutes: 60 },
  { id: "d-fr-3", clientId: "cli-liam", targetId: "tgt-mands-spontaneous", timestamp: "2026-09-24 10:00", sessionNumber: 3, therapistName: "Sarah Jenkins, BCBA", value: 11, occurrenceCount: 11, lessonDurationMinutes: 60 },
  { id: "d-fr-4", clientId: "cli-liam", targetId: "tgt-mands-spontaneous", timestamp: "2026-09-27 10:00", sessionNumber: 4, therapistName: "Joe Ronald, RBT", value: 14, occurrenceCount: 14, lessonDurationMinutes: 60 },
  { id: "d-fr-5", clientId: "cli-liam", targetId: "tgt-mands-spontaneous", timestamp: "2026-09-30 10:00", sessionNumber: 5, therapistName: "Maya Patel, RBT", value: 15, occurrenceCount: 15, lessonDurationMinutes: 60 },
  { id: "d-fr-6", clientId: "cli-liam", targetId: "tgt-mands-spontaneous", timestamp: "2026-10-04 10:00", sessionNumber: 6, therapistName: "Sarah Jenkins, BCBA", value: 18, occurrenceCount: 18, lessonDurationMinutes: 60 },
  { id: "d-fr-7", clientId: "cli-liam", targetId: "tgt-mands-spontaneous", timestamp: "2026-10-08 10:00", sessionNumber: 7, therapistName: "Joe Ronald, RBT", value: 20, occurrenceCount: 20, lessonDurationMinutes: 60 },

  // Behavior Reduction: Vocal Disruption (Frequency) - exhibits Zero Out
  { id: "d-br-vd-1", clientId: "cli-liam", targetId: "br-vocal-disruption", timestamp: "2026-09-15 11:00", sessionNumber: 1, therapistName: "Sarah Jenkins, BCBA", value: 16, occurrenceCount: 16, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-vd-2", clientId: "cli-liam", targetId: "br-vocal-disruption", timestamp: "2026-09-18 11:00", sessionNumber: 2, therapistName: "Joe Ronald, RBT", value: 14, occurrenceCount: 14, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-vd-3", clientId: "cli-liam", targetId: "br-vocal-disruption", timestamp: "2026-09-21 11:00", sessionNumber: 3, therapistName: "Maya Patel, RBT", value: 11, occurrenceCount: 11, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-vd-4", clientId: "cli-liam", targetId: "br-vocal-disruption", timestamp: "2026-09-24 11:00", sessionNumber: 4, therapistName: "Sarah Jenkins, BCBA", value: 9, occurrenceCount: 9, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-vd-5", clientId: "cli-liam", targetId: "br-vocal-disruption", timestamp: "2026-09-27 11:00", sessionNumber: 5, therapistName: "Joe Ronald, RBT", value: 7, occurrenceCount: 7, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-vd-6", clientId: "cli-liam", targetId: "br-vocal-disruption", timestamp: "2026-09-30 11:00", sessionNumber: 6, therapistName: "Maya Patel, RBT", value: 5, occurrenceCount: 5, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-vd-7", clientId: "cli-liam", targetId: "br-vocal-disruption", timestamp: "2026-10-03 11:00", sessionNumber: 7, therapistName: "Sarah Jenkins, BCBA", value: 3, occurrenceCount: 3, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-vd-8", clientId: "cli-liam", targetId: "br-vocal-disruption", timestamp: "2026-10-06 11:00", sessionNumber: 8, therapistName: "Joe Ronald, RBT", value: 2, occurrenceCount: 2, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-vd-9", clientId: "cli-liam", targetId: "br-vocal-disruption", timestamp: "2026-10-09 11:00", sessionNumber: 9, therapistName: "Maya Patel, RBT", value: 0, occurrenceCount: 0, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-vd-10", clientId: "cli-liam", targetId: "br-vocal-disruption", timestamp: "2026-10-11 11:00", sessionNumber: 10, therapistName: "Sarah Jenkins, BCBA", value: 0, occurrenceCount: 0, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },

  // Behavior Reduction: Physical Aggression (Frequency)
  { id: "d-br-ag-1", clientId: "cli-liam", targetId: "br-aggression", timestamp: "2026-09-16 13:00", sessionNumber: 1, therapistName: "Joe Ronald, RBT", value: 7, occurrenceCount: 7, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-ag-2", clientId: "cli-liam", targetId: "br-aggression", timestamp: "2026-09-20 13:00", sessionNumber: 2, therapistName: "Maya Patel, RBT", value: 5, occurrenceCount: 5, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-ag-3", clientId: "cli-liam", targetId: "br-aggression", timestamp: "2026-09-23 13:00", sessionNumber: 3, therapistName: "Sarah Jenkins, BCBA", value: 4, occurrenceCount: 4, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-ag-4", clientId: "cli-liam", targetId: "br-aggression", timestamp: "2026-09-27 13:00", sessionNumber: 4, therapistName: "Joe Ronald, RBT", value: 2, occurrenceCount: 2, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-ag-5", clientId: "cli-liam", targetId: "br-aggression", timestamp: "2026-10-01 13:00", sessionNumber: 5, therapistName: "Maya Patel, RBT", value: 1, occurrenceCount: 1, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-ag-6", clientId: "cli-liam", targetId: "br-aggression", timestamp: "2026-10-05 13:00", sessionNumber: 6, therapistName: "Sarah Jenkins, BCBA", value: 0, occurrenceCount: 0, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-ag-7", clientId: "cli-liam", targetId: "br-aggression", timestamp: "2026-10-08 13:00", sessionNumber: 7, therapistName: "Joe Ronald, RBT", value: 0, occurrenceCount: 0, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },

  // Behavior Reduction: Elopement (Duration seconds)
  { id: "d-br-el-1", clientId: "cli-liam", targetId: "br-elopement", timestamp: "2026-09-17 14:00", sessionNumber: 1, therapistName: "Sarah Jenkins, BCBA", value: 240, durationSeconds: 240, occurrenceCount: 1, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-el-2", clientId: "cli-liam", targetId: "br-elopement", timestamp: "2026-09-22 14:00", sessionNumber: 2, therapistName: "Maya Patel, RBT", value: 190, durationSeconds: 190, occurrenceCount: 1, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-el-3", clientId: "cli-liam", targetId: "br-elopement", timestamp: "2026-09-26 14:00", sessionNumber: 3, therapistName: "Joe Ronald, RBT", value: 110, durationSeconds: 110, occurrenceCount: 1, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-el-4", clientId: "cli-liam", targetId: "br-elopement", timestamp: "2026-10-02 14:00", sessionNumber: 4, therapistName: "Sarah Jenkins, BCBA", value: 65, durationSeconds: 65, occurrenceCount: 1, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" },
  { id: "d-br-el-5", clientId: "cli-liam", targetId: "br-elopement", timestamp: "2026-10-07 14:00", sessionNumber: 5, therapistName: "Maya Patel, RBT", value: 0, durationSeconds: 0, occurrenceCount: 0, lessonDurationMinutes: 60, missingDataMode: "ZeroOut" }
];

export const INITIAL_PHASE_LINES = [
  {
    id: "pcl-1",
    targetId: "tgt-expr-food",
    date: "2026-09-23",
    label: "Intervention Start (Differential Reinforcement)",
    style: "Solid",
    color: "#2563EB",
    isAutomated: false,
    source: "Manual"
  },
  {
    id: "pcl-2",
    targetId: "tgt-expr-food",
    date: "2026-10-02",
    label: "Generalization Across Settings",
    style: "Dotted",
    color: "#059669",
    isAutomated: true,
    source: "OutcomesPromotions"
  },
  {
    id: "pcl-3",
    targetId: "br-vocal-disruption",
    date: "2026-09-25",
    label: "FCT & Visual Break Board Implemented",
    style: "Solid",
    color: "#DC2626",
    isAutomated: false,
    source: "Manual"
  }
];

export const INITIAL_PHASE_RANGES = [
  {
    id: "pr-1",
    targetId: "tgt-expr-food",
    startDate: "2026-09-15",
    endDate: "2026-09-22",
    label: "Baseline Assessment Window",
    color: "rgba(147, 197, 253, 0.25)"
  }
];

export const INITIAL_GRAPH_NOTES = [
  {
    id: "gn-1",
    targetId: "tgt-expr-food",
    date: "2026-09-24",
    noteText: "Session conducted in new therapy room; client adjusted rapidly after familiar toy presented.",
    color: "#F59E0B",
    staffName: "Sarah Jenkins, BCBA"
  }
];

export const INITIAL_ABC_ENTRIES = [
  {
    id: "abc-1",
    clientId: "cli-liam",
    timestamp: "2026-10-12 10:20",
    therapist: "Joe Ronald, RBT",
    antecedents: ["Task Demand (Tabletop Math)", "Staff Transition"],
    behaviors: ["Vocal Disruption / Screaming", "Task Refusal"],
    consequences: ["Prompted Functional Mand ('I need a break')", "Demand Paused 2 min"],
    location: "Classroom / Therapy Table",
    notes: "Client resumed task after taking three deep breaths and completing 2 easy puzzle pieces.",
    intensity: 3,
    durationMinutes: 4
  },
  {
    id: "abc-2",
    clientId: "cli-liam",
    timestamp: "2026-10-10 14:15",
    therapist: "Maya Patel, RBT",
    antecedents: ["Peer Took Preferred Toy (Red Truck)", "Unstructured Free Play"],
    behaviors: ["Physical Aggression (Hitting)", "Grabbing Toy"],
    consequences: ["Blocked Aggression", "Facilitated Turn-Taking with Visual Timer"],
    location: "Play Area / Sensory Gym",
    notes: "Peer gave truck back after 1 minute timer sounded. Positive social interaction praised.",
    intensity: 4,
    durationMinutes: 3
  },
  {
    id: "abc-3",
    clientId: "cli-liam",
    timestamp: "2026-10-07 11:05",
    therapist: "Sarah Jenkins, BCBA",
    antecedents: ["Transition from Gym to Table"],
    behaviors: ["Elopement / Leaving Area"],
    consequences: ["Shadowed at safe distance", "First/Then Visual Board Presented"],
    location: "Hallway",
    notes: "Client checked visual schedule and independently walked back to station.",
    intensity: 2,
    durationMinutes: 2
  },
  {
    id: "abc-4",
    clientId: "cli-liam",
    timestamp: "2026-10-04 15:30",
    therapist: "Joe Ronald, RBT",
    antecedents: ["Denied Tangible (iPad)"],
    behaviors: ["Vocal Disruption / Screaming"],
    consequences: ["Extinction (No iPad given)", "Differential Reinforcement for Calming"],
    location: "Therapy Room B",
    notes: "Calmed after 3 minutes. Earned sticker on token board for completing puzzle.",
    intensity: 3,
    durationMinutes: 5
  },
  {
    id: "abc-5",
    clientId: "cli-liam",
    timestamp: "2026-09-29 13:45",
    therapist: "Maya Patel, RBT",
    antecedents: ["Loud Ambient Noise in Cafeteria"],
    behaviors: ["Elopement / Leaving Area"],
    consequences: ["Offered Noise-Canceling Headphones", "Moved to Quiet Corner"],
    location: "Cafeteria",
    notes: "Headphones immediately decreased agitation. Sensory accommodation noted in BIP.",
    intensity: 2,
    durationMinutes: 3
  },
  {
    id: "abc-6",
    clientId: "cli-liam",
    timestamp: "2026-09-25 09:50",
    therapist: "Joe Ronald, RBT",
    antecedents: ["Difficult Motor Imitation Task"],
    behaviors: ["Task Refusal", "Vocal Disruption / Screaming"],
    consequences: ["Error Correction Procedure", "Reduced Response Effort"],
    location: "Therapy Table A",
    notes: "Broke down motor task into 2 simpler components; accuracy increased to 80%.",
    intensity: 3,
    durationMinutes: 4
  }
];
