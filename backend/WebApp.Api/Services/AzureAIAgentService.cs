using Azure.AI.Agents.Persistent;
using Azure.AI.Projects;
using Azure.AI.Projects.OpenAI;
using Azure.Core;
using Azure.Identity;
using OpenAI.Responses;
using System.Runtime.CompilerServices;
using WebApp.Api.Models;

namespace WebApp.Api.Services;

#pragma warning disable OPENAI001

public class AzureAIAgentService : IDisposable
{
    private readonly AIProjectClient _projectClient;
    private readonly string _agentId;
    private readonly ILogger<AzureAIAgentService> _logger;
    private AgentVersion? _latestAgentVersion;
    private AgentMetadataResponse? _cachedMetadata; // Cache metadata to avoid repeated calls
    private readonly SemaphoreSlim _agentLock = new(1, 1);
    private readonly CancellationTokenSource _disposeCts = new();
    private UsageInfo? _lastRunUsage;
    private bool _disposed = false;

    public AzureAIAgentService(
        IConfiguration configuration,
        ILogger<AzureAIAgentService> logger)
    {
        _logger = logger;

        // Get Azure AI Agent Service configuration
        var endpoint = configuration["AI_AGENT_ENDPOINT"]
            ?? throw new InvalidOperationException("AI_AGENT_ENDPOINT is not configured");

        _agentId = configuration["AI_AGENT_ID"]
            ?? throw new InvalidOperationException("AI_AGENT_ID is not configured");

        _logger.LogInformation("Initializing Azure AI Agent Service client for endpoint: {Endpoint}, Agent ID: {AgentId}", endpoint, _agentId);

        // IMPORTANT: Use explicit credential types to avoid unexpected behavior
        // Reference: https://learn.microsoft.com/en-us/dotnet/azure/sdk/authentication/best-practices
        
        TokenCredential credential;
        var environment = configuration["ASPNETCORE_ENVIRONMENT"] ?? "Production";
        
        if (environment == "Development")
        {
            // Local development: Use ChainedTokenCredential for explicit, predictable behavior
            // This avoids the "fail fast" mode issues with DefaultAzureCredential
            _logger.LogInformation("Development environment: Using ChainedTokenCredential (AzureCli -> AzureDeveloperCli)");
            
            credential = new ChainedTokenCredential(
                new AzureCliCredential(),
                new AzureDeveloperCliCredential()
            );
        }
        else
        {
            // Production: Use explicit ManagedIdentityCredential (system-assigned)
            // This prevents DefaultAzureCredential from attempting other credential types
            // and ensures deterministic behavior in production
            _logger.LogInformation("Production environment: Using ManagedIdentityCredential (system-assigned)");
            credential = new ManagedIdentityCredential();
        }

        // Create client for Azure AI Agent Service
        _projectClient = new AIProjectClient(new Uri(endpoint), credential);

        _logger.LogInformation("Azure AI Agent Service client initialized successfully");
        
        // Pre-load agent at startup (matches Azure sample pattern in gunicorn.conf.py)
        // This ensures the agent is ready before the first request
        _ = Task.Run(async () => 
        {
            try 
            {
                await GetAgentAsync(_disposeCts.Token);
                _logger.LogInformation("Agent pre-loaded successfully at startup");
            }
            catch (OperationCanceledException)
            {
                // Service was disposed during startup - this is expected during hot reload
                _logger.LogDebug("Agent pre-load cancelled due to service disposal");
            }
            catch (ObjectDisposedException)
            {
                // Service was disposed during startup - this is expected during hot reload
                _logger.LogDebug("Agent pre-load cancelled due to service disposal");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to pre-load agent at startup. Will retry on first request.");
            }
        });
    }

    private async Task<AgentVersion> GetAgentAsync(CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        
        if (_latestAgentVersion != null)
            return _latestAgentVersion;

        await _agentLock.WaitAsync(cancellationToken);
        try
        {
            if (_latestAgentVersion != null)
                return _latestAgentVersion;

            _logger.LogInformation("Loading existing agent from Azure AI Agent Service: {AgentId}", _agentId);
            
            // Get the existing agent
            AgentRecord agentRecord = await _projectClient.Agents.GetAgentAsync(_agentId, cancellationToken);
            _latestAgentVersion = agentRecord.Versions.Latest;

            _logger.LogInformation("Successfully connected to existing Azure AI Agent: {AgentId}", _agentId);
            return _latestAgentVersion;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load agent from Azure AI Agent Service");
            throw;
        }
        finally
        {
            _agentLock.Release();
        }
    }

