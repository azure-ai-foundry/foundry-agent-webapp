# AI Agent Web App - Copilot Instructions

**Purpose**: AI-powered web application with Entra ID authentication and Azure AI Foundry Agent Service integration.

## Architecture Overview

### Single Container Pattern
ASP.NET Core serves both REST API (`/api/*`) and React SPA (same origin).

### Authentication Flow
1. Browser → `MSAL.js` (PKCE flow) → JWT with `Chat.ReadWrite` scope
2. Frontend → Backend (JWT Bearer token)
3. Backend → Azure AI Foundry Agent Service (`ManagedIdentityCredential`)

### Configuration Strategy
- **Local**: `.env` files (gitignored, auto-generated)
- **Production**: Environment variables + Docker build args

## Key Files

| File | Purpose |
|------|---------||
| `backend/WebApp.Api/Program.cs` | Middleware + JWT + API endpoints |
| `frontend/src/config/authConfig.ts` | MSAL configuration |
| `deployment/hooks/preprovision.ps1` | Entra app + `.env` generation + AI Foundry discovery |
| `deployment/hooks/postprovision.ps1` | Docker build + deployment |
| `infra/main-app.bicep` | Container App configuration |

## Development Commands

| Command | Purpose | Time |
|---------|---------|------|
| `azd up` | Full deployment (Entra app + infrastructure + container) | 10-12 min |
| `.\deployment\scripts\deploy.ps1` | Code-only deployment (Docker rebuild + push) | 3-5 min |
| VS Code task: "Start Local Dev Servers" | Start local dev (backend + frontend) | Instant |
| `.\deployment\scripts\start-local-dev.ps1` | Start local dev (manual) | Instant |

**Note**: `azd deploy` is not used. This template uses an infra-only pattern where `postprovision` handles initial deployment. For code updates, run the deployment script directly to avoid redundant builds.

## Development Workflow

### Step 1: Initial Setup
- **Goal**: Configure authentication and generate config files
- **Action**: Run `azd up` (creates Entra app, deploys to Azure)
- **Result**: `.env` files generated in `frontend/` and `backend/WebApp.Api/`

### Step 2: Daily Development
- **Goal**: Run local servers with hot reload
- **Action**: Run VS Code task "Start Local Dev Servers"
- **Result**: Backend (port 8080) + Frontend (port 5173) in separate terminals

### Step 3: Deploy Changes
- **Goal**: Update cloud deployment with code changes
- **Action**: Run `.\deployment\scripts\deploy.ps1` (Docker rebuild + push)
- **Transition**: Test at `https://<app>.azurecontainerapps.io`

## Custom npm Registries

**Pattern**: Add `.npmrc` to `frontend/` directory

```ini
# frontend/.npmrc
registry=https://registry.example.com/
//registry.example.com/:_authToken=${NPM_TOKEN}
```

Dockerfile copies `.npmrc` if present. Don't commit tokens.

## Critical Patterns

### Middleware Order (NEVER reorder)
**Goal**: Serve static files, validate auth, route APIs, fallback to SPA

**See**: `backend/WebApp.Api/Program.cs` for correct ordering:
1. `UseDefaultFiles()` / `UseStaticFiles()` - Serve SPA assets
2. `UseAuthentication()` / `UseAuthorization()` - Validate JWT
3. Map API endpoints
4. `MapFallbackToFile("index.html")` - MUST BE LAST

### API Endpoint Pattern
**Always use**: `.RequireAuthorization("RequireChatScope")` + `CancellationToken` + `IHostEnvironment` (for error handling)

**See**: `backend/WebApp.Api/Program.cs` for endpoint patterns with:
- `ErrorResponseFactory.CreateFromException()` for RFC 7807-compliant errors
- Development vs production error detail sanitization
- Proper exception handling in streaming and non-streaming endpoints

### Credential Strategy
**Local**: `ChainedTokenCredential` (uses `az login`)  
**Production**: `ManagedIdentityCredential` (system-assigned)

**See**: `backend/WebApp.Api/Services/AzureAIAgentService.cs` constructor for environment-aware credential selection

## Deployment Phases

1. **preprovision** → Entra app + AI Foundry auto-discovery + `.env` generation
2. **provision** → Deploy Azure resources via Bicep
3. **postprovision** → Updates redirect URIs + calls `build-and-deploy-container.ps1` to build/deploy container

**Deployment logic**: Shared `build-and-deploy-container` module (DRY) uses local Docker if available, ACR cloud build otherwise.

**Code-only deployment**: Use `.\deployment\scripts\deploy.ps1` (faster than `azd up`).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `VITE_ENTRA_SPA_CLIENT_ID not set` | Run `azd up` |
| `AI_AGENT_ENDPOINT not configured` | Run `azd provision` to re-discover AI Foundry resources |
| No AI Foundry resources found | Create an AI Foundry resource at https://ai.azure.com |
| 401 on `/api/*` | Verify token has `Chat.ReadWrite` scope |
| `ManagedIdentityCredential` error locally | Set `ASPNETCORE_ENVIRONMENT=Development` |
| Multiple AI Foundry resources | Run `azd provision` to select a different resource |

## Folder Documentation

See `AGENTS.md` files for implementation details:
- `backend/AGENTS.md` → ASP.NET Core + JWT + AI Agent SDK
- `frontend/AGENTS.md` → React + MSAL + Vite
- `infra/AGENTS.md` → Bicep + RBAC + Container Apps
- `deployment/AGENTS.md` → Hooks + Docker + Deployment

## Essential Rules

### ✅ Always Do
- Use `.RequireAuthorization("RequireChatScope")` on all API endpoints
- Accept and propagate `CancellationToken` in async methods
- Use `ErrorResponseFactory.CreateFromException()` for consistent error responses
- Implement `IDisposable` for services with disposable resources (e.g., `SemaphoreSlim`)
- Validate file uploads before processing (size, count, type)
- Use explicit credentials: `ChainedTokenCredential` (local) or `ManagedIdentityCredential` (cloud)
- Try `acquireTokenSilent()` first, fallback to `acquireTokenPopup()`
- Access `import.meta.env.*` at module level only

### ❌ Never Do
- Commit `.env*` files
- Use `.Result` or `.Wait()` on async methods
- Expose internal error details in production (use `IHostEnvironment.IsDevelopment()`)
- Forget disposal guards in `IDisposable` methods
- Reorder middleware pipeline
- Access `import.meta.env.*` inside functions
