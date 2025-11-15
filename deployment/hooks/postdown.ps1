#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Cleanup hook after azd down

.DESCRIPTION
    This hook runs after Azure resources are deleted by azd down.
    
    By default, Docker images are PRESERVED to speed up redeployment.
    To clean Docker images, set environment variable:
        $env:CLEAN_DOCKER_IMAGES = "true"
        azd down --force --purge

.EXAMPLE
    # Normal teardown (preserves Docker images)
    azd down --force --purge
    
.EXAMPLE
    # Full cleanup (removes Docker images too)
    $env:CLEAN_DOCKER_IMAGES = "true"
    azd down --force --purge
#>

$ErrorActionPreference = "Stop"

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host " Post-Down Cleanup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# --- Get environment name ---

$envName = $env:AZURE_ENV_NAME
if (-not $envName) {
    Write-Host "[!] Warning: AZURE_ENV_NAME not set, skipping some cleanup steps" -ForegroundColor Yellow
}

# --- Delete Entra App Registration ---

if ($envName) {
    Write-Host "`nCleaning up Entra app registration..." -ForegroundColor Cyan
    
    try {
        # Try to get the client ID from the environment
        $clientId = azd env get-value ENTRA_SPA_CLIENT_ID 2>$null
        
        if ($clientId) {
            Write-Host "  Found app registration: $clientId" -ForegroundColor Gray
            az ad app delete --id $clientId 2>&1 | Out-Null
            Write-Host "  [OK] Entra app registration deleted" -ForegroundColor Green
        }
        else {
            Write-Host "  No ENTRA_SPA_CLIENT_ID found in environment" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "  [!] Could not delete Entra app registration" -ForegroundColor Yellow
        Write-Host "    $_" -ForegroundColor Gray
    }
}

# --- Delete local configuration files ---

Write-Host "`nCleaning up local configuration files..." -ForegroundColor Cyan

$envLocalPath = Join-Path $PSScriptRoot ".." "frontend" ".env.local"
if (Test-Path $envLocalPath) {
    Remove-Item $envLocalPath -Force
    Write-Host "  [OK] Deleted frontend/.env.local" -ForegroundColor Green
}
else {
    Write-Host "  frontend/.env.local not found" -ForegroundColor Gray
}

# Clean up backend configuration
$backendEnvPath = Join-Path $PSScriptRoot ".." "backend" "WebApp.Api" ".env"
if (Test-Path $backendEnvPath) {
    Remove-Item $backendEnvPath -Force
    Write-Host "  [OK] Deleted backend/WebApp.Api/.env" -ForegroundColor Green
}
else {
    Write-Host "  backend/WebApp.Api/.env not found" -ForegroundColor Gray
}

# --- Delete azd environment folder ---

if ($envName) {
    Write-Host "`nCleaning up azd environment..." -ForegroundColor Cyan
    
    $envFolder = Join-Path $PSScriptRoot ".." ".azure" $envName
    if (Test-Path $envFolder) {
        Remove-Item $envFolder -Recurse -Force
        Write-Host "  [OK] Deleted .azure/$envName environment folder" -ForegroundColor Green
    }
    else {
        Write-Host "  .azure/$envName not found" -ForegroundColor Gray
    }
}

# --- Check if we should clean Docker images ---

$cleanDockerImages = $env:CLEAN_DOCKER_IMAGES -eq "true"

if ($cleanDockerImages) {
    Write-Host "`nCleaning Docker images..." -ForegroundColor Yellow
    
    $images = docker images "ai-foundry-agent/*" -q
    if ($images) {
        $imageCount = ($images | Measure-Object).Count
        Write-Host "Found $imageCount Docker image(s) to remove" -ForegroundColor Gray
        
        $images | ForEach-Object {
            try {
                docker rmi $_ -f
            }
            catch {
                Write-Host "[!] Failed to remove image $_" -ForegroundColor Yellow
            }
        }
        
        Write-Host "[OK] Docker images removed" -ForegroundColor Green
    }
    else {
        Write-Host "No Docker images found to clean" -ForegroundColor Gray
    }
}
else {
    Write-Host "`nDocker images PRESERVED (faster redeployment)" -ForegroundColor Green
    
    $images = docker images "ai-foundry-agent/*" -q
    if ($images) {
        $imageCount = ($images | Measure-Object).Count
        Write-Host "  Preserved $imageCount Docker image(s)" -ForegroundColor Gray
        Write-Host "`nTo clean Docker images next time:" -ForegroundColor Yellow
        Write-Host '  $env:CLEAN_DOCKER_IMAGES = "true"' -ForegroundColor White
        Write-Host "  azd down --force --purge" -ForegroundColor White
    }
}

# --- Check preserved artifacts ---

Write-Host "`nPreserved local development artifacts:" -ForegroundColor Cyan

$nodeModulesPath = Join-Path $PSScriptRoot ".." "frontend" "node_modules"
if (Test-Path $nodeModulesPath) {
    Write-Host "  [OK] frontend/node_modules (no need to reinstall)" -ForegroundColor Gray
}

# --- Success Message ---

Write-Host "`n=====================================" -ForegroundColor Green
Write-Host " Cleanup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host "`nWhat was cleaned:" -ForegroundColor White
Write-Host "  [OK] Azure resources (resource group)" -ForegroundColor Gray
Write-Host "  [OK] Entra app registration" -ForegroundColor Gray
Write-Host "  [OK] Local configuration files (.env.local, .env)" -ForegroundColor Gray
Write-Host "  [OK] azd environment folder (.azure/$envName)" -ForegroundColor Gray
Write-Host "`nWhat was preserved:" -ForegroundColor White
Write-Host "  [OK] Node modules (faster setup)" -ForegroundColor Gray
Write-Host "  [OK] Docker images (faster redeployment)" -ForegroundColor Gray
Write-Host "`nTo redeploy:" -ForegroundColor Yellow
Write-Host "  azd up" -ForegroundColor White
Write-Host "`n"
