using System.Text.Json.Serialization;

namespace Welina.Analytics.Api.Models
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum TargetType
    {
        TrialByTrial,
        Duration,
        Frequency,
        IntervalData,
        Anecdotal,
        FluencyRate
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ProgramCategory
    {
        SkillAcquisition,
        BehaviorReduction
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum TargetStatus
    {
        Baseline,
        Acquisition,
        Maintenance,
        Generalization,
        Completed
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum LineStyle
    {
        Solid,
        Dotted
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum AggregationType
    {
        PerDay,
        PerSession,
        Weekly,
        Monthly
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum DurationViewMode
    {
        TotalDuration,
        TotalCount,
        AverageDuration
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum RateViewMode
    {
        RatePerDay,
        RatePerMinute,
        RatePerHour
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum BehaviorMissingDataMode
    {
        ZeroOut,
        DataNotTracked
    }
}
