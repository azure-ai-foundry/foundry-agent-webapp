---
name: researching-azure-ai-sdk
description: >
  Provides research patterns for Azure AI Foundry Agent Service SDK.
  Use when implementing agent features, looking up SDK methods, finding
  code samples, or troubleshooting Azure.AI.Projects API usage.
---

# Researching Azure AI SDK

**CRITICAL**: Don't guess SDK usage. Follow this research workflow.

## Subagent Delegation for Research

**Multi-repo research blows up context** (1000+ tokens per file). Delegate to subagent for:
- Searching across 3+ repositories
- Reading 5+ files for patterns
- Comprehensive API surface exploration
- Finding all usages of a method/type

### Delegation Pattern

```
runSubagent(
  agentName: "WebAppAgent",
  prompt: "RESEARCH task - do NOT write code.
    
    **Question**: [specific SDK question]
    
    **Search these sources in order**:
    1. Azure.AI.Projects SDK: github.com/Azure/azure-sdk-for-net/tree/main/sdk/ai/Azure.AI.Projects
    2. Azure.AI.Agents.Persistent samples: .../Azure.AI.Agents.Persistent/samples
    3. Microsoft Foundry Samples: github.com/microsoft-foundry/foundry-samples
    
    **Find**:
    - Method signatures for [specific API]
    - Usage examples (pseudocode only)
    - Any gotchas or edge cases
    
    **Return** (max 20 lines):
    - Key method name and signature
    - Code pattern (pseudocode)
    - File path where found (for later reference)
    
    Do NOT include full file contents.",
  description: "SDK research: [topic]"
)
```

### When to Delegate vs Inline

| Delegate to Subagent | Keep Inline |
|----------------------|-------------|
| Multi-repo code search | Local codebase grep |
| Finding all usages | Known method lookup |
| API surface exploration | Single file read |
| Pattern comparison | Quick signature check |
| Sample discovery | Using known pattern |

## SDK Architecture Overview

The Azure AI Foundry SDK has **two API surfaces** for agents:

| API | Endpoint | ID Format | SDK Access |
|-----|----------|-----------|------------|
| **v2 Agents API** | `/agents/` | Human-readable (e.g., `dadjokes`) | `AIProjectClient.Agents` |
| **OpenAI Assistants API** | `/assistants/` | OpenAI format (e.g., `asst_xxx`) | `PersistentAgentsClient` |

**This project uses v2 Agents API** for human-readable agent IDs.

```
Azure.AI.Projects (Main Entry Point)
├── AIProjectClient
│   ├── .Agents.GetAgentAsync() → AgentRecord (v2 Agents API)
│   ├── .GetPersistentAgentsClient() → PersistentAgentsClient (Assistants API)
│   └── .OpenAI.GetProjectResponsesClientForAgent() → ProjectResponsesClient (Responses API)
└── Sub-namespaces:
    ├── Azure.AI.Projects.OpenAI (Responses API, conversations)
    └── OpenAI.Responses (streaming types)
```

## 1. Primary SDK Repository (Start Here)

**Azure.AI.Projects SDK**: https://github.com/Azure/azure-sdk-for-net/tree/main/sdk/ai/Azure.AI.Projects

- README: Core client patterns, authentication, basic operations
- Samples: `tests/Samples/` folder with full examples

**Azure.AI.Agents.Persistent SDK**: https://github.com/Azure/azure-sdk-for-net/tree/main/sdk/ai/Azure.AI.Agents.Persistent

- 33+ samples covering streaming, file search, Bing grounding, MCP, Azure Functions
- Key samples:
  - `Sample9_PersistentAgents_Streaming.md` - Basic streaming pattern
  - `Sample8_PersistentAgents_FunctionsWithStreaming.md` - Tool calls with streaming
  - `Sample27_PersistentAgents_MCP_Streaming.md` - MCP server integration

## 2. Official Quickstart Samples

**Microsoft Foundry Samples**: https://github.com/microsoft-foundry/foundry-samples

- `samples/csharp/quickstart/quickstart-chat-with-agent.cs` - **Responses API pattern**
- `samples/csharp/quickstart/` - Multiple quickstart examples

**Key pattern from official quickstart**:
```csharp
AIProjectClient projectClient = new(new Uri(projectEndpoint), new AzureCliCredential());
ProjectConversation conversation = projectClient.OpenAI.Conversations.CreateProjectConversation();
ProjectResponsesClient responsesClient = projectClient.OpenAI.GetProjectResponsesClientForAgent(
    defaultAgent: agentName,
    defaultConversationId: conversation.Id);
ResponseResult response = responsesClient.CreateResponse("Your prompt");
```

