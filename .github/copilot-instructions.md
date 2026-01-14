**Purpose**: AI-powered web application with Entra ID authentication and Azure AI Foundry Agent Service integration.

## Skills (On-Demand Context)

Load a skill when working in that domain. Each has detailed patterns and examples.

| Skill | When to Load |
|-------|--------------|
| `writing-csharp-code` | Backend code, API endpoints, SDK usage |
| `writing-typescript-code` | Frontend components, React hooks, MSAL |
| `implementing-chat-streaming` | SSE endpoints, streaming state |
| `troubleshooting-authentication` | 401 errors, token/JWT issues |
| `deploying-to-azure` | azd commands, deployment failures |
| `researching-azure-ai-sdk` | SDK patterns, multi-repo research |
| `testing-with-playwright` | Browser testing, accessibility |
| `writing-bicep-templates` | Infrastructure changes |

## Subagent Delegation

**Delegate to subagent** when operations would consume excessive context:

| Delegate | Keep Inline |
|----------|-------------|
| Multi-file research (5+ files) | Single file reads |
| Screenshot/accessibility analysis | Console log checks |
| Multi-repo code search | Local grep |
| Full deployment log analysis | Quick status checks |

**Pattern**:
```
runSubagent(
  prompt: "RESEARCH task - [specific goal]. Return: [exact output needed, max lines].",
  description: "[3-5 word summary]"
)
```

**Key**: Tell subagent exactly what to return. It sends one message back—make it count.
