const SHARED_COMPONENT_FIELDS = `
  id
  name
  componentType
  componentTypeId
  content
  config
`

export const SHARED_COMPONENT_QUERY = /* GraphQL */ `
  query SharedComponent($id: ID!) {
    sharedComponent(id: $id) {
      ${SHARED_COMPONENT_FIELDS}
    }
  }
`

export const SHARED_COMPONENTS_QUERY = /* GraphQL */ `
  query SharedComponents($websiteId: ID!) {
    sharedComponents(websiteId: $websiteId) {
      ${SHARED_COMPONENT_FIELDS}
    }
  }
`
