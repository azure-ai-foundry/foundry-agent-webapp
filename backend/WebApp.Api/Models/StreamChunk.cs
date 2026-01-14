namespace WebApp.Api.Models;

/// <summary>
/// Represents a chunk of streaming response data.
/// Can contain either text content or annotations (citations).
/// </summary>
public record StreamChunk
{
    /// <summary>
    /// Text content chunk (delta). Null if this chunk contains annotations.
    /// </summary>
    public string? TextDelta { get; init; }
    
    /// <summary>
    /// Annotations/citations extracted from the response. Null if this chunk contains text.
    /// </summary>
    public List<AnnotationInfo>? Annotations { get; init; }
    
    /// <summary>
    /// Creates a text delta chunk.
    /// </summary>
    public static StreamChunk Text(string delta) => new() { TextDelta = delta };
    
    /// <summary>
    /// Creates an annotations chunk.
    /// </summary>
    public static StreamChunk WithAnnotations(List<AnnotationInfo> annotations) => new() { Annotations = annotations };
    
    /// <summary>
    /// Whether this chunk contains text content.
    /// </summary>
    public bool IsText => TextDelta != null;
    
    /// <summary>
    /// Whether this chunk contains annotations.
    /// </summary>
    public bool HasAnnotations => Annotations != null && Annotations.Count > 0;
}