## 3. Azure Architecture Center Samples

**Baseline Chat App**: https://github.com/Azure-Samples/microsoft-foundry-baseline

- Full production architecture with Entra ID auth
- `website/chatui/Controllers/ChatController.cs` - SSE streaming pattern

**Basic Chat Example**: https://github.com/Azure-Samples/microsoft-foundry-basic

- Simpler example of Foundry agent chat integration

**Semantic Kernel + Foundry**: https://github.com/Azure-Samples/app-service-agentic-semantic-kernel-ai-foundry-agent

- Integration pattern for Semantic Kernel with Azure AI Foundry Agents

## 4. UI Reference Samples (React Patterns)

### Primary UI Reference

**Azure AI Agents React Sample**: https://github.com/Azure-Samples/get-started-with-ai-agents

This is the **primary UI reference** for this project. Many UI patterns were borrowed from here:
- Chat interface components
- Message rendering with citations/annotations
- Streaming text display
- Responsive layout patterns

### Agent Framework DevUI (Python)

**Agent Framework DevUI**: https://github.com/microsoft/agent-framework/tree/main/python/packages/devui

Alternative UI patterns for agent development:
- Development-focused chat interface
- Multi-agent visualization
- Tool call debugging UI

### UI Component Inspiration

When implementing new UI features, check these sources in order:
1. `get-started-with-ai-agents` - React + TypeScript patterns for chat UI
2. `agent-framework/devui` - Development UI patterns
3. Fluent UI Copilot Components - Base component library (already used)

## 5. Semantic Kernel Integration

**Repository**: https://github.com/microsoft/semantic-kernel

