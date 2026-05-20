export const ucsReadApiTypeDefs = /* GraphQL */ `
  """ISO-8601 timestamp with millisecond precision."""
  scalar DateTime

  """Arbitrary JSON payload mirrored from UCS storage."""
  scalar JSON

  type Query {
    """
    Fetch a single website by id.
    Requires the API key to scope into the owning account or website.
    """
    website(id: ID!): Website

    """
    List websites accessible to the API key using Relay-style pagination.
    """
    websites(first: Int = 20, after: String): WebsiteConnection!

    """
    Resolve a UCS page by id or slug for a given website.
    Either id or slug must be provided.
    """
    page(id: ID, slug: String, websiteId: ID!): Page

    """Fetch a shared component by id."""
    sharedComponent(id: ID!): SharedComponent

    """List shared components for the provided website."""
    sharedComponents(websiteId: ID!): [SharedComponent!]!

    """List captured design systems for the provided website."""
    designSystems(websiteId: ID!): [DesignSystem!]!
  }

  """Website metadata mirrored from UCS."""
  type Website {
    """Unique website identifier."""
    id: ID!
    """Human readable website name."""
    name: String!
    """Optional marketing description."""
    description: String
    """Category recorded by the importer."""
    category: String!
    """Structured metadata persisted for the website."""
    metadata: JSON
    """Icon reference or media record."""
    icon: JSON
    """Feature flags and settings configured for the website."""
    settings: JSON
    """Indicates whether the website is active."""
    isActive: Boolean!
    """Creation timestamp."""
    createdAt: DateTime!
    """Last update timestamp."""
    updatedAt: DateTime!
  }

  """Relay-style connection for websites."""
  type WebsiteConnection {
    """Paginated edges for the current window."""
    edges: [WebsiteEdge!]!
    """Relay page info metadata."""
    pageInfo: PageInfo!
    """Total websites available for the caller."""
    totalCount: Int!
  }

  """Edge wrapper that carries the node cursor."""
  type WebsiteEdge {
    """Opaque cursor derived from website id and createdAt."""
    cursor: String!
    """Website node for this edge."""
    node: Website!
  }

  """Pagination metadata describing the next window."""
  type PageInfo {
    """Cursor to resume pagination or null when exhausted."""
    endCursor: String
    """Indicates whether additional pages exist."""
    hasNextPage: Boolean!
  }

  """Normalized UCS page response used by headless runtimes."""
  type Page {
    """Page identifier."""
    id: ID!
    """Website that owns the page."""
    websiteId: ID!
    """Display title stored with the page."""
    title: String!
    """Canonical full path for the page."""
    fullPath: String!
    """Template identifier applied to the page."""
    templateKey: String
    """Template props captured at save time."""
    templateProps: JSON!
    """Structured region summaries describing the layout."""
    regions: [PageRegion!]!
    """Normalized component instances for the page."""
    components: [ComponentInstance!]!
    """Raw metadata including SEO fields."""
    metadata: JSON!
    """Shared component ids referenced by the component tree."""
    sharedComponentIds: [ID!]
    """Hydrated shared component payloads."""
    sharedComponents: [SharedComponent!]!
    """Resolved structure context for breadcrumbs and navigation."""
    structure: PageStructure
    """Resolver diagnostics captured while loading the page."""
    diagnostics: [PageDiagnostic!]!
  }

  """Region summary describing allowed component types."""
  type PageRegion {
    """Region key from the template definition."""
    region: String!
    """Component types registered within the region."""
    componentTypes: [String!]!
  }

  """Single component instance used by the head runtime."""
  type ComponentInstance {
    """Unique component identifier."""
    id: ID!
    """Legacy component type string."""
    type: String!
    """Canonical CMS component enum."""
    componentType: String
    """Website component type identifier."""
    componentTypeId: ID
    """Parent component id when nested."""
    parentId: ID
    """Zero-based ordering index inside the parent."""
    position: Int!
    """Raw props captured from the builder."""
    props: JSON!
    """Structured content chunk for the component."""
    content: JSON!
    """Responsive style map."""
    styles: JSON!
    """Component metadata and AI annotations."""
    metadata: JSON!
    """Linked shared component identifier when present."""
    sharedComponentId: ID
    """Global component identifier retained for legacy imports."""
    globalComponentId: ID
    """Effective props after merging shared defaults and overrides."""
    effectiveProps: JSON
    """Indicates whether overrides exist for the instance."""
    hasOverrides: Boolean
    """True when the instance references a shared component."""
    isSharedInstance: Boolean
  }

  """Shared component definition stored in UCS."""
  type SharedComponent {
    """Shared component identifier."""
    id: ID!
    """Display name configured in UCS."""
    name: String!
    """Template component type."""
    componentType: String!
    """Underlying website component type id."""
    componentTypeId: ID
    """Serialized component content (default props)."""
    content: JSON
    """Config metadata including default props and category."""
    config: JSON!
  }

  """Persisted design system snapshot."""
  type DesignSystem {
    """Design system identifier."""
    id: ID!
    """Website that produced the snapshot."""
    websiteId: ID!
    """Associated design concept identifier."""
    designConceptId: ID!
    """Friendly concept name when available."""
    conceptName: String
    """Semantic version recorded during capture."""
    version: String!
    """Raw token payload exported by the DOM probe."""
    tokens: JSON!
    """Source import job that generated the snapshot."""
    sourceJobId: ID
    """Indicates whether this snapshot is the active (current) version."""
    isCurrent: Boolean!
    """Creation timestamp."""
    createdAt: DateTime!
    """Last update timestamp."""
    updatedAt: DateTime!
  }

  """Structure payload describing the current node and neighbors."""
  type PageStructure {
    """Currently resolved node."""
    current: StructureNode
    """Ancestor breadcrumbs ordered by depth."""
    ancestors: [StructureNode!]!
    """Direct children of the current node."""
    children: [StructureNode!]!
  }

  """Structure node metadata used for navigation."""
  type StructureNode {
    """Structure identifier."""
    id: ID!
    """Linked page id when the node represents a page."""
    websitePageId: ID
    """Parent structure id or null for root nodes."""
    parentId: ID
    """Slug assigned to the node."""
    slug: String!
    """Normalized full path."""
    fullPath: String!
    """Sibling ordering index."""
    position: Int!
    """True when the node is a folder without a page."""
    isFolder: Boolean!
    """Optional title stored with the node."""
    title: String
  }

  """Diagnostic entries captured while resolving a page."""
  type PageDiagnostic {
    """Machine readable code."""
    code: String!
    """Severity flag."""
    level: String!
    """Human readable explanation."""
    message: String!
    """Structured context for debugging."""
    context: JSON
  }
`;
