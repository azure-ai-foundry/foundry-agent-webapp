#!/usr/bin/env pwsh
# Pre-provision: Creates Entra app, discovers AI Foundry resources, generates local dev config

$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"

Write-Host "Pre-Provision: Entra ID & AI Foundry Setup" -ForegroundColor Cyan

# Check prerequisites
foreach ($cmd in @('pwsh', 'az')) {
    if (-not (Get-Command $cmd -EA SilentlyContinue)) {
        Write-Host "[ERROR] $cmd not found. See: https://learn.microsoft.com/cli/azure/install-azure-cli" -ForegroundColor Red
        exit 1
    }
}

$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "[ERROR] Not logged in to Azure. Run 'azd auth login'" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Azure CLI: $($account.user.name)" -ForegroundColor Green

# Get environment
$envName = (azd env get-value AZURE_ENV_NAME 2>&1) | Where-Object { $_ -notmatch 'ERROR' } | Select-Object -First 1
if ([string]::IsNullOrWhiteSpace($envName)) { $envName = $env:AZURE_ENV_NAME }
if ([string]::IsNullOrWhiteSpace($envName)) {
    Write-Host "[ERROR] AZURE_ENV_NAME not set. Run 'azd init' first." -ForegroundColor Red
    exit 1
}

# Auto-detect tenant if not set
$tenantId = (azd env get-value ENTRA_TENANT_ID 2>&1) | Where-Object { $_ -notmatch 'ERROR' } | Select-Object -First 1
if ([string]::IsNullOrWhiteSpace($tenantId)) {
    $tenantId = $account.tenantId
    azd env set ENTRA_TENANT_ID $tenantId
}
Write-Host "[OK] Tenant: $tenantId" -ForegroundColor Green

Write-Host "[OK] Environment: $envName" -ForegroundColor Green

# Create app registration
$appName = "ai-foundry-agent-$envName"
Write-Host "Creating app registration..." -ForegroundColor Cyan

$params = @{ AppName = $appName; TenantId = $tenantId }
$smr = $env:ENTRA_SERVICE_MANAGEMENT_REFERENCE
if (-not [string]::IsNullOrWhiteSpace($smr)) { $params.ServiceManagementReference = $smr }

$clientId = & "$PSScriptRoot/modules/New-EntraAppRegistration.ps1" @params
if (-not $clientId) {
    Write-Host "[ERROR] App registration failed. See deployment/hooks/README.md" -ForegroundColor Red
    exit 1
}
azd env set ENTRA_SPA_CLIENT_ID $clientId
Write-Host "[OK] Client ID: $clientId" -ForegroundColor Green

# Discover AI Foundry resources
Write-Host "Discovering AI Foundry resources..." -ForegroundColor Cyan

$existingEndpoint = (azd env get-value AI_AGENT_ENDPOINT 2>&1) | Where-Object { $_ -notmatch 'ERROR' } | Select-Object -First 1

if ([string]::IsNullOrWhiteSpace($existingEndpoint)) {
    # Auto-discover
    $resources = az cognitiveservices account list --query "[?kind=='AIServices']" | ConvertFrom-Json
    if (-not $resources -or $resources.Count -eq 0) {
        Write-Host "[ERROR] No AI Foundry resources found. Create one at https://ai.azure.com" -ForegroundColor Red
        exit 1
    }
    
    $selected = $resources[0]
    if ($resources.Count -gt 1) {
        Write-Host "Found $($resources.Count) AI Foundry resources:" -ForegroundColor Cyan
        for ($i = 0; $i -lt $resources.Count; $i++) {
            Write-Host "  [$($i+1)] $($resources[$i].name) ($($resources[$i].resourceGroup))" -ForegroundColor White
        }
        $sel = Read-Host "Select (1-$($resources.Count))"
        $selection = 0
        if ([int]::TryParse($sel, [ref]$selection) -and $selection -ge 1 -and $selection -le $resources.Count) {
            $selected = $resources[$selection - 1]
        }
    }
    Write-Host "[OK] Using: $($selected.name)" -ForegroundColor Green
    
    # Get first project
    $projectsUrl = "https://management.azure.com$($selected.id)/projects?api-version=2025-04-01-preview"
    $projects = az rest --method get --url $projectsUrl --query "value" 2>$null | ConvertFrom-Json
    if (-not $projects -or $projects.Count -eq 0) {
        Write-Host "[ERROR] No projects found. Create one at https://ai.azure.com" -ForegroundColor Red
        exit 1
    }
    $projectName = $projects[0].name.Split('/')[-1]
    
    $aiEndpoint = "https://$($selected.name).services.ai.azure.com/api/projects/$projectName"
    azd env set AI_FOUNDRY_RESOURCE_GROUP $selected.resourceGroup
    azd env set AI_FOUNDRY_RESOURCE_NAME $selected.name
    azd env set AI_AGENT_ENDPOINT $aiEndpoint
    
    Write-Host "[OK] Endpoint: $aiEndpoint" -ForegroundColor Green
} else {
    Write-Host "[OK] Using pre-configured endpoint" -ForegroundColor Green
    $aiEndpoint = $existingEndpoint
}

# Discover agent if not set
$agentId = (azd env get-value AI_AGENT_ID 2>&1) | Where-Object { $_ -notmatch 'ERROR' } | Select-Object -First 1
if ([string]::IsNullOrWhiteSpace($agentId)) {
    try {
        $agents = & "$PSScriptRoot/modules/Get-AIFoundryAgents.ps1" -ProjectEndpoint $aiEndpoint
        if ($agents -and $agents.Count -gt 0) {
            $agentId = $agents[0].name
            azd env set AI_AGENT_ID $agentId
            Write-Host "[OK] Agent: $agentId" -ForegroundColor Green
        }
    } catch { }
}
if ([string]::IsNullOrWhiteSpace($agentId)) {
    Write-Host "[ERROR] AI_AGENT_ID required. Run: azd env set AI_AGENT_ID <name>" -ForegroundColor Red
    exit 1
}

# Create local dev config files
$aiAgentEndpoint = (azd env get-value AI_AGENT_ENDPOINT 2>&1) | Where-Object { $_ -notmatch 'ERROR' } | Select-Object -First 1
$aiAgentId = (azd env get-value AI_AGENT_ID 2>&1) | Where-Object { $_ -notmatch 'ERROR' } | Select-Object -First 1

# Frontend .env.local
@"
# Auto-generated - Do not commit
VITE_ENTRA_SPA_CLIENT_ID=$clientId
VITE_ENTRA_TENANT_ID=$tenantId
"@ | Out-File -FilePath "frontend/.env.local" -Encoding utf8 -Force

# Backend .env
@"
# Auto-generated - Do not commit
AzureAd__Instance=https://login.microsoftonline.com/
AzureAd__TenantId=$tenantId
AzureAd__ClientId=$clientId
AzureAd__Audience=api://$clientId
AI_AGENT_ENDPOINT=$aiAgentEndpoint
AI_AGENT_ID=$aiAgentId
"@ | Out-File -FilePath "backend/WebApp.Api/.env" -Encoding utf8 -Force

Write-Host "[OK] Local dev config created" -ForegroundColor Green
Write-Host "[OK] Pre-provision complete" -ForegroundColor Green
