---
name: writing-csharp-code
description: >
  Provides C# and ASP.NET Core coding standards for this repository.
  Use when writing or modifying C# code, implementing API endpoints,
  configuring middleware, or working with authentication in the backend.
---

# C# Coding Standards

**Goal**: Write clean, secure ASP.NET Core code with proper authentication

## Hot Reload Development Workflow

**The backend runs in watch mode** (`dotnet watch run`). When you edit C# code:

1. **Save the file** - .NET automatically recompiles
2. **Check the terminal** - Look for compilation output in the "Backend: ASP.NET Core API" terminal
3. **Verify via console logs** - New requests will use updated code immediately

**VS Code Tasks** (use `Run Task` command or check terminal panel):
- `Backend: ASP.NET Core API` - Runs `dotnet watch run` with live recompilation
- Logs are visible directly in VS Code terminal

**No restart needed** - Just edit, save, and test. Watch for compilation errors in the terminal.

**Testing changes**: Use Playwright browser tools to make requests and check browser console logs, or call endpoints directly.

## Minimal API Patterns

Use typed request models, CancellationToken, and IHostEnvironment:

```csharp
app.MapPost("/api/endpoint", async (
    RequestModel request,
    MyService service,
    IHostEnvironment env,
    CancellationToken cancellationToken) =>
{
    try
    {
        var result = await service.ProcessAsync(request, cancellationToken);
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        return ErrorResponseFactory.CreateFromException(ex, env);
    }
})
.RequireAuthorization("RequireChatScope")
.WithName("EndpointName");
```

## Authentication Setup

**JWT Bearer with Entra ID**:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(options =>
    {
        builder.Configuration.Bind("AzureAd", options);
        options.TokenValidationParameters.ValidAudiences = new[]
        {
            builder.Configuration["AzureAd:ClientId"],
            $"api://{builder.Configuration["AzureAd:ClientId"]}"
        };
    }, options => builder.Configuration.Bind("AzureAd", options));
```

## Async Best Practices

```csharp
// ✅ Use async/await with CancellationToken
public async Task<Result> ProcessAsync(Request req, CancellationToken ct)
{
    return await _service.ExecuteAsync(req, ct);
}

// ❌ Never block on async
var result = _service.ExecuteAsync(req).Result;  // WRONG
```

## IAsyncEnumerable for Streaming

```csharp
public async IAsyncEnumerable<string> StreamAsync(
    string input,
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    await foreach (var chunk in source.WithCancellation(cancellationToken))
    {
        yield return chunk;
    }
}
```

## Credential Strategy

```csharp
TokenCredential credential = env.IsDevelopment()
    ? new ChainedTokenCredential(
        new AzureCliCredential(),
        new AzureDeveloperCliCredential())  // Supports 'azd auth login'
    : new ManagedIdentityCredential();      // System-assigned in production
```

**Why ChainedTokenCredential**: Avoids `DefaultAzureCredential`'s "fail fast" mode issues. Explicit, predictable credential chain.

## IDisposable Pattern

```csharp
public class MyService : IDisposable
{
    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly CancellationTokenSource _disposeCts = new();
    private bool _disposed;

    public void DoWork()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        // ...
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        
        // Cancel pending operations first
        try { _disposeCts.Cancel(); }
        catch (ObjectDisposedException) { }
        
        _disposeCts.Dispose();
        _lock.Dispose();
    }
}
```

## Error Responses (RFC 7807)

Use `ErrorResponseFactory.CreateFromException()` for consistent error responses.

See: `backend/WebApp.Api/Models/ErrorResponse.cs`

## Common Mistakes

- ❌ Using `.Result` or `.Wait()` on async methods
- ❌ Forgetting `CancellationToken` parameter
- ❌ Missing `.RequireAuthorization()` on endpoints
- ❌ Exposing internal errors in production
- ❌ Forgetting disposal guards in `IDisposable`

---

## Project-Specific: Middleware Pipeline

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

## Project-Specific: AgentFrameworkService

**See**: `backend/WebApp.Api/Services/AgentFrameworkService.cs`

**SDK Package**: `Azure.AI.Projects` v1.2.0-beta.5 (main entry point)
**Sub-namespaces**: `Azure.AI.Projects.OpenAI`, `OpenAI.Responses`

**Key patterns**:
- `IDisposable` implementation with `_agentLock.Dispose()`
- Disposal guards (`ObjectDisposedException.ThrowIf`) in all public methods
- Environment-aware credential selection (ChainedTokenCredential vs ManagedIdentityCredential)
- Cached agent instance with `SemaphoreSlim` for thread safety
- Configuration validation (`AI_AGENT_ENDPOINT`, `AI_AGENT_ID`)

**v2 Agents API** (uses `/agents/` endpoint with human-readable IDs):
```csharp
// Get agent metadata via v2 Agents API
AgentRecord agentRecord = await projectClient.Agents.GetAgentAsync(agentId);
AgentVersion version = agentRecord.Versions.Latest;