    public async Task<string> GetAgentInfoAsync(CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        
        var agent = await GetAgentAsync(cancellationToken);
        return agent?.ToString() ?? "AI Assistant";
    }

    /// <summary>
    /// Get the agent metadata (name, description, metadata) for display in UI.
    /// Cached after first call to avoid repeated Azure API calls.
    /// </summary>
    public async Task<AgentMetadataResponse> GetAgentMetadataAsync(CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        
        // Return cached metadata if available (matches Azure sample pattern)
        if (_cachedMetadata != null)
        {
            _logger.LogDebug("Returning cached agent metadata");
            return _cachedMetadata;
        }
        
        var agent = await GetAgentAsync(cancellationToken);
        PromptAgentDefinition? promptAgentDefinition = (agent.Definition as PromptAgentDefinition);

        _cachedMetadata = new AgentMetadataResponse
        {
            Id = agent.Id,//persistentAgent.Value.Id,
            Object = "agent",
            CreatedAt = agent.CreatedAt.ToUnixTimeSeconds(),
            Name = agent.Name ?? "AI Assistant",
            Description = agent.Description,
            Model = promptAgentDefinition?.Model ?? string.Empty,
            Instructions = promptAgentDefinition?.Instructions ?? string.Empty,
            Metadata = agent.Metadata?.ToDictionary(kvp => kvp.Key, kvp => kvp.Value)
        };
        
        _logger.LogInformation("Cached agent metadata for future requests");
        return _cachedMetadata;
    }

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
                "Created conversation: {ConversationId} with title: {Title}", 
                conversation.Id,
                conversation.Metadata.TryGetValue("title", out string? metadataTitle)
                    ? metadataTitle
                    : "New Conversation");
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
    /// Streams agent response for a message in a conversation with optional image attachments.
    /// Returns StreamChunk objects containing either text deltas or annotations (citations).
    /// </summary>
    public async IAsyncEnumerable<StreamChunk> StreamMessageAsync(
        string conversationId,
        string message,
        List<string>? imageDataUris = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        
        var agent = await GetAgentAsync(cancellationToken);
        
        _logger.LogInformation(
            "Streaming message to conversation: {ConversationId}, ImageCount: {ImageCount}", 
            conversationId,
            imageDataUris?.Count ?? 0);
        
        if (string.IsNullOrWhiteSpace(message))
        {
            _logger.LogWarning("Attempted to stream empty message to conversation {ConversationId}", conversationId);
            throw new ArgumentException("Message cannot be null or whitespace", nameof(message));
        }

        ResponseItem userMessage = BuildUserMessage(message, imageDataUris);

        ProjectResponsesClient responsesClient
            = _projectClient.OpenAI.GetProjectResponsesClientForAgent(agent, conversationId);

        CreateResponseOptions options = new()
        {
            InputItems = { userMessage },
            StreamingEnabled = true
        };

        // Dictionary to collect file search results for quote extraction
        // FileSearchCallResponseItem arrives before MessageResponseItem with annotations
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
                else
                {
                    _logger.LogDebug("Output item completed: {ItemType}", itemDoneUpdate.Item?.GetType().Name);
                }
            }
            else if (update is StreamingResponseFunctionCallArgumentsDoneUpdate)
            {
                // Function/tool call arguments received - future enhancement (Issue #15)
                _logger.LogDebug("Function call arguments completed");
            }
            else if (update is StreamingResponseErrorUpdate errorUpdate)
            {
                _logger.LogError("Stream error: {Error}", errorUpdate.Message);
                throw new InvalidOperationException($"Stream error: {errorUpdate.Message}");
            }
            else if (update is StreamingResponseCompletedUpdate completedUpdate)
            {
                _lastRunUsage = ExtractUsageInfo(completedUpdate.Response.Usage);
            }
        }

        _logger.LogInformation("Completed streaming response for conversation: {ConversationId}", conversationId);
    }

    /// <summary>
    /// Extracts annotation information from a completed response item.
    /// Handles all annotation types from the OpenAI.Responses SDK:
    /// - UriCitationMessageAnnotation: Bing, Azure AI Search, SharePoint citations
    /// - FileCitationMessageAnnotation: File search citations from vector stores
    /// - FilePathMessageAnnotation: File paths generated by code interpreter
    /// - ContainerFileCitationMessageAnnotation: Container file citations
    /// </summary>
    /// <param name="item">The completed response item to extract annotations from</param>
    /// <param name="fileSearchQuotes">Dictionary mapping FileId to quote text from file search results</param>
    private List<AnnotationInfo> ExtractAnnotations(
        ResponseItem? item, 
        Dictionary<string, string>? fileSearchQuotes = null)
    {
        var annotations = new List<AnnotationInfo>();
        
        if (item is not MessageResponseItem messageItem)
        {
            _logger.LogDebug("ExtractAnnotations: Item is not MessageResponseItem, type: {Type}", item?.GetType().Name ?? "null");
            return annotations;
        }

        _logger.LogDebug("ExtractAnnotations: Processing MessageResponseItem with {Count} content items", messageItem.Content.Count);

        foreach (var content in messageItem.Content)
        {
            var annotationCount = content.OutputTextAnnotations?.Count ?? 0;
            _logger.LogDebug("ExtractAnnotations: Content has {Count} OutputTextAnnotations", annotationCount);
            
            if (content.OutputTextAnnotations == null) continue;
            
            foreach (var annotation in content.OutputTextAnnotations)
            {
                _logger.LogDebug("ExtractAnnotations: Found annotation Kind={Kind}, Type={Type}", 
                    annotation.Kind, annotation.GetType().Name);
                
                var annotationInfo = annotation switch
                {
                    // URI citations from Bing, Azure AI Search, SharePoint
                    UriCitationMessageAnnotation uriAnnotation => new AnnotationInfo
                    {
                        Type = "uri_citation",
                        Label = uriAnnotation.Title ?? "Source",
                        Url = uriAnnotation.Uri?.ToString(),
                        StartIndex = uriAnnotation.StartIndex,
                        EndIndex = uriAnnotation.EndIndex
                    },
                    
                    // File citations from file search (vector stores)
                    FileCitationMessageAnnotation fileCitation => new AnnotationInfo
                    {
                        Type = "file_citation",
                        Label = fileCitation.Filename ?? "File",
                        FileId = fileCitation.FileId,
                        StartIndex = fileCitation.Index,
                        EndIndex = fileCitation.Index,
                        // Look up quote from file search results
                        Quote = fileSearchQuotes?.TryGetValue(fileCitation.FileId, out var quote) == true 
                            ? quote 
                            : null
                    },
                    
                    // File paths generated by code interpreter
                    FilePathMessageAnnotation filePath => new AnnotationInfo
                    {
                        Type = "file_path",
                        Label = "Generated File",
                        FileId = filePath.FileId,
                        StartIndex = filePath.Index,
                        EndIndex = filePath.Index
                    },
                    
                    // Container file citations
                    ContainerFileCitationMessageAnnotation containerCitation => new AnnotationInfo
                    {
                        Type = "container_file_citation",
                        Label = containerCitation.Filename ?? "Container File",
                        FileId = containerCitation.FileId,
                        StartIndex = containerCitation.StartIndex,
                        EndIndex = containerCitation.EndIndex,
                        // Look up quote from file search results
                        Quote = fileSearchQuotes?.TryGetValue(containerCitation.FileId, out var containerQuote) == true 
                            ? containerQuote 
                            : null
                    },
                    
                    // Unknown annotation type - log for debugging
                    _ => null
                };
                
                if (annotationInfo != null)
                {
                    annotations.Add(annotationInfo);
                }
                else
                {
                    _logger.LogWarning(
                        "Unknown annotation type: Kind={Kind}, Type={Type}",
                        annotation.Kind,
                        annotation.GetType().FullName);
                }
            }
        }

        return annotations;
    }

    /// <summary>
    /// Validates image data URIs for count, size, MIME type, and base64 integrity.
    /// Returns list of validation errors, or empty list if all valid.
    /// </summary>
    private static List<string> ValidateImageDataUris(List<string>? imageDataUris)
    {
        var errors = new List<string>();
        
        if (imageDataUris == null || imageDataUris.Count == 0)
            return errors;
        
        // Enforce maximum count
        if (imageDataUris.Count > 5)
        {
            errors.Add($"Too many images: {imageDataUris.Count} provided, maximum 5 allowed");
            return errors; // Short-circuit if count exceeded
        }
        
        var allowedMimeTypes = new[] { "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp" };
        const long maxSizeBytes = 5 * 1024 * 1024; // 5MB
        
        for (int i = 0; i < imageDataUris.Count; i++)
        {
            var dataUri = imageDataUris[i];
            
            // Validate format: data:[<media-type>][;base64],<data>
            if (!dataUri.StartsWith("data:"))
            {
                errors.Add($"Image {i + 1}: Invalid data URI format (must start with 'data:')");
                continue;
            }
            
            var semiIndex = dataUri.IndexOf(';');
            var commaIndex = dataUri.IndexOf(',');
            
            if (semiIndex < 0 || commaIndex < 0 || commaIndex < semiIndex)
            {
                errors.Add($"Image {i + 1}: Malformed data URI structure");
                continue;
            }
            
            // Extract and validate MIME type
            string mediaType = dataUri["data:".Length..semiIndex].ToLowerInvariant();
            if (!allowedMimeTypes.Contains(mediaType))
            {
                errors.Add($"Image {i + 1}: Unsupported type '{mediaType}'. Allowed: PNG, JPEG, GIF, WebP");
                continue;
            }
            
            // Validate and decode base64
            string base64Data = dataUri[(commaIndex + 1)..];
            try
            {
                byte[] imageBytes = Convert.FromBase64String(base64Data);
                
                // Enforce size limit
                if (imageBytes.Length > maxSizeBytes)
                {
                    var sizeMB = imageBytes.Length / (1024.0 * 1024.0);
                    errors.Add($"Image {i + 1}: Size {sizeMB:F1}MB exceeds maximum 5MB");
                }
            }
            catch (FormatException)
            {
                errors.Add($"Image {i + 1}: Invalid base64 encoding");
            }
        }
        
        return errors;
    }

    /// <summary>
    /// Builds message content blocks from text and optional image data URIs.
    /// Images are encoded as base64 data URIs for inline vision analysis.
    /// </summary>
    private MessageResponseItem BuildUserMessage(string message, List<string>? imageDataUris)
    {
        // Validate images before processing
        var validationErrors = ValidateImageDataUris(imageDataUris);
        if (validationErrors.Count > 0)
        {
            _logger.LogWarning("Image attachment validation failed: {Errors}", string.Join("; ", validationErrors));
            throw new ArgumentException($"Invalid image attachments: {string.Join(", ", validationErrors)}");
        }
        
        List<ResponseContentPart> messageContentParts =
        [
            ResponseContentPart.CreateInputTextPart(message),
        ];

        foreach (string imageDataUri in imageDataUris ?? [])
        {
            // data:[<media-type>][;base64],<data>
            if (imageDataUri.StartsWith("data:"))
            {
                string mediaType = imageDataUri["data:".Length..imageDataUri.IndexOf(';')];
                BinaryData imageBytes = BinaryData.FromBytes(
                    Convert.FromBase64String(imageDataUri[(imageDataUri.IndexOf(',') + 1)..]));
                messageContentParts.Add(ResponseContentPart.CreateInputImagePart(imageBytes, mediaType));
            }
            else
            {
                messageContentParts.Add(ResponseContentPart.CreateInputImagePart(new Uri(imageDataUri)));
            }
        }

        return ResponseItem.CreateUserMessageItem(messageContentParts);
    }

    /// <summary>
    /// Extracts token usage metrics from Azure AI Agents run usage data.
    /// </summary>
    private static UsageInfo ExtractUsageInfo(ResponseTokenUsage usage)
    {
        return new UsageInfo
        {
            PromptTokens = usage.InputTokenCount,
            CompletionTokens = usage.OutputTokenCount,
            TotalTokens = usage.TotalTokenCount
        };
    }

    public Task<UsageInfo?> GetLastRunUsageAsync(CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        
        return Task.FromResult(_lastRunUsage);
    }

    /// <summary>
    /// Dispose of managed resources.
    /// </summary>
    public void Dispose()
    {
        if (!_disposed)
        {
            _disposed = true;
            
            // Cancel any pending operations first
            try
            {
                _disposeCts.Cancel();
            }
            catch (ObjectDisposedException) { }
            
            _disposeCts.Dispose();
            _agentLock.Dispose();
            _logger.LogDebug("AzureAIAgentService disposed");
        }
    }
}

public class UsageInfo
{
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public int TotalTokens { get; set; }
}
