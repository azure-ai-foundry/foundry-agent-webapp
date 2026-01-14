#!/usr/bin/env pwsh
# List agents in an Azure AI Foundry project

param([string]$ProjectEndpoint)

# Get endpoint from param, env, or azd
if ([string]::IsNullOrWhiteSpace($ProjectEndpoint)) { $ProjectEndpoint = $env:AI_AGENT_ENDPOINT }
if ([string]::IsNullOrWhiteSpace($ProjectEndpoint)) {
    $ProjectEndpoint = (azd env get-value AI_AGENT_ENDPOINT 2>&1) | Where-Object { $_ -notmatch 'ERROR' } | Select-Object -First 1
}
if ([string]::IsNullOrWhiteSpace($ProjectEndpoint)) {
    Write-Host "[ERROR] No endpoint. Run: azd env set AI_AGENT_ENDPOINT <url>" -ForegroundColor Red
    exit 1
}

Write-Host "Endpoint: $ProjectEndpoint" -ForegroundColor Cyan

try {
    $agents = & "$PSScriptRoot\..\hooks\modules\Get-AIFoundryAgents.ps1" -ProjectEndpoint $ProjectEndpoint -Quiet
    
    if ($agents.Count -eq 0) {
        Write-Host "No agents found. Create one at https://ai.azure.com" -ForegroundColor Yellow
        exit 0
    }
    
    $agents | ForEach-Object {
        [PSCustomObject]@{
            Name = $_.name
            ID = $_.id
            Model = $_.versions.latest.definition.model
        }
    } | Format-Table -AutoSize
    
    Write-Host "To use: azd env set AI_AGENT_ID <name>" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] $_" -ForegroundColor Red
    exit 1
}
