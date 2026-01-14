# Deployment Directory

**AI Assistance**: See `.github/skills/deploying-to-azure/SKILL.md` for deployment patterns.

## Structure

```
deployment/
├── docker/              # Docker build files
│   └── frontend.Dockerfile  # Single-container build (React + ASP.NET Core)
├── hooks/               # Azure Developer CLI lifecycle hooks
│   ├── preprovision.ps1     # Create Entra app + discover AI Foundry + generate config
│   ├── postprovision.ps1    # Update Entra redirect URIs + assign RBAC
│   ├── predeploy.ps1        # Build container (local Docker or ACR cloud build)
│   ├── postdown.ps1         # Cleanup (optional)
│   └── modules/             # Reusable PowerShell modules
│       ├── Get-AIFoundryAgents.ps1
│       └── New-EntraAppRegistration.ps1
└── scripts/             # User-invoked scripts
    └── start-local-dev.ps1  # Start native local development
```

## Build Strategy

Container builds use **local Docker when available** with **ACR cloud build as fallback**:

| Docker Installed | Build Method | Speed |
|------------------|--------------|-------|
| ✅ Yes, running | Local Docker build + push to ACR | ~2 min |
| ❌ No | ACR cloud build | ~4-5 min |

This is handled automatically by `predeploy.ps1`.

## Key Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `azd up` | Full provision + deploy | Initial setup, infrastructure changes |
| `azd deploy` | Code-only deployment | Fast iteration on code changes |
| `azd down` | Tear down resources | Cleanup |

## Hook Workflow

```
azd up
  ├─ preprovision.ps1 (Entra + AI Foundry discovery + .env generation)
  ├─ provision (Bicep deployment with placeholder image)
  ├─ postprovision.ps1 (updates Entra redirect URIs + RBAC)
  └─ predeploy.ps1 (builds container - local Docker or ACR cloud)

azd deploy
  └─ predeploy.ps1 (builds + pushes + updates Container App)
```

## Quick Reference

**Common tasks**:
- First deployment: `azd up`
- Deploy code changes: `azd deploy`
- Local development: `.\deployment\scripts\start-local-dev.ps1`
- Clean up: `azd down --force --purge`

## Docker Details

**Build strategy**: Multi-stage (React build → .NET build → Runtime)

**Build args**: Client ID and Tenant ID are automatically passed to the Dockerfile from azd environment variables.

**Custom npm registries**: Add `.npmrc` to `frontend/` directory - automatically copied during build

For AI-assisted development, see `.github/skills/deploying-to-azure/SKILL.md`.
