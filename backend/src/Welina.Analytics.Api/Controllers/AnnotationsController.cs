using Microsoft.AspNetCore.Mvc;
using Welina.Analytics.Api.Models;
using Welina.Analytics.Api.Services;

namespace Welina.Analytics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AnnotationsController : ControllerBase
    {
        private readonly IAnalyticsService _service;

        public AnnotationsController(IAnalyticsService service)
        {
            _service = service;
        }

        [HttpGet("summary")]
        public ActionResult<AnnotationSummaryResponse> GetSummary(
            [FromQuery] string clientId, 
            [FromQuery] string targetId)
        {
            if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(targetId))
                return BadRequest(new { message = "clientId and targetId are required" });

            return Ok(new AnnotationSummaryResponse
            {
                PhaseLines = _service.GetPhaseChangeLines(clientId, targetId),
                PhaseRanges = _service.GetPhaseRanges(clientId, targetId),
                GraphNotes = _service.GetGraphNotes(clientId, targetId)
            });
        }

        // Phase Lines
        [HttpPost("phase-lines")]
        public ActionResult<PhaseChangeLine> AddPhaseLine([FromBody] PhaseChangeLine line)
        {
            var created = _service.AddPhaseChangeLine(line);
            return Ok(created);
        }

        [HttpDelete("phase-lines/{id}")]
        public IActionResult DeletePhaseLine(string id)
        {
            bool removed = _service.DeletePhaseChangeLine(id);
            if (!removed) return NotFound();
            return NoContent();
        }

        // Phase Ranges
        [HttpPost("phase-ranges")]
        public ActionResult<PhaseRange> AddPhaseRange([FromBody] PhaseRange range)
        {
            var created = _service.AddPhaseRange(range);
            return Ok(created);
        }

        [HttpDelete("phase-ranges/{id}")]
        public IActionResult DeletePhaseRange(string id)
        {
            bool removed = _service.DeletePhaseRange(id);
            if (!removed) return NotFound();
            return NoContent();
        }

        // Graph Notes
        [HttpPost("graph-notes")]
        public ActionResult<GraphNote> AddGraphNote([FromBody] GraphNote note)
        {
            var created = _service.AddGraphNote(note);
            return Ok(created);
        }

        [HttpDelete("graph-notes/{id}")]
        public IActionResult DeleteGraphNote(string id)
        {
            bool removed = _service.DeleteGraphNote(id);
            if (!removed) return NotFound();
            return NoContent();
        }
    }

    public class AnnotationSummaryResponse
    {
        public List<PhaseChangeLine> PhaseLines { get; set; } = new();
        public List<PhaseRange> PhaseRanges { get; set; } = new();
        public List<GraphNote> GraphNotes { get; set; } = new();
    }
}
