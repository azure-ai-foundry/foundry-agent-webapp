# Connecting Repository to Mazhar-ai Agent
## Setup Guide for Professor Mansoor's AI Agent

This guide will walk you through connecting this repository to your **Mazhar-ai** agent on Microsoft Azure AI Foundry.

---

## Prerequisites

Before you begin, ensure you have:

✅ Azure subscription with access to Azure AI Foundry
✅ Azure Developer CLI (`azd`) installed ([Install guide](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd))
✅ Azure CLI (`az`) installed and logged in
✅ Node.js 18+ and .NET 9 SDK installed
✅ An Azure AI Foundry agent named **Mazhar-ai** (or ready to create it)

---

## Step 1: Configure Your Mazhar-ai Agent in Azure AI Foundry

### 1.1 Navigate to Azure AI Foundry

1. Go to [https://ai.azure.com](https://ai.azure.com)
2. Sign in with your Azure account
3. Select your AI Foundry resource (or create one)
4. Open your project (or create one)

### 1.2 Create/Edit the Mazhar-ai Agent

1. In your project, navigate to **Agents** in the left sidebar
2. Click **Create agent** (or edit if Mazhar-ai already exists)
3. Configure the agent:
   - **Name**: `Mazhar-ai` (or `mazhar-ai`, note the exact name)
   - **Description**: "The Calm Architect - AI embodiment of strategic clarity and disciplined depth"
   - **Model**: `gpt-4` or `gpt-4o` (recommended for depth) or `gpt-4o-mini` (for speed)

### 1.3 Set the System Instructions (The Soul)

Copy the entire contents from `/home/user/foundry-agent-webapp/docs/mazhar-ai-system-instructions.md` into the **Instructions** field.

This includes:
- Core identity as "The Calm Architect"
- Communication style (precision, restraint, clarity)
- Areas of expertise
- Operating principles
- How to engage with users

### 1.4 Optional: Add Custom Metadata

In the **Metadata** section, add:
```
logo: [URL to a logo image if you have one]
theme_color: #0078d4
version: 2026-vision-v1
```

### 1.5 Save the Agent

Click **Save** to create/update your agent. Azure AI Foundry will create a new version.

**Important**: Note the exact agent name/ID (e.g., `Mazhar-ai` or `mazhar-ai`)

---

## Step 2: Connect Repository to Mazhar-ai

### 2.1 Login to Azure Developer CLI

```bash
azd auth login
```

This will open a browser for authentication.

### 2.2 Initialize the Project

From the repository root:

```bash
# Initialize azd in this directory
azd init

# When prompted:
# - Environment name: choose a name like "mazhar-ai-dev" or "prod"
# - Subscription: select your Azure subscription
# - Location: choose a region (e.g., "eastus", "westus2")
```

### 2.3 Configure the Agent Connection

Set the agent ID to point to your Mazhar-ai agent:

```bash
# Set the agent ID (use exact name from Azure AI Foundry)
azd env set AI_AGENT_ID Mazhar-ai

# Optional: If you have multiple AI Foundry resources, specify which one:
# azd env set AI_FOUNDRY_RESOURCE_GROUP <resource-group-name>
# azd env set AI_FOUNDRY_RESOURCE_NAME <ai-foundry-resource-name>
```

---

## Step 3: Provision and Deploy

### 3.1 Provision Azure Resources

This will:
- Auto-discover your AI Foundry resources
- Create Azure Container Apps infrastructure
- Set up Microsoft Entra ID authentication
- Configure RBAC permissions

```bash
azd provision
```

**During provisioning, you may be prompted to:**
- Select which AI Foundry resource to use (if multiple exist)
- Confirm the agent selection

### 3.2 Deploy the Application

```bash
azd deploy
```

This will:
- Build the frontend (React + TypeScript)
- Build the backend (.NET 9 API)
- Create a Docker container
- Deploy to Azure Container Apps

### 3.3 Verify Deployment

```bash
# Get the deployed URL
azd env get-values | grep WEBSITE_URL

# Or open in browser
azd show
```

---

## Step 4: Test the Connection

### 4.1 Access the Web Application

Navigate to the URL from Step 3.3 (e.g., `https://mazhar-ai-webapp-xyz.azurecontainerapps.io`)

### 4.2 Sign In

1. Click "Sign in with Microsoft"
2. Authenticate with your Azure account
3. Consent to the required permissions

### 4.3 Interact with Mazhar-ai

Try these prompts to verify the personality:

**Test 1: Strategic Thinking**
```
"I want to build a new feature that tracks everything. What should I do?"
```
Expected: Mazhar-ai should ask clarifying questions, emphasize restraint, and challenge "everything"

**Test 2: Depth Check**
```
"How do I make my app faster?"
```
Expected: Should probe for specifics, offer frameworks for analysis, not quick fixes

**Test 3: Vision Alignment**
```
"What is your purpose?"
```
Expected: Should reference being "The Calm Architect" and principles from the vision board

---

## Step 5: Local Development (Optional)

### 5.1 Set Up Local Environment

```bash
# Install dependencies
cd frontend && npm install && cd ..
cd backend/WebApp.Api && dotnet restore && cd ../..

# Copy environment configuration
# This assumes you've run 'azd provision' which generates these files
# If not, you'll need to manually create .env files
```

### 5.2 Start Local Development

**Terminal 1 - Backend:**
```bash
cd backend/WebApp.Api
dotnet run
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 5.3 Access Locally

Navigate to: `http://localhost:5173`

The local app will connect to your Azure AI Foundry agent (Mazhar-ai) in the cloud.

---

## Troubleshooting

### Agent Not Found
**Error**: "Agent 'Mazhar-ai' not found"

**Solution**:
1. Verify exact agent name: `az rest --method get --url "https://<resource>.services.ai.azure.com/api/projects/<project>/agents?api-version=2025-11-15-preview"`
2. Update environment: `azd env set AI_AGENT_ID <exact-name>`
3. Re-provision: `azd provision`

### Authentication Errors
**Error**: "AADSTS50011: No reply URL is registered"

**Solution**:
1. In Azure Portal, go to Microsoft Entra ID > App Registrations
2. Find your app (search for the CLIENT_ID)
3. Add redirect URI: `https://<your-app-url>`
4. Add redirect URI for local dev: `http://localhost:5173`

### Permission Denied
**Error**: "403 Forbidden" when calling agent

**Solution**:
1. Verify managed identity has "Cognitive Services OpenAI User" role
2. Run: `azd provision` (this sets up RBAC automatically)
3. Check Azure Portal > AI Foundry > Access Control (IAM)

### List Available Agents
To see all agents in your project:

```bash
# From repository root
.\deployment\scripts\list-agents.ps1

# Or via REST API
az rest --method get \
  --url "https://<resource>.services.ai.azure.com/api/projects/<project>/agents?api-version=2025-11-15-preview"
```

---

## Updating Mazhar-ai's Personality

### To modify the agent's behavior:

1. Go to [https://ai.azure.com](https://ai.azure.com)
2. Navigate to your project > Agents > Mazhar-ai
3. Edit the **Instructions** field
4. Save (creates new version)
5. **No code deployment needed!** The app automatically uses the latest version

### To test changes locally:

```bash
# Just restart your local backend
cd backend/WebApp.Api
dotnet run
```

The backend fetches the latest agent configuration from Azure on startup.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Web Browser                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React Frontend (localhost:5173 or Azure)             │  │
│  │  - MSAL.js authentication                             │  │
│  │  - Sends JWT token with requests                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS + Bearer Token
                      ↓
┌─────────────────────────────────────────────────────────────┐
│           .NET 9 Backend API (Azure Container Apps)         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  AzureAIAgentService                                  │  │
│  │  - Validates JWT token                                │  │
│  │  - Uses Managed Identity (in Azure)                   │  │
│  │  - Connects via Azure.AI.Projects SDK                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │ Azure SDK + Managed Identity
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              Azure AI Foundry                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Project: <your-project>                              │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Agent: Mazhar-ai                               │  │  │
│  │  │  - Model: gpt-4 / gpt-4o                        │  │  │
│  │  │  - Instructions: "The Calm Architect..." (soul) │  │  │
│  │  │  - Tools: Optional function calling, etc.       │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

### 1. Customize the Frontend
Edit `/home/user/foundry-agent-webapp/frontend/src/components/AgentPreview.tsx` to:
- Add custom branding for Mazhar-ai
- Customize the UI theme to reflect the "calm architect" aesthetic
- Add suggested prompts that align with the vision

### 2. Extend Functionality
Consider adding:
- **Function Calling**: Tools that Mazhar-ai can use (e.g., calendar, task manager)
- **File Search**: Allow Mazhar-ai to search through uploaded documents
- **Code Interpreter**: Enable data analysis capabilities

### 3. Monitor Usage
Set up Application Insights to track:
- User engagement
- Agent response quality
- Token usage and costs

---

## Support

If you encounter issues:

1. Check the [troubleshooting section](#troubleshooting) above
2. Review logs: `azd monitor --logs`
3. Consult Azure AI Foundry documentation: [https://learn.microsoft.com/azure/ai-studio](https://learn.microsoft.com/azure/ai-studio)

---

**Your Mazhar-ai agent is ready to embody the 2026 vision.**

**Move with clarity. Respond with restraint. Create with service.**
