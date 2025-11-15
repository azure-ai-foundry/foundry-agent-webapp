# Deployment Directory

**Context**: See `.github/copilot-instructions.md` for commands and workflows. See `deployment/AGENTS.md` for technical implementation.

## Structure

```
deployment/
├── docker/              # Docker build files
│   └── frontend.Dockerfile  # Single-container build (React + ASP.NET Core)
├── hooks/               # Azure Developer CLI lifecycle hooks
│   ├── preprovision.ps1     # Create Entra app + discover AI Foundry + generate config
│   ├── postprovision.ps1    # Build & deploy initial container
│   └── postdown.ps1         # Cleanup (optional)
│   └── modules/             # Reusable PowerShell modules
│       └── New-EntraAppRegistration.ps1
└── scripts/             # User-invoked deployment scripts
    ├── build-and-deploy-container.ps1  # Shared build/deploy logic (DRY)
    ├── deploy.ps1                    # Quick deploy (code-only updates)
    └── start-local-dev.ps1           # Start native local development
```

## Key Files

| File | Purpose | When to Use |
|------|---------|-------------|
| `hooks/preprovision.ps1` | Discovery & config generation | Auto-runs during `azd up` |
| `hooks/postprovision.ps1` | Initial build & deployment | Auto-runs during `azd up` |
| `scripts/deploy.ps1` | Code-only deployment | Manual invocation for code changes |
| `scripts/start-local-dev.ps1` | Local dev server startup | Manual invocation for development |
| `scripts/build-and-deploy-container.ps1` | Shared build module | Called by postprovision & deploy |
| `docker/frontend.Dockerfile` | Production build | Used by build scripts |

## Hook Relationship

```
azd up
  ├─ preprovision.ps1 (Entra + AI Foundry discovery + .env generation)
  ├─ provision (Bicep deployment)
  └─ postprovision.ps1 (calls build-and-deploy-container.ps1)

deploy.ps1 (direct invocation)
  └─ build-and-deploy-container.ps1

build-and-deploy-container.ps1 (shared module)
  ├─ Detects Docker availability
  ├─ Local build + push OR ACR cloud build
  └─ Updates Container App
```

## Quick Reference

For complete commands and workflows, see `.github/copilot-instructions.md` → Development Workflow section.

**Common tasks**:
- First deployment: `azd up`
- Deploy code changes: `.\deployment\scripts\deploy.ps1`
- Local development: `.\deployment\scripts\start-local-dev.ps1`
- Clean up: `azd down --force --purge`

## Docker Details

**Build strategy**: Multi-stage (React build → .NET build → Runtime)

**Custom npm registries**: Add `.npmrc` to `frontend/` directory - automatically copied during build

**Build modes**:
- Local Docker (faster, recommended): Uses installed Docker daemon
- ACR cloud build (fallback): Uploads context to ACR for cloud build

See `AGENTS.md` for complete Dockerfile and build module implementation.
