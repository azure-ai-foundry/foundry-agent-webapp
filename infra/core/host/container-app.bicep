param name string
param location string
param tags object
param containerAppsEnvironmentId string
param containerRegistryName string
param containerImage string
param targetPort int
param env array = []
param enableIngress bool = true
param external bool = true

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' existing = {
  name: containerRegistryName
}

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: enableIngress ? {
        external: external
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
      } : null
      registries: [
        {
          server: containerRegistry.properties.loginServer
          username: containerRegistry.listCredentials().username
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: [
        {
          name: 'registry-password'
          value: containerRegistry.listCredentials().passwords[0].value
        }
      ]
    }
    template: {
      containers: [
        {
          name: name
          image: containerImage
          env: env
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 3
      }
    }
  }
}

output id string = containerApp.id
output name string = containerApp.name
output fqdn string = enableIngress ? containerApp.properties.configuration.ingress.fqdn : ''
output identityPrincipalId string = containerApp.identity.principalId
