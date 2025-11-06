using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Identity.Web;
using WebApp.Api.Models;
using WebApp.Api.Services;
using System.Security.Claims;

// Load .env file for local development BEFORE building the configuration
// In production (Docker), Container Apps injects environment variables directly
var envFilePath = Path.Combine(Directory.GetCurrentDirectory(), ".env");
if (File.Exists(envFilePath))
{
    foreach (var line in File.ReadAllLines(envFilePath))
    {
        if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#"))
            continue;

        var parts = line.Split('=', 2, StringSplitOptions.TrimEntries);
        if (parts.Length == 2)
        {
            // Set as environment variables so they're picked up by configuration system
            Environment.SetEnvironmentVariable(parts[0], parts[1]);
        }
    }
}

var builder = WebApplication.CreateBuilder(args);

// Enable PII logging for debugging auth issues (ONLY IN DEVELOPMENT)
if (builder.Environment.IsDevelopment())
{
    Microsoft.IdentityModel.Logging.IdentityModelEventSource.ShowPII = true;
}

// Add ServiceDefaults (telemetry, health checks)
builder.AddServiceDefaults();

// Add ProblemDetails service for standardized RFC 7807 error responses
builder.Services.AddProblemDetails();

// Configure CORS for local development and production
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:8080" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        // In development, allow any localhost port for flexibility
        if (builder.Environment.IsDevelopment())
        {
            policy.SetIsOriginAllowed(origin => 
            {
                if (Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                {
                    return uri.Host == "localhost" || uri.Host == "127.0.0.1";
                }
                return false;
            })
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
        }
        else
        {
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        }
    });
});

// Override ClientId and TenantId from environment variables if provided
// These will be set by azd during deployment or by AppHost in local dev
var clientId = builder.Configuration["ENTRA_SPA_CLIENT_ID"]
    ?? builder.Configuration["AzureAd:ClientId"];

if (!string.IsNullOrEmpty(clientId))
{
    builder.Configuration["AzureAd:ClientId"] = clientId;
    // Set audience to match the expected token audience claim
    builder.Configuration["AzureAd:Audience"] = $"api://{clientId}";
}

var tenantId = builder.Configuration["ENTRA_TENANT_ID"]
    ?? builder.Configuration["AzureAd:TenantId"];

if (!string.IsNullOrEmpty(tenantId))
{
    builder.Configuration["AzureAd:TenantId"] = tenantId;
}

const string RequiredScope = "Chat.ReadWrite";
const string ScopePolicyName = "RequireChatScope";

// Add Microsoft Identity Web authentication
// Validates JWT bearer tokens issued for the SPA's delegated scope
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(options =>
    {
        builder.Configuration.Bind("AzureAd", options);
        var configuredClientId = builder.Configuration["AzureAd:ClientId"];

        options.TokenValidationParameters.ValidAudiences = new[]
        {
            configuredClientId,
            $"api://{configuredClientId}"
        };

        options.TokenValidationParameters.NameClaimType = ClaimTypes.Name;
        options.TokenValidationParameters.RoleClaimType = ClaimTypes.Role;
    }, options => builder.Configuration.Bind("AzureAd", options));

builder.Services.AddAuthorization(options =>
{
    // Use Microsoft.Identity.Web's built-in scope validation
    options.AddPolicy(ScopePolicyName, policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireScope(RequiredScope);
    });
});

// Register Azure AI Agent Service as scoped
// Scoped is preferred for services making external API calls to ensure proper disposal
// and avoid potential issues with long-lived connections
builder.Services.AddScoped<WebApp.Api.Services.AzureAIAgentService>();

var app = builder.Build();

// Add exception handling middleware for production
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler();
}

// Add status code pages for consistent error responses
app.UseStatusCodePages();

// Map health checks
app.MapDefaultEndpoints();

// Serve static files from wwwroot (frontend)
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseCors("AllowFrontend");

// Note: HTTPS redirection not needed - Azure Container Apps handles SSL termination at ingress
// The container receives HTTP traffic on port 8080

// Add authentication and authorization middleware
app.UseAuthentication();
app.UseAuthorization();

// Authenticated health endpoint exposes caller identity
app.MapGet("/api/health", (HttpContext context) =>
{
    var userId = context.User.FindFirst("oid")?.Value ?? "unknown";
    var userName = context.User.FindFirst("name")?.Value ?? "unknown";

    return Results.Ok(new
    {
        status = "healthy",
        timestamp = DateTime.UtcNow,
        authenticated = true,
        user = new { id = userId, name = userName }
    });
})
.RequireAuthorization(ScopePolicyName)
.WithName("GetHealth");

