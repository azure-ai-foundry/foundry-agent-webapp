#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Validates local development configuration files

.DESCRIPTION
    Checks that frontend/.env.local and backend/WebApp.Api/.env
    exist and contain valid (non-placeholder) configuration values.
    
    Returns exit code 0 on success, 1 on failure.

.EXAMPLE
    .\scripts\validate-config.ps1
#>

$ErrorActionPreference = "Stop"

$validationErrors = @()
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

# --- Helper Functions ---

function Write-ValidationError {
    param([string]$Message)
    Write-Host "  [ERROR] $Message" -ForegroundColor Red
}

function Write-ValidationSuccess {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

# --- Check Frontend Configuration ---

Write-Host "`nValidating frontend configuration..." -ForegroundColor Cyan

$frontendEnv = Join-Path $projectRoot "frontend" ".env.local"
if (-not (Test-Path $frontendEnv)) {
    $validationErrors += "Missing: frontend/.env.local"
    Write-ValidationError "frontend/.env.local not found"
} else {
    $content = Get-Content $frontendEnv -Raw
    
    # Check VITE_ENTRA_SPA_CLIENT_ID
    if ($content -match "VITE_ENTRA_SPA_CLIENT_ID=(\S+)") {
        $clientId = $matches[1]
        if ([string]::IsNullOrWhiteSpace($clientId) -or $clientId -match "PLACEHOLDER") {
            $validationErrors += "frontend/.env.local has invalid VITE_ENTRA_SPA_CLIENT_ID"
            Write-ValidationError "VITE_ENTRA_SPA_CLIENT_ID is invalid or placeholder"
        } else {
            Write-ValidationSuccess "VITE_ENTRA_SPA_CLIENT_ID is valid"
        }
    } else {
        $validationErrors += "frontend/.env.local missing VITE_ENTRA_SPA_CLIENT_ID"
        Write-ValidationError "VITE_ENTRA_SPA_CLIENT_ID not found"
    }
    
    # Check VITE_ENTRA_TENANT_ID
    if ($content -match "VITE_ENTRA_TENANT_ID=(\S+)") {
        $tenantId = $matches[1]
        if ([string]::IsNullOrWhiteSpace($tenantId) -or $tenantId -match "PLACEHOLDER") {
            $validationErrors += "frontend/.env.local has invalid VITE_ENTRA_TENANT_ID"
            Write-ValidationError "VITE_ENTRA_TENANT_ID is invalid or placeholder"
        } else {
            Write-ValidationSuccess "VITE_ENTRA_TENANT_ID is valid"
        }
    } else {
        $validationErrors += "frontend/.env.local missing VITE_ENTRA_TENANT_ID"
        Write-ValidationError "VITE_ENTRA_TENANT_ID not found"
    }
}

# --- Check Backend Configuration ---

Write-Host "`nValidating backend configuration..." -ForegroundColor Cyan

$backendEnv = Join-Path $projectRoot "backend" "WebApp.Api" ".env"
if (-not (Test-Path $backendEnv)) {
    $validationErrors += "Missing: backend/WebApp.Api/.env"
    Write-ValidationError "backend/WebApp.Api/.env not found"
} else {
    $content = Get-Content $backendEnv -Raw
    
    # Check AzureAd__TenantId (double underscore is .NET environment variable format for nested config)
    if ($content -match "AzureAd__TenantId=(\S+)") {
        $tenantId = $matches[1]
        if ([string]::IsNullOrWhiteSpace($tenantId) -or $tenantId -match "PLACEHOLDER") {
            $validationErrors += "backend/WebApp.Api/.env has invalid AzureAd__TenantId"
            Write-ValidationError "AzureAd__TenantId is invalid or placeholder"
        } else {
            Write-ValidationSuccess "AzureAd__TenantId is valid"
        }
    } else {
        $validationErrors += "backend/WebApp.Api/.env missing AzureAd__TenantId"
        Write-ValidationError "AzureAd__TenantId not found"
    }
    
    # Check AzureAd__ClientId
    if ($content -match "AzureAd__ClientId=(\S+)") {
        $clientId = $matches[1]
        if ([string]::IsNullOrWhiteSpace($clientId) -or $clientId -match "PLACEHOLDER") {
            $validationErrors += "backend/WebApp.Api/.env has invalid AzureAd__ClientId"
            Write-ValidationError "AzureAd__ClientId is invalid or placeholder"
        } else {
            Write-ValidationSuccess "AzureAd__ClientId is valid"
        }
    } else {
        $validationErrors += "backend/WebApp.Api/.env missing AzureAd__ClientId"
        Write-ValidationError "AzureAd__ClientId not found"
    }
}

# --- Report Results ---

Write-Host ""
if ($validationErrors.Count -gt 0) {
    Write-Host "❌ Configuration Validation Failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Errors found:" -ForegroundColor Yellow
    foreach ($validationError in $validationErrors) {
        Write-Host "  • $validationError" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "To fix this, run:" -ForegroundColor Yellow
    Write-Host "  azd up" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "✅ Configuration validated successfully" -ForegroundColor Green
Write-Host ""
exit 0
