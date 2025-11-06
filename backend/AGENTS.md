# Backend - ASP.NET Core API

**Context**: See `.github/copilot-instructions.md` for architecture

## Middleware Pipeline

**Goal**: Serve static files → validate auth → route APIs → SPA fallback

```csharp
app.UseDefaultFiles();     // index.html for /
app.UseStaticFiles();      // wwwroot/* assets  
app.UseCors();             // Dev only
app.UseAuthentication();   // Validate JWT
app.UseAuthorization();    // Enforce scope
// Map endpoints here
app.MapFallbackToFile("index.html");  // MUST BE LAST
```

## Endpoint Pattern

```csharp
app.MapPost("/api/chat/stream", async (
    ChatRequest request,
    AzureAIAgentService agentService,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    httpContext.Response.Headers.Append("Content-Type", "text/event-stream");
    httpContext.Response.Headers.Append("Cache-Control", "no-cache");
    
    var threadId = request.ThreadId ?? await agentService.CreateThreadAsync(request.Message, cancellationToken);
    
    await httpContext.Response.WriteAsync($"data: {{\"type\":\"threadId\",\"threadId\":\"{threadId}\"}}\n\n", cancellationToken);
    await httpContext.Response.Body.FlushAsync(cancellationToken);
    
    await foreach (var chunk in agentService.StreamMessageAsync(threadId, request.Message, request.ImageDataUris, cancellationToken))
    {
        var json = System.Text.Json.JsonSerializer.Serialize(new { type = "chunk", content = chunk });
        await httpContext.Response.WriteAsync($"data: {json}\n\n", cancellationToken);
        await httpContext.Response.Body.FlushAsync(cancellationToken);
    }
    
    await httpContext.Response.WriteAsync("data: {\"type\":\"done\"}\n\n", cancellationToken);
})
.RequireAuthorization("RequireChatScope")
.WithName("StreamChatMessage");
```

## AzureAIAgentService Implementation

From `Services/AzureAIAgentService.cs`:

```csharp
public class AzureAIAgentService
{
    private readonly PersistentAgentsClient _client;
    private readonly string _agentId;

    public AzureAIAgentService(IConfiguration configuration, ILogger<AzureAIAgentService> logger)
    {
        var endpoint = configuration["AI_FOUNDRY_AGENT_ENDPOINT"] 
            ?? throw new InvalidOperationException("AI_FOUNDRY_AGENT_ENDPOINT not configured");
        
        _agentId = configuration["AI_FOUNDRY_AGENT_ID"]
            ?? throw new InvalidOperationException("AI_FOUNDRY_AGENT_ID not configured");
        
        // Environment-aware credential selection (see .github/instructions/csharp.instructions.md)
        var environment = configuration["ASPNETCORE_ENVIRONMENT"] ?? "Production";
        
        TokenCredential credential = environment == "Development"
            ? new ChainedTokenCredential(new AzureCliCredential(), new AzureDeveloperCliCredential())
            : new ManagedIdentityCredential();  // Production: system-assigned managed identity
        
        _client = new PersistentAgentsClient(endpoint, credential);
    }
    
    public async IAsyncEnumerable<string> StreamMessageAsync(
        string threadId,
        string message,
        List<string>? imageDataUris = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        // Build message content with text + images
        var messageContent = new List<MessageInputContentBlock> { new MessageInputTextBlock(message) };
        
        if (imageDataUris != null)
        {
            foreach (var dataUri in imageDataUris)
            {
                messageContent.Add(new MessageInputImageUriBlock(new MessageImageUriParam(uri: dataUri)));
            }
        }
        
        await _client.Messages.CreateMessageAsync(threadId, MessageRole.User, messageContent, cancellationToken);
        
        var streamingUpdates = _client.Runs.CreateRunStreamingAsync(threadId, _agentId, cancellationToken);
        
        await foreach (var update in streamingUpdates)
        {
            if (update is MessageContentUpdate contentUpdate && !string.IsNullOrEmpty(contentUpdate.Text))
            {
                yield return contentUpdate.Text;
            }
        }
    }
}
```

## JWT Validation

**Pattern**: See `.github/instructions/csharp.instructions.md` for complete authentication setup.

**Key detail**: Accept both `clientId` and `api://{clientId}` as valid audiences for dual-format token support.

## Configuration (.env file)

**Auto-loaded** before building configuration:

```csharp
var envFile = Path.Combine(Directory.GetCurrentDirectory(), ".env");
if (File.Exists(envFile))
{
    foreach (var line in File.ReadAllLines(envFile)
        .Where(l => !string.IsNullOrWhiteSpace(l) && !l.StartsWith("#")))
    {
        var parts = line.Split('=', 2);
        if (parts.Length == 2)
            Environment.SetEnvironmentVariable(parts[0].Trim(), parts[1].Trim());
    }
}
```

## Models

```csharp
public record ChatRequest(string? ThreadId, string Message, List<string>? ImageDataUris = null);
public record ChatResponse(string Message, string? ThreadId = null);
```