// Streaming Chat endpoint: Send message and stream response using SSE
app.MapPost("/api/chat/stream", async (
    ChatRequest request,
    AzureAIAgentService agentService,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    try
    {
        // Set headers for Server-Sent Events
        httpContext.Response.Headers.Append("Content-Type", "text/event-stream");
        httpContext.Response.Headers.Append("Cache-Control", "no-cache");
        httpContext.Response.Headers.Append("Connection", "keep-alive");

        // Create new thread if not provided (with first message as title)
        var threadId = request.ThreadId
            ?? await agentService.CreateThreadAsync(request.Message, cancellationToken);

        // Send thread ID first
        await httpContext.Response.WriteAsync(
            $"data: {{\"type\":\"threadId\",\"threadId\":\"{threadId}\"}}\n\n",
            cancellationToken);
        await httpContext.Response.Body.FlushAsync(cancellationToken);

        // Track start time for duration calculation
        var startTime = DateTime.UtcNow;

        // Stream the response using Agent Framework SDK with optional image data URIs
        await foreach (var chunk in agentService.StreamMessageAsync(
            threadId,
            request.Message,
            request.ImageDataUris,
            cancellationToken))
        {
            var json = System.Text.Json.JsonSerializer.Serialize(new
            {
                type = "chunk",
                content = chunk
            });
            
            await httpContext.Response.WriteAsync(
                $"data: {json}\n\n",
                cancellationToken);
            await httpContext.Response.Body.FlushAsync(cancellationToken);
        }

        // Calculate duration
        var endTime = DateTime.UtcNow;
        var duration = (endTime - startTime).TotalMilliseconds;

        // Get usage info from agent service
        var usage = await agentService.GetLastRunUsageAsync(cancellationToken);

        // Send usage event if available
        if (usage != null)
        {
            var usageJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                type = "usage",
                duration = duration,
                promptTokens = usage.PromptTokens,
                completionTokens = usage.CompletionTokens,
                totalTokens = usage.TotalTokens
            });
            
            await httpContext.Response.WriteAsync(
                $"data: {usageJson}\n\n",
                cancellationToken);
            await httpContext.Response.Body.FlushAsync(cancellationToken);
        }

        // Send completion event
        await httpContext.Response.WriteAsync(
            "data: {\"type\":\"done\"}\n\n",
            cancellationToken);
        await httpContext.Response.Body.FlushAsync(cancellationToken);
    }
    catch (Exception ex)
    {
        var errorJson = System.Text.Json.JsonSerializer.Serialize(new
        {
            type = "error",
            message = ex.Message
        });
        await httpContext.Response.WriteAsync(
            $"data: {errorJson}\n\n",
            cancellationToken);
    }
})
.RequireAuthorization(ScopePolicyName)
.WithName("StreamChatMessage");

// Get agent metadata (name, description, model, metadata)
// Used by frontend to display agent information in the UI
app.MapGet("/api/agent", async (
    AzureAIAgentService agentService,
    CancellationToken cancellationToken) =>
{
    try
    {
        var metadata = await agentService.GetAgentMetadataAsync(cancellationToken);
        return Results.Ok(metadata);
    }
    catch (Exception ex)
    {
        return Results.Problem(
            title: "Failed to retrieve agent metadata",
            detail: ex.Message,
            statusCode: 500
        );
    }
})
.RequireAuthorization(ScopePolicyName)
.WithName("GetAgentMetadata");

// Get agent info (for debugging)
app.MapGet("/api/agent/info", async (
    AzureAIAgentService agentService,
    CancellationToken cancellationToken) =>
{
    try
    {
        var agentInfo = await agentService.GetAgentInfoAsync(cancellationToken);
        return Results.Ok(new
        {
            info = agentInfo,
            status = "ready"
        });
    }
    catch (Exception ex)
    {
        return Results.Problem(
            detail: ex.Message,
            statusCode: 500,
            title: "AI Agent Error");
    }
})
.RequireAuthorization(ScopePolicyName)
.WithName("GetAgentInfo");

// Fallback route for SPA - serve index.html for any non-API routes
app.MapFallbackToFile("index.html");

app.Run();
