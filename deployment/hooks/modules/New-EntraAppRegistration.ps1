#!/usr/bin/env pwsh

<#
.SYNOPSIS
Creates or updates an Entra ID app registration for AI Foundry Agent application.

.PARAMETER AppName
The display name for the app registration.

.PARAMETER TenantId
The Entra ID tenant ID.

.PARAMETER FrontendUrl
The frontend URL for SPA redirect URI.

.PARAMETER ServiceManagementReference
Optional property for organizations with custom app registration policies.
Set via environment variable: $env:ENTRA_SERVICE_MANAGEMENT_REFERENCE = "your-guid"
If your organization requires this field, the error message will indicate what's needed.
Contact your Entra ID administrator for the required value.

.LINK
https://learn.microsoft.com/en-us/powershell/module/microsoft.graph.applications/invoke-mginstantiateapplicationtemplate?view=graph-powershell-1.0#-servicemanagementreference

.LINK
https://learn.microsoft.com/en-us/graph/api/applicationtemplate-instantiate?view=graph-rest-1.0

.OUTPUTS
Returns the client ID of the created/updated app registration.
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$AppName,

    [Parameter(Mandatory=$true)]
    [string]$TenantId,

    [Parameter(Mandatory=$false)]
    [string]$FrontendUrl = "http://localhost:8080",

    [Parameter(Mandatory=$false)]
    [string]$ServiceManagementReference = $null
)

Write-Host "Checking for existing app registration: $AppName" -ForegroundColor Cyan

# Check if app already exists
$existingApp = az ad app list --display-name $AppName --query "[0]" | ConvertFrom-Json

if ($existingApp) {
    Write-Host "[OK] Found existing app registration: $($existingApp.appId)" -ForegroundColor Green
    $appId = $existingApp.appId
} else {
    Write-Host "Creating new app registration: $AppName" -ForegroundColor Yellow

    # Build app body based on whether serviceManagementReference is provided
    $appBody = @{
        displayName = $AppName
        signInAudience = "AzureADMyOrg"
    }

    # Add serviceManagementReference if provided (for organizations with custom policies)
    if (-not [string]::IsNullOrWhiteSpace($ServiceManagementReference)) {
        Write-Host "Using Service Management Reference: $ServiceManagementReference" -ForegroundColor Gray
        $appBody.serviceManagementReference = $ServiceManagementReference
    }

    $appBodyJson = $appBody | ConvertTo-Json

    # Save to temp file to avoid PowerShell quoting issues
    $tempFile = [System.IO.Path]::GetTempFileName()
    $appBodyJson | Out-File -FilePath $tempFile -Encoding utf8

    $createResult = az rest --method POST `
        --uri "https://graph.microsoft.com/v1.0/applications" `
        --headers "Content-Type=application/json" `
        --body "@$tempFile" `
        2>&1

    Remove-Item $tempFile -ErrorAction SilentlyContinue

    if ($LASTEXITCODE -ne 0) {
        $errorMessage = $createResult -join "`n"
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Red
        Write-Host "App Registration Failed" -ForegroundColor Red
        Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Red
        Write-Host ""
        Write-Host "ERROR: Failed to create Entra ID app registration." -ForegroundColor Red
        Write-Host ""
        Write-Host "Error from Microsoft Graph API:" -ForegroundColor Yellow
        Write-Host $errorMessage
        Write-Host ""
        Write-Host "Common Solutions:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "1. If your organization requires a Service Management Reference:" -ForegroundColor Cyan
        Write-Host "   • Contact your Entra ID administrator to get the required GUID" -ForegroundColor Gray
        Write-Host "   • Run azd up with the environment variable set:" -ForegroundColor Gray
        Write-Host "     `$env:ENTRA_SERVICE_MANAGEMENT_REFERENCE = '<guid>'; azd up" -ForegroundColor White
        Write-Host "   • Or set persistently: [Environment]::SetEnvironmentVariable('ENTRA_SERVICE_MANAGEMENT_REFERENCE', '<guid>', 'User')" -ForegroundColor Gray
        Write-Host ""
        Write-Host "2. If your organization has other custom policies:" -ForegroundColor Cyan
        Write-Host "   • Review the error message above for specific requirements" -ForegroundColor Gray
        Write-Host "   • Contact your Entra ID administrator" -ForegroundColor Gray
        Write-Host "   • You may need to manually create the app registration" -ForegroundColor Gray
        Write-Host ""
        Write-Host "For more details, see: deployment/hooks/README.md" -ForegroundColor Gray
        Write-Host ""
        throw "App registration creation failed"
    }

    $appJson = $createResult | ConvertFrom-Json
    $appId = $appJson.appId
    $objectId = $appJson.id

    if (-not $appId) {
        Write-Error "App registration created but client ID is empty"
        throw "Invalid app registration"
    }

    Write-Host "[OK] Created app registration: $appId" -ForegroundColor Green
}

