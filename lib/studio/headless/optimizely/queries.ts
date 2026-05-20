/**
 * GraphQL queries for Optimizely Content Graph.
 * These queries are used during build-time to discover site structure and pages.
 */

/**
 * Query to get a page by its content ID.
 * Used for start page and specific page retrieval.
 */
export const PAGE_BY_ID_QUERY = /* GraphQL */ `
query GetPageById($id: Int!, $locale: [Locales!]) {
  _Content(
    where: { _metadata: { key: { eq: $id } } }
    locale: $locale
  ) {
    items {
      __typename
      _metadata {
        key
        displayName
        types
        url { default }
        locale
        status
      }
      _json
    }
  }
}
`

/**
 * Query to get content by URL path.
 * Used for page resolution by slug.
 */
export const PAGE_BY_PATH_QUERY = /* GraphQL */ `
query GetPageByPath($path: [String!]!, $locale: [Locales!]) {
  _Content(
    where: { _metadata: { url: { default: { in: $path } } } }
    locale: $locale
  ) {
    items {
      __typename
      _metadata {
        key
        displayName
        types
        url { default }
        locale
        status
      }
      _json
    }
  }
}
`

/**
 * Query to discover all pages (site tree traversal).
 * Fetches pages with their URLs for building the slug registry.
 */
export const DISCOVER_PAGES_QUERY = /* GraphQL */ `
query DiscoverPages($locale: [Locales!], $limit: Int!, $cursor: String) {
  _Content(
    locale: $locale
    limit: $limit
    cursor: $cursor
    where: { _metadata: { url: { default: { exist: true } } } }
  ) {
    items {
      __typename
      _metadata {
        key
        displayName
        types
        url { default }
        locale
        status
      }
    }
    cursor
  }
}
`

/**
 * Query to get page with expanded content (components).
 * Used for full page content resolution.
 */
export const PAGE_WITH_CONTENT_QUERY = /* GraphQL */ `
query GetPageWithContent($path: [String!]!, $locale: [Locales!]) {
  _Content(
    where: { _metadata: { url: { default: { in: $path } } } }
    locale: $locale
  ) {
    items {
      __typename
      _metadata {
        key
        displayName
        types
        url { default }
        locale
        status
      }
      _json
    }
  }
}
`
