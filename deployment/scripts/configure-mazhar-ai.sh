#!/bin/bash
# Quick configuration script for connecting to Mazhar-ai agent
#
# Usage:
#   ./configure-mazhar-ai.sh [agent-name] [resource-group] [resource-name]
#
# Examples:
#   ./configure-mazhar-ai.sh
#   ./configure-mazhar-ai.sh "mazhar-ai"
#   ./configure-mazhar-ai.sh "Mazhar-ai" "rg-aifoundry" "aifoundry-prod"

set -e

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Parameters
AGENT_NAME="${1:-Mazhar-ai}"
RESOURCE_GROUP="${2:-}"
RESOURCE_NAME="${3:-}"

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         Mazhar-ai Agent Configuration                        ║${NC}"
echo -e "${CYAN}║         The Calm Architect                                   ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if azd is installed
echo -e "${YELLOW}Checking prerequisites...${NC}"
if ! command -v azd &> /dev/null; then
    echo -e "${RED}❌ Azure Developer CLI (azd) is not installed.${NC}"
    echo -e "${RED}   Install from: https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Azure Developer CLI found${NC}"

# Set the agent ID
echo ""
echo -e "${YELLOW}Configuring agent connection...${NC}"
echo -e "${CYAN}   Agent Name: $AGENT_NAME${NC}"

if azd env set AI_AGENT_ID "$AGENT_NAME"; then
    echo -e "${GREEN}✅ AI_AGENT_ID set to: $AGENT_NAME${NC}"
else
    echo -e "${RED}❌ Failed to set AI_AGENT_ID${NC}"
    exit 1
fi

# Optional: Set resource group and name if provided
if [ -n "$RESOURCE_GROUP" ] && [ -n "$RESOURCE_NAME" ]; then
    echo ""
    echo -e "${YELLOW}Configuring Azure AI Foundry resource...${NC}"
    echo -e "${CYAN}   Resource Group: $RESOURCE_GROUP${NC}"
    echo -e "${CYAN}   Resource Name: $RESOURCE_NAME${NC}"

    if azd env set AI_FOUNDRY_RESOURCE_GROUP "$RESOURCE_GROUP" && \
       azd env set AI_FOUNDRY_RESOURCE_NAME "$RESOURCE_NAME"; then
        echo -e "${GREEN}✅ Azure AI Foundry resource configured${NC}"
    else
        echo -e "${RED}❌ Failed to set Azure AI Foundry resource${NC}"
        exit 1
    fi
fi

# Display current configuration
echo ""
echo -e "${YELLOW}Current Environment Configuration:${NC}"
echo -e "${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if azd env get-values 2>/dev/null | grep "AI_" | while read -r line; do
    echo -e "${CYAN}   $line${NC}"
done; then
    :
else
    echo -e "${GRAY}   (Environment not yet initialized)${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Configuration Complete                                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo -e "${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${WHITE}1. Ensure your Mazhar-ai agent exists in Azure AI Foundry${NC}"
echo -e "${GRAY}   → Go to: https://ai.azure.com${NC}"
echo -e "${GRAY}   → Create/edit agent named: '$AGENT_NAME'${NC}"
echo -e "${GRAY}   → Copy system instructions from: docs/mazhar-ai-system-instructions.md${NC}"
echo ""
echo -e "${WHITE}2. Provision Azure resources${NC}"
echo -e "${CYAN}   → Run: azd provision${NC}"
echo ""
echo -e "${WHITE}3. Deploy the application${NC}"
echo -e "${CYAN}   → Run: azd deploy${NC}"
echo ""
echo -e "${YELLOW}For detailed instructions, see: docs/MAZHAR_AI_SETUP.md${NC}"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}Move with clarity. Respond with restraint. Create with service.${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
