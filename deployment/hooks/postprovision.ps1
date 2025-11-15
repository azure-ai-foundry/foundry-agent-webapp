#!/usr/bin/env pwsh

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Post-Provision: Build & Deploy Container" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get environment variables from azd
$envName = azd env get-value AZURE_ENV_NAME 2>$null
if (-not $envName) {
    # Fallback to environment variable for backward compatibility
    $envName = $env:AZURE_ENV_NAME
}

$clientId = azd env get-value ENTRA_SPA_CLIENT_ID 2>$null
if (-not $clientId) {
    $clientId = $env:ENTRA_SPA_CLIENT_ID
}

$tenantId = azd env get-value ENTRA_TENANT_ID 2>$null
if (-not $tenantId) {
    $tenantId = $env:ENTRA_TENANT_ID
}

$resourceGroup = azd env get-value AZURE_RESOURCE_GROUP_NAME 2>$null
$containerApp = azd env get-value AZURE_CONTAINER_APP_NAME 2>$null
$acrName = azd env get-value AZURE_CONTAINER_REGISTRY_NAME 2>$null

if (-not $envName) {
    Write-Error "AZURE_ENV_NAME not set"
    exit 1
}

if (-not $clientId) {
    Write-Error "ENTRA_SPA_CLIENT_ID not set. App registration may have failed."
    exit 1
}

if (-not $resourceGroup) {
    Write-Error "AZURE_RESOURCE_GROUP_NAME not set. Infrastructure may not be deployed."
    exit 1
}

Write-Host "Environment: $envName" -ForegroundColor Green
Write-Host "Client ID: $clientId" -ForegroundColor Green
Write-Host "Resource Group: $resourceGroup" -ForegroundColor Green
Write-Host ""

# Step 1: Get Container App URL
Write-Host "Step 1: Getting Container App URL..." -ForegroundColor Cyan

$containerAppUrl = azd env get-value WEB_ENDPOINT 2>$null
if (-not $containerAppUrl) {
    $containerAppUrl = $env:WEB_ENDPOINT
}

if (-not $containerAppUrl) {
    Write-Error "WEB_ENDPOINT not set"
    exit 1
}

Write-Host "[OK] Container App URL: $containerAppUrl" -ForegroundColor Green
Write-Host ""

# Step 2: Update Entra App Registration with redirect URI
Write-Host "Step 2: Updating Entra App Registration redirect URIs..." -ForegroundColor Cyan

$app = az ad app show --id $clientId | ConvertFrom-Json
$objectId = $app.id

# Build redirect URIs array including localhost and deployed URL
$redirectUris = @(
    "http://localhost:8080",     # Local Docker Compose (production-identical)
    "http://localhost:5173",     # Local Vite dev server (hot reload)
    $containerAppUrl              # Azure Container App (production)
)

# Update SPA configuration using Microsoft Graph API
$spaBody = @{
    spa = @{
        redirectUris = $redirectUris
    }
} | ConvertTo-Json -Depth 10

$tempFile = [System.IO.Path]::GetTempFileName()
$spaBody | Out-File -FilePath $tempFile -Encoding utf8

az rest --method PATCH `
    --uri "https://graph.microsoft.com/v1.0/applications/$objectId" `
    --headers "Content-Type=application/json" `
    --body "@$tempFile" `
    | Out-Null

Remove-Item $tempFile -ErrorAction SilentlyContinue

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to update Entra app registration"
    exit 1
}

Write-Host "[OK] Updated redirect URIs:" -ForegroundColor Green
foreach ($uri in $redirectUris) {
    Write-Host "  - $uri" -ForegroundColor White
}
Write-Host ""

# Step 3: Build and deploy container using shared module
$scriptPath = Join-Path (Split-Path $PSScriptRoot -Parent) "scripts\build-and-deploy-container.ps1"

try {
    # Don't overwrite $containerAppUrl - it's already set from WEB_ENDPOINT
    & $scriptPath `
        -ClientId $clientId `
        -TenantId $tenantId `
        -ResourceGroup $resourceGroup `
        -ContainerApp $containerApp `
        -AcrName $acrName | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Container deployment failed"
        exit 1
    }
}
catch {
    Write-Error "Container deployment failed: $_"
    exit 1
}

# Step 4: Verify deployment
Write-Host "Step 4: Verifying deployment..." -ForegroundColor Cyan

$response = Invoke-WebRequest -Uri "$containerAppUrl" -Method Get -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue

if ($response -and $response.StatusCode -eq 200) {
    Write-Host "[OK] Application responded successfully" -ForegroundColor Green
} elseif ($response) {
    Write-Warning "Application responded with status: $($response.StatusCode)"
} else {
    Write-Warning "Application request failed - no response received"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Post-Provision Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Application URL: $containerAppUrl" -ForegroundColor Cyan
Write-Host "Client ID: $clientId" -ForegroundColor Cyan
Write-Host ""

# Step 5: Open browser to ACA URL
Write-Host "Step 5: Opening browser to deployed application..." -ForegroundColor Cyan

if ($containerAppUrl) {
    try {
        Start-Process $containerAppUrl
        Write-Host "[OK] Browser opened to: $containerAppUrl" -ForegroundColor Green
    }
    catch {
        Write-Host "[!] Could not open browser automatically" -ForegroundColor Yellow
        Write-Host "  Open manually: $containerAppUrl" -ForegroundColor Gray
    }
}
else {
    Write-Host "[!] Container App URL not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host " Deployment Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Production URL: " -NoNewline -ForegroundColor Cyan
Write-Host "$containerAppUrl" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  • Test production: $containerAppUrl" -ForegroundColor Gray
Write-Host "  • Start local dev: .\deployment\scripts\start-local-dev.ps1" -ForegroundColor Gray
Write-Host "  • Deploy updates: .\deployment\scripts\deploy.ps1" -ForegroundColor Gray
Write-Host "  • View logs: az containerapp logs show -n $containerApp -g $resourceGroup --follow" -ForegroundColor Gray
Write-Host ""
