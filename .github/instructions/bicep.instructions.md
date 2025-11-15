---
description: Bicep coding standards and patterns for Azure infrastructure
applyTo: "**/*.bicep"
---

# Bicep Instructions

**Goal**: Create consistent, secure Azure infrastructure

## Naming Convention

**Use**: `resourceToken` from `uniqueString(subscription().id, environmentName, location)`

**Pattern**: `<abbr>-<suffix>-<token>` (see `abbreviations.json`)  
**Exception**: ACR requires alphanumeric only: `cr${resourceToken}`

```bicep
var token = toLower(uniqueString(subscription().id, environmentName, location))
name: '${abbrs.appContainerApps}web-${token}'  // ca-web-abc123
```

## Parameters

**Always**: Add `@description()` and use `@allowed()` for constrained values

```bicep
@description('Environment (dev, prod)')
param environmentName string

@description('Azure region')
@allowed(['eastus2', 'westus2'])
param location string = 'eastus2'
```

## Outputs

**Purpose**: Expose key identifiers for `azd` and other modules

```bicep
output containerAppName string = containerApp.name
output webEndpoint string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output identityPrincipalId string = containerApp.identity.principalId
```

## Reference Existing Resources

```bicep
resource aiFoundry 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  scope: resourceGroup(aiFoundryResourceGroup)
  name: aiFoundryResourceName
}
```

## Managed Identity

**Always use**: System-assigned identity + output `principalId` for RBAC

```bicep
identity: { type: 'SystemAssigned' }
output identityPrincipalId string = resource.identity.principalId
```

## RBAC Assignments

**Pattern**: Use `guid()` for names + specify `principalType`

```bicep
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resource.id, principalId, roleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
```

## Secrets

**Use**: Container App secrets + `listCredentials()` pattern

```bicep
secrets: [{
  name: 'registry-password'
  value: containerRegistry.listCredentials().passwords[0].value
}]
```

## Container Apps

**Key settings**:
- `minReplicas: 0` (scale-to-zero)
- `targetPort: 8080` (convention)
- `allowInsecure: false` (HTTPS only)

## Validation

```powershell
az bicep build --file main.bicep
az deployment group what-if --template-file main.bicep
```
