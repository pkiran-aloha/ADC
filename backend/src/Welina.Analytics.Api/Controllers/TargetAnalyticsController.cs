using Microsoft.AspNetCore.Mvc;
using System.Text;
using Welina.Analytics.Api.Models;
using Welina.Analytics.Api.Services;

namespace Welina.Analytics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TargetAnalyticsController : ControllerBase
    {
        private readonly IAnalyticsService _service;

        public TargetAnalyticsController(IAnalyticsService service)
        {
            _service = service;
        }

        [HttpGet("data")]
        public ActionResult<TargetDataResponse> GetData(
            [FromQuery] string clientId,
            [FromQuery] string targetIds, // comma separated
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] AggregationType aggregation = AggregationType.PerDay,
            [FromQuery] bool splitByTherapist = false,
            [FromQuery] DurationViewMode durationView = DurationViewMode.TotalDuration,
            [FromQuery] RateViewMode rateView = RateViewMode.RatePerDay,
            [FromQuery] bool calculateAverage = true,
            [FromQuery] bool calculateTrend = true)
        {
            if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(targetIds))
            {
                return BadRequest(new { message = "clientId and targetIds are required." });
            }

            var ids = targetIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            var rawData = _service.GetTargetDataPoints(clientId, ids, startDate, endDate, aggregation, splitByTherapist);

            var response = new TargetDataResponse
            {
                DataPoints = rawData,
                TotalRecords = rawData.Count
            };

            // Calculate statistics if numerical values exist
            var validValues = rawData.Where(d => d.Value.HasValue).Select(d => d.Value!.Value).ToList();
            if (validValues.Any())
            {
                response.AverageValue = Math.Round(validValues.Average(), 2);
            }

            // Calculate trendline endpoints
            if (rawData.Count >= 2 && validValues.Count >= 2)
            {
                var first = rawData.First(d => d.Value.HasValue);
                var last = rawData.Last(d => d.Value.HasValue);
                response.TrendlineStart = new TrendPoint { Date = first.Timestamp, Value = first.Value!.Value };
                response.TrendlineEnd = new TrendPoint { Date = last.Timestamp, Value = last.Value!.Value };

                // Linear Regression calculation: y = mx + c
                int n = rawData.Count;
                double sumX = 0;
                double sumY = 0;
                double sumXY = 0;
                double sumX2 = 0;
                for (int i = 0; i < n; i++)
                {
                    double x = i;
                    double y = rawData[i].Value ?? 0;
                    sumX += x;
                    sumY += y;
                    sumXY += x * y;
                    sumX2 += x * x;
                }
                double slope = (n * sumXY - sumX * sumY) / Math.Max(1, (n * sumX2 - sumX * sumX));
                double intercept = (sumY - slope * sumX) / n;
                response.RegressionSlope = Math.Round(slope, 4);
                response.RegressionIntercept = Math.Round(intercept, 4);
            }

            return Ok(response);
        }
    }

    public class TargetDataResponse
    {
        public List<SessionDataPoint> DataPoints { get; set; } = new();
        public int TotalRecords { get; set; }
        public double? AverageValue { get; set; }
        public TrendPoint? TrendlineStart { get; set; }
        public TrendPoint? TrendlineEnd { get; set; }
        public double? RegressionSlope { get; set; }
        public double? RegressionIntercept { get; set; }
    }

    public class TrendPoint
    {
        public DateTime Date { get; set; }
        public double Value { get; set; }
    }
}
