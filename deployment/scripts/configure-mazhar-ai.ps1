#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Quick configuration script for connecting to Mazhar-ai agent

.DESCRIPTION
    This script configures the Azure Developer CLI environment to connect
    to the Mazhar-ai agent on Microsoft Azure AI Foundry.

.PARAMETER AgentName
    The name of the agent in Azure AI Foundry (default: "Mazhar-ai")

.PARAMETER ResourceGroup
    Optional: Specify the Azure AI Foundry resource group

.PARAMETER ResourceName
    Optional: Specify the Azure AI Foundry resource name

.EXAMPLE
    .\configure-mazhar-ai.ps1
    # Uses default agent name "Mazhar-ai"

.EXAMPLE
    .\configure-mazhar-ai.ps1 -AgentName "mazhar-ai"
    # Uses custom agent name

.EXAMPLE
    .\configure-mazhar-ai.ps1 -ResourceGroup "rg-aifoundry" -ResourceName "aifoundry-prod"
    # Specifies specific Azure AI Foundry resource
#>

param(
    [string]$AgentName = "Mazhar-ai",
    [string]$ResourceGroup = "",
    [string]$ResourceName = ""
)

$ErrorActionPreference = "Stop"

Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Mazhar-ai Agent Configuration                        ║" -ForegroundColor Cyan
Write-Host "║         The Calm Architect                                   ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if azd is installed
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
if (-not (Get-Command azd -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Azure Developer CLI (azd) is not installed." -ForegroundColor Red
    Write-Host "   Install from: https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Azure Developer CLI found" -ForegroundColor Green

# Set the agent ID
Write-Host ""
Write-Host "Configuring agent connection..." -ForegroundColor Yellow
Write-Host "   Agent Name: $AgentName" -ForegroundColor Cyan

try {
    azd env set AI_AGENT_ID $AgentName
    Write-Host "✅ AI_AGENT_ID set to: $AgentName" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to set AI_AGENT_ID" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    exit 1
}

# Optional: Set resource group and name if provided
if ($ResourceGroup -and $ResourceName) {
    Write-Host ""
    Write-Host "Configuring Azure AI Foundry resource..." -ForegroundColor Yellow
    Write-Host "   Resource Group: $ResourceGroup" -ForegroundColor Cyan
    Write-Host "   Resource Name: $ResourceName" -ForegroundColor Cyan

    try {
        azd env set AI_FOUNDRY_RESOURCE_GROUP $ResourceGroup
        azd env set AI_FOUNDRY_RESOURCE_NAME $ResourceName
        Write-Host "✅ Azure AI Foundry resource configured" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to set Azure AI Foundry resource" -ForegroundColor Red
        Write-Host "   Error: $_" -ForegroundColor Red
        exit 1
    }
}

# Display current configuration
Write-Host ""
Write-Host "Current Environment Configuration:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
try {
    $envVars = azd env get-values | Out-String
    $envVars -split "`n" | Where-Object { $_ -match "AI_" } | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Cyan
    }
} catch {
    Write-Host "   (Environment not yet initialized)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ Configuration Complete                                   ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""
Write-Host "1. Ensure your Mazhar-ai agent exists in Azure AI Foundry" -ForegroundColor White
Write-Host "   → Go to: https://ai.azure.com" -ForegroundColor DarkGray
Write-Host "   → Create/edit agent named: '$AgentName'" -ForegroundColor DarkGray
Write-Host "   → Copy system instructions from: docs/mazhar-ai-system-instructions.md" -ForegroundColor DarkGray
Write-Host ""
Write-Host "2. Provision Azure resources" -ForegroundColor White
Write-Host "   → Run: azd provision" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Deploy the application" -ForegroundColor White
Write-Host "   → Run: azd deploy" -ForegroundColor Cyan
Write-Host ""
Write-Host "For detailed instructions, see: docs/MAZHAR_AI_SETUP.md" -ForegroundColor Yellow
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Move with clarity. Respond with restraint. Create with service." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
