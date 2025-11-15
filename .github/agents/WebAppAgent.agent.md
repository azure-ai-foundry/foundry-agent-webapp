---
description: Azure AI Foundry Agent Service development mode - SDK research, MCP integration, and agent implementation patterns
tools: ['edit', 'search', 'new', 'runCommands', 'runTasks', 'Microsoft Docs/*', 'github/github-mcp-server/get_file_contents', 'github/github-mcp-server/search_code', 'microsoft/playwright-mcp/*', 'runSubagent', 'usages', 'vscodeAPI', 'problems', 'changes', 'fetch', 'githubRepo', 'extensions', 'todos']
model: Claude Sonnet 4.5 (copilot)
---

# Azure AI Agent Development Mode

**Purpose**: Specialized mode for Azure AI Foundry Agent Service development with ASP.NET Core + React.

**When to use**: AI agent features, authentication, SDK integrations, state management, UI components.

## Documentation Layers

Avoid token waste by understanding what lives where:

1. **copilot-instructions.md** (always loaded) → Architecture, workflows, deployment commands, critical patterns
2. **AGENTS.md files** (loaded on-demand) → Implementation details when touching backend/, frontend/, infra/, deployment/
3. **This file** → SDK research patterns, MCP tool usage, testing workflows

**Your role**: Research SDKs, validate with tests, connect documentation sources. Don't duplicate what's in copilot-instructions.md.

## Azure AI Agent SDK Research Pattern

**CRITICAL**: Don't guess SDK usage. Follow this research workflow:

### 1. Search Official Documentation (Start here)

**Official SDK Repository**: https://github.com/Azure/azure-sdk-for-net/tree/main/sdk/ai/Azure.AI.Agents.Persistent

Use available MCP tools to search Microsoft Learn documentation for Azure AI Agents Persistent SDK features, patterns, and examples.

### 2. Check Semantic Kernel Samples (Complementary patterns)

**Repository**: https://github.com/microsoft/semantic-kernel

