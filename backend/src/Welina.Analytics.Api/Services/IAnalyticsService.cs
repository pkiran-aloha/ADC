using System;
using System.Collections.Generic;
using Welina.Analytics.Api.Models;

namespace Welina.Analytics.Api.Services
{
    public interface IAnalyticsService
    {
        List<Client> GetClients();
        Client? GetClient(string clientId);
        List<TherapyProgram> GetProgramsByClient(string clientId, ProgramCategory? category = null);
        List<MasteryDataPoint> GetCumulativeMastery(string clientId, string programId);
        
        List<SessionDataPoint> GetTargetDataPoints(
            string clientId, 
            List<string> targetIds, 
            DateTime? startDate = null, 
            DateTime? endDate = null,
            AggregationType aggregation = AggregationType.PerDay,
            bool splitByTherapist = false);

        List<AbcEntry> GetAbcData(string clientId, DateTime? startDate = null, DateTime? endDate = null);

        // Annotations
        List<PhaseChangeLine> GetPhaseChangeLines(string clientId, string targetId);
        PhaseChangeLine AddPhaseChangeLine(PhaseChangeLine line);
        bool DeletePhaseChangeLine(string lineId);

        List<PhaseRange> GetPhaseRanges(string clientId, string targetId);
        PhaseRange AddPhaseRange(PhaseRange range);
        bool DeletePhaseRange(string rangeId);

        List<GraphNote> GetGraphNotes(string clientId, string targetId);
        GraphNote AddGraphNote(GraphNote note);
        bool DeleteGraphNote(string noteId);

        // Data recording & prompts
        Target UpdateTargetPhase(string targetId, TargetStatus newPhase, bool addPhaseLine, string? phaseLineLabel);
        void RecordSessionData(SessionDataPoint point);
    }
}
