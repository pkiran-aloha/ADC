using Microsoft.AspNetCore.Mvc;
using Welina.Analytics.Api.Models;
using Welina.Analytics.Api.Services;

namespace Welina.Analytics.Api.Controllers
{
    // Appointment context (setting, staff, setting events, supervision, fidelity) and the
    // data-quality standards the analytics compare against.
    [ApiController]
    [Route("api/[controller]")]
    public class ServiceSessionsController : ControllerBase
    {
        private readonly IAnalyticsService _service;

        public ServiceSessionsController(IAnalyticsService service)
        {
            _service = service;
        }

        [HttpGet]
        public ActionResult<List<ServiceSession>> GetServiceSessions(
            [FromQuery] string clientId,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            if (string.IsNullOrEmpty(clientId)) return BadRequest(new { message = "clientId is required" });
            return Ok(_service.GetServiceSessions(clientId, startDate, endDate));
        }

        [HttpGet("staff")]
        public ActionResult<List<StaffMember>> GetStaff() => Ok(_service.GetStaff());

        [HttpGet("standards")]
        public ActionResult<ClinicalStandards> GetStandards() => Ok(_service.GetClinicalStandards());
    }
}
