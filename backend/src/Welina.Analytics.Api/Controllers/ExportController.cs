using Microsoft.AspNetCore.Mvc;
using System.IO.Compression;
using System.Text;
using Welina.Analytics.Api.Models;
using Welina.Analytics.Api.Services;

namespace Welina.Analytics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ExportController : ControllerBase
    {
        private readonly IAnalyticsService _service;

        public ExportController(IAnalyticsService service)
        {
            _service = service;
        }

        [HttpGet("raw")]
        public IActionResult ExportRawTargetData(
            [FromQuery] string clientId,
            [FromQuery] string targetIds,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(targetIds))
                return BadRequest("clientId and targetIds are required.");

            var ids = targetIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            var rawData = _service.GetTargetDataPoints(clientId, ids, startDate, endDate, AggregationType.PerDay, splitByTherapist: true);

            var sb = new StringBuilder();
            sb.AppendLine("Timestamp,TargetId,Therapist,Value,CorrectCount,TotalTrials,DurationSeconds,OccurrenceCount,LessonDurationMinutes,MissingDataMode");

            foreach (var point in rawData)
            {
                sb.AppendLine($"\"{point.Timestamp:yyyy-MM-dd HH:mm:ss}\",\"{point.TargetId}\",\"{point.TherapistName}\",{point.Value},{point.CorrectCount},{point.TotalTrials},{point.DurationSeconds},{point.OccurrenceCount},{point.LessonDurationMinutes},\"{point.MissingDataMode}\"");
            }

            return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"Raw_Trials_{clientId}_{DateTime.UtcNow:yyyyMMdd}.csv");
        }

        [HttpGet("raw/zip")]
        public IActionResult ExportRawDataZip(
            [FromQuery] string clientId,
            [FromQuery] string targetIds)
        {
            if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(targetIds))
                return BadRequest("clientId and targetIds are required.");

            var ids = targetIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            
            using var memoryStream = new MemoryStream();
            using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
            {
                foreach (var tid in ids)
                {
                    var data = _service.GetTargetDataPoints(clientId, new List<string> { tid }, splitByTherapist: true);
                    var entry = archive.CreateEntry($"{tid}_raw_trials.csv");
                    using var entryStream = entry.Open();
                    using var writer = new StreamWriter(entryStream, Encoding.UTF8);
                    
                    writer.WriteLine("Timestamp,TargetId,Therapist,Value,CorrectCount,TotalTrials,DurationSeconds,OccurrenceCount,LessonDurationMinutes,MissingDataMode");
                    foreach (var point in data)
                    {
                        writer.WriteLine($"\"{point.Timestamp:yyyy-MM-dd HH:mm:ss}\",\"{point.TargetId}\",\"{point.TherapistName}\",{point.Value},{point.CorrectCount},{point.TotalTrials},{point.DurationSeconds},{point.OccurrenceCount},{point.LessonDurationMinutes},\"{point.MissingDataMode}\"");
                    }
                }
            }

            memoryStream.Seek(0, SeekOrigin.Begin);
            return File(memoryStream.ToArray(), "application/zip", $"{clientId}_Structured_Analytics_Export.zip");
        }
    }
}