**Relevant paths**:
- `dotnet/samples/GettingStartedWithAgents/AzureAIAgent/` - Getting started examples
- `dotnet/samples/Concepts/Agents/` - Advanced patterns (Step##_*.cs files)

Semantic Kernel provides rich examples of Azure AI Agent patterns using its abstraction layer. Use available GitHub MCP tools to search and browse these samples for proven implementation patterns.

**Note**: Semantic Kernel abstracts agent operations through its framework. When adapting patterns, translate SK abstractions to direct Azure.AI.Agents.Persistent SDK types.

### 3. Azure AI Foundry Agent Samples

**Official Samples Repository**: https://github.com/azure-ai-foundry/foundry-samples

**Key paths**:
- `samples/microsoft/csharp/getting-started-agents/` - C# quickstart samples
- `samples/microsoft/python/getting-started-agents/` - Python quickstart samples
- `samples/microsoft/typescript/getting-started-agents/` - TypeScript quickstart samples
- `samples/microsoft/data/` - Sample data files (product info, etc.)

These are the official Azure AI Foundry Agent Service samples showing function calling, file search, code interpreter, and streaming patterns. Use available GitHub MCP tools to explore language-specific implementations.

**Additional UI Sample**: https://github.com/Azure-Samples/get-started-with-ai-agents
- React-based chat UI components and UX patterns
- **Note**: Backend uses Node.js - focus on frontend patterns only

### 4. Broad Code Search (Last resort)

Use available GitHub search tools to find usage examples of specific Azure.AI.Agents.Persistent types across public repositories when official documentation is insufficient.

### Current SDK Version

**Package**: `Azure.AI.Agents.Persistent` v1.2.0-beta.6 (pinned in WebApp.Api.csproj)

**Why pinned**: Beta SDK with evolving API surface. Upgrade deliberately to avoid breaking changes.

**Resources**:
- **NuGet**: https://www.nuget.org/packages/Azure.AI.Agents.Persistent
- **SDK Source**: https://github.com/Azure/azure-sdk-for-net/tree/main/sdk/ai/Azure.AI.Agents.Persistent
- **API Reference**: https://learn.microsoft.com/en-us/dotnet/api/azure.ai.agents.persistent
- **Official Samples**: https://github.com/Azure/azure-sdk-for-net/tree/main/sdk/ai/Azure.AI.Agents.Persistent/samples

**Key sample files**:
- Function calling with streaming
- MCP tool integration  
- File upload and vector search
- Async patterns

### Microsoft Agent Framework (Higher-level abstraction)

**Package**: `Microsoft.Agents.AI.AzureAI` v1.0.0-preview (also in project)

The Microsoft Agent Framework provides a higher-level abstraction over the Azure AI Foundry Agent Service, offering simplified agent creation and orchestration patterns.

**Resources**:
- **NuGet**: https://www.nuget.org/packages/Microsoft.Agents.AI.AzureAI
- **Documentation**: https://learn.microsoft.com/en-us/agent-framework/user-guide/agents/agent-types/azure-ai-foundry-agent
- **GitHub Samples**: https://github.com/microsoft/agent-framework/tree/main/dotnet/samples
- **Quickstart**: https://learn.microsoft.com/en-us/agent-framework/tutorials/quick-start

**When to use**:
- Need unified agent abstraction across multiple AI services
- Want simplified agent lifecycle management
- Building multi-agent orchestration scenarios
- Prefer higher-level `AIAgent` abstractions over direct SDK calls

**Relationship**: Agent Framework wraps `PersistentAgentsClient` and provides `CreateAIAgentAsync()` extension methods for simplified agent creation. Both can coexist in the same project.

See backend/AGENTS.md for full implementation patterns (credentials, streaming, error handling, cancellation tokens).

## Testing with Playwright MCP

**CRITICAL**: Always test changes before completion.

### Testing Priority (Token efficiency)

1. **Console logs** - State transitions, errors (0 tokens)
2. **Network tab** - API calls, status codes (minimal tokens)
3. **Accessibility snapshot** - DOM structure (low tokens)
4. **Screenshots** - Visual verification (high tokens - only when essential)

### Workflow

```powershell
# Start servers
.\deployment\scripts\start-local-dev.ps1

# Then use Playwright MCP:
# 1. Navigate to http://localhost:5173
# 2. Check console (before/after interactions)
# 3. Verify network requests
# 4. Take accessibility snapshot for DOM validation
```

### When to Test (Not optional)

- After UI component or API endpoint changes
- Before committing multi-step implementations
- When user reports issues

### Validation Checklist

- [ ] Console shows expected actions (🔄 [timestamp] ACTION_TYPE)
- [ ] No console errors/warnings
- [ ] Network tab shows correct status codes (200/400/401/500)
- [ ] DOM elements present in accessibility snapshot

## MCP Tool Usage Strategy

### Documentation Research

Use available Microsoft Learn documentation tools to:
1. **Search** Microsoft Learn for Azure AI Agents SDK topics
2. **Fetch** complete documentation pages when search results need more depth
3. Find official samples, API references, and best practices

### GitHub Repository Access

Use available GitHub MCP tools to:
1. **Search code** across repositories for implementation examples
2. **Browse files** in specific paths for sample code
3. Access repositories: Azure SDK, Semantic Kernel, Azure Samples

### Browser Testing

Use available browser automation tools to:
1. Navigate to http://localhost:5173 after starting local dev
2. Check console logs for state transitions and errors
3. Inspect network requests for API validation
4. Capture accessibility snapshots for DOM structure
5. Take screenshots only when visual verification is essential

## Project-Specific Context

**Architecture**: Single-conversation UI (full-width chat, no sidebar/history)
**State**: Redux-style via React Context + useReducer with dev logging

### AI Agent Service Configuration

**Auto-discovery** (`azd up`): Searches subscription for AI Foundry resources → prompts user to select if multiple exist → discovers agents via REST API → validates RBAC permissions → configures everything automatically.

**Change resource**: `azd provision` (re-runs discovery + updates RBAC + regenerates `.env` files) or `azd env set AI_FOUNDRY_RESOURCE_GROUP <rg>` then `azd provision`.

**Implementation**: `deployment/hooks/preprovision.ps1` (discovery), `infra/main.bicep` (RBAC via `core/security/role-assignment.bicep`).
