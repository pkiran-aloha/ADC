using System;
using System.Collections.Generic;

namespace Welina.Analytics.Api.Models
{
    public class Client
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string DateOfBirth { get; set; } = string.Empty;
        public string PrimaryDiagnosis { get; set; } = "Autism Spectrum Disorder (ASD)";
        public string SupervisingBcba { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string? ServiceModel { get; set; } // Comprehensive or Focused
        public double? AuthorizedHoursPerWeek { get; set; }
        public string? ServiceStartDate { get; set; }
        public string? PrimarySetting { get; set; }
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
        // Chronological phases; the last entry matches Phase and PhaseEnteredDate.
        public List<PhaseHistoryEntry> PhaseHistory { get; set; } = new();
        public MasteryRule? MasteryRule { get; set; }
        // Behavior Reduction only: documented FBA hypothesis and intervention summary.
        public string? FunctionHypothesis { get; set; }
        public string? Intervention { get; set; }
    }

    public class PhaseHistoryEntry
    {
        public TargetStatus Phase { get; set; }
        public DateTime Date { get; set; }
    }

    public class MasteryRule
    {
        // percentCorrect, percentIntervals, intervalCount, count, ratePerHour, correctPerMinute, durationSeconds
        public string Measure { get; set; } = string.Empty;
        public string Comparison { get; set; } = string.Empty; // atLeast, atMost, below, above
        public double Threshold { get; set; }
        public int ConsecutiveSessions { get; set; }
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
        // One-character codes parallel to Levels, used in SessionDataPoint.TrialSequence.
        public List<string> Codes { get; set; } = new();
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
        public List<StaffMember> Staff { get; set; } = new();
        public List<ServiceSession> ServiceSessions { get; set; } = new();
        public ClinicalStandards ClinicalStandards { get; set; } = new();
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
        public string? ServiceSessionId { get; set; }
        public string? TrialSequence { get; set; } // prompt code per trial, e.g. "IIGIMIIIII"
        public string? IntervalScores { get; set; } // "1" scored / "0" not scored per interval
        public List<int>? EpisodeDurations { get; set; } // seconds per episode (Duration)
        public int? ErrorCount { get; set; } // FluencyRate errors during the timing
        public IoaRecord? Ioa { get; set; }
    }

    public class IoaRecord
    {
        public string Observer { get; set; } = string.Empty;
        public string Method { get; set; } = string.Empty; // TrialByTrial, IntervalByInterval, TotalCount, TotalDuration
        public int? Agreements { get; set; }
        public int? Total { get; set; }
        public int? Primary { get; set; }
        public int? Secondary { get; set; }
        public double Percent { get; set; }
    }

    // Appointment context for observations: setting, staff, setting events, supervision.
    public class ServiceSession
    {
        public string Id { get; set; } = string.Empty;
        public string ClientId { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string Start { get; set; } = string.Empty;
        public string End { get; set; } = string.Empty;
        public int Minutes { get; set; }
        public string TherapistName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string ServiceCode { get; set; } = string.Empty; // 97153, 97155, 97156
        public string Setting { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty; // Completed or Cancelled
        public string? CancelReason { get; set; }
        public List<string> SettingEvents { get; set; } = new();
        public SupervisionRecord? Supervision { get; set; }
        public FidelityRecord? Fidelity { get; set; }
        public string? IoaObserver { get; set; }
    }

    public class SupervisionRecord
    {
        public string Supervisor { get; set; } = string.Empty;
        public int Minutes { get; set; }
    }

    public class FidelityRecord
    {
        public string Observer { get; set; } = string.Empty;
        public int Correct { get; set; }
        public int Total { get; set; }
        public double Percent { get; set; }
    }

    public class StaffMember
    {
        public string Name { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty; // BCBA, BCaBA or RBT
        public string? StartDate { get; set; }
    }

    public class ClinicalStandards
    {
        public IoaStandard Ioa { get; set; } = new();
        public FidelityStandard Fidelity { get; set; } = new();
        public SupervisionStandard Supervision { get; set; } = new();
        public StabilityStandard Stability { get; set; } = new();
        public NonoverlapStandard Nonoverlap { get; set; } = new();
        public DualCriterionStandard Cdc { get; set; } = new();
    }

    public class IoaStandard
    {
        public double MinimumCoveragePercent { get; set; }
        public double PreferredCoveragePercent { get; set; }
        public double MinimumAgreementPercent { get; set; }
        public double PreferredAgreementPercent { get; set; }
        public string Source { get; set; } = string.Empty;
    }

    public class FidelityStandard
    {
        public double MinimumPercent { get; set; }
        public double PreferredPercent { get; set; }
        public string Source { get; set; } = string.Empty;
    }

    public class SupervisionStandard
    {
        public double RbtMinimumPercent { get; set; }
        public int RbtMinimumContactsPerMonth { get; set; }
        public string Source { get; set; } = string.Empty;
    }

    public class StabilityStandard
    {
        public double MedianBandPercent { get; set; }
        public double MinimumWithinPercent { get; set; }
        public string Source { get; set; } = string.Empty;
    }

    public class NonoverlapStandard
    {
        public List<double> NapBands { get; set; } = new();
        public List<double> PndBands { get; set; } = new();
        public string Source { get; set; } = string.Empty;
    }

    public class DualCriterionStandard
    {
        public double ShiftSd { get; set; }
        public double Alpha { get; set; }
        public string Source { get; set; } = string.Empty;
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
        public List<string> SettingEvents { get; set; } = new();
        // Antecedent -> motivating-operation category; consequence -> reinforcer it delivers.
        public Dictionary<string, string> AntecedentCategories { get; set; } = new();
        public Dictionary<string, string> ConsequenceFunctions { get; set; } = new();
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
        public List<string> SettingEvents { get; set; } = new();
        public string? ServiceSessionId { get; set; }
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
