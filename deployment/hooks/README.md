# Azure Developer CLI Hooks

**Context**: See `.github/copilot-instructions.md` and `deployment/AGENTS.md` for overall architecture.

## Hook Execution Order

| Phase | Command | Hooks Executed | Duration |
|-------|---------|----------------|----------|
| **Deploy** | `azd up` | preprovision → provision → postprovision | 10-12 min |
| **Teardown** | `azd down` | (resources deleted) → postdown | 2-3 min |
| **Reprovision** | `azd provision` | preprovision → provision | 2-3 min |

## Hook Details

| Hook | Purpose | Key Actions | Outputs |
|------|---------|-------------|---------|
| **preprovision.ps1** | Create Entra app + discover AI Foundry + generate config | • Discovers AI Foundry resources<br>• Creates Entra SPA app<br>• Generates `.env` files | `.env` and `.env.local` files |
| **postprovision.ps1** | Build & deploy container | • Updates redirect URIs<br>• Builds Docker image<br>• Deploys to Container App | Updated Container App |
| **postdown.ps1** | Cleanup (optional) | • Optionally removes Docker images<br>• Default: preserves for fast redeploy | Clean slate |

## Module Scripts

### modules/New-EntraAppRegistration.ps1

Reusable module for creating Entra ID app registrations with PKCE flow.

**Usage**:
```powershell
$clientId = & ".\modules\New-EntraAppRegistration.ps1" `
    -AppName "my-app" `
    -TenantId $tenantId `
    -RedirectUris @("http://localhost:5173")
```

### modules/Get-AIFoundryAgents.ps1

Discovers agents in an Azure AI Foundry project via REST API (`/agents?api-version=2025-11-15-preview`).

**Usage**:
```powershell
# Basic usage
$agents = & "$PSScriptRoot/modules/Get-AIFoundryAgents.ps1" `
    -ProjectEndpoint $endpoint

# Quiet mode (suppress console output)
$agents = & "$PSScriptRoot/modules/Get-AIFoundryAgents.ps1" `
    -ProjectEndpoint $endpoint -Quiet

# Custom token
$agents = & "$PSScriptRoot/modules/Get-AIFoundryAgents.ps1" `
    -ProjectEndpoint $endpoint -AccessToken $token
```

**Returns**: Array of agent objects (`name`, `id`, `versions`). Handles pagination automatically.

## Testing

```powershell
# Test individual hooks
.\hooks\preprovision.ps1
.\hooks\postprovision.ps1  # Requires provisioned infrastructure
.\hooks\postdown.ps1

# Test full flow
azd up
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| App registration fails with policy error | Set `$env:ENTRA_SERVICE_MANAGEMENT_REFERENCE = 'guid'` (see note below) |
| Preprovision fails | Verify Azure CLI auth: `az account show` |
| Postprovision Docker build fails | Check Docker running: `docker version` |
| AI Foundry not found | Create resource at https://ai.azure.com |
| Multiple AI Foundry resources | Hook will prompt for selection |

### App Registration Policies

Some organizations require [`serviceManagementReference`](https://learn.microsoft.com/en-us/powershell/module/microsoft.graph.applications/invoke-mginstantiateapplicationtemplate) for app registrations.

**Quick fix**:
```powershell
$env:ENTRA_SERVICE_MANAGEMENT_REFERENCE = 'your-guid-here'; azd up
```

**Persistent fix**:
```powershell
[System.Environment]::SetEnvironmentVariable('ENTRA_SERVICE_MANAGEMENT_REFERENCE', 'your-guid-here', 'User')
# Restart terminal
```

Contact your Entra ID admin for the required GUID.

## Customization

### Change Default Behavior

| Change | File | Modification |
|--------|------|-------------|
| Always clean Docker images | `postdown.ps1` | Set `$cleanDockerImages = $true` |
| Change ports | `start-local-dev.ps1` + Entra app URIs | Update port references |
| Skip auto-opening browser | `postprovision.ps1` | Comment out `Start-Process` line |
