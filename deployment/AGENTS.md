# Deployment - azd Hooks

**Context**: See `.github/copilot-instructions.md` for architecture

## Preprovision Hook

**Goal**: Create Entra app + discover AI Foundry + generate config files

```powershell
# Get environment
$envName = azd env get-value AZURE_ENV_NAME
$tenantId = (az account show | ConvertFrom-Json).tenantId

# Create app registration
$clientId = & "$PSScriptRoot\modules\New-EntraAppRegistration.ps1" `
    -AppName "$envName-client" -TenantId $tenantId

azd env set ENTRA_SPA_CLIENT_ID $clientId
azd env set ENTRA_TENANT_ID $tenantId

# Discover AI Foundry resources
$foundryResources = az resource list --resource-type "Microsoft.MachineLearningServices/workspaces" | ConvertFrom-Json

if ($foundryResources.Count -eq 0) {
    Write-Error "No AI Foundry resources found in subscription"
    exit 1
}

# If multiple resources, prompt user to select
if ($foundryResources.Count -gt 1) {
    Write-Host "Multiple AI Foundry resources found:"
    for ($i = 0; $i -lt $foundryResources.Count; $i++) {
        Write-Host "[$i] $($foundryResources[$i].name) (Resource Group: $($foundryResources[$i].resourceGroup))"
    }
    $selection = Read-Host "Select resource [0-$($foundryResources.Count - 1)]"
    $selectedResource = $foundryResources[$selection]
} else {
    $selectedResource = $foundryResources[0]
}

$resourceGroup = $selectedResource.resourceGroup
$resourceName = $selectedResource.name

# Discover agents via REST API (using shared module)
$allAgents = & "$PSScriptRoot/modules/Get-AIFoundryAgents.ps1" -ProjectEndpoint $aiEndpoint

if ($allAgents.Count -eq 0) {
    Write-Error "No agents found in AI Foundry resource"
    exit 1
}

# Select first agent or prompt if multiple
if ($allAgents.Count -eq 1) {
    $agentName = $allAgents[0].name
} else {
    # Display agents and use first one
    Write-Host "Found $($allAgents.Count) agents, using first: $($allAgents[0].name)"
    $agentName = $allAgents[0].name
}

# Set environment variables
azd env set AI_FOUNDRY_RESOURCE_GROUP $resourceGroup
azd env set AI_FOUNDRY_RESOURCE_NAME $resourceName
azd env set AI_AGENT_ENDPOINT $aiEndpoint
azd env set AI_AGENT_ID $agentName

# Generate frontend .env.local
@"
VITE_ENTRA_SPA_CLIENT_ID=$clientId
VITE_ENTRA_TENANT_ID=$tenantId
"@ | Set-Content "frontend/.env.local"

# Generate backend .env
@"
AzureAd__ClientId=$clientId
AzureAd__TenantId=$tenantId
AI_AGENT_ENDPOINT=$aiEndpoint
AI_AGENT_ID=$agentName
"@ | Set-Content "backend/WebApp.Api/.env"
```

**Key Points**:
- Auto-discovers AI Foundry resources in current subscription
- Prompts user to select if multiple resources exist
- Discovers agents via REST API (v2025-11-15-preview) using `Get-AIFoundryAgents.ps1` module
- Uses agent names (not IDs) for configuration
- Generates `.env` files with all required configuration

## Postprovision Hook

**Goal**: Update redirect URIs + build/deploy container

**Pattern**: Updates Entra app redirect URIs, then calls shared `build-and-deploy-container.ps1` module

```powershell
# 1. Get Container App URL
$appUrl = az containerapp show --name $containerApp --resource-group $rg `
    --query "properties.configuration.ingress.fqdn" -o tsv
$appUrl = "https://$appUrl"

# 2. Update app registration redirect URIs (local dev + production)
$redirectUris = @("http://localhost:5173", "http://localhost:8080", $appUrl)
az rest --method PATCH `
    --uri "https://graph.microsoft.com/v1.0/applications/$appObjectId" `
    --body (ConvertTo-Json @{ spa = @{ redirectUris = $redirectUris } })

# 3. Call shared build/deploy module (same logic as deploy.ps1)
$scriptPath = Join-Path (Split-Path $PSScriptRoot -Parent) "scripts\build-and-deploy-container.ps1"
$containerAppUrl = & $scriptPath `
    -ClientId $clientId `
    -TenantId $tenantId `
    -ResourceGroup $resourceGroup `
    -ContainerApp $containerApp `
    -AcrName $acrName
```

## Docker Multi-Stage Build

**Pattern**: Build React → Build .NET → Runtime

**Custom npm Registries**: Add `.npmrc` to `frontend/` directory - it's automatically copied

```dockerfile
# Stage 1: Build React
FROM node:20-alpine AS frontend
ARG ENTRA_SPA_CLIENT_ID
ARG ENTRA_TENANT_ID
WORKDIR /app
COPY frontend/package*.json ./
COPY frontend/.npmrc* ./ 2>/dev/null || true  # Copy .npmrc if present (custom registries)
RUN npm ci  # Respects .npmrc for custom registries
COPY frontend/ ./
ENV VITE_ENTRA_SPA_CLIENT_ID=$ENTRA_SPA_CLIENT_ID
RUN npm run build

# Stage 2: Build .NET
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS backend
WORKDIR /app
COPY backend/*.sln ./
COPY backend/WebApp.Api/*.csproj ./WebApp.Api/
RUN dotnet restore
COPY backend/ ./
RUN dotnet publish -c Release -o /app/publish

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine
WORKDIR /app
COPY --from=backend /app/publish ./
COPY --from=frontend /app/dist ./wwwroot
EXPOSE 8080
ENTRYPOINT ["dotnet", "WebApp.Api.dll"]
```

## Shared Build Module

`deployment/scripts/build-and-deploy-container.ps1`

**Usage**: Called by both `postprovision` hook and `deploy` script

```powershell
& "$scriptPath" -ClientId $id -TenantId $tid -ResourceGroup $rg -ContainerApp $app -AcrName $acr
```

**Logic**:
1. Detects if Docker is available and running
2. Uses local Docker build + push if available
3. Falls back to ACR cloud build if Docker unavailable
4. Updates Container App with new image
5. Returns Container App URL

## Local Development Scripts

`deployment/scripts/start-local-dev.ps1`

**Features**:
- Validates configuration files
- Checks and installs/repairs npm dependencies if needed
- Starts both backend and frontend servers
- Displays URLs for local development

## Troubleshooting

```powershell
# Check current image
az containerapp show --name $app --resource-group $rg `
    --query "properties.template.containers[0].image"

# View logs
az containerapp logs show --name $app --resource-group $rg --tail 100

# Check RBAC
$principalId = az containerapp show --name $app --resource-group $rg `
    --query "identity.principalId" -o tsv
az role assignment list --assignee $principalId
```
