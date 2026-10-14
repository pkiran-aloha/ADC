using System;
using System.Collections.Generic;
using System.Linq;
using Welina.Analytics.Api.Models;

namespace Welina.Analytics.Api.Services
{
    public class InMemoryAnalyticsService : IAnalyticsService
    {
        private readonly List<Client> _clients = new();
        private readonly List<TherapyProgram> _programs = new();
        private readonly List<SessionDataPoint> _dataPoints = new();
        private readonly List<AbcEntry> _abcEntries = new();
        private readonly List<PhaseChangeLine> _phaseLines = new();
        private readonly List<PhaseRange> _phaseRanges = new();
        private readonly List<GraphNote> _graphNotes = new();

        public InMemoryAnalyticsService()
        {
            SeedInitialData();
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
            bool splitByTherapist = false)
        {
            var query = _dataPoints.Where(d => d.ClientId == clientId && targetIds.Contains(d.TargetId));

            if (startDate.HasValue)
                query = query.Where(d => d.Timestamp >= startDate.Value);
            if (endDate.HasValue)
                query = query.Where(d => d.Timestamp <= endDate.Value);

            var rawPoints = query.OrderBy(d => d.Timestamp).ToList();

            if (aggregation == AggregationType.PerDay && !splitByTherapist)
            {
                // Default aggregation per day per target
                return rawPoints
                    .GroupBy(p => new { p.TargetId, Date = p.Timestamp.Date })
                    .Select(g => new SessionDataPoint
                    {
                        Id = Guid.NewGuid().ToString(),
                        TargetId = g.Key.TargetId,
                        ClientId = clientId,
                        Timestamp = g.Key.Date,
                        SessionNumber = g.First().SessionNumber,
                        TherapistName = string.Join(", ", g.Select(x => x.TherapistName).Distinct()),
                        Value = g.Average(x => x.Value ?? 0),
                        CorrectCount = g.Sum(x => x.CorrectCount ?? 0),
                        TotalTrials = g.Sum(x => x.TotalTrials ?? 0),
                        DurationSeconds = g.Sum(x => x.DurationSeconds ?? 0),
                        OccurrenceCount = g.Sum(x => x.OccurrenceCount ?? 0),
                        LessonDurationMinutes = g.Sum(x => x.LessonDurationMinutes ?? 0),
                        MissingDataMode = g.First().MissingDataMode
                    })
                    .ToList();
            }

            return rawPoints;
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

        private void SeedInitialData()
        {
            var liam = new Client
            {
                Id = "cli-liam",
                Name = "Liam Miller",
                DateOfBirth = "2018-04-12",
                PrimaryDiagnosis = "Autism Spectrum Disorder (Level 2)",
                SupervisingBcba = "Sarah Jenkins, BCBA"
            };

            var emma = new Client
            {
                Id = "cli-emma",
                Name = "Emma Watson",
                DateOfBirth = "2019-09-21",
                PrimaryDiagnosis = "ASD with Speech Apraxia",
                SupervisingBcba = "David Vance, BCBA"
            };

            _clients.AddRange(new[] { liam, emma });

            // Program 1: Playing with Toys (Duration & Interval)
            var progPlaying = new TherapyProgram
            {
                Id = "prog-playing",
                ClientId = "cli-liam",
                Name = "Playing with Toys",
                Category = ProgramCategory.SkillAcquisition,
                Status = "Active",
                Domain = "Play & Leisure",
                Targets = new List<Target>
                {
                    new Target
                    {
                        Id = "tgt-play-independent",
                        ProgramId = "prog-playing",
                        Name = "Independent Play with Legos",
                        Description = "Engages in sustained block building without prompting",
                        Type = TargetType.Duration,
                        Phase = TargetStatus.Acquisition,
                        PhaseEnteredDate = DateTime.UtcNow.AddMonths(-2),
                        StandardColor = "#3B82F6"
                    },
                    new Target
                    {
                        Id = "tgt-play-turn-taking",
                        ProgramId = "prog-playing",
                        Name = "Turn Taking in Board Games",
                        Description = "Waits for peer turn during structured tabletop game",
                        Type = TargetType.IntervalData,
                        Phase = TargetStatus.Maintenance,
                        PhaseEnteredDate = DateTime.UtcNow.AddDays(-20),
                        StandardColor = "#10B981"
                    }
                }
            };

            // Program 2: Expressive Identification (Trial by Trial & Anecdotal)
            var progExpressive = new TherapyProgram
            {
                Id = "prog-expressive",
                ClientId = "cli-liam",
                Name = "Expressive Labeling",
                Category = ProgramCategory.SkillAcquisition,
                Status = "Active",
                Domain = "Communication",
                Targets = new List<Target>
                {
                    new Target
                    {
                        Id = "tgt-expr-food",
                        ProgramId = "prog-expressive",
                        Name = "Expressive Food Items",
                        Description = "Names common foods shown in 2D picture cards",
                        Type = TargetType.TrialByTrial,
                        Phase = TargetStatus.Generalization,
                        PhaseEnteredDate = DateTime.UtcNow.AddDays(-15),
                        StandardColor = "#6366F1"
                    },
                    new Target
                    {
                        Id = "tgt-expr-preference",
                        ProgramId = "prog-expressive",
                        Name = "What are your preferences in Food?",
                        Description = "Qualitative anecdotal notes on food choices and spontaneous requests",
                        Type = TargetType.Anecdotal,
                        Phase = TargetStatus.Acquisition,
                        PhaseEnteredDate = DateTime.UtcNow.AddMonths(-1),
                        StandardColor = "#8B5CF6"
                    }
                }
            };

            // Program 3: Fluency / Rate Program (FluencyRate)
            var progFluency = new TherapyProgram
            {
                Id = "prog-fluency",
                ClientId = "cli-liam",
                Name = "Tact Fluency (Sight Words)",
                Category = ProgramCategory.SkillAcquisition,
                Status = "Active",
                Domain = "Academic / Fluency",
                Targets = new List<Target>
                {
                    new Target
                    {
                        Id = "tgt-sight-words",
                        ProgramId = "prog-fluency",
                        Name = "Rapid Sight Word Tacting",
                        Description = "Reads primer sight words in timed 1-minute sprints",
                        Type = TargetType.FluencyRate,
                        Phase = TargetStatus.Acquisition,
                        PhaseEnteredDate = DateTime.UtcNow.AddDays(-25),
                        StandardColor = "#EC4899"
                    }
                }
            };

            // Program 4: Frequency Program (Frequency)
            var progRequests = new TherapyProgram
            {
                Id = "prog-requests",
                ClientId = "cli-liam",
                Name = "Manding - Spontaneous Requests",
                Category = ProgramCategory.SkillAcquisition,
                Status = "Active",
                Domain = "Functional Communication",
                Targets = new List<Target>
                {
                    new Target
                    {
                        Id = "tgt-mands-spontaneous",
                        ProgramId = "prog-requests",
                        Name = "Spontaneous 2-Word Mands",
                        Description = "Requests desired item/activity without verbal prompts",
                        Type = TargetType.Frequency,
                        Phase = TargetStatus.Acquisition,
                        PhaseEnteredDate = DateTime.UtcNow.AddMonths(-1),
                        StandardColor = "#F59E0B"
                    }
                }
            };

            // Behavior Reduction Program (BR)
            var progBehaviors = new TherapyProgram
            {
                Id = "prog-behaviors",
                ClientId = "cli-liam",
                Name = "Behavior Reduction Plan",
                Category = ProgramCategory.BehaviorReduction,
                Status = "Active",
                Domain = "Behavior",
                Targets = new List<Target>
                {
                    new Target
                    {
                        Id = "br-vocal-disruption",
                        ProgramId = "prog-behaviors",
                        Name = "Vocal Disruption / Screaming",
                        Description = "High-pitched screaming or crying above conversational volume",
                        Type = TargetType.Frequency,
                        Phase = TargetStatus.Acquisition,
                        PhaseEnteredDate = DateTime.UtcNow.AddMonths(-3),
                        StandardColor = "#EF4444"
                    },
                    new Target
                    {
                        Id = "br-aggression",
                        ProgramId = "prog-behaviors",
                        Name = "Physical Aggression",
                        Description = "Hitting, kicking, or scratching directed towards staff or peers",
                        Type = TargetType.Frequency,
                        Phase = TargetStatus.Acquisition,
                        PhaseEnteredDate = DateTime.UtcNow.AddMonths(-3),
                        StandardColor = "#F97316"
                    },
                    new Target
                    {
                        Id = "br-elopement",
                        ProgramId = "prog-behaviors",
                        Name = "Elopement / Leaving Area",
                        Description = "Moving greater than 5 feet away from instructional zone without permission",
                        Type = TargetType.Duration,
                        Phase = TargetStatus.Acquisition,
                        PhaseEnteredDate = DateTime.UtcNow.AddMonths(-2),
                        StandardColor = "#DC2626"
                    }
                }
            };

            _programs.AddRange(new[] { progPlaying, progExpressive, progFluency, progRequests, progBehaviors });

            // Generate realistic session data across the past 30 days
            var now = DateTime.UtcNow.Date;
            var therapists = new[] { "Sarah Jenkins, BCBA", "Joe Ronald, RBT", "Maya Patel, RBT" };

            // Trial by Trial data for Expressive Food
            var trialAccuracy = new[] { 60.0, 60.0, 70.0, 65.0, 80.0, 80.0, 90.0, 85.0, 100.0, 95.0, 100.0, 100.0 };
            for (int i = 0; i < trialAccuracy.Length; i++)
            {
                var date = now.AddDays(-28 + i * 2);
                int total = 10;
                int correct = (int)Math.Round((trialAccuracy[i] / 100.0) * total);
                _dataPoints.Add(new SessionDataPoint
                {
                    Id = Guid.NewGuid().ToString(),
                    ClientId = "cli-liam",
                    TargetId = "tgt-expr-food",
                    Timestamp = date.AddHours(10),
                    SessionNumber = i + 1,
                    TherapistName = therapists[i % therapists.Length],
                    Value = trialAccuracy[i],
                    CorrectCount = correct,
                    TotalTrials = total,
                    LessonDurationMinutes = 45
                });
            }

            // Duration data for Playing with Toys (minutes & seconds)
            var durations = new[] { 95, 120, 158, 165, 190, 210, 228, 255, 270, 290, 310, 340 };
            for (int i = 0; i < durations.Length; i++)
            {
                var date = now.AddDays(-26 + i * 2);
                _dataPoints.Add(new SessionDataPoint
                {
                    Id = Guid.NewGuid().ToString(),
                    ClientId = "cli-liam",
                    TargetId = "tgt-play-independent",
                    Timestamp = date.AddHours(14),
                    SessionNumber = i + 1,
                    TherapistName = therapists[(i + 1) % therapists.Length],
                    Value = durations[i],
                    DurationSeconds = durations[i],
                    OccurrenceCount = 1,
                    LessonDurationMinutes = 50
                });
            }

            // Interval data for Turn Taking
            var intervals = new[] { 40.0, 50.0, 55.0, 60.0, 75.0, 80.0, 85.0, 85.0, 90.0, 95.0 };
            for (int i = 0; i < intervals.Length; i++)
            {
                var date = now.AddDays(-22 + i * 2);
                int totalIntervals = 20;
                int correctIntervals = (int)Math.Round((intervals[i] / 100.0) * totalIntervals);
                _dataPoints.Add(new SessionDataPoint
                {
                    Id = Guid.NewGuid().ToString(),
                    ClientId = "cli-liam",
                    TargetId = "tgt-play-turn-taking",
                    Timestamp = date.AddHours(11),
                    SessionNumber = i + 1,
                    TherapistName = therapists[i % therapists.Length],
                    Value = intervals[i],
                    CorrectCount = correctIntervals,
                    TotalTrials = totalIntervals,
                    LessonDurationMinutes = 40
                });
            }

            // Anecdotal data
            var anecdotalEntries = new[]
            {
                (now.AddDays(-2), "Joe Ronald", "Requested 'Banana' during snack time with prompt level 1 (verbal gesture)."),
                (now.AddDays(-5), "Maya Patel", "Independently stated 'I want pizza slices' during lunch break."),
                (now.AddDays(-8), "Sarah Jenkins", "Declined broccoli with polite phrase 'No thank you, want crackers'."),
                (now.AddDays(-12), "Joe Ronald", "Pointed to apple slices and vocalized 'Apple please' clearly."),
                (now.AddDays(-16), "Maya Patel", "Chose yogurt over pudding without hesitating.")
            };
            foreach (var item in anecdotalEntries)
            {
                _dataPoints.Add(new SessionDataPoint
                {
                    Id = Guid.NewGuid().ToString(),
                    ClientId = "cli-liam",
                    TargetId = "tgt-expr-preference",
                    Timestamp = item.Item1.AddHours(13).AddMinutes(15),
                    SessionNumber = 1,
                    TherapistName = item.Item2,
                    QualitativeEntry = item.Item3
                });
            }

            // Fluency Rate data
            var fluencyCounts = new[] { 14, 18, 17, 21, 24, 26, 28, 30, 32 };
            for (int i = 0; i < fluencyCounts.Length; i++)
            {
                var date = now.AddDays(-20 + i * 2);
                int count = fluencyCounts[i];
                double sessionMins = 7.0; // 7 minutes sprint
                _dataPoints.Add(new SessionDataPoint
                {
                    Id = Guid.NewGuid().ToString(),
                    ClientId = "cli-liam",
                    TargetId = "tgt-sight-words",
                    Timestamp = date.AddHours(15),
                    SessionNumber = i + 1,
                    TherapistName = therapists[i % therapists.Length],
                    Value = count,
                    OccurrenceCount = count,
                    LessonDurationMinutes = sessionMins
                });
            }

            // Frequency Manding data
            var mandCounts = new[] { 6, 8, 7, 10, 12, 11, 15, 14, 18, 20 };
            for (int i = 0; i < mandCounts.Length; i++)
            {
                var date = now.AddDays(-20 + i * 2);
                _dataPoints.Add(new SessionDataPoint
                {
                    Id = Guid.NewGuid().ToString(),
                    ClientId = "cli-liam",
                    TargetId = "tgt-mands-spontaneous",
                    Timestamp = date.AddHours(9),
                    SessionNumber = i + 1,
                    TherapistName = therapists[i % therapists.Length],
                    Value = mandCounts[i],
                    OccurrenceCount = mandCounts[i],
                    LessonDurationMinutes = 60
                });
            }

            // Behavior Reduction: Vocal Disruption (Frequency)
            var brCounts = new[] { 18, 15, 12, 14, 10, 9, 8, 6, 4, 3, 2, 0 };
            for (int i = 0; i < brCounts.Length; i++)
            {
                var date = now.AddDays(-24 + i * 2);
                _dataPoints.Add(new SessionDataPoint
                {
                    Id = Guid.NewGuid().ToString(),
                    ClientId = "cli-liam",
                    TargetId = "br-vocal-disruption",
                    Timestamp = date.AddHours(11),
                    SessionNumber = i + 1,
                    TherapistName = therapists[i % therapists.Length],
                    Value = brCounts[i],
                    OccurrenceCount = brCounts[i],
                    LessonDurationMinutes = 60,
                    MissingDataMode = BehaviorMissingDataMode.ZeroOut
                });
            }

            // Behavior Reduction: Aggression
            var aggCounts = new[] { 8, 6, 5, 7, 4, 3, 2, 1, 1, 0, 0 };
            for (int i = 0; i < aggCounts.Length; i++)
            {
                var date = now.AddDays(-22 + i * 2);
                _dataPoints.Add(new SessionDataPoint
                {
                    Id = Guid.NewGuid().ToString(),
                    ClientId = "cli-liam",
                    TargetId = "br-aggression",
                    Timestamp = date.AddHours(14),
                    SessionNumber = i + 1,
                    TherapistName = therapists[(i + 1) % therapists.Length],
                    Value = aggCounts[i],
                    OccurrenceCount = aggCounts[i],
                    LessonDurationMinutes = 60,
                    MissingDataMode = BehaviorMissingDataMode.ZeroOut
                });
            }

            // Behavior Reduction: Elopement (Duration seconds)
            var elopeDurations = new[] { 340, 280, 210, 185, 140, 95, 60, 45, 0 };
            for (int i = 0; i < elopeDurations.Length; i++)
            {
                var date = now.AddDays(-20 + i * 2);
                _dataPoints.Add(new SessionDataPoint
                {
                    Id = Guid.NewGuid().ToString(),
                    ClientId = "cli-liam",
                    TargetId = "br-elopement",
                    Timestamp = date.AddHours(15),
                    SessionNumber = i + 1,
                    TherapistName = therapists[i % therapists.Length],
                    Value = elopeDurations[i],
                    DurationSeconds = elopeDurations[i],
                    OccurrenceCount = 1,
                    LessonDurationMinutes = 60,
                    MissingDataMode = BehaviorMissingDataMode.ZeroOut
                });
            }

            // Phase Change Lines
            _phaseLines.Add(new PhaseChangeLine
            {
                Id = "pcl-1",
                TargetId = "tgt-expr-food",
                Date = now.AddDays(-16),
                Label = "Intervention Start (Differential Reinforcement)",
                Style = LineStyle.Solid,
                Color = "#2563EB",
                Source = "Manual"
            });

            _phaseLines.Add(new PhaseChangeLine
            {
                Id = "pcl-2",
                TargetId = "tgt-expr-food",
                Date = now.AddDays(-8),
                Label = "Generalization Across Settings",
                Style = LineStyle.Dotted,
                Color = "#059669",
                Source = "OutcomesPromotions"
            });

            _phaseLines.Add(new PhaseChangeLine
            {
                Id = "pcl-3",
                TargetId = "br-vocal-disruption",
                Date = now.AddDays(-14),
                Label = "FCT (Functional Communication Training)",
                Style = LineStyle.Solid,
                Color = "#DC2626",
                Source = "Manual"
            });

            // Phase Ranges
            _phaseRanges.Add(new PhaseRange
            {
                Id = "pr-1",
                TargetId = "tgt-expr-food",
                StartDate = now.AddDays(-28),
                EndDate = now.AddDays(-18),
                Label = "Baseline Assessment Window",
                Color = "rgba(147, 197, 253, 0.25)"
            });

            // Graph Notes
            _graphNotes.Add(new GraphNote
            {
                Id = "gn-1",
                TargetId = "tgt-expr-food",
                Date = now.AddDays(-12),
                NoteText = "Client had low sleep the night prior; prompted reinforcement frequency was doubled.",
                Color = "#F59E0B",
                StaffName = "Sarah Jenkins, BCBA"
            });

            // ABC Data entries
            _abcEntries.Add(new AbcEntry
            {
                Id = "abc-1",
                ClientId = "cli-liam",
                Timestamp = now.AddDays(-1).AddHours(10).AddMinutes(20),
                Therapist = "Joe Ronald, RBT",
                Antecedents = new List<string> { "Task Demand (Tabletop Math)", "Staff Transition" },
                Behaviors = new List<string> { "Vocal Disruption / Screaming", "Task Refusal" },
                Consequences = new List<string> { "Prompted Functional Mand ('I need a break')", "Demand Paused 2 min" },
                Location = "Classroom / Therapy Table",
                Notes = "Client resumed task after taking three deep breaths and completing 2 easy puzzle pieces.",
                Intensity = 3,
                DurationMinutes = 4
            });

            _abcEntries.Add(new AbcEntry
            {
                Id = "abc-2",
                ClientId = "cli-liam",
                Timestamp = now.AddDays(-2).AddHours(14).AddMinutes(15),
                Therapist = "Maya Patel, RBT",
                Antecedents = new List<string> { "Peer Took Preferred Toy (Red Truck)", "Unstructured Free Play" },
                Behaviors = new List<string> { "Physical Aggression (Hitting)", "Grabbing Toy" },
                Consequences = new List<string> { "Blocked Aggression", "Facilitated Turn-Taking with Visual Timer" },
                Location = "Play Area / Sensory Gym",
                Notes = "Peer gave truck back after 1 minute timer sounded. Positive social interaction praised.",
                Intensity = 4,
                DurationMinutes = 3
            });

            _abcEntries.Add(new AbcEntry
            {
                Id = "abc-3",
                ClientId = "cli-liam",
                Timestamp = now.AddDays(-4).AddHours(11).AddMinutes(05),
                Therapist = "Sarah Jenkins, BCBA",
                Antecedents = new List<string> { "Transition from Gym to Table" },
                Behaviors = new List<string> { "Elopement / Leaving Area" },
                Consequences = new List<string> { "Shadowed at safe distance", "First/Then Visual Board Presented" },
                Location = "Hallway",
                Notes = "Client checked visual schedule and independently walked back to station.",
                Intensity = 2,
                DurationMinutes = 2
            });

            _abcEntries.Add(new AbcEntry
            {
                Id = "abc-4",
                ClientId = "cli-liam",
                Timestamp = now.AddDays(-7).AddHours(15).AddMinutes(30),
                Therapist = "Joe Ronald, RBT",
                Antecedents = new List<string> { "Denied Tangible (iPad)" },
                Behaviors = new List<string> { "Vocal Disruption / Screaming" },
                Consequences = new List<string> { "Extinction (No iPad given)", "Differential Reinforcement for Calming" },
                Location = "Therapy Room B",
                Notes = "Calmed after 3 minutes. Earned sticker on token board for completing puzzle.",
                Intensity = 3,
                DurationMinutes = 5
            });

            _abcEntries.Add(new AbcEntry
            {
                Id = "abc-5",
                ClientId = "cli-liam",
                Timestamp = now.AddDays(-9).AddHours(13).AddMinutes(45),
                Therapist = "Maya Patel, RBT",
                Antecedents = new List<string> { "Loud Ambient Noise in Cafeteria" },
                Behaviors = new List<string> { "Elopement / Leaving Area" },
                Consequences = new List<string> { "Offered Noise-Canceling Headphones", "Moved to Quiet Corner" },
                Location = "Cafeteria",
                Notes = "Headphones immediately decreased agitation. Sensory accommodation noted in BIP.",
                Intensity = 2,
                DurationMinutes = 3
            });
        }
    }
}
