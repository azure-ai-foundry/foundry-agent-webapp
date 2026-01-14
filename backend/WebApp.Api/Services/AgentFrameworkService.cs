using Azure.AI.Projects;
using Azure.AI.Projects.OpenAI;
using Azure.Core;
using Azure.Identity;
using OpenAI.Responses;
using System.Runtime.CompilerServices;
using WebApp.Api.Models;

namespace WebApp.Api.Services;

#pragma warning disable OPENAI001

/// <summary>
/// Azure AI Foundry agent service using v2 Agents API via Azure.AI.Projects SDK.
/// </summary>
/// <remarks>
/// Uses AIProjectClient.Agents (not PersistentAgentsClient) for human-readable agent IDs.
/// See .github/skills/researching-azure-ai-sdk/SKILL.md for SDK patterns.
/// </remarks>
public class AgentFrameworkService : IDisposable
{
    private readonly AIProjectClient _projectClient;
    private readonly string _agentId;
    private readonly ILogger<AgentFrameworkService> _logger;
    private AgentVersion? _cachedAgentVersion;
    private AgentMetadataResponse? _cachedMetadata;
    private readonly SemaphoreSlim _agentLock = new(1, 1);
    private bool _disposed = false;
    private ResponseTokenUsage? _lastUsage;

    public AgentFrameworkService(
        IConfiguration configuration,
        ILogger<AgentFrameworkService> logger)
    {
        _logger = logger;

        var endpoint = configuration["AI_AGENT_ENDPOINT"]
            ?? throw new InvalidOperationException("AI_AGENT_ENDPOINT is not configured");

        _agentId = configuration["AI_AGENT_ID"]
            ?? throw new InvalidOperationException("AI_AGENT_ID is not configured");

        _logger.LogDebug(
            "Initializing AgentFrameworkService: endpoint={Endpoint}, agentId={AgentId}", 
            endpoint, 
            _agentId);

        TokenCredential credential;
        var environment = configuration["ASPNETCORE_ENVIRONMENT"] ?? "Production";

        if (environment == "Development")
        {
            _logger.LogInformation("Development: Using ChainedTokenCredential (AzureCli -> AzureDeveloperCli)");
            credential = new ChainedTokenCredential(
                new AzureCliCredential(),
                new AzureDeveloperCliCredential()
            );
        }
        else
        {
            _logger.LogInformation("Production: Using ManagedIdentityCredential (system-assigned)");
            credential = new ManagedIdentityCredential();
        }

        _projectClient = new AIProjectClient(new Uri(endpoint), credential);
        _logger.LogInformation("AIProjectClient initialized successfully");
    }

    /// <summary>
    /// Get agent metadata from Azure AI Foundry v2 Agents API.
    /// Caches the result for subsequent calls.
    /// </summary>
    private async Task<AgentVersion> GetAgentAsync(CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        if (_cachedAgentVersion != null)
            return _cachedAgentVersion;

        await _agentLock.WaitAsync(cancellationToken);
        try
        {
            if (_cachedAgentVersion != null)
                return _cachedAgentVersion;

            _logger.LogInformation("Loading agent from v2 Agents API: {AgentId}", _agentId);

            // Use AIProjectClient.Agents to access v2 Agents API (/agents/ endpoint)
            AgentRecord agentRecord = await _projectClient.Agents.GetAgentAsync(_agentId, cancellationToken);
            _cachedAgentVersion = agentRecord.Versions.Latest;

            var definition = _cachedAgentVersion.Definition as PromptAgentDefinition;
            _logger.LogInformation(
                "Loaded agent: name={AgentName}, model={Model}, version={Version}", 
                _cachedAgentVersion.Name,
                definition?.Model ?? "unknown",
                _cachedAgentVersion.Version);

            // Log StructuredInputs at debug level for troubleshooting
            if (definition?.StructuredInputs != null && definition.StructuredInputs.Count > 0)
            {
                _logger.LogDebug("Agent has {Count} StructuredInputs: {Keys}", 
                    definition.StructuredInputs.Count, 
                    string.Join(", ", definition.StructuredInputs.Keys));
            }

            return _cachedAgentVersion;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load agent: {AgentId}", _agentId);
            throw;
        }
        finally
        {
            _agentLock.Release();
        }
    }

