# AI Agent Web App

AI-powered web application with Entra ID authentication and Azure AI Foundry Agent Service integration. Deploy to Azure Container Apps with a single command.

## Quick Start

### Using this Template

```powershell
# Clone or initialize from GitHub template
azd init -t microsoft-foundry/foundry-agent-webapp

# Deploy everything
azd up  # Full deployment: ~10-12 minutes
```

**Alternative**: Use GitHub's "Use this template" button or clone directly:
```powershell
git clone https://github.com/microsoft-foundry/foundry-agent-webapp.git
cd foundry-agent-webapp
azd up
```

The `azd up` command:
1. Creates Microsoft Entra ID app registration (automated)
2. Deploys Azure infrastructure (ACR, Container Apps)
3. Builds and deploys your application
4. Opens browser to your deployed app

**Local Development**: http://localhost:5173 (frontend), http://localhost:8080 (backend)  
**Production**: https://<your-app>.azurecontainerapps.io

## Prerequisites

### Windows
- **PowerShell 7+** - `winget install Microsoft.PowerShell`
- **Azure Developer CLI (azd)** - `winget install microsoft.azd`
- **Azure CLI** - `winget install Microsoft.AzureCLI`
- **Docker Desktop** (optional) - https://docs.docker.com/desktop/install/windows-install/
- **.NET 9 SDK** - https://dot.net
- **Node.js 18+** - https://nodejs.org

