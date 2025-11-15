---
description: C# and ASP.NET Core coding standards
applyTo: "**/*.cs"
---

# C# Instructions

**Goal**: Write secure, async, maintainable ASP.NET Core code

## Minimal API Pattern

**Use**: Minimal APIs (not Controllers unless 10+ endpoints)

**Always include**: `.RequireAuthorization()` + `CancellationToken`

```csharp
app.MapPost("/api/endpoint", async (
    RequestModel request,
    ServiceClass service,
    CancellationToken ct) =>
{
    var result = await service.DoWorkAsync(request, ct);
    return Results.Ok(result);
})
.RequireAuthorization("RequireChatScope");
```

## Authentication

**Use**: `Microsoft.Identity.Web` with scope-based policies

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(options => {
        builder.Configuration.Bind("AzureAd", options);
        var clientId = builder.Configuration["AzureAd:ClientId"];
        options.TokenValidationParameters.ValidAudiences = 
            new[] { clientId, $"api://{clientId}" };
    }, options => builder.Configuration.Bind("AzureAd", options));

builder.Services.AddAuthorization(options =>
    options.AddPolicy("RequireChatScope", policy =>
        policy.RequireAuthenticatedUser()
              .RequireClaim("scp", "Chat.ReadWrite")));
```

## Async Best Practices

- ✅ Always accept `CancellationToken`
- ✅ Propagate tokens through call chain
- ❌ Never use `.Result` or `.Wait()`

## Dependency Injection

**Lifetimes**:
- `Singleton`: Stateless, thread-safe (AI clients)
- `Scoped`: Per-request (DB contexts)
- `Transient`: Stateful or lightweight

```csharp
builder.Services.AddSingleton<AzureAIAgentService>();
builder.Services.AddScoped<IUserService, UserService>();
```

## Azure SDK

**Use**: Environment-aware credentials

```csharp
var credential = env == "Development" 
    ? new ChainedTokenCredential(new AzureCliCredential(), new AzureDeveloperCliCredential())
    : new ManagedIdentityCredential();
var client = new PersistentAgentsClient(endpoint, credential);
```

## Error Handling

```csharp
try {
    return Results.Ok(await service.DoWorkAsync(request, ct));
} catch (ArgumentException ex) {
    return Results.BadRequest(ex.Message);
} catch (Exception ex) {
    return Results.Problem(ex.Message, statusCode: 500);
}
```

## Configuration

**Use**: `IConfiguration` + environment variables (never commit secrets)

```csharp
builder.Services.Configure<Settings>(
    builder.Configuration.GetSection("MySettings"));
```

## Models

**Use**: Records for immutable DTOs + nullable reference types

```csharp
public record ChatRequest(string ConversationId, string Message);
public record ChatResponse(string Message, string? ConversationId = null);
```

## Common Mistakes

❌ Skipping `.RequireAuthorization()`  
❌ Using `.Result` or `.Wait()`  
❌ Forgetting `CancellationToken`  
❌ Putting `MapFallbackToFile` before API mappings  
❌ Storing secrets in `appsettings.json`
