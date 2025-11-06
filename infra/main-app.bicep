param location string
param tags object
param resourceToken string
param containerAppsEnvironmentId string
param containerRegistryName string
param aiAgentEndpoint string
param aiAgentId string
param entraSpaClientId string
param entraTenantId string
param webImageName string

var abbrs = loadJsonContent('./abbreviations.json')

// Single Container App - serves both frontend and backend
module webApp './core/host/container-app.bicep' = {
  name: 'web-container-app'
  params: {
    name: '${abbrs.appContainerApps}web-${resourceToken}'
    location: location
    tags: union(tags, { 'azd-service-name': 'web' })
    containerAppsEnvironmentId: containerAppsEnvironmentId
    containerRegistryName: containerRegistryName
    containerImage: webImageName
    targetPort: 8080
    env: [
      {
        name: 'ASPNETCORE_ENVIRONMENT'
        value: 'Production'
      }
      {
        name: 'ASPNETCORE_URLS'
        value: 'http://+:8080'
      }
      {
        name: 'ENTRA_SPA_CLIENT_ID'
        value: entraSpaClientId
      }
      {
        name: 'ENTRA_TENANT_ID'
        value: entraTenantId
      }
      {
        name: 'AI_AGENT_ENDPOINT'
        value: aiAgentEndpoint
      }
      {
        name: 'AI_AGENT_ID'
        value: aiAgentId
      }
    ]
    enableIngress: true
    external: true
  }
}

output webEndpoint string = 'https://${webApp.outputs.fqdn}'
output webIdentityPrincipalId string = webApp.outputs.identityPrincipalId
output webAppName string = webApp.outputs.name