### macOS
- **PowerShell 7+** - `brew install powershell` or [download](https://github.com/PowerShell/PowerShell/releases)
- **Azure Developer CLI (azd)** - `brew tap azure/azd && brew install azd` or `curl -fsSL https://aka.ms/install-azd.sh | bash`
- **Azure CLI** - `brew install azure-cli` or `curl -L https://aka.ms/InstallAzureCli | bash`
- **Docker Desktop** (optional) - `brew install --cask docker` or [download](https://www.docker.com/products/docker-desktop/)
- **.NET 9 SDK** - https://dot.net
- **Node.js 18+** - `brew install node` or https://nodejs.org

> **Homebrew not installed?** Commands work without Homebrew using direct installers. The deployment script (`azd up`) checks for Homebrew and provides appropriate installation instructions.

### Linux
- **PowerShell 7+** - https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-linux
- **Azure Developer CLI (azd)** - `curl -fsSL https://aka.ms/install-azd.sh | bash`
- **Azure CLI** - https://learn.microsoft.com/cli/azure/install-azure-cli-linux
- **Docker Engine** (optional) - https://docs.docker.com/engine/install/
- **.NET 9 SDK** - https://dot.net
- **Node.js 18+** - https://nodejs.org

### Azure Requirements
- **Azure Subscription** with Contributor role
- **Bicep CLI** - Installed automatically with `azd`, or manually: `az bicep install`
- **Azure AI Foundry Resource** - Create at https://ai.azure.com with at least one agent

> **Note**: Docker is optional. If not installed, `azd` automatically uses Azure Container Registry cloud build for deployment.

### Custom npm Registries

If your organization uses a custom npm registry, add `.npmrc` to `frontend/` directory:

```ini
registry=https://your-registry.example.com/
//your-registry.example.com/:_authToken=${NPM_TOKEN}
```

**Note**: `.npmrc` is automatically copied during Docker builds. Don't commit authentication tokens.

### Organization-Specific Requirements

If your organization has custom Entra ID policies (e.g., requires service management reference for app registrations), set this environment variable before deployment:

```powershell
# For tenants requiring service management metadata
azd env set ENTRA_SERVICE_MANAGEMENT_REFERENCE "https://portal.azure.com/#blade/Microsoft_AAD_IAM/ManagedAppMenuBlade/..."
```

See [deployment/hooks/README.md](deployment/hooks/README.md#app-registration-policies) for more organization-specific configuration options.

## VS Code Configuration

The workspace includes optimized VS Code configuration for AI-assisted development:

### Tasks (`.vscode/tasks.json`)

| Task | Description | Port |
|------|-------------|------|
| `Backend: ASP.NET Core API` | `dotnet watch run` with hot reload | 8080 |
| `Frontend: React Vite` | `npm run dev` with HMR | 5173 |
| `Start Dev (VS Code Terminals)` | Starts both in parallel (default build task) | - |
| `Install Frontend Dependencies` | `npm install --legacy-peer-deps` | - |

**Hot Reload Workflow**:
- **Backend**: Edit C# → Save → .NET auto-recompiles → Check terminal for errors
- **Frontend**: Edit TypeScript/React → Save → Browser updates instantly (HMR)
- **No restarts needed** - just edit, save, and test

**AI Agent Benefits**: Server logs are visible in VS Code terminals, allowing AI agents to:
- See compilation errors and warnings
- Monitor request handling
- Debug issues without screenshots

### Settings (`.vscode/settings.json`)
- **GitHub Copilot** - Enabled with Agent Skills (`chat.useAgentSkills: true`)
- **Skills** - On-demand loading from `.github/skills/` for efficient context
- **Terminal Scrollback** - Limited to 500 lines to prevent overwhelming AI context
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

### Option 1: VS Code Tasks (Recommended for AI-assisted development)
```powershell
# Run the compound task via Command Palette (Ctrl+Shift+P):
# "Tasks: Run Task" → "Start Dev (VS Code Terminals)"
# Or press Ctrl+Shift+B (default build task)

# Servers run in VS Code terminal panel with visible logs
# AI agents can read logs via get_terminal_output
```

### Option 2: PowerShell Script
```powershell
# Start local development (spawns separate terminal windows)
.\deployment\scripts\start-local-dev.ps1
```

### Hot Reload
- **React**: Hot Module Replacement (HMR) - instant browser updates
- **C#**: Watch mode - auto-recompiles on save, check terminal for errors
- **Test at**: http://localhost:5173

### Deploy
```powershell
# Deploy code changes to Azure
azd deploy  # 3-5 minutes
```

## Architecture

**Frontend**: React 19 + TypeScript + Vite  
**Backend**: ASP.NET Core 9 Minimal APIs  
**Authentication**: Microsoft Entra ID (PKCE flow)  
**AI Integration**: Azure AI Foundry v2 Agents API (`Azure.AI.Projects` SDK)  
**Deployment**: Single container, Azure Container Apps  
**Local Dev**: Native (no Docker required)



## Commands

**See `.github/copilot-instructions.md` for complete command reference and development workflow.**

| Command | Purpose | Duration |
|---------|---------|----------|
| `azd up` | Initial deployment (infra + code) | 10-12 min |
| `azd deploy` | Deploy code changes only | 3-5 min |
| `.\deployment\scripts\start-local-dev.ps1` | Start local development | Instant |
| `.\deployment\scripts\list-agents.ps1` | List agents in your project | Instant |
| `azd provision` | Re-deploy infrastructure / update RBAC | 2-3 min |
| `azd down --force --purge` | Delete all Azure resources | 2-3 min |

## Documentation

### For Developers
- `backend/README.md` - ASP.NET Core API setup and configuration
- `frontend/README.md` - React frontend development (if present)
- `infra/README.md` - Azure infrastructure overview
- `deployment/README.md` - Deployment scripts and hooks

### For AI Assistants (GitHub Copilot)
This repository uses VS Code's Agent Skills feature for on-demand context loading:

- `.github/copilot-instructions.md` - Architecture overview (always loaded)
- `.github/skills/` - Domain-specific guidance loaded when relevant:
  - `deploying-to-azure` - Deployment commands and troubleshooting
  - `writing-csharp-code` - C#/ASP.NET Core patterns
  - `writing-typescript-code` - TypeScript/React patterns
  - `writing-bicep-templates` - Bicep infrastructure patterns
  - `implementing-chat-streaming` - SSE streaming patterns
  - `troubleshooting-authentication` - MSAL/JWT debugging
  - `researching-azure-ai-sdk` - SDK research workflow
  - `testing-with-playwright` - Browser testing workflow

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
    ├── copilot-instructions.md   # Architecture overview (always loaded)
    ├── skills/                   # On-demand AI assistant guidance
    │   ├── deploying-to-azure/
    │   ├── writing-csharp-code/
    │   ├── writing-typescript-code/
    │   └── ...                   # 8 skills total
    └── agents/                   # Agent mode definitions
```