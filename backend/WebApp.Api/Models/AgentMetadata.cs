namespace WebApp.Api.Models;

/// <summary>
/// Agent metadata response model matching Azure sample pattern
/// </summary>
public record AgentMetadataResponse
{
    public required string Id { get; init; }
    public required string Object { get; init; } = "agent";
    public required long CreatedAt { get; init; }
    public required string Name { get; init; }
    public string? Description { get; init; }
    public required string Model { get; init; }
    public string? Instructions { get; init; }
    public Dictionary<string, string>? Metadata { get; init; }
    
    /// <summary>
    /// Starter prompts to display as suggestions in the chat interface.
    /// Populated from agent metadata key "starterPrompts" (newline-separated text).
    /// Configure in Azure AI Foundry portal under agent Configuration > Starter prompts.
    /// </summary>
    public List<string>? StarterPrompts { get; init; }
}