# Get app object ID (needed for updates)
$app = az ad app show --id $appId | ConvertFrom-Json
$objectId = $app.id

Write-Host "Configuring app registration..." -ForegroundColor Cyan

# Configure SPA redirect URIs
# Default: 
#   - http://localhost:5173 (Vite dev server - native development with hot reload)
#   - http://localhost:8080 (Backend API - flexibility)
$redirectUris = @(
    "http://localhost:5173",
    "http://localhost:8080"
)

if ($FrontendUrl -and $FrontendUrl -ne "http://localhost:5173" -and $FrontendUrl -ne "http://localhost:8080") {
    $redirectUris += $FrontendUrl
}

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

Write-Host "[OK] Configured SPA redirect URIs" -ForegroundColor Green

# Set identifier URI and expose API scope
$identifierUri = "api://$appId"

# Check if scope already exists
$existingScope = $app.api.oauth2PermissionScopes | Where-Object { $_.value -eq "Chat.ReadWrite" }

if ($existingScope) {
    # Scope exists - just update identifier URI if needed
    Write-Host "[OK] API scope already exists: Chat.ReadWrite" -ForegroundColor Green
    
    if ($app.identifierUris -notcontains $identifierUri) {
        $apiBody = @{
            identifierUris = @($identifierUri)
        } | ConvertTo-Json -Depth 10

        $tempFile = [System.IO.Path]::GetTempFileName()
        $apiBody | Out-File -FilePath $tempFile -Encoding utf8

        az rest --method PATCH `
            --uri "https://graph.microsoft.com/v1.0/applications/$objectId" `
            --headers "Content-Type=application/json" `
            --body "@$tempFile" `
            2>&1 | Out-Null

        Remove-Item $tempFile -ErrorAction SilentlyContinue
        Write-Host "[OK] Set identifier URI: $identifierUri" -ForegroundColor Green
    } else {
        Write-Host "[OK] Identifier URI already set: $identifierUri" -ForegroundColor Green
    }
} else {
    # Create new scope
    $apiBody = @{
        identifierUris = @($identifierUri)
        api = @{
            oauth2PermissionScopes = @(
                @{
                    adminConsentDescription = "Allows the app to read and write chat messages on behalf of the signed-in user"
                    adminConsentDisplayName = "Read and write chat messages"
                    id = (New-Guid).Guid
                    isEnabled = $true
                    type = "User"
                    userConsentDescription = "Allows the app to read and write your chat messages"
                    userConsentDisplayName = "Read and write your chat messages"
                    value = "Chat.ReadWrite"
                }
            )
        }
    } | ConvertTo-Json -Depth 10

    $tempFile = [System.IO.Path]::GetTempFileName()
    $apiBody | Out-File -FilePath $tempFile -Encoding utf8

    az rest --method PATCH `
        --uri "https://graph.microsoft.com/v1.0/applications/$objectId" `
        --headers "Content-Type=application/json" `
        --body "@$tempFile" `
        2>&1 | Out-Null

    Remove-Item $tempFile -ErrorAction SilentlyContinue

    Write-Host "[OK] Set identifier URI: $identifierUri" -ForegroundColor Green
    Write-Host "[OK] Exposed API scope: Chat.ReadWrite" -ForegroundColor Green
}

Write-Host ""
Write-Host "App Registration Summary:" -ForegroundColor Cyan
Write-Host "  Display Name: $AppName" -ForegroundColor White
Write-Host "  Client ID: $appId" -ForegroundColor White
Write-Host "  Tenant ID: $TenantId" -ForegroundColor White
Write-Host "  Identifier URI: $identifierUri" -ForegroundColor White
Write-Host "  API Scope: api://$appId/Chat.ReadWrite" -ForegroundColor White
Write-Host ""

# Return client ID for azd environment
return $appId
