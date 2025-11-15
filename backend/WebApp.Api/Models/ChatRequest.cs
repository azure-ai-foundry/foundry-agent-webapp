namespace WebApp.Api.Models;

public record ChatRequest
{
    public required string Message { get; init; }
    public string? ConversationId { get; init; }
    /// <summary>
    /// Base64-encoded image data URIs (e.g., data:image/png;base64,iVBORw0KG...)
    /// Images are sent inline with the message, no file upload needed.
    /// </summary>
    public List<string>? ImageDataUris { get; init; }
}
