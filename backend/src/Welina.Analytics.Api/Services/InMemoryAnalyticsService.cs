using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using Welina.Analytics.Api.Models;

namespace Welina.Analytics.Api.Services
{
    public class InMemoryAnalyticsService : IAnalyticsService
    {
        private readonly List<Client> _clients = new();
        private readonly List<TherapyProgram> _programs = new();
        private readonly List<SessionDataPoint> _dataPoints = new();
        private readonly List<AbcEntry> _abcEntries = new();
        private readonly List<AbcConfiguration> _abcConfigurations = new();
        private readonly ProgramCatalog _programCatalog = new();
        private readonly List<PhaseChangeLine> _phaseLines = new();
        private readonly List<PhaseRange> _phaseRanges = new();
        private readonly List<GraphNote> _graphNotes = new();

        public InMemoryAnalyticsService()
        {
            using var stream = typeof(InMemoryAnalyticsService).Assembly.GetManifestResourceStream(
                "Welina.Analytics.Api.clinicalSeed.json")
                ?? throw new InvalidOperationException("Embedded clinical demo fixture is missing.");
            var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
            options.Converters.Add(new JsonStringEnumConverter());
            var seed = JsonSerializer.Deserialize<ClinicalSeed>(stream, options)
                ?? throw new InvalidOperationException("Clinical demo fixture could not be loaded.");

            _clients.AddRange(seed.Clients);
            _programs.AddRange(seed.Programs);
            _dataPoints.AddRange(seed.SessionData);
            _abcEntries.AddRange(seed.AbcEntries);
            _abcConfigurations.AddRange(seed.AbcConfigurations);
            _phaseLines.AddRange(seed.PhaseLines);
            _phaseRanges.AddRange(seed.PhaseRanges);
            _graphNotes.AddRange(seed.GraphNotes);
            _programCatalog.PromptHierarchyTemplates.AddRange(seed.PromptHierarchyTemplates);
            _programCatalog.CustomFieldDefinitions.AddRange(seed.CustomFieldDefinitions);
        }

        public List<Client> GetClients() => _clients;

        public Client? GetClient(string clientId) => _clients.FirstOrDefault(c => c.Id == clientId);

        public List<TherapyProgram> GetProgramsByClient(string clientId, ProgramCategory? category = null)
        {
            var query = _programs.Where(p => p.ClientId == clientId);
            if (category.HasValue)
            {
                query = query.Where(p => p.Category == category.Value);
            }
            return query.ToList();
        }

        public ProgramCatalog GetProgramCatalog() => _programCatalog;

        public List<MasteryDataPoint> GetCumulativeMastery(string clientId, string programId)
        {
            var program = _programs.FirstOrDefault(p => p.ClientId == clientId && p.Id == programId);
            if (program == null) return new List<MasteryDataPoint>();

            // Calculate historical mastery milestones for targets in this program
            var masteredStates = new[] { TargetStatus.Maintenance, TargetStatus.Generalization, TargetStatus.Completed };
            var transitionEvents = new List<(DateTime Date, string TargetName)>();

            foreach (var target in program.Targets)
            {
                if (masteredStates.Contains(target.Phase))
                {
                    transitionEvents.Add((target.PhaseEnteredDate.Date, target.Name));
                }
            }

            var groupedByDate = transitionEvents
                .GroupBy(e => e.Date)
                .OrderBy(g => g.Key)
                .ToList();

            var result = new List<MasteryDataPoint>();
            int cumulative = 0;

            foreach (var group in groupedByDate)
            {
                cumulative += group.Count();
                result.Add(new MasteryDataPoint
                {
                    Date = group.Key,
                    CumulativeMasteredCount = cumulative,
                    NewlyMasteredTargetNames = group.Select(x => x.TargetName).ToList()
                });
            }

            return result;
        }

        public List<SessionDataPoint> GetTargetDataPoints(
            string clientId, 
            List<string> targetIds, 
            DateTime? startDate = null, 
            DateTime? endDate = null,
            AggregationType aggregation = AggregationType.PerDay,
            bool splitByTherapist = false,
            bool includeUntracked = false)
        {
            // Analytics skips missed observations; raw exports can request the marker.
            var query = _dataPoints.Where(d => d.ClientId == clientId &&
                targetIds.Contains(d.TargetId) &&
                (includeUntracked || d.MissingDataMode != BehaviorMissingDataMode.DataNotTracked));

            if (startDate.HasValue)
                query = query.Where(d => d.Timestamp >= startDate.Value);
            if (endDate.HasValue)
                query = query.Where(d => d.Timestamp <= endDate.Value);

            var rawPoints = query.OrderBy(d => d.Timestamp).ToList();
            if (aggregation != AggregationType.PerDay || splitByTherapist || includeUntracked) return rawPoints;

            var typeByTarget = _programs.SelectMany(p => p.Targets).ToDictionary(t => t.Id, t => t.Type);
            return rawPoints
                .GroupBy(p => new { p.TargetId, Date = p.Timestamp.Date })
                .Select(g =>
                {
                    if (g.Count() == 1) return g.First();

                    var type = typeByTarget[g.Key.TargetId];
                    var correct = g.Sum(x => x.CorrectCount ?? 0);
                    var trials = g.Sum(x => x.TotalTrials ?? 0);
                    var occurred = g.Sum(x => x.OccurredIntervals ?? x.CorrectCount ?? 0);
                    var intervals = g.Sum(x => x.TotalIntervals ?? x.TotalTrials ?? 0);
                    double? value = type switch
                    {
                        TargetType.TrialByTrial => trials > 0 ? Math.Round(100.0 * correct / trials) : (double?)null,
                        TargetType.IntervalData => intervals > 0 ? Math.Round(100.0 * occurred / intervals) : (double?)null,
                        TargetType.Anecdotal => null,
                        _ => g.Sum(x => x.Value ?? 0)
                    };
                    return new SessionDataPoint
                    {
                        Id = Guid.NewGuid().ToString(),
                        TargetId = g.Key.TargetId,
                        ClientId = clientId,
                        Timestamp = g.Key.Date,
                        SessionNumber = g.First().SessionNumber,
                        TherapistName = string.Join(", ", g.Select(x => x.TherapistName).Distinct()),
                        Value = value,
                        CorrectCount = g.Any(x => x.CorrectCount.HasValue) ? correct : null,
                        TotalTrials = g.Any(x => x.TotalTrials.HasValue) ? trials : null,
                        OccurredIntervals = g.Any(x => x.OccurredIntervals.HasValue) ? occurred : null,
                        TotalIntervals = g.Any(x => x.TotalIntervals.HasValue) ? intervals : null,
                        DurationSeconds = g.Any(x => x.DurationSeconds.HasValue) ? g.Sum(x => x.DurationSeconds ?? 0) : null,
                        OccurrenceCount = g.Any(x => x.OccurrenceCount.HasValue) ? g.Sum(x => x.OccurrenceCount ?? 0) : null,
                        LessonDurationMinutes = g.Sum(x => x.LessonDurationMinutes ?? 0),
                        QualitativeEntry = type == TargetType.Anecdotal
                            ? string.Join("; ", g.Select(x => x.QualitativeEntry)) : null,
                        MissingDataMode = g.All(x => x.MissingDataMode == BehaviorMissingDataMode.ZeroOut)
                            ? BehaviorMissingDataMode.ZeroOut : null
                    };
                })
                .ToList();
        }

