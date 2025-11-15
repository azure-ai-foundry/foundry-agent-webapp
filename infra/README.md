# Infrastructure - Azure Bicep Templates

**Technical details**: See `infra/AGENTS.md` for Bicep patterns and code examples.

## Overview

Infrastructure as Code (IaC) using Azure Bicep, deployed via Azure Developer CLI (azd). Provisions:

- **Azure Container Registry** (Basic tier) - Private image storage
- **Azure Container Apps Environment** - Serverless container runtime
- **Azure Container App** - Single container (frontend + backend)
- **Log Analytics Workspace** - Centralized logging
- **RBAC Assignments** - Managed identity → AI Foundry access

## Architecture

```
Subscription (deployment scope)
├── Resource Group (auto-created)
├── Container Registry (ACR)
├── Container Apps Environment
│   └── Container App (web)
│       ├── System-assigned identity
│       ├── Scale: 0-3 replicas
│       └── Ingress: HTTPS external
├── Log Analytics Workspace
└── RBAC: Container App → Cognitive Services User
```

## Files

| File | Purpose |
|------|---------|
| `main.bicep` | Orchestration (subscription scope) |
| `main-infrastructure.bicep` | Shared resources (ACR, Log Analytics, Container Apps Env) |
| `main-app.bicep` | Container App configuration |
| `main.parameters.json` | Parameter values (environment name, location) |
| `abbreviations.json` | Azure resource naming abbreviations |

## Key Features

- **Subscription Scope**: Single deployment creates resource group + all resources
- **Unique Naming**: `uniqueString()` prevents naming conflicts
- **Scale-to-Zero**: Container App scales down when idle (cost savings)
- **Managed Identity**: System-assigned identity for Azure resource access
- **RBAC Automation**: Auto-assigns "Cognitive Services User" role to AI Foundry

## Deployment

### Via azd (recommended)

```powershell
# Initial deployment
azd up  # Provisions + deploys code

# Update infrastructure only
azd provision

# Change AI Foundry resource
azd env set AI_FOUNDRY_RESOURCE_GROUP <resource-group>
azd env set AI_FOUNDRY_RESOURCE_NAME <resource-name>
azd provision  # Updates RBAC
```

### Direct Bicep (advanced)

```powershell
az deployment sub create \
  --location eastus \
  --template-file main.bicep \
  --parameters main.parameters.json \
  --parameters environmentName=myenv
```

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `environmentName` | (required) | Unique identifier (appended to resource names) |
| `location` | (required) | Azure region |
| `webImageName` | `mcr.microsoft.com/k8se/quickstart:latest` | Container image (placeholder during initial provision) |
| `entraSpaClientId` | (from azd) | Entra app client ID |
| `entraTenantId` | `tenant().tenantId` | Entra tenant ID (auto-detected or from azd) |
| `aiAgentEndpoint` | (from azd) | AI Agent endpoint URL |
| `aiAgentId` | (from azd) | Agent name |
| `aiFoundryResourceGroup` | (from azd) | AI Foundry resource group (for RBAC scope) |
| `aiFoundryResourceName` | (from azd) | AI Foundry resource name (for RBAC scope) |

## Outputs

| Output | Purpose |
|--------|---------|
| `AZURE_CONTAINER_APP_NAME` | Container App name (for deployment scripts) |
| `AZURE_CONTAINER_REGISTRY_NAME` | ACR name (for image push) |
| `AZURE_RESOURCE_GROUP_NAME` | Resource group name |
| `CONTAINER_APP_URL` | Application FQDN |
| `CONTAINER_APP_IDENTITY_PRINCIPAL_ID` | Managed identity principal ID (for RBAC) |

## Resource Configuration

### Container App

- **Compute**: 0.5 vCPU, 1GB RAM
- **Scaling**: 0-3 replicas (scale-to-zero enabled)
- **Ingress**: External HTTPS on port 8080
- **Identity**: System-assigned managed identity
- **Secrets**: ACR password (for private registry pull)

### Container Registry

- **Tier**: Basic (sufficient for single app)
- **Admin**: Disabled (uses managed identity)
- **Public Access**: Disabled

### Log Analytics

- **Retention**: 30 days
- **Pricing**: Pay-as-you-go (5GB/month free tier)

## Cost Optimization

- **Scale-to-zero**: Automatically enabled (no cost when idle)
- **Basic ACR**: Lowest tier ($5/month)
- **Shared environment**: Multiple apps can share Container Apps Environment

Estimated monthly cost: **$10-15** (varies by usage).

## Security

- ✅ System-assigned managed identity (no secrets in configuration)
- ✅ Private container registry (ACR)
- ✅ HTTPS-only ingress
- ✅ Least-privilege RBAC (Cognitive Services User role only)
- ✅ No public IP addresses

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Deployment fails | Check `az deployment sub show -n <deployment-name>` |
| RBAC not working | Verify `CONTAINER_APP_IDENTITY_PRINCIPAL_ID` has role assignment |
| Scale-to-zero not working | Check HTTP/TCP health probes (must succeed) |
| Name conflicts | Change `environmentName` parameter |

## Customization

### Change Scaling Limits

Edit `main-app.bicep`:
```bicep
scale: {
  minReplicas: 1  // Change from 0 to prevent scale-to-zero
  maxReplicas: 10  // Change from 3 for more scale
}
```

### Change Resource Tier

Edit `main-infrastructure.bicep`:
```bicep
sku: {
  name: 'Standard'  // Upgrade from Basic
}
```

### Add Environment Variables

Edit `main-app.bicep`:
```bicep
env: [
  { name: 'CUSTOM_VAR', value: 'custom-value' }
]
```

## Validation

```powershell
# Test Bicep syntax
az bicep build --file main.bicep

# What-if deployment
az deployment sub what-if \
  --location eastus \
  --template-file main.bicep \
  --parameters main.parameters.json
```

See `infra/AGENTS.md` for complete Bicep code examples and patterns.
