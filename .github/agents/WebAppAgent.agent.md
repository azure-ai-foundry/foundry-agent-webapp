---
description: Azure AI Foundry Agent Service development mode - SDK research, MCP integration, and agent implementation patterns
tools: ['execute/getTerminalOutput', 'execute/runTask', 'execute/createAndRunTask', 'execute/runInTerminal', 'execute/testFailure', 'execute/runTests', 'read/terminalSelection', 'read/terminalLastCommand', 'read/getTaskOutput', 'read/problems', 'read/readFile', 'edit', 'search', 'web', 'agent', 'microsoftdocs/mcp/*', 'playwright/*', 'todo']
model: Claude Opus 4.5 (copilot)
name: Web App Agent
---

# Azure AI Agent Development Mode

**Purpose**: Specialized mode for Azure AI Foundry Agent Service development with ASP.NET Core + React.

**When to use**: AI agent features, authentication, SDK integrations, state management, UI components.

## Documentation Layers

1. **copilot-instructions.md** (always loaded) → Purpose, skill index, delegation hints
2. **Skills** (loaded on-demand) → Domain-specific patterns, SDK details, deployment config
3. **This file** → Agent mode configuration, MCP tool strategy

**Your role**: Research SDKs, validate with tests, connect documentation sources.

## Available Skills

Skills provide detailed guidance and delegation patterns on-demand:

| Skill | Includes Subagent Pattern |
|-------|---------------------------|
| deploying-to-azure | ✅ Log analysis delegation |
| researching-azure-ai-sdk | ✅ Multi-repo research delegation |
| testing-with-playwright | ✅ Screenshot/accessibility delegation |
| writing-csharp-code | - |
| writing-typescript-code | - |
| writing-bicep-templates | - |
| implementing-chat-streaming | - |
| troubleshooting-authentication | - |

## Subagent Delegation Strategy

**Core Principle**: Delegate context-heavy operations to subagents to preserve parent context window.

### When to Delegate to Subagent

| Delegate | Keep Inline |
|----------|-------------|
| Multi-file research (5+ files) | Single file reads |
| Screenshot capture/analysis | Console log checks |
| Multi-repo code search | Local grep/search |
| Full deployment log analysis | Quick status checks |
| Complex SDK pattern research | Known API calls |
| Accessibility snapshot analysis | Simple DOM queries |

### Context Budget Guidelines

| Operation | Token Cost | Strategy |
|-----------|------------|----------|
| Screenshot | 2000-5000 | Always delegate |
| Accessibility snapshot | 500-2000 | Delegate if > 1 page |
| Full file read (large) | 1000+ | Delegate research |
| Multi-repo search | 2000+ | Always delegate |
| Console logs | 100-300 | Keep inline |
| Network summary | 50-100 | Keep inline |

### Subagent Result Handling

Subagent returns a single message. Parse and use:
1. **Quote key findings** in your response to user
2. **Use file paths/line numbers** returned for targeted edits
3. **Apply suggested patterns** directly without re-reading sources

**Delegation patterns**: See skill docs for specific prompt templates (testing-with-playwright, researching-azure-ai-sdk, deploying-to-azure).

## MCP Tool Usage Strategy

### Documentation Research

Use Microsoft Learn documentation tools to search and fetch Azure AI SDK topics.

**Delegation trigger**: Research requiring 3+ sources → delegate to subagent.

### GitHub Repository Access

Use GitHub MCP tools to search code and browse files across Azure SDK, Semantic Kernel, Azure Samples.

**Delegation trigger**: Multi-repo search or 5+ file reads → delegate to subagent.

### Browser Testing

Use Playwright tools in priority order: console logs → network → accessibility → screenshots.

**Delegation trigger**: Multi-page testing, screenshots, or accessibility audits → delegate to subagent.

## Development Workflow

**Both servers support live reloading** - no restarts needed:

| Server | Task | Hot Reload |
|--------|------|------------|
| Backend | `Backend: ASP.NET Core API` | Auto-recompiles on save |
| Frontend | `Frontend: React Vite` | HMR - instant browser updates |

**Compound task**: `Start Dev (VS Code Terminals)` starts both in parallel.

**Workflow**: Edit code → Save → Check terminal for errors → Test in browser


