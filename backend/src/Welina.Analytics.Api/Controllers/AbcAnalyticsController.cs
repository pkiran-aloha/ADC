using Microsoft.AspNetCore.Mvc;
using System.Text;
using Welina.Analytics.Api.Models;
using Welina.Analytics.Api.Services;

namespace Welina.Analytics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AbcAnalyticsController : ControllerBase
    {
        private readonly IAnalyticsService _service;

        public AbcAnalyticsController(IAnalyticsService service)
        {
            _service = service;
        }

        [HttpGet]
        public ActionResult<List<AbcEntry>> GetAbcEntries(
            [FromQuery] string clientId,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            if (string.IsNullOrEmpty(clientId)) return BadRequest(new { message = "clientId is required" });
            return Ok(_service.GetAbcData(clientId, startDate, endDate));
        }

        [HttpGet("configuration")]
        public ActionResult<AbcConfiguration> GetConfiguration([FromQuery] string clientId)
        {
            if (string.IsNullOrEmpty(clientId)) return BadRequest(new { message = "clientId is required" });
            var configuration = _service.GetAbcConfiguration(clientId);
            if (configuration == null) return NotFound();
            return Ok(configuration);
        }

        [HttpGet("export/csv")]
        public IActionResult ExportAbcRawCsv(
            [FromQuery] string clientId,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            var list = _service.GetAbcData(clientId, startDate, endDate);
            var sb = new StringBuilder();
            sb.AppendLine("Date & Time,Therapist,Antecedents,Behaviors,Consequences,Location,Notes,Intensity,DurationMinutes");
            foreach (var item in list)
            {
                var ants = string.Join("; ", item.Antecedents);
                var behs = string.Join("; ", item.Behaviors);
                var cons = string.Join("; ", item.Consequences);
                var notes = item.Notes.Replace("\"", "\"\"");
                sb.AppendLine($"\"{item.Timestamp:yyyy-MM-dd HH:mm:ss}\",\"{item.Therapist}\",\"{ants}\",\"{behs}\",\"{cons}\",\"{item.Location}\",\"{notes}\",{item.Intensity},{item.DurationMinutes}");
            }
            return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"ABC_Data_{clientId}_{DateTime.UtcNow:yyyyMMdd}.csv");
        }
    }
}
