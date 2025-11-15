#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Get agents from an Azure AI Foundry project

.DESCRIPTION
    Uses the Azure AI Foundry REST API (v2025-11-15-preview) to enumerate agents in a project.
    Handles pagination automatically to retrieve all agents.

.PARAMETER ProjectEndpoint
    The Azure AI Foundry project endpoint (e.g., https://myresource.services.ai.azure.com/api/projects/myproject)

.PARAMETER AccessToken
    Optional. Bearer token for authentication. If not provided, will attempt to get token via Azure CLI.

.PARAMETER Quiet
    Suppress informational output. Only returns agent data or errors.

.OUTPUTS
    Array of agent objects with properties: name, id, versions, etc.

.EXAMPLE
    $agents = & "$PSScriptRoot\modules\Get-AIFoundryAgents.ps1" -ProjectEndpoint $endpoint
    
.EXAMPLE
    $agents = & "$PSScriptRoot\modules\Get-AIFoundryAgents.ps1" -ProjectEndpoint $endpoint -Quiet
    foreach ($agent in $agents) {
        Write-Host $agent.name
    }
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectEndpoint,
    
    [Parameter(Mandatory=$false)]
    [string]$AccessToken,
    
    [Parameter(Mandatory=$false)]
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

# Get access token if not provided
if ([string]::IsNullOrWhiteSpace($AccessToken)) {
    if (-not $Quiet) {
        Write-Host "Getting access token..." -ForegroundColor Cyan
    }
    
    $tokenData = az account get-access-token --resource 'https://ai.azure.com' 2>&1 | Out-String
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to get access token. Ensure you're logged in with 'az login'"
        exit 1
    }
    
    $AccessToken = ($tokenData | ConvertFrom-Json).accessToken
    
    if (-not $Quiet) {
        Write-Host "[OK] Authenticated" -ForegroundColor Green
    }
}

# List agents with pagination
if (-not $Quiet) {
    Write-Host "Discovering agents in project..." -ForegroundColor Cyan
}

$allAgents = @()
$afterCursor = $null
$hasMore = $true
$pageCount = 0

try {
    while ($hasMore) {
        $pageCount++
        $url = "$ProjectEndpoint/agents?api-version=2025-11-15-preview"
        if ($afterCursor) {
            $encodedCursor = [System.Web.HttpUtility]::UrlEncode($afterCursor)
            $url += "&after=$encodedCursor"
        }
        
        $response = curl --request GET --url $url `
            -H "Authorization: Bearer $AccessToken" `
            -H "Content-Type: application/json" `
            --silent --show-error 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "API request failed: $response"
            exit 1
        }
        
        $agentsData = ($response | ConvertFrom-Json)
        
        if ($agentsData.data) {
            $allAgents += $agentsData.data
        }
        
        # Check pagination
        $hasMore = $agentsData.has_more -eq $true
        $afterCursor = $agentsData.last_id
        
        if ($hasMore -and -not $Quiet) {
            Write-Host "  Fetching page $($pageCount + 1)..." -ForegroundColor Gray
        }
    }
    
    if (-not $Quiet) {
        if ($allAgents.Count -eq 0) {
            Write-Host "[!] No agents found in project" -ForegroundColor Yellow
        } else {
            Write-Host "[OK] Found $($allAgents.Count) agent(s)" -ForegroundColor Green
        }
    }
    
    # Return agents array
    return $allAgents
    
} catch {
    Write-Error "Failed to list agents: $_"
    exit 1
}
