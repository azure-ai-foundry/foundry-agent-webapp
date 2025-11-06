using Azure.AI.Agents.Persistent;
using Azure.Core;
using Azure.Identity;
using Microsoft.Agents.AI;
using System.Runtime.CompilerServices;
using WebApp.Api.Models;

namespace WebApp.Api.Services;

public class AzureAIAgentService
{
    private readonly PersistentAgentsClient _client;
    private readonly string _agentId;
    private readonly ILogger<AzureAIAgentService> _logger;
    private readonly Dictionary<string, AgentThread> _threads = new();
    private readonly Dictionary<string, string> _threadIdMapping = new(); // Maps our ID to persistent thread ID
    private AIAgent? _agent;
    private AgentMetadataResponse? _cachedMetadata; // Cache metadata to avoid repeated calls
    private readonly SemaphoreSlim _agentLock = new(1, 1);
    private UsageInfo? _lastRunUsage;

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
        _client = new PersistentAgentsClient(endpoint, credential);
        
        _logger.LogInformation("Azure AI Agent Service client initialized successfully");
        
        // Pre-load agent at startup (matches Azure sample pattern in gunicorn.conf.py)
        // This ensures the agent is ready before the first request
        _ = Task.Run(async () => 
        {
            try 
            {
                await GetAgentAsync();
                _logger.LogInformation("Agent pre-loaded successfully at startup");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to pre-load agent at startup. Will retry on first request.");
            }
        });
    }

    private async Task<AIAgent> GetAgentAsync(CancellationToken cancellationToken = default)
    {
        if (_agent != null)
            return _agent;

        await _agentLock.WaitAsync(cancellationToken);
        try
        {
            if (_agent != null)
                return _agent;

            _logger.LogInformation("Loading existing agent from Azure AI Agent Service: {AgentId}", _agentId);
            
            // Get the existing agent by ID (using Agent Framework SDK helper)
            _agent = await _client.GetAIAgentAsync(_agentId);
            
            _logger.LogInformation("Successfully connected to existing Azure AI Agent: {AgentId}", _agentId);
            return _agent;
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
        var agent = await GetAgentAsync(cancellationToken);
        return agent?.ToString() ?? "AI Assistant";
    }

    /// <summary>
    /// Get the agent metadata (name, description, metadata) for display in UI.
    /// Cached after first call to avoid repeated Azure API calls.
    /// </summary>
    public async Task<AgentMetadataResponse> GetAgentMetadataAsync(CancellationToken cancellationToken = default)
    {
        // Return cached metadata if available (matches Azure sample pattern)
        if (_cachedMetadata != null)
        {
            _logger.LogDebug("Returning cached agent metadata");
            return _cachedMetadata;
        }
        
        var agent = await GetAgentAsync(cancellationToken);
        
        // Get the underlying PersistentAgent to access all properties
        // The AIAgent wrapper doesn't expose all properties, so we retrieve the original
        var persistentAgent = await _client.Administration.GetAgentAsync(_agentId, cancellationToken);
        
        _cachedMetadata = new AgentMetadataResponse
        {
            Id = persistentAgent.Value.Id,
            Object = "agent",
            CreatedAt = persistentAgent.Value.CreatedAt.ToUnixTimeSeconds(),
            Name = persistentAgent.Value.Name ?? "AI Assistant",
            Description = persistentAgent.Value.Description,
            Model = persistentAgent.Value.Model,
            Instructions = persistentAgent.Value.Instructions,
            Metadata = persistentAgent.Value.Metadata?.ToDictionary(kvp => kvp.Key, kvp => kvp.Value)
        };
        
        _logger.LogInformation("Cached agent metadata for future requests");
        return _cachedMetadata;
    }

    public async Task<string> CreateThreadAsync(string? firstMessage = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Creating new conversation thread");
            
            // Use persistent client to create thread with metadata
            var metadata = new Dictionary<string, string>();
            
            if (!string.IsNullOrEmpty(firstMessage))
            {
                // Store title in metadata (truncate to 50 chars)
                var title = firstMessage.Length > 50 
                    ? firstMessage[..50] + "..."  // Use range operator instead of Substring
                    : firstMessage;
                metadata["title"] = title;
            }
            
            var thread = await _client.Threads.CreateThreadAsync(
                metadata: metadata.Count > 0 ? metadata : null,
                cancellationToken: cancellationToken);
            
            var threadId = thread.Value.Id;
            
            _logger.LogInformation("Created conversation thread: {ThreadId} with title: {Title}", 
                threadId, metadata.GetValueOrDefault("title", "New Conversation"));
            return threadId;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Thread creation was cancelled");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create conversation thread");
            throw;
        }
    }

    public async IAsyncEnumerable<string> StreamMessageAsync(
        string threadId,
        string message,
        List<string>? imageDataUris = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var agent = await GetAgentAsync(cancellationToken);
        
        _logger.LogInformation("Streaming message to thread: {ThreadId}, ImageCount: {ImageCount}", 
            threadId, imageDataUris?.Count ?? 0);
        
        // Validate input
        if (string.IsNullOrWhiteSpace(message))
        {
            _logger.LogWarning("Attempted to stream empty message to thread {ThreadId}", threadId);
            throw new ArgumentException("Message cannot be null or whitespace", nameof(message));
        }

        // ALWAYS use persistent API to get real token usage
        // The Agent Framework SDK doesn't provide usage info, so we need the persistent client
        if (true) // Always use persistent API now
        {
            string persistentThreadId;
            
            // Get or create persistent thread
            if (!_threadIdMapping.TryGetValue(threadId, out persistentThreadId!))
            {
                _logger.LogInformation("Creating new persistent thread for file attachments");
                var threadResponse = await _client.Threads.CreateThreadAsync(cancellationToken: cancellationToken);
                persistentThreadId = threadResponse.Value.Id;
                _threadIdMapping[threadId] = persistentThreadId;
            }
            
            _logger.LogInformation("Creating message with {ImageCount} image(s) as inline content on thread {PersistentThreadId}", 
                imageDataUris?.Count ?? 0, persistentThreadId);
            
            // Build message content array with text + images
            // Images are sent as base64 data URIs (e.g., data:image/png;base64,iVBORw0KG...)
            // This follows the Semantic Kernel pattern: ImageContent with DataUri property
            var messageContent = new List<MessageInputContentBlock>
            {
                // Add the user's text message first
                new MessageInputTextBlock(message)
            };
            
            // Add each image as an inline data URI block (for vision/analysis)
            // Azure AI Agents SDK accepts data URIs via MessageInputImageUriBlock
            if (imageDataUris != null)
            {
                foreach (var dataUri in imageDataUris)
                {
                    var imageUriParam = new MessageImageUriParam(uri: dataUri);
                    messageContent.Add(new MessageInputImageUriBlock(imageUriParam));
                }
            }

            // Create the message with content blocks using the PersistentAgentsClient
            await _client.Messages.CreateMessageAsync(
                threadId: persistentThreadId,
                role: MessageRole.User,
                contentBlocks: messageContent,
                cancellationToken: cancellationToken);
            
            // Create a streaming run using the persistent client
            var streamingUpdates = _client.Runs.CreateRunStreamingAsync(
                threadId: persistentThreadId,
                agentId: _agentId,
                cancellationToken: cancellationToken);
            
            // Reset usage info for this run
            _lastRunUsage = null;
            
            // Stream the response
            await foreach (var streamingUpdate in streamingUpdates)
            {
                // Handle message content updates
                if (streamingUpdate is MessageContentUpdate contentUpdate)
                {
                    var text = contentUpdate.Text;
                    if (!string.IsNullOrEmpty(text))
                    {
                        yield return text;
                    }
                }
                // Capture usage information when run completes
                else if (streamingUpdate is RunUpdate runUpdate 
                    && runUpdate.UpdateKind == StreamingUpdateReason.RunCompleted
                    && runUpdate.Value?.Usage != null)
                {
                    var usage = runUpdate.Value.Usage;
                    _lastRunUsage = new UsageInfo
                    {
                        PromptTokens = (int)usage.PromptTokens,
                        CompletionTokens = (int)usage.CompletionTokens,
                        TotalTokens = (int)usage.TotalTokens
                    };
                }
            }
            
            _logger.LogInformation("Completed streaming response for thread: {ThreadId}", threadId);
            yield break;
        }
    }

    public Task<UsageInfo?> GetLastRunUsageAsync(CancellationToken cancellationToken = default)
    {
        return Task.FromResult(_lastRunUsage);
    }
}

public class UsageInfo
{
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public int TotalTokens { get; set; }
}
