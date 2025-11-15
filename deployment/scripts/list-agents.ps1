#!/usr/bin/env pwsh
<#
.SYNOPSIS
    List agents in an Azure AI Foundry project

.DESCRIPTION
    Uses the Azure AI Foundry REST API (v2025-11-15-preview) to enumerate agents in a project.
    Handles pagination automatically to list all agents.

.PARAMETER ProjectEndpoint
    The Azure AI Foundry project endpoint (e.g., https://myresource.services.ai.azure.com/api/projects/myproject)

.EXAMPLE
    .\list-agents.ps1

.EXAMPLE
    .\list-agents.ps1 -ProjectEndpoint "https://v2agents-resource.services.ai.azure.com/api/projects/v2agents"
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectEndpoint
)

# Get endpoint from parameter, environment, or azd
if ([string]::IsNullOrWhiteSpace($ProjectEndpoint)) {
    $ProjectEndpoint = $env:AI_AGENT_ENDPOINT
}

if ([string]::IsNullOrWhiteSpace($ProjectEndpoint)) {
    $ProjectEndpoint = (azd env get-value AI_AGENT_ENDPOINT 2>&1) | Where-Object { $_ -notmatch 'ERROR|WARNING' } | Select-Object -First 1
}

if ([string]::IsNullOrWhiteSpace($ProjectEndpoint)) {
    Write-Error @"
Project endpoint not found. Provide via:
  - Parameter: .\list-agents.ps1 -ProjectEndpoint <endpoint>
  - Environment: Set AI_AGENT_ENDPOINT environment variable
  - Azure Developer CLI: azd env set AI_AGENT_ENDPOINT <endpoint>
"@
    exit 1
}

Write-Host "Project Endpoint: $ProjectEndpoint" -ForegroundColor Cyan
Write-Host ""

# Call the module to get agents
try {
    $allAgents = & "$PSScriptRoot\..\hooks\modules\Get-AIFoundryAgents.ps1" -ProjectEndpoint $ProjectEndpoint
    
    if ($allAgents.Count -eq 0) {
        Write-Host "No agents found in project" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "To create an agent:" -ForegroundColor Cyan
        Write-Host "  1. Visit https://ai.azure.com" -ForegroundColor Gray
        Write-Host "  2. Open your project" -ForegroundColor Gray
        Write-Host "  3. Navigate to 'Agents' and create a new agent" -ForegroundColor Gray
        exit 0
    }
    
    Write-Host ""
    Write-Host "Found $($allAgents.Count) agent(s):" -ForegroundColor Green
    Write-Host ""
    foreach ($agent in $allAgents) {
        Write-Host "  Name:    $($agent.name)" -ForegroundColor White
        Write-Host "  ID:      $($agent.id)" -ForegroundColor Gray
        
        if ($agent.versions -and $agent.versions.latest) {
            $latest = $agent.versions.latest
            if ($latest.definition.kind) {
                Write-Host "  Type:    $($latest.definition.kind)" -ForegroundColor Gray
            }
            if ($latest.definition.model) {
                Write-Host "  Model:   $($latest.definition.model)" -ForegroundColor Gray
            }
            if ($latest.version) {
                Write-Host "  Version: $($latest.version)" -ForegroundColor Gray
            }
            if ($latest.metadata.description) {
                Write-Host "  Desc:    $($latest.metadata.description)" -ForegroundColor Gray
            }
        }
        
        Write-Host ""
    }
    
    Write-Host "To use an agent:" -ForegroundColor Cyan
    Write-Host "  azd env set AI_AGENT_ID <agent-name>" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Error "Failed to list agents: $_"
    Write-Host ""
    Write-Host "Error details:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}
