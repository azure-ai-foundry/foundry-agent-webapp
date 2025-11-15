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
    
    var conversationId = request.ConversationId ?? await agentService.CreateConversationAsync(request.Message, cancellationToken);
    
    await httpContext.Response.WriteAsync($"data: {{\"type\":\"conversationId\",\"conversationId\":\"{conversationId}\"}}\n\n", cancellationToken);
    await httpContext.Response.Body.FlushAsync(cancellationToken);
    
    await foreach (var chunk in agentService.StreamMessageAsync(conversationId, request.Message, request.ImageDataUris, cancellationToken))
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

## Error Handling

**Pattern**: Use `ErrorResponseFactory` for consistent error responses following RFC 7807 Problem Details.

**See**: 
- `backend/WebApp.Api/Models/ErrorResponse.cs` for `ErrorResponseFactory` implementation
- `backend/WebApp.Api/Program.cs` endpoints (`/api/chat/stream`, `/api/agent`, `/api/agent/info`) for usage patterns

**Key points**:
- Development: Returns full exception details + stack trace in extensions
- Production: Returns user-friendly messages, hides internal details
- Maps status codes to actionable error messages

## AzureAIAgentService Implementation

**See**: `backend/WebApp.Api/Services/AzureAIAgentService.cs`

**Key patterns**:
- `IDisposable` implementation with `_agentLock.Dispose()`
- Disposal guards (`ObjectDisposedException.ThrowIf`) in all public methods
- Environment-aware credential selection (dev: `ChainedTokenCredential`, prod: `ManagedIdentityCredential`)
- Cached agent instance with `SemaphoreSlim` for thread safety
- Configuration validation (`AI_AGENT_ENDPOINT`, `AI_AGENT_ID`)
    
**Streaming pattern**: See `StreamMessageAsync` method for:
- Disposal guard before processing
- Multi-modal message support (text + image data URIs)
- `IAsyncEnumerable<string>` with `[EnumeratorCancellation]`
- `MessageContentUpdate` filtering for text content

**Image Validation**: Server-side validation enforces security constraints on base64 image data URIs:
- Maximum 5 images per request
- Maximum 5MB per image (decoded size)
- Allowed MIME types: `image/png`, `image/jpeg`, `image/jpg`, `image/gif`, `image/webp`
- Base64 integrity checking before processing
- Aggregated error reporting with structured logging via `ILogger`
- Returns HTTP 400 with validation details if constraints violated

**See**: `ValidateImageDataUris()` method in `AzureAIAgentService.cs` for implementation details.
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

**See**: `backend/WebApp.Api/Models/` for request/response models:
- `ChatRequest.cs` - Conversation ID, message, image data URIs
- `ChatResponse.cs` - Response message, conversation ID
- `ErrorResponse.cs` - RFC 7807 Problem Details
- `ConversationModels.cs` - Conversation creation/deletion models
- `AgentMetadata.cs` - Agent info for UI display

