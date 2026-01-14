#!/usr/bin/env pwsh
# Creates or updates an Entra ID app registration for AI Foundry Agent application
# Returns: Client ID of the created/updated app

param(
    [Parameter(Mandatory=$true)][string]$AppName,
    [Parameter(Mandatory=$true)][string]$TenantId,
    [string]$FrontendUrl = "http://localhost:8080",
    [string]$ServiceManagementReference = $null
)

$ErrorActionPreference = 'Stop'

# Check for existing app
$existingApp = az ad app list --display-name $AppName --query "[0]" | ConvertFrom-Json

if ($existingApp) {
    Write-Host "[OK] Found existing app: $($existingApp.appId)" -ForegroundColor Green
    $appId = $existingApp.appId
} else {
    Write-Host "Creating app registration: $AppName" -ForegroundColor Cyan
    
    $appBody = @{ displayName = $AppName; signInAudience = "AzureADMyOrg" }
    if (-not [string]::IsNullOrWhiteSpace($ServiceManagementReference)) {
        $appBody.serviceManagementReference = $ServiceManagementReference
    }
    
    $tempFile = [System.IO.Path]::GetTempFileName()
    ($appBody | ConvertTo-Json) | Out-File -FilePath $tempFile -Encoding utf8
    
    $result = az rest --method POST --uri "https://graph.microsoft.com/v1.0/applications" `
        --headers "Content-Type=application/json" --body "@$tempFile" 2>&1
    Remove-Item $tempFile -EA SilentlyContinue
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] App registration failed" -ForegroundColor Red
        Write-Host $result -ForegroundColor Gray
        Write-Host ""
        Write-Host "If your org requires serviceManagementReference:" -ForegroundColor Yellow
        Write-Host "  azd env set ENTRA_SERVICE_MANAGEMENT_REFERENCE '<guid-from-admin>'" -ForegroundColor White
        Write-Host "  azd up" -ForegroundColor White
        throw "App registration creation failed"
    }
    
    $appId = ($result | ConvertFrom-Json).appId
    Write-Host "[OK] Created: $appId" -ForegroundColor Green
}

# Get object ID for updates
$app = az ad app show --id $appId | ConvertFrom-Json
$objectId = $app.id

# Configure SPA redirect URIs
$redirectUris = @("http://localhost:5173", "http://localhost:8080")
if ($FrontendUrl -and $FrontendUrl -notin $redirectUris) { $redirectUris += $FrontendUrl }

$tempFile = [System.IO.Path]::GetTempFileName()
(@{ spa = @{ redirectUris = $redirectUris } } | ConvertTo-Json -Depth 10) | Out-File -FilePath $tempFile -Encoding utf8
az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/$objectId" `
    --headers "Content-Type=application/json" --body "@$tempFile" | Out-Null
Remove-Item $tempFile -EA SilentlyContinue
if ($LASTEXITCODE -ne 0) { throw "Failed to update redirect URIs" }

# Set identifier URI and API scope
$identifierUri = "api://$appId"
$existingScope = $app.api.oauth2PermissionScopes | Where-Object { $_.value -eq "Chat.ReadWrite" }

# Ensure identifierUri is set even if scope exists
if ($app.identifierUris -notcontains $identifierUri) {
    $tempFile = [System.IO.Path]::GetTempFileName()
    (@{ identifierUris = @($identifierUri) } | ConvertTo-Json -Depth 10) | Out-File -FilePath $tempFile -Encoding utf8
    az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/$objectId" `
        --headers "Content-Type=application/json" --body "@$tempFile" 2>&1 | Out-Null
    Remove-Item $tempFile -EA SilentlyContinue
}

if (-not $existingScope) {
    $apiBody = @{
        identifierUris = @($identifierUri)
        api = @{
            oauth2PermissionScopes = @(@{
                adminConsentDescription = "Allows the app to read and write chat messages"
                adminConsentDisplayName = "Read and write chat messages"
                id = (New-Guid).Guid
                isEnabled = $true
                type = "User"
                userConsentDescription = "Allows the app to read and write your chat messages"
                userConsentDisplayName = "Read and write your chat messages"
                value = "Chat.ReadWrite"
            })
        }
    }
    $tempFile = [System.IO.Path]::GetTempFileName()
    ($apiBody | ConvertTo-Json -Depth 10) | Out-File -FilePath $tempFile -Encoding utf8
    az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/$objectId" `
        --headers "Content-Type=application/json" --body "@$tempFile" 2>&1 | Out-Null
    Remove-Item $tempFile -EA SilentlyContinue
    if ($LASTEXITCODE -ne 0) { throw "Failed to configure API scope" }
    Write-Host "[OK] Exposed API scope: Chat.ReadWrite" -ForegroundColor Green
}

Write-Host "[OK] App configured: $appId" -ForegroundColor Green
return $appId
