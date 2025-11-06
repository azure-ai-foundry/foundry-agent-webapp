namespace WebApp.Api.Models;

public record ChatResponse
{
    public required string Message { get; init; }
    public required string ThreadId { get; init; }
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
}
