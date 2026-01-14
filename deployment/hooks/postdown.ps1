#!/usr/bin/env pwsh
# Post-down: Cleanup Entra app, role assignments, and local config after azd down

$ErrorActionPreference = "Continue"

Write-Host "Post-Down Cleanup" -ForegroundColor Cyan

$envName = $env:AZURE_ENV_NAME

# Remove role assignment from AI Foundry resource (if it exists)
$webIdentityPrincipalId = azd env get-value WEB_IDENTITY_PRINCIPAL_ID 2>$null
$aiFoundryResourceGroup = azd env get-value AI_FOUNDRY_RESOURCE_GROUP 2>$null
$aiFoundryResourceName = azd env get-value AI_FOUNDRY_RESOURCE_NAME 2>$null
$subscriptionId = azd env get-value AZURE_SUBSCRIPTION_ID 2>$null

if ($webIdentityPrincipalId -and $aiFoundryResourceGroup -and $aiFoundryResourceName -and $subscriptionId) {
    Write-Host "Removing role assignment from AI Foundry resource..." -ForegroundColor Yellow
    
    $scope = "/subscriptions/$subscriptionId/resourceGroups/$aiFoundryResourceGroup/providers/Microsoft.CognitiveServices/accounts/$aiFoundryResourceName"
    
    az role assignment delete `
        --assignee $webIdentityPrincipalId `
        --role "Cognitive Services User" `
        --scope $scope 2>&1 | Out-Null
    
    Write-Host "[OK] Role assignment removed (if it existed)" -ForegroundColor Green
}

# Delete Entra app
if ($envName) {
    $clientId = azd env get-value ENTRA_SPA_CLIENT_ID 2>$null
    if ($clientId) {
        az ad app delete --id $clientId 2>&1 | Out-Null
        Write-Host "[OK] Entra app deleted: $clientId" -ForegroundColor Green
    }
}

# Delete local config files
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
@(
    "frontend/.env.local",
    "backend/WebApp.Api/.env"
) | ForEach-Object {
    $path = Join-Path $projectRoot $_
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "[OK] Deleted $_" -ForegroundColor Green
    }
}

# Delete azd environment folder
if ($envName) {
    $envFolder = Join-Path $projectRoot ".azure" $envName
    if (Test-Path $envFolder) {
        Remove-Item $envFolder -Recurse -Force
        Write-Host "[OK] Deleted .azure/$envName" -ForegroundColor Green
    }
}

# Optional Docker cleanup
if ($env:CLEAN_DOCKER_IMAGES -eq "true" -and (Get-Command docker -EA SilentlyContinue)) {
    docker images --filter "reference=*azurecr.io/web:*" -q | ForEach-Object { docker rmi $_ -f 2>$null }
    Write-Host "[OK] Docker images cleaned" -ForegroundColor Green
}

Write-Host "[OK] Cleanup complete. Run 'azd up' to redeploy." -ForegroundColor Green
