// One versioned, fictional demo dataset shared with the .NET API.
// Update scripts/generate_clinical_seed.py and regenerate data/clinicalSeed.json.
import seed from '../../../data/clinicalSeed.json' with { type: 'json' };

export const SEED_VERSION = seed.revision;
export const SEED_AS_OF_DATE = seed.asOfDate;
export const INITIAL_CLIENTS = seed.clients;
export const INITIAL_PROGRAMS = seed.programs;
export const INITIAL_SESSION_DATA = seed.sessionData;
export const INITIAL_PHASE_LINES = seed.phaseLines;
export const INITIAL_PHASE_RANGES = seed.phaseRanges;
export const INITIAL_GRAPH_NOTES = seed.graphNotes;
export const INITIAL_ABC_CONFIGURATIONS = seed.abcConfigurations;
export const INITIAL_ABC_ENTRIES = seed.abcEntries;
export const PROMPT_HIERARCHY_TEMPLATES = seed.promptHierarchyTemplates;
export const CUSTOM_FIELD_DEFINITIONS = seed.customFieldDefinitions;