    /// <summary>
    /// Streams agent response for a message using ProjectResponsesClient (Responses API).
    /// Returns StreamChunk objects containing either text deltas or annotations.
    /// </summary>
    public async IAsyncEnumerable<StreamChunk> StreamMessageAsync(
        string conversationId,
        string message,
        List<string>? imageDataUris = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        _logger.LogInformation(
            "Streaming message to conversation: {ConversationId}, ImageCount: {ImageCount}",
            conversationId,
            imageDataUris?.Count ?? 0);

        if (string.IsNullOrWhiteSpace(message))
        {
            _logger.LogWarning("Attempted to stream empty message to conversation {ConversationId}", conversationId);
            throw new ArgumentException("Message cannot be null or whitespace", nameof(message));
        }

        // Build user message with optional images
        ResponseItem userMessage = BuildUserMessage(message, imageDataUris);

        // Get ProjectResponsesClient for the agent and conversation
        ProjectResponsesClient responsesClient
            = _projectClient.OpenAI.GetProjectResponsesClientForAgent(
                new AgentReference(_agentId), 
                conversationId);

        CreateResponseOptions options = new()
        {
            InputItems = { userMessage },
            StreamingEnabled = true
        };

        // Dictionary to collect file search results for quote extraction
        var fileSearchQuotes = new Dictionary<string, string>();

        await foreach (StreamingResponseUpdate update
            in responsesClient.CreateResponseStreamingAsync(
                options: options,
                cancellationToken: cancellationToken))
        {
            if (update is StreamingResponseOutputTextDeltaUpdate deltaUpdate)
            {
                yield return StreamChunk.Text(deltaUpdate.Delta);
            }
            else if (update is StreamingResponseOutputItemDoneUpdate itemDoneUpdate)
            {
                // Capture file search results for quote extraction
                if (itemDoneUpdate.Item is FileSearchCallResponseItem fileSearchItem)
                {
                    foreach (var result in fileSearchItem.Results)
                    {
                        if (!string.IsNullOrEmpty(result.FileId) && !string.IsNullOrEmpty(result.Text))
                        {
                            fileSearchQuotes[result.FileId] = result.Text;
                            _logger.LogDebug(
                                "Captured file search quote for FileId={FileId}, QuoteLength={Length}", 
                                result.FileId, 
                                result.Text.Length);
                        }
                    }
                    continue;
                }
                
                // Extract annotations/citations from completed output items
                var annotations = ExtractAnnotations(itemDoneUpdate.Item, fileSearchQuotes);
                if (annotations.Count > 0)
                {
                    _logger.LogInformation("Extracted {Count} annotations from response", annotations.Count);
                    yield return StreamChunk.WithAnnotations(annotations);
                }
            }
            else if (update is StreamingResponseCompletedUpdate completedUpdate)
            {
                _lastUsage = completedUpdate.Response.Usage;
            }
            else if (update is StreamingResponseErrorUpdate errorUpdate)
            {
                _logger.LogError("Stream error: {Error}", errorUpdate.Message);
                throw new InvalidOperationException($"Stream error: {errorUpdate.Message}");
            }
        }

        _logger.LogInformation("Completed streaming for conversation: {ConversationId}", conversationId);
    }

