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
        public string Status { get; set; } = "Active"; // Active, On Hold, Mastered
        public string Domain { get; set; } = string.Empty; // Communication, Social, Play, Adaptive
        public List<Target> Targets { get; set; } = new();
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
        public string MasteryCriteria { get; set; } = "80% across 3 consecutive sessions";
        public string StandardColor { get; set; } = "#3B82F6";
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
        public int? DurationSeconds { get; set; }
        public int? OccurrenceCount { get; set; }
        public double? LessonDurationMinutes { get; set; }
        public string? QualitativeEntry { get; set; }
        public BehaviorMissingDataMode? MissingDataMode { get; set; }
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
