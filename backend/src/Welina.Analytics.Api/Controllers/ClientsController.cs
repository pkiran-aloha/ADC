using Microsoft.AspNetCore.Mvc;
using Welina.Analytics.Api.Models;
using Welina.Analytics.Api.Services;

namespace Welina.Analytics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ClientsController : ControllerBase
    {
        private readonly IAnalyticsService _service;

        public ClientsController(IAnalyticsService service)
        {
            _service = service;
        }

        [HttpGet]
        public ActionResult<List<Client>> GetClients()
        {
            return Ok(_service.GetClients());
        }

        [HttpGet("{id}")]
        public ActionResult<Client> GetClient(string id)
        {
            var client = _service.GetClient(id);
            if (client == null) return NotFound(new { message = "Client not found" });
            return Ok(client);
        }
    }
}