**Relevant paths**:
- `dotnet/src/Agents/OpenAI/` - OpenAI Responses API integration
- `dotnet/samples/GettingStartedWithAgents/AzureAIAgent/`
- `dotnet/samples/Concepts/Agents/` (Step##_*.cs files)

## 6. OpenAI .NET SDK (Streaming Types)

**Repository**: https://github.com/openai/openai-dotnet

- `docs/guides/streaming-responses/` - Streaming patterns
- Source of `StreamingResponseOutputTextDeltaUpdate` and related types

## 7. GitHub Code Search (For Specific Patterns)

Use GitHub search to find usage examples:

```
# Find streaming patterns
"StreamingResponseOutputTextDeltaUpdate language:csharp"

# Find Responses API usage
"ProjectResponsesClient CreateResponseStreamingAsync language:csharp"

# Find conversation patterns
"ProjectConversation GetProjectResponsesClientForAgent language:csharp"
```

## Current SDK Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `Azure.AI.Projects` | 1.2.0-beta.5 | Main entry point, `AIProjectClient`, v2 Agents API, Responses API |
| `Azure.Identity` | 1.17.1 | Authentication (`AzureDeveloperCliCredential`, `ManagedIdentityCredential`) |
| `Microsoft.Identity.Web` | 4.3.0 | JWT Bearer authentication for API |

**Note**: This project uses `Azure.AI.Projects` beta for v2 Agents API access (`AIProjectClient.Agents`). The stable version does not include the v2 Agents API.

**Sub-namespaces available** (not separate packages):
- `Azure.AI.Projects.OpenAI` - Responses API, conversations
- `OpenAI.Responses` - Streaming types

**Removed Package**: `Microsoft.Agents.AI.AzureAI` was evaluated but removed because it only supports OpenAI Assistants API, not v2 Agents API.

**Key Resources**:
- NuGet (Azure.AI.Projects): https://www.nuget.org/packages/Azure.AI.Projects
- SDK Source: https://github.com/Azure/azure-sdk-for-net/tree/main/sdk/ai/Azure.AI.Projects
- v2 Migration Guide: https://learn.microsoft.com/en-us/azure/ai-foundry/agents/how-to/migrate
- API Reference: https://learn.microsoft.com/en-us/dotnet/api/azure.ai.projects
- Product Docs: https://learn.microsoft.com/azure/ai-studio/

## Annotation Types in Responses

The SDK provides several annotation types for citations (from `OpenAI.Responses` namespace):

| Type | Class | Use Case | Key Properties |
|------|-------|----------|----------------|
| URI Citation | `UriCitationMessageAnnotation` | Bing, Azure AI Search, SharePoint | `Uri`, `Title`, `StartIndex`, `EndIndex` |
| File Citation | `FileCitationMessageAnnotation` | File search (vector stores) | `FileId`, `Filename`, `Index` |
| File Path | `FilePathMessageAnnotation` | Code interpreter output | `FileId`, `Index` |
| Container Citation | `ContainerFileCitationMessageAnnotation` | Container file citations | `FileId`, `Filename`, `StartIndex`, `EndIndex` |

**Note**: `FileCitationMessageAnnotation` uses `Index` (not `StartIndex`/`EndIndex`) per the SDK. See `ExtractAnnotations()` in `AgentFrameworkService.cs` for mapping to `AnnotationInfo`.

## Streaming Response Types (from OpenAI.Responses namespace)

| Type | Purpose |
|------|---------|
| `StreamingResponseOutputTextDeltaUpdate` | Text content delta chunks |
| `StreamingResponseOutputItemDoneUpdate` | Item completion signals |
| `StreamingResponseCompletedUpdate` | Response completion with usage |
| `ResponseItem` | Base type for response items |

**Pattern used in this project**:
```csharp
await foreach (var update in responsesClient.CreateResponseStreamingAsync(...))
{
    if (update is StreamingResponseOutputTextDeltaUpdate textUpdate)
        yield return new StreamChunk { Text = textUpdate.Delta };
    if (update is StreamingResponseOutputItemDoneUpdate itemDone)
        // Extract annotations from itemDone.Item
}
```

## Microsoft Agent Framework (Not Used)

**Package**: `Microsoft.Agents.AI.AzureAI` v1.0.0-preview

**Status**: This project previously evaluated the Agent Framework but does not use it because `PersistentAgentsClient.GetAIAgentAsync()` only works with OpenAI Assistants API, not the v2 Agents API that Azure AI Foundry uses for human-readable agent IDs.

**When to reconsider**:
- When Microsoft adds native support for v2 Agents API in `PersistentAgentsClient`
- Or a new `ProjectAgentsClient` that wraps `AIProjectClient.Agents`

**Resources**:
- Documentation: https://learn.microsoft.com/en-us/agent-framework/user-guide/agents/agent-types/azure-ai-foundry-agent
- Samples: https://github.com/microsoft/agent-framework/tree/main/dotnet/samples

## Migration Notes

The SDK has evolved from connection string-based auth to project endpoint:

**Old pattern (deprecated)**:
```csharp
// DON'T USE - connection string deprecated in v1.0.0-beta.9+
var projectClient = new AIProjectClient(connectionString, new DefaultAzureCredential());
```

**New pattern (current)**:
```csharp
// USE THIS - project endpoint
var projectClient = new AIProjectClient(new Uri(projectEndpoint), new DefaultAzureCredential());
```

See: https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/ai/Azure.AI.Projects/AGENTS_MIGRATION_GUIDE.md

## Additional SDK Resources

### Fetch SDK Source from GitHub (Authoritative)

Type definitions live in these repos—read them directly:

- **Azure.AI.Projects source**: https://github.com/Azure/azure-sdk-for-net/tree/main/sdk/ai/Azure.AI.Projects/src
- **Azure.AI.Agents.Persistent samples**: https://github.com/Azure/azure-sdk-for-net/tree/main/sdk/ai/Azure.AI.Agents.Persistent/samples
- **OpenAI.Responses types**: https://github.com/openai/openai-dotnet/tree/main/src



### GitHub Code Search

Search across all .NET codebases for real-world usage:

```
"ProjectResponsesClient CreateResponseStreamingAsync" language:csharp
"StreamingResponseOutputTextDeltaUpdate" language:csharp
```

This finds how other projects use these APIs, revealing patterns and edge cases.

### PowerShell Reflection (Last Resort)

Only use when all above methods fail and you need to verify exact signatures on a pre-release SDK:

```powershell
cd backend/WebApp.Api; dotnet build
$asm = [Reflection.Assembly]::LoadFrom((Resolve-Path "bin/Debug/net9.0/Azure.AI.Projects.dll"))

# Find types matching a pattern
$asm.GetExportedTypes() | Where-Object { $_.Name -like "*Streaming*" } | ForEach-Object { $_.FullName }

# Get method signatures
$asm.GetType("Azure.AI.Projects.OpenAI.ProjectResponsesClient").GetMethods() | Select-Object Name, ReturnType
```

**Limitations**:
- Requires successful build first
- Returns raw metadata without intent or usage guidance
- No relationships or recommended patterns visible
- Use as verification, not exploration