    /// <summary>
    /// Supported image MIME types for vision capabilities.
    /// </summary>
    private static readonly HashSet<string> AllowedMediaTypes = 
        ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];

    /// <summary>
    /// Maximum number of images per message.
    /// </summary>
    private const int MaxImageCount = 5;

    /// <summary>
    /// Maximum size per image in bytes (5MB).
    /// </summary>
    private const long MaxImageSizeBytes = 5 * 1024 * 1024;

    /// <summary>
    /// Builds a ResponseItem for the user message with optional image attachments.
    /// Validates count (max 5), size (max 5MB each), MIME type, and Base64 format.
    /// </summary>
    private static ResponseItem BuildUserMessage(string message, List<string>? imageDataUris)
    {
        if (imageDataUris == null || imageDataUris.Count == 0)
        {
            return ResponseItem.CreateUserMessageItem(message);
        }

        // Enforce maximum image count
        if (imageDataUris.Count > MaxImageCount)
        {
            throw new ArgumentException(
                $"Invalid image attachments: Too many images ({imageDataUris.Count}), maximum {MaxImageCount} allowed");
        }

        var contentParts = new List<ResponseContentPart>
        {
            ResponseContentPart.CreateInputTextPart(message)
        };

        var errors = new List<string>();

        for (int i = 0; i < imageDataUris.Count; i++)
        {
            var dataUri = imageDataUris[i];
            
            // Validate data URI format
            if (!dataUri.StartsWith("data:"))
            {
                errors.Add($"Image {i + 1}: Invalid format (must be data URI)");
                continue;
            }

            var semiIndex = dataUri.IndexOf(';');
            var commaIndex = dataUri.IndexOf(',');
            
            if (semiIndex < 0 || commaIndex < 0 || commaIndex < semiIndex)
            {
                errors.Add($"Image {i + 1}: Malformed data URI");
                continue;
            }

            // Extract and validate MIME type
            var mediaType = dataUri[5..semiIndex].ToLowerInvariant();
            if (!AllowedMediaTypes.Contains(mediaType))
            {
                errors.Add($"Image {i + 1}: Unsupported type '{mediaType}'. Allowed: PNG, JPEG, GIF, WebP");
                continue;
            }

            // Validate Base64 and decode
            var base64Data = dataUri[(commaIndex + 1)..];
            try
            {
                var bytes = Convert.FromBase64String(base64Data);
                
                // Enforce size limit
                if (bytes.Length > MaxImageSizeBytes)
                {
                    var sizeMB = bytes.Length / (1024.0 * 1024.0);
                    errors.Add($"Image {i + 1}: Size {sizeMB:F1}MB exceeds maximum 5MB");
                    continue;
                }
                
                contentParts.Add(ResponseContentPart.CreateInputImagePart(
                    BinaryData.FromBytes(bytes),
                    mediaType));
            }
            catch (FormatException)
            {
                errors.Add($"Image {i + 1}: Invalid Base64 encoding");
            }
        }

        if (errors.Count > 0)
        {
            throw new ArgumentException($"Invalid image attachments: {string.Join("; ", errors)}");
        }

        return ResponseItem.CreateUserMessageItem(contentParts);
    }

    /// <summary>
    /// Extracts annotation information from a completed response item.
    /// </summary>
    private List<AnnotationInfo> ExtractAnnotations(
        ResponseItem? item, 
        Dictionary<string, string>? fileSearchQuotes = null)
    {
        var annotations = new List<AnnotationInfo>();
        
        if (item is not MessageResponseItem messageItem)
            return annotations;

        foreach (var content in messageItem.Content)
        {
            if (content.OutputTextAnnotations == null) continue;
            
            foreach (var annotation in content.OutputTextAnnotations)
            {
                var annotationInfo = annotation switch
                {
                    UriCitationMessageAnnotation uriAnnotation => new AnnotationInfo
                    {
                        Type = "uri_citation",
                        Label = uriAnnotation.Title ?? "Source",
                        Url = uriAnnotation.Uri?.ToString(),
                        StartIndex = uriAnnotation.StartIndex,
                        EndIndex = uriAnnotation.EndIndex
                    },
                    
                    FileCitationMessageAnnotation fileCitation => new AnnotationInfo
                    {
                        Type = "file_citation",
                        Label = fileCitation.Filename ?? "File",
                        FileId = fileCitation.FileId,
                        StartIndex = fileCitation.Index,
                        EndIndex = fileCitation.Index,
                        Quote = fileSearchQuotes?.TryGetValue(fileCitation.FileId, out var quote) == true 
                            ? quote : null
                    },
                    
                    FilePathMessageAnnotation filePath => new AnnotationInfo
                    {
                        Type = "file_path",
                        Label = "Generated File",
                        FileId = filePath.FileId,
                        StartIndex = filePath.Index,
                        EndIndex = filePath.Index
                    },
                    
                    ContainerFileCitationMessageAnnotation containerCitation => new AnnotationInfo
                    {
                        Type = "container_file_citation",
                        Label = containerCitation.Filename ?? "Container File",
                        FileId = containerCitation.FileId,
                        StartIndex = containerCitation.StartIndex,
                        EndIndex = containerCitation.EndIndex,
                        Quote = fileSearchQuotes?.TryGetValue(containerCitation.FileId, out var containerQuote) == true 
                            ? containerQuote : null
                    },
                    
                    _ => null
                };
                
                if (annotationInfo != null)
                    annotations.Add(annotationInfo);
            }
        }

        return annotations;
    }

    /// <summary>
    /// Create a new conversation for the agent.
    /// Uses ProjectConversation from Azure.AI.Projects for server-managed state.
    /// </summary>
    public async Task<string> CreateConversationAsync(string? firstMessage = null, CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        try
        {
            _logger.LogInformation("Creating new conversation");
            
            ProjectConversationCreationOptions conversationOptions = new();

            if (!string.IsNullOrEmpty(firstMessage))
            {
                // Store title in metadata (truncate to 50 chars)
                var title = firstMessage.Length > 50 
                    ? firstMessage[..50] + "..."
                    : firstMessage;
                conversationOptions.Metadata["title"] = title;
            }

            ProjectConversation conversation
                = await _projectClient.OpenAI.Conversations.CreateProjectConversationAsync(
                    conversationOptions,
                    cancellationToken);

            _logger.LogInformation(
                "Created conversation: {ConversationId}", 
                conversation.Id);
            return conversation.Id;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Conversation creation was cancelled");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create conversation");
            throw;
        }
    }

    /// <summary>
    /// Get the agent metadata (name, description, etc.) for display in UI.
    /// </summary>
    public async Task<AgentMetadataResponse> GetAgentMetadataAsync(CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        // Ensure agent is loaded (which also caches the version info)
        await GetAgentAsync(cancellationToken);

        if (_cachedMetadata != null)
            return _cachedMetadata;

        if (_cachedAgentVersion == null)
            throw new InvalidOperationException("Agent version not loaded");

        var definition = _cachedAgentVersion.Definition as PromptAgentDefinition;
        var metadata = _cachedAgentVersion.Metadata?.ToDictionary(kvp => kvp.Key, kvp => kvp.Value);

        // Log metadata keys at debug level for troubleshooting
        if (metadata != null && metadata.Count > 0)
        {
            _logger.LogDebug("Agent metadata keys: {Keys}", string.Join(", ", metadata.Keys));
        }

        // Parse starter prompts from metadata
        List<string>? starterPrompts = ParseStarterPrompts(metadata);

        _cachedMetadata = new AgentMetadataResponse
        {
            Id = _agentId,
            Object = "agent",
            CreatedAt = _cachedAgentVersion.CreatedAt.ToUnixTimeSeconds(),
            Name = _cachedAgentVersion.Name ?? "AI Assistant",
            Description = _cachedAgentVersion.Description,
            Model = definition?.Model ?? string.Empty,
            Instructions = definition?.Instructions ?? string.Empty,
            Metadata = metadata,
            StarterPrompts = starterPrompts
        };

        return _cachedMetadata;
    }

    /// <summary>
    /// Parse starter prompts from agent metadata.
    /// Azure AI Foundry stores starter prompts as newline-separated text in the "starterPrompts" metadata key.
    /// Example: "How's the weather?\nIs your fridge running?\nTell me a joke"
    /// </summary>
    private List<string>? ParseStarterPrompts(Dictionary<string, string>? metadata)
    {
        if (metadata == null)
            return null;

        // Azure AI Foundry uses camelCase "starterPrompts" key with newline-separated values
        if (!metadata.TryGetValue("starterPrompts", out var starterPromptsValue))
            return null;

        if (string.IsNullOrWhiteSpace(starterPromptsValue))
            return null;

        // Split by newlines and filter out empty entries
        var prompts = starterPromptsValue
            .Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.Trim())
            .Where(p => !string.IsNullOrEmpty(p))
            .ToList();

        if (prompts.Count > 0)
        {
            _logger.LogDebug("Parsed {Count} starter prompts from agent metadata", prompts.Count);
            return prompts;
        }

        return null;
    }

    /// <summary>
    /// Get basic agent info string (for debugging).
    /// </summary>
    public async Task<string> GetAgentInfoAsync(CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        await GetAgentAsync(cancellationToken);
        return _cachedAgentVersion?.Name ?? _agentId;
    }

    /// <summary>
    /// Get token usage from the last streaming response.
    /// </summary>
    public (int InputTokens, int OutputTokens, int TotalTokens)? GetLastUsage() =>
        _lastUsage is null ? null : (_lastUsage.InputTokenCount, _lastUsage.OutputTokenCount, _lastUsage.TotalTokenCount);

    public void Dispose()
    {
        if (!_disposed)
        {
            _disposed = true;
            _agentLock.Dispose();
            _logger.LogDebug("AgentFrameworkService disposed");
        }
    }
}
