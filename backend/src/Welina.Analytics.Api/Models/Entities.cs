using System;
using System.Collections.Generic;

namespace Welina.Analytics.Api.Models
{
    public class Client
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string DateOfBirth { get; set; } = string.Empty;
        public string PrimaryDiagnosis { get; set; } = "Autism Spectrum Disorder (ASD)";
        public string SupervisingBcba { get; set; } = string.Empty;
    }

    public class TherapyProgram
    {
        public string Id { get; set; } = string.Empty;
        public string ClientId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public ProgramCategory Category { get; set; }
        public string Status { get; set; } = string.Empty; // Baselining, Teaching, Maintaining, etc.
        public string Domain { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ProgramObjective { get; set; } = string.Empty;
        public string TeachingInstructions { get; set; } = string.Empty;
        public string? TreatmentArea { get; set; }
        public string? Baseline { get; set; }
        public List<string> Tags { get; set; } = new();
        public List<LearningMaterial> LearningMaterials { get; set; } = new();
        public Dictionary<string, string> CustomFields { get; set; } = new();
        // Behavior Reduction programs contain exactly one target for the existing analytics UI.
        public List<Target> Targets { get; set; } = new();
    }

    public class LearningMaterial
    {
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public string Path { get; set; } = string.Empty;
    }

    public class Target
    {
        public string Id { get; set; } = string.Empty;
        public string ProgramId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public TargetType Type { get; set; }
        public TargetStatus Phase { get; set; }
        public DateTime PhaseEnteredDate { get; set; }
        public string DiscriminativeStimuli { get; set; } = string.Empty;
        public string? TargetInstructions { get; set; }
        public string? PromptHierarchyId { get; set; }
        public string MasterySettings { get; set; } = string.Empty; // Manual or Automatic
        public string MasteryCriteria { get; set; } = string.Empty;
        public IntervalSettings? IntervalSettings { get; set; }
        public FluencySettings? FluencySettings { get; set; }
        public string Color { get; set; } = "#3B82F6";
    }

    public class IntervalSettings
    {
        public string StartType { get; set; } = string.Empty; // LessonStart or Manual
        public string IntervalLength { get; set; } = string.Empty; // mm:ss
        public string CaptureType { get; set; } = string.Empty; // Whole, Partial, MomentaryTimeSampling
        public int? NumberOfIntervals { get; set; }
    }

    public class FluencySettings
    {
        public string StartType { get; set; } = string.Empty; // LessonStartCountUp, ManualStartCountUp/Down
    }

    public class PromptHierarchyTemplate
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public List<string> Levels { get; set; } = new();
    }

    public class CustomFieldDefinition
    {
        public string Key { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string InputType { get; set; } = string.Empty;
    }

    public class ProgramCatalog
    {
        public List<PromptHierarchyTemplate> PromptHierarchyTemplates { get; set; } = new();
        public List<CustomFieldDefinition> CustomFieldDefinitions { get; set; } = new();
    }

    // Deserialized from the one fixture shared with the frontend.
    public class ClinicalSeed
    {
        public string AsOfDate { get; set; } = string.Empty;
        public List<Client> Clients { get; set; } = new();
        public List<TherapyProgram> Programs { get; set; } = new();
        public List<SessionDataPoint> SessionData { get; set; } = new();
        public List<AbcEntry> AbcEntries { get; set; } = new();
        public List<AbcConfiguration> AbcConfigurations { get; set; } = new();
        public List<PhaseChangeLine> PhaseLines { get; set; } = new();
        public List<PhaseRange> PhaseRanges { get; set; } = new();
        public List<GraphNote> GraphNotes { get; set; } = new();
        public List<PromptHierarchyTemplate> PromptHierarchyTemplates { get; set; } = new();
        public List<CustomFieldDefinition> CustomFieldDefinitions { get; set; } = new();
    }

    public class SessionDataPoint
    {
        public string Id { get; set; } = string.Empty;
        public string TargetId { get; set; } = string.Empty;
        public string ClientId { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        public int SessionNumber { get; set; }
        public string TherapistName { get; set; } = string.Empty;
        public double? Value { get; set; } // Numerical value depending on type
        public int? CorrectCount { get; set; }
        public int? TotalTrials { get; set; }
        public int? OccurredIntervals { get; set; }
        public int? TotalIntervals { get; set; }
        public int? DurationSeconds { get; set; }
        public int? OccurrenceCount { get; set; }
        public double? LessonDurationMinutes { get; set; }
        public string? QualitativeEntry { get; set; }
        public BehaviorMissingDataMode? MissingDataMode { get; set; }
    }

    public class AbcConfiguration
    {
        public string ClientId { get; set; } = string.Empty;
        public string TreatmentArea { get; set; } = string.Empty;
        public string TeachingInstructions { get; set; } = string.Empty;
        public List<string> Antecedents { get; set; } = new();
        public List<string> Behaviors { get; set; } = new();
        public List<string> Consequences { get; set; } = new();
        public List<string> Locations { get; set; } = new();
    }

    public class AbcEntry
    {
        public string Id { get; set; } = string.Empty;
        public string ClientId { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        public string Therapist { get; set; } = string.Empty;
        public List<string> Antecedents { get; set; } = new();
        public List<string> Behaviors { get; set; } = new();
        public List<string> Consequences { get; set; } = new();
        public string Location { get; set; } = string.Empty;
        public string Notes { get; set; } = string.Empty;
        public int Intensity { get; set; } = 1;
        public int DurationMinutes { get; set; } = 5;
    }

    public class PhaseChangeLine
    {
        public string Id { get; set; } = string.Empty;
        public string TargetId { get; set; } = string.Empty;
        public string? ProgramId { get; set; }
        public DateTime Date { get; set; }
        public string Label { get; set; } = string.Empty;
        public LineStyle Style { get; set; } = LineStyle.Solid;
        public string Color { get; set; } = "#3B82F6";
        public bool IsAutomated { get; set; } = false;
        public string Source { get; set; } = "Manual"; // Manual, ProgramUpdate, OutcomesPromotions, Bulk
    }

    public class PhaseRange
    {
        public string Id { get; set; } = string.Empty;
        public string TargetId { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string Label { get; set; } = string.Empty;
        public string Color { get; set; } = "#93C5FD40"; // Semi-transparent blue
    }

    public class GraphNote
    {
        public string Id { get; set; } = string.Empty;
        public string TargetId { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string NoteText { get; set; } = string.Empty;
        public string Color { get; set; } = "#F59E0B";
        public string StaffName { get; set; } = string.Empty;
    }

    public class MasteryDataPoint
    {
        public DateTime Date { get; set; }
        public int CumulativeMasteredCount { get; set; }
        public List<string> NewlyMasteredTargetNames { get; set; } = new();
    }
}
