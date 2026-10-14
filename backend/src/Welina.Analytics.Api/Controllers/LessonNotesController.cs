using Microsoft.AspNetCore.Mvc;
using Welina.Analytics.Api.Models;
using Welina.Analytics.Api.Services;

namespace Welina.Analytics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LessonNotesController : ControllerBase
    {
        private readonly IAnalyticsService _service;

        public LessonNotesController(IAnalyticsService service)
        {
            _service = service;
        }

        [HttpPost("record")]
        public IActionResult RecordLessonTrial([FromBody] RecordTrialRequest request)
        {
            if (string.IsNullOrEmpty(request.ClientId) || string.IsNullOrEmpty(request.TargetId))
                return BadRequest("ClientId and TargetId are required");

            var point = new SessionDataPoint
            {
                Id = Guid.NewGuid().ToString(),
                ClientId = request.ClientId,
                TargetId = request.TargetId,
                Timestamp = request.Timestamp ?? DateTime.UtcNow,
                SessionNumber = request.SessionNumber,
                TherapistName = request.TherapistName ?? "Current Therapist",
                Value = request.Value,
                CorrectCount = request.CorrectCount,
                TotalTrials = request.TotalTrials,
                DurationSeconds = request.DurationSeconds,
                OccurrenceCount = request.OccurrenceCount,
                LessonDurationMinutes = request.LessonDurationMinutes ?? 60,
                MissingDataMode = request.MissingDataMode,
                QualitativeEntry = request.QualitativeEntry
            };

            _service.RecordSessionData(point);

            return Ok(new { success = true, pointId = point.Id });
        }
    }

    public class RecordTrialRequest
    {
        public string ClientId { get; set; } = string.Empty;
        public string TargetId { get; set; } = string.Empty;
        public DateTime? Timestamp { get; set; }
        public int SessionNumber { get; set; } = 1;
        public string? TherapistName { get; set; }
        public double? Value { get; set; }
        public int? CorrectCount { get; set; }
        public int? TotalTrials { get; set; }
        public int? DurationSeconds { get; set; }
        public int? OccurrenceCount { get; set; }
        public double? LessonDurationMinutes { get; set; }
        public BehaviorMissingDataMode? MissingDataMode { get; set; }
        public string? QualitativeEntry { get; set; }
    }
}
