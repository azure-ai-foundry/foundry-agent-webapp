param location string
param tags object
param resourceToken string

var abbrs = loadJsonContent('./abbreviations.json')

var defaultTags = {
  'azd-env-name': resourceToken
}

var allTags = union(tags, defaultTags)

// Log Analytics Workspace
module logAnalytics './core/host/log-analytics.bicep' = {
  name: 'log-analytics'
  params: {
    name: '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
    location: location
    tags: allTags
  }
}

// Container Registry
module containerRegistry './core/host/container-registry.bicep' = {
  name: 'container-registry'
  params: {
    name: '${abbrs.containerRegistryRegistries}${resourceToken}'
    location: location
    tags: allTags
  }
}

// Container Apps Environment
module containerAppsEnvironment './core/host/container-apps-environment.bicep' = {
  name: 'container-apps-environment'
  params: {
    name: '${abbrs.appManagedEnvironments}${resourceToken}'
    location: location
    tags: allTags
    logAnalyticsWorkspaceId: logAnalytics.outputs.id
  }
}

output containerRegistryName string = containerRegistry.outputs.name
output containerRegistryLoginServer string = containerRegistry.outputs.loginServer
output containerAppsEnvironmentId string = containerAppsEnvironment.outputs.id