// Use AgentReference for streaming (not the agent object directly)
ProjectResponsesClient responsesClient = projectClient.OpenAI.GetProjectResponsesClientForAgent(
    new AgentReference(agentId), conversationId);
```

**Streaming Pattern**: Returns `IAsyncEnumerable<StreamChunk>` where `StreamChunk` contains either:
- Text delta (`chunk.IsText`, `chunk.TextDelta`)
- Annotations/citations (`chunk.HasAnnotations`, `chunk.Annotations`)

**Streaming Response Types** (from `OpenAI.Responses`):
- `StreamingResponseOutputTextDeltaUpdate` - Text content delta
- `StreamingResponseOutputItemDoneUpdate` - Item completion (has annotations)
- `StreamingResponseCompletedUpdate` - Response completion with usage stats

**Image Validation** (in `BuildUserMessage()`):
- Maximum 5 images per request
- Maximum 5MB per image (decoded size)
- Allowed: `image/png`, `image/jpeg`, `image/gif`, `image/webp`
- Returns HTTP 400 with validation details if constraints violated

**Annotation Types** (from `OpenAI.Responses`): 
- `UriCitationMessageAnnotation` - Bing, Azure AI Search, SharePoint
- `FileCitationMessageAnnotation` - File search (vector stores)
- `FilePathMessageAnnotation` - Code interpreter output
- `ContainerFileCitationMessageAnnotation` - Container file citations

**Starter Prompts**: Parsed from agent metadata (`starterPrompts` key, newline-separated).

## Project-Specific: Configuration Loading

Auto-load `.env` file before building configuration:

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

## Troubleshooting SDK Issues

**When things break**: SDK type mismatches and missing methods almost always happen after a package upgrade. Check `backend/WebApp.Api/WebApp.Api.csproj` for current versions:

- `Azure.AI.Projects` - currently `1.2.0-beta.5`
- `Azure.Identity` - currently `1.17.1`

If types don't match documentation or samples, verify you're looking at docs for the **same version** installed in the project.

### GitHub SDK Source (For Deep Dives)

When you need to understand SDK internals, fetch the actual source:

- **Azure.AI.Projects**: https://github.com/Azure/azure-sdk-for-net/tree/main/sdk/ai/Azure.AI.Projects/src
- **SDK samples**: https://github.com/Azure/azure-sdk-for-net/tree/main/sdk/ai/Azure.AI.Agents.Persistent/samples
- **OpenAI.Responses**: https://github.com/openai/openai-dotnet/tree/main/src

### Quick Structure Checks (CLI)

For project-level overviews only—use sparingly:

```powershell
# List public types in backend (overview, not deep exploration)
Get-ChildItem -Path backend -Recurse -Include *.cs | 
    Select-String -Pattern "^\s*(public|internal)\s+(class|record|interface)\s+(\w+)" |
    ForEach-Object { $_.Matches.Groups[3].Value } | Sort-Object -Unique

# Find IDisposable implementations
Get-ChildItem -Path backend -Recurse -Include *.cs |
    Select-String -Pattern ":\s*.*IDisposable"
```

**Use for**: Quick inventory of what exists. Follow up with pattern search or IDE navigation for understanding.

### Reflection (Last Resort Only)

Only use when nothing else works and you must verify exact method signatures on a beta SDK:

```powershell
cd backend/WebApp.Api; dotnet build
$asm = [Reflection.Assembly]::LoadFrom((Resolve-Path "bin/Debug/net9.0/Azure.AI.Projects.dll"))
$asm.GetType("Azure.AI.Projects.OpenAI.ProjectResponsesClient").GetMethods() | 
    Where-Object { $_.Name -like "*Streaming*" } | Select-Object Name, ReturnType
```

**When to use**: Beta SDK docs are wrong/missing, IDE can't resolve the type, and GitHub source is unclear.

**Limitation**: Returns raw API surface without intent, relationships, or usage guidance. Prefer contextual methods above.

## Related Skills

- **implementing-chat-streaming** - SSE streaming patterns and backend endpoint implementation
- **troubleshooting-authentication** - MSAL/JWT debugging for 401 errors
- **researching-azure-ai-sdk** - SDK research workflow and sample repositories
