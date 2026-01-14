#!/usr/bin/env pwsh
# Get agents from an Azure AI Foundry project (handles pagination)
# Returns: Array of agent objects with properties: name, id, versions, etc.

param(
    [Parameter(Mandatory=$true)][string]$ProjectEndpoint,
    [string]$AccessToken,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

# Get access token if not provided
if ([string]::IsNullOrWhiteSpace($AccessToken)) {
    $tokenData = az account get-access-token --resource 'https://ai.azure.com' 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw "Failed to get access token" }
    $AccessToken = ($tokenData | ConvertFrom-Json).accessToken
}

# List agents with pagination
$allAgents = @()
$afterCursor = $null
$hasMore = $true

while ($hasMore) {
    $url = "$ProjectEndpoint/agents?api-version=2025-11-15-preview"
    if ($afterCursor) {
        $url += "&after=$([System.Web.HttpUtility]::UrlEncode($afterCursor))"
    }
    
    try {
        $response = Invoke-RestMethod -Uri $url -Headers @{ Authorization = "Bearer $AccessToken" }
    } catch {
        throw "API request failed: $_"
    }
    
    if ($response.data) { $allAgents += $response.data }
    $hasMore = $response.has_more -eq $true
    $afterCursor = $response.last_id
}

if (-not $Quiet) {
    $count = $allAgents.Count
    if ($count -eq 0) { Write-Host "[!] No agents found" -ForegroundColor Yellow }
    else { Write-Host "[OK] Found $count agent(s)" -ForegroundColor Green }
}

return $allAgents
