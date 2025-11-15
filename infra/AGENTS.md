# Infrastructure - Bicep

**Context**: See `.github/copilot-instructions.md` for architecture

## Module Hierarchy

```
main.bicep (subscription scope)
├─ Resource group
├─ main-infrastructure.bicep (ACR + Container Apps Env + Log Analytics)
├─ main-app.bicep (Container App)
└─ RBAC (Cognitive Services User role)
```

## Naming Pattern

**Use**: `uniqueString()` + `abbreviations.json`

```bicep
var token = toLower(uniqueString(subscription().id, environmentName, location))
var abbrs = loadJsonContent('./abbreviations.json')

name: 'cr${token}'  // ACR: alphanumeric only
name: '${abbrs.appContainerApps}web-${token}'  // ca-web-abc123
```

## Container App

**Key settings**: System identity + scale-to-zero + HTTPS only

```bicep
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        allowInsecure: false
      }
      secrets: [{
        name: 'registry-password'
        value: containerRegistry.listCredentials().passwords[0].value
      }]
    }
    template: {
      containers: [{
        name: 'web'
        image: containerImage
        env: [
          { name: 'ENTRA_SPA_CLIENT_ID', value: entraSpaClientId }
          { name: 'AI_AGENT_ENDPOINT', value: aiAgentEndpoint }
          { name: 'AI_AGENT_ID', value: aiAgentId }
        ]
        resources: { cpu: json('0.5'), memory: '1Gi' }
      }]
      scale: { minReplicas: 0, maxReplicas: 3 }
    }
  }
}

output fqdn string = containerApp.properties.configuration.ingress.fqdn
output identityPrincipalId string = containerApp.identity.principalId
```

## RBAC Assignment

```bicep
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aiFoundry.id, principalId, roleId)
  scope: aiFoundry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
```
