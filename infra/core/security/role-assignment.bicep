targetScope = 'resourceGroup'

param principalId string
param roleDefinitionId string
param principalType string = 'ServicePrincipal'
param aiFoundryResourceName string

// Get the AI Foundry resource in this resource group
resource existingAIFoundry 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: aiFoundryResourceName
}

// Create role assignment on the AI Foundry resource
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(existingAIFoundry.id, principalId, roleDefinitionId)
  scope: existingAIFoundry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: principalId
    principalType: principalType
  }
}

output roleAssignmentId string = roleAssignment.id
