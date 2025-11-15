# AI Agent Web App

AI-powered web application with Entra ID authentication and Azure AI Foundry Agent Service integration. Deploy to Azure Container Apps with a single command.

## Quick Start

```powershell
azd up  # Full deployment: ~10-12 minutes
```

This command:
1. Creates Microsoft Entra ID app registration (automated)
2. Deploys Azure infrastructure (ACR, Container Apps)
3. Builds and deploys your application
4. Opens browser to your deployed app

**Local Development**: http://localhost:5173 (frontend), http://localhost:8080 (backend)  
**Production**: https://<your-app>.azurecontainerapps.io

## Prerequisites

- **Azure Subscription** with Contributor role
- **PowerShell 7+** - Cross-platform scripting (https://aka.ms/powershell)
- **Azure Developer CLI (azd)** - `winget install microsoft.azd`
- **Bicep CLI** - Installed automatically with `azd`, or manually: `az bicep install`
- **.NET 9 SDK** - https://dot.net
- **Node.js 18+** - https://nodejs.org
- **Azure AI Foundry Resource** - Create at https://ai.azure.com with at least one agent
- **Docker Desktop** (optional) - For local builds. If not installed, `azd` uses Azure Container Registry cloud build.

### Custom npm Registries

If your organization uses a custom npm registry, add `.npmrc` to `frontend/` directory:

```ini
registry=https://your-registry.example.com/
//your-registry.example.com/:_authToken=${NPM_TOKEN}
```

**Note**: `.npmrc` is automatically copied during Docker builds. Don't commit authentication tokens.

### Organization-Specific Requirements

If your organization has custom Entra ID policies, you may need to set environment variables before deployment. See [deployment/hooks/README.md](deployment/hooks/README.md#app-registration-policies) for details.

## VS Code Configuration

The workspace includes optimized VS Code configuration for AI-assisted development:

### Tasks (`.vscode/tasks.json`)
- **Start Local Development** - Runs both frontend and backend servers simultaneously
- **Start Backend (ASP.NET Core)** - `dotnet run` with watch mode (port 8080)
- **Start Frontend (Vite)** - `npm run dev` with HMR (port 5173)

### Settings (`.vscode/settings.json`)
- **GitHub Copilot** - Enabled with custom agent mode support
- **Instruction Files** - Loads `.github/instructions/*.md` and `AGENTS.md` hierarchy
- **Markdown Linting** - Disabled to prevent noise from instruction files

## Configuration

### Azure AI Foundry

`azd up` automatically discovers your AI Foundry resource, project, and agent:

- **1 resource found**: Auto-selects and configures RBAC
- **Multiple resources found**: Prompts you to select which one to use
- **RBAC**: Automatically grants the Container App's managed identity "Cognitive Services User" role

**Change AI Foundry resource**:
```powershell
# Option 1: Let azd discover and prompt for selection
azd provision  # Re-runs discovery, updates RBAC

# Option 2: Manually configure then provision
azd env set AI_FOUNDRY_RESOURCE_GROUP <resource-group>
azd env set AI_FOUNDRY_RESOURCE_NAME <resource-name>
azd provision  # Updates RBAC for new resource
```

**List and switch agents** (requires prior `azd up`):
```powershell
# List all agents in configured project
.\deployment\scripts\list-agents.ps1

# Switch to different agent (in same resource)
azd env set AI_AGENT_ID <agent-name>
# No provision needed - RBAC already grants access to all agents in the resource
```

> 💡 `azd provision` (or `azd up`) automatically regenerates `.env` files and updates RBAC assignments when configuration changes.

## Development Workflow

```powershell
# Start local development (first time or daily)
.\deployment\scripts\start-local-dev.ps1

# Work with instant feedback:
# - React: Hot Module Replacement (HMR)
# - C#: Watch mode recompilation
# - Test at http://localhost:5173

# Deploy code changes to Azure
.\deployment\scripts\deploy.ps1  # 3-5 minutes
```

## Architecture

**Frontend**: React 18 + TypeScript + Vite  
**Backend**: ASP.NET Core 9 Minimal APIs  
**Authentication**: Microsoft Entra ID (PKCE flow)  
**AI Integration**: Azure AI Foundry Agent Service  
**Deployment**: Single container, Azure Container Apps  
**Local Dev**: Native (no Docker required)



## Commands

**See `.github/copilot-instructions.md` for complete command reference and development workflow.**

| Command | Purpose | Duration |
|---------|---------|----------|
| `azd up` | Initial deployment (infra + code) | 10-12 min |
| `.\deployment\scripts\deploy.ps1` | Deploy code changes only | 3-5 min |
| `.\deployment\scripts\start-local-dev.ps1` | Start local development | Instant |
| `.\deployment\scripts\list-agents.ps1` | List agents in your project | Instant |
| `azd provision` | Re-deploy infrastructure / update RBAC | 2-3 min |
| `azd down --force --purge` | Delete all Azure resources | 2-3 min |

> **Why not `azd deploy`?** This template uses an infra-only pattern. The `postprovision` hook handles initial builds, and `deploy.ps1` handles code updates to avoid redundant operations.

## Documentation

For contributors and AI agents, detailed technical documentation is available:
- `.github/copilot-instructions.md` - Architecture overview and cross-cutting patterns
- `backend/AGENTS.md` - ASP.NET Core implementation patterns
- `frontend/AGENTS.md` - React and MSAL integration patterns
- `infra/AGENTS.md` - Bicep infrastructure patterns
- `deployment/AGENTS.md` - Deployment and Docker patterns

## Azure Resources Provisioned

This template deploys the following Azure resources:

- **Azure Container Apps** - Serverless container hosting (0.5 vCPU, 1GB RAM, scale-to-zero enabled)
- **Azure Container Registry** - Private container image storage (Basic tier)
- **Log Analytics Workspace** - Application logging and monitoring
- **Managed Identity** - System-assigned identity with RBAC to AI Foundry resource

**Local development requires no Azure resources** - runs natively without Docker or cloud dependencies.





## Project Structure

```
├── backend/WebApp.Api/          # ASP.NET Core API + serves frontend
├── frontend/                     # React + TypeScript + Vite
├── infra/                        # Bicep infrastructure templates
├── deployment/
│   ├── hooks/                    # azd lifecycle automation
│   ├── scripts/                  # User commands
│   └── docker/                   # Multi-stage Dockerfile
└── .github/
    ├── copilot-instructions.md   # Architecture patterns
    └── instructions/             # Language-specific standards
```