        public List<AbcEntry> GetAbcData(string clientId, DateTime? startDate = null, DateTime? endDate = null)
        {
            var query = _abcEntries.Where(a => a.ClientId == clientId);
            if (startDate.HasValue)
                query = query.Where(a => a.Timestamp >= startDate.Value);
            if (endDate.HasValue)
                query = query.Where(a => a.Timestamp <= endDate.Value);

            return query.OrderByDescending(a => a.Timestamp).ToList();
        }

        public AbcConfiguration? GetAbcConfiguration(string clientId) =>
            _abcConfigurations.FirstOrDefault(a => a.ClientId == clientId);

        public List<PhaseChangeLine> GetPhaseChangeLines(string clientId, string targetId)
        {
            return _phaseLines.Where(p => p.TargetId == targetId).OrderBy(p => p.Date).ToList();
        }

        public PhaseChangeLine AddPhaseChangeLine(PhaseChangeLine line)
        {
            if (string.IsNullOrEmpty(line.Id)) line.Id = Guid.NewGuid().ToString();
            _phaseLines.Add(line);
            return line;
        }

        public bool DeletePhaseChangeLine(string lineId)
        {
            var item = _phaseLines.FirstOrDefault(p => p.Id == lineId);
            if (item != null)
            {
                _phaseLines.Remove(item);
                return true;
            }
            return false;
        }

        public List<PhaseRange> GetPhaseRanges(string clientId, string targetId)
        {
            return _phaseRanges.Where(p => p.TargetId == targetId).OrderBy(p => p.StartDate).ToList();
        }

        public PhaseRange AddPhaseRange(PhaseRange range)
        {
            if (string.IsNullOrEmpty(range.Id)) range.Id = Guid.NewGuid().ToString();
            _phaseRanges.Add(range);
            return range;
        }

        public bool DeletePhaseRange(string rangeId)
        {
            var item = _phaseRanges.FirstOrDefault(p => p.Id == rangeId);
            if (item != null)
            {
                _phaseRanges.Remove(item);
                return true;
            }
            return false;
        }

        public List<GraphNote> GetGraphNotes(string clientId, string targetId)
        {
            return _graphNotes.Where(p => p.TargetId == targetId).OrderBy(p => p.Date).ToList();
        }

        public GraphNote AddGraphNote(GraphNote note)
        {
            if (string.IsNullOrEmpty(note.Id)) note.Id = Guid.NewGuid().ToString();
            _graphNotes.Add(note);
            return note;
        }

        public bool DeleteGraphNote(string noteId)
        {
            var item = _graphNotes.FirstOrDefault(p => p.Id == noteId);
            if (item != null)
            {
                _graphNotes.Remove(item);
                return true;
            }
            return false;
        }

        public Target UpdateTargetPhase(string targetId, TargetStatus newPhase, bool addPhaseLine, string? phaseLineLabel)
        {
            Target? target = null;
            TherapyProgram? program = null;

            foreach (var p in _programs)
            {
                var t = p.Targets.FirstOrDefault(x => x.Id == targetId);
                if (t != null)
                {
                    target = t;
                    program = p;
                    break;
                }
            }

            if (target == null) throw new InvalidOperationException("Target not found");

            target.Phase = newPhase;
            target.PhaseEnteredDate = DateTime.UtcNow;

            if (addPhaseLine)
            {
                _phaseLines.Add(new PhaseChangeLine
                {
                    Id = Guid.NewGuid().ToString(),
                    TargetId = targetId,
                    ProgramId = program?.Id,
                    Date = DateTime.UtcNow.Date,
                    Label = string.IsNullOrWhiteSpace(phaseLineLabel) ? newPhase.ToString() : phaseLineLabel,
                    Style = LineStyle.Solid,
                    Color = "#2563EB",
                    IsAutomated = false,
                    Source = "Manual"
                });
            }

            return target;
        }

        public void RecordSessionData(SessionDataPoint point)
        {
            if (string.IsNullOrEmpty(point.Id)) point.Id = Guid.NewGuid().ToString();
            _dataPoints.Add(point);
        }
    }
}
