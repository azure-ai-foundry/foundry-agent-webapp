#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy code updates to Azure Container Apps

.DESCRIPTION
    This script rebuilds and deploys the Docker image to Azure without re-provisioning infrastructure.
    
    What it does:
    1. Gets Container App configuration from azd environment
    2. Builds Docker image with embedded Client ID
    3. Pushes image to Azure Container Registry
    4. Updates Container App with new image
    
    Use this for code-only deployments (faster than azd up).
    For infrastructure changes, use: azd up

.EXAMPLE
    .\deployment\scripts\deploy.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploy to Azure Container Apps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get environment variables from azd
$envName = azd env get-value AZURE_ENV_NAME 2>&1
if ($LASTEXITCODE -ne 0 -or -not $envName) {
    Write-Error "AZURE_ENV_NAME not set. Have you run 'azd up' yet?"
    exit 1
}

$clientId = azd env get-value ENTRA_SPA_CLIENT_ID 2>&1
if ($LASTEXITCODE -ne 0 -or -not $clientId) {
    Write-Error "ENTRA_SPA_CLIENT_ID not set. Run 'azd up' to configure."
    exit 1
}

$tenantId = azd env get-value ENTRA_TENANT_ID 2>&1
if ($LASTEXITCODE -ne 0 -or -not $tenantId) {
    Write-Error "ENTRA_TENANT_ID not set. Run 'azd up' to configure."
    exit 1
}

$resourceGroup = azd env get-value AZURE_RESOURCE_GROUP_NAME 2>&1
if ($LASTEXITCODE -ne 0 -or -not $resourceGroup) {
    Write-Error "AZURE_RESOURCE_GROUP_NAME not set. Run 'azd up' to provision infrastructure."
    exit 1
}

$containerApp = azd env get-value AZURE_CONTAINER_APP_NAME 2>&1
if ($LASTEXITCODE -ne 0 -or -not $containerApp) {
    Write-Error "AZURE_CONTAINER_APP_NAME not set. Run 'azd up' to provision infrastructure."
    exit 1
}

$acrName = azd env get-value AZURE_CONTAINER_REGISTRY_NAME 2>&1
if ($LASTEXITCODE -ne 0 -or -not $acrName) {
    Write-Error "AZURE_CONTAINER_REGISTRY_NAME not set. Run 'azd up' to provision infrastructure."
    exit 1
}

Write-Host "Environment: $envName" -ForegroundColor Green
Write-Host "Resource Group: $resourceGroup" -ForegroundColor Green
Write-Host "Container App: $containerApp" -ForegroundColor Green
Write-Host ""

# Call shared deployment module
try {
    $containerAppUrl = & "$PSScriptRoot\build-and-deploy-container.ps1" `
        -ClientId $clientId `
        -TenantId $tenantId `
        -ResourceGroup $resourceGroup `
        -ContainerApp $containerApp `
        -AcrName $acrName
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Deployment failed"
        exit 1
    }
}
catch {
    Write-Error "Deployment failed: $_"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Application URL: $containerAppUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  • Test: $containerAppUrl" -ForegroundColor Gray
Write-Host "  • Logs: az containerapp logs show -n $containerApp -g $resourceGroup --follow" -ForegroundColor Gray
Write-Host "  • Deploy again: .\deployment\scripts\deploy.ps1" -ForegroundColor Gray
Write-Host ""
