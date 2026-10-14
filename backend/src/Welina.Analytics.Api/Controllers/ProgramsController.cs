using Microsoft.AspNetCore.Mvc;
using Welina.Analytics.Api.Models;
using Welina.Analytics.Api.Services;

namespace Welina.Analytics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProgramsController : ControllerBase
    {
        private readonly IAnalyticsService _service;

        public ProgramsController(IAnalyticsService service)
        {
            _service = service;
        }

        [HttpGet]
        public ActionResult<List<TherapyProgram>> GetPrograms([FromQuery] string clientId, [FromQuery] ProgramCategory? category = null)
        {
            if (string.IsNullOrEmpty(clientId)) return BadRequest(new { message = "clientId is required" });
            return Ok(_service.GetProgramsByClient(clientId, category));
        }

        [HttpGet("catalogs")]
        public ActionResult<ProgramCatalog> GetCatalogs() => Ok(_service.GetProgramCatalog());

        [HttpPost("targets/{targetId}/phase")]
        public ActionResult<Target> UpdateTargetPhase(
            string targetId, 
            [FromBody] UpdatePhaseRequest request)
        {
            try
            {
                var target = _service.UpdateTargetPhase(targetId, request.NewPhase, request.AddPhaseLine, request.PhaseLineLabel);
                return Ok(target);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }

    public class UpdatePhaseRequest
    {
        public TargetStatus NewPhase { get; set; }
        public bool AddPhaseLine { get; set; }
        public string? PhaseLineLabel { get; set; }
    }
}
