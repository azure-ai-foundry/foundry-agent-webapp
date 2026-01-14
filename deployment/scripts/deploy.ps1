#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy code updates to Azure Container Apps

.DESCRIPTION
    This script is a convenience wrapper around 'azd deploy'.
    
    azd deploy handles:
    1. Building the Docker image (locally or via ACR remote build)
    2. Passing build args (ENTRA_SPA_CLIENT_ID, ENTRA_TENANT_ID) from azd environment
    3. Pushing to Azure Container Registry
    4. Updating the Container App with the new image
    
    This is faster than 'azd up' as it skips infrastructure provisioning.
    For infrastructure changes, use: azd up

.EXAMPLE
    .\deployment\scripts\deploy.ps1
    
.EXAMPLE
    # Or use azd directly:
    azd deploy
#>

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploy to Azure Container Apps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verify azd environment exists
$envName = azd env get-value AZURE_ENV_NAME 2>&1
if ($LASTEXITCODE -ne 0 -or -not $envName) {
    Write-Error "No azd environment found. Have you run 'azd up' yet?"
    exit 1
}

Write-Host "Environment: $envName" -ForegroundColor Green
Write-Host ""

# Run azd deploy
Write-Host "Running azd deploy..." -ForegroundColor Cyan
Write-Host "(Uses local Docker if available; otherwise ACR cloud build)" -ForegroundColor Gray
Write-Host ""

azd deploy

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed"
    exit 1
}

# Get the deployed URL
$containerAppUrl = azd env get-value WEB_ENDPOINT 2>&1
if ($containerAppUrl -and $LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Deployment Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Application URL: $containerAppUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Yellow
    Write-Host "  • Deploy again: azd deploy" -ForegroundColor Gray
    Write-Host "  • Full redeploy: azd up" -ForegroundColor Gray
    Write-Host "  • View logs: az containerapp logs show -g `$(azd env get-value AZURE_RESOURCE_GROUP_NAME) -n `$(azd env get-value AZURE_CONTAINER_APP_NAME) --follow" -ForegroundColor Gray
    Write-Host ""
}
