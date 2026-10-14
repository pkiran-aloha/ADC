using Microsoft.AspNetCore.Mvc;
using System.Text;
using Welina.Analytics.Api.Models;
using Welina.Analytics.Api.Services;

namespace Welina.Analytics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OverallMasteryController : ControllerBase
    {
        private readonly IAnalyticsService _service;

        public OverallMasteryController(IAnalyticsService service)
        {
            _service = service;
        }

        [HttpGet]
        public ActionResult<List<MasteryDataPoint>> GetCumulativeMastery(
            [FromQuery] string clientId, 
            [FromQuery] string programId)
        {
            if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(programId))
                return BadRequest(new { message = "clientId and programId are required" });

            var data = _service.GetCumulativeMastery(clientId, programId);
            return Ok(data);
        }

        [HttpGet("export/csv")]
        public IActionResult ExportMasteryCsv([FromQuery] string clientId, [FromQuery] string programId)
        {
            var data = _service.GetCumulativeMastery(clientId, programId);
            var sb = new StringBuilder();
            sb.AppendLine("Date,Cumulative Mastered Targets,Newly Mastered Targets");
            foreach (var point in data)
            {
                var names = string.Join("; ", point.NewlyMasteredTargetNames);
                sb.AppendLine($"{point.Date:yyyy-MM-dd},{point.CumulativeMasteredCount},\"{names}\"");
            }
            return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"Mastery_{programId}_{DateTime.UtcNow:yyyyMMdd}.csv");
        }
    }
}
