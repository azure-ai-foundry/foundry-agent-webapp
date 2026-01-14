#!/usr/bin/env pwsh
# Validates local development configuration files

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$validationErrors = [System.Collections.ArrayList]::new()

function Test-EnvVar {
    param([string]$content, [string]$name, [string]$file)
    $pattern = "$name=(\S+)"
    if ($content -match $pattern -and $matches[1] -notmatch "PLACEHOLDER") {
        Write-Host ("  OK: " + $name) -ForegroundColor Green
        return $true
    } else {
        Write-Host ("  ERROR: " + $name) -ForegroundColor Red
        return $false
    }
}

# Frontend
Write-Host "Frontend config:" -ForegroundColor Cyan
$frontendEnv = Join-Path $projectRoot "frontend/.env.local"
if (Test-Path $frontendEnv) {
    $content = Get-Content $frontendEnv -Raw
    if (-not (Test-EnvVar $content "VITE_ENTRA_SPA_CLIENT_ID" "frontend/.env.local")) { $null = $validationErrors.Add("VITE_ENTRA_SPA_CLIENT_ID") }
    if (-not (Test-EnvVar $content "VITE_ENTRA_TENANT_ID" "frontend/.env.local")) { $null = $validationErrors.Add("VITE_ENTRA_TENANT_ID") }
} else {
    $null = $validationErrors.Add("frontend/.env.local not found")
    Write-Host "  [ERROR] File not found" -ForegroundColor Red
}

# Backend
Write-Host "Backend config:" -ForegroundColor Cyan
$backendEnv = Join-Path $projectRoot "backend/WebApp.Api/.env"
if (Test-Path $backendEnv) {
    $content = Get-Content $backendEnv -Raw
    if (-not (Test-EnvVar $content "AzureAd__TenantId" "backend/.env")) { $null = $validationErrors.Add("AzureAd__TenantId") }
    if (-not (Test-EnvVar $content "AzureAd__ClientId" "backend/.env")) { $null = $validationErrors.Add("AzureAd__ClientId") }
} else {
    $null = $validationErrors.Add("backend/.env not found")
    Write-Host "  [ERROR] File not found" -ForegroundColor Red
}

if ($validationErrors.Count -gt 0) {
    Write-Host "`n[ERROR] Validation failed. Run 'azd up' to fix." -ForegroundColor Red
    exit 1
}

Write-Host "`n[OK] Configuration valid" -ForegroundColor Green
exit 0
