namespace WebApp.Api.Models;

/// <summary>
/// Represents a citation annotation from AI agent responses.
/// Supports all Azure AI Agent SDK annotation types:
/// - uri_citation: Bing, Azure AI Search, SharePoint
/// - file_citation: File search from vector stores
/// - file_path: Code interpreter generated files
/// - container_file_citation: Container file citations
/// </summary>
public record AnnotationInfo
{
    /// <summary>
    /// The type of annotation: "uri_citation", "file_citation", "file_path", or "container_file_citation".
    /// </summary>
    public required string Type { get; init; }
    
    /// <summary>
    /// Display label for the citation (title or filename).
    /// </summary>
    public required string Label { get; init; }
    
    /// <summary>
    /// URL for URI citations (null for file citations).
    /// </summary>
    public string? Url { get; init; }
    
    /// <summary>
    /// File ID for file citations (null for URI citations).
    /// </summary>
    public string? FileId { get; init; }
    
    /// <summary>
    /// The placeholder text in the response to replace (e.g., "【4:0†source】").
    /// </summary>
    public string? TextToReplace { get; init; }
    
    /// <summary>
    /// Start index in the text where the citation applies.
    /// </summary>
    public int? StartIndex { get; init; }
    
    /// <summary>
    /// End index in the text where the citation applies.
    /// </summary>
    public int? EndIndex { get; init; }
    
    /// <summary>
    /// Quote from the source document (for file citations).
    /// </summary>
    public string? Quote { get; init; }
}
