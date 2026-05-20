# Umbraco Compose CMS Export Provider

Export website content to [Umbraco Compose](https://umbraco.com/products/umbraco-compose/) (content orchestration platform).

## Quick Start

1. **Set environment variables**:

```bash
# Required
UMBRACO_PROJECT_ALIAS=your-project-alias
UMBRACO_REGION=germanywestcentral

# Authentication (need both)
UMBRACO_CLIENT_ID=your-oauth-client-id
UMBRACO_CLIENT_SECRET=your-oauth-client-secret
UMBRACO_PAT=your-personal-access-token

# Optional
UMBRACO_ENVIRONMENT=production  # default: "production"
UMBRACO_COLLECTION=pages        # default: "pages"
```

2. **Use the provider**:

```typescript
import { UmbracoComposeProvider } from '@/lib/cms-export/umbraco-compose';

const provider = new UmbracoComposeProvider();
const result = await provider.syncUnifiedBundle(bundle, {
  onProgress: (progress) => console.log(progress),
});
```

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `UMBRACO_PROJECT_ALIAS` | Your project's alias in Umbraco Compose | `royal-childrens-hospital` |
| `UMBRACO_REGION` | Azure region for API endpoints | `germanywestcentral` |
| `UMBRACO_CLIENT_ID` | OAuth client ID for Management API | `catalyst-studio` |
| `UMBRACO_CLIENT_SECRET` | OAuth client secret | `your-secret` |
| `UMBRACO_PAT` | Personal Access Token for Ingestion API | `pat_xxx...` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `UMBRACO_ENVIRONMENT` | `production` | Target environment (production, staging, etc.) |
| `UMBRACO_COLLECTION` | `pages` | Default collection for content ingestion |

### Programmatic Configuration

```typescript
const provider = new UmbracoComposeProvider({
  projectAlias: 'my-project',
  region: 'germanywestcentral',
  clientId: 'my-client-id',
  clientSecret: 'my-secret',
  personalAccessToken: 'pat_xxx',
  environment: 'production',
  collection: 'pages',
  debug: true,  // Enable debug logging
});
```

## Authentication

Umbraco Compose uses **dual authentication**:

1. **Management API** (OAuth 2.0):
   - Used for schema operations (create/update type schemas)
   - Requires `client_id` and `client_secret`
   - Tokens are cached and auto-refreshed

2. **Ingestion API** (PAT):
   - Used for content ingestion (PUT batches)
   - Uses Personal Access Token directly
   - No token management needed

### Getting Credentials

1. **OAuth Credentials** (for Management API):
   - Go to Umbraco Compose portal → Project Settings → API Clients
   - Create a new client with appropriate scopes
   - Copy the Client ID and Client Secret

2. **Personal Access Token** (for Ingestion API):
   - Go to Umbraco Compose portal → Your Profile → Personal Access Tokens
   - Create a new token with write permissions
   - Copy the token value

## Content Mapping

### Type Schemas

Content types are mapped to Umbraco JSON Schema format:

| CMS Type | Umbraco Schema |
|----------|----------------|
| `string` | `{ type: "string" }` |
| `number` | `{ type: "number" }` |
| `boolean` | `{ type: "boolean" }` |
| `date` | `{ type: "string", format: "date-time" }` |
| `Image` | `{ type: "object", properties: { src, alt, ... } }` |
| `Array<T>` | `{ type: "array", items: {...} }` |

### Content Structure

Pages and components are transformed to Umbraco ingestion format:

```typescript
// Input: Unified Content
{
  id: "page-home",
  type: "page",
  title: "Home",
  components: [...]
}

// Output: Umbraco Ingestion Entry
{
  id: "page-home-abc123",
  type: "page",
  action: "upsert",
  data: {
    title: "Home",
    slug: "home",
    navbarRef: "shared-navbar-abc123",
    hero: { headline: "...", ... }
  }
}
```

### Shared Components

Components marked as shared (navbar, footer) are:
1. Created as separate content items
2. Referenced by ID in page data
3. Deduplicated by `sharedId`

## Error Handling

### Error Classes

```typescript
import {
  UmbracoComposeError,    // Base error class
  UmbracoAuthError,       // Authentication failures
  UmbracoValidationError, // Schema validation errors
  UmbracoRateLimitError,  // Rate limit exceeded
  UmbracoIngestionError,  // Content ingestion failures
  UmbracoConnectionError, // Network/connection issues
} from '@/lib/cms-export/umbraco-compose';
```

### Retry Logic

The provider automatically retries on:
- Network errors
- 5xx server errors
- 429 rate limit errors (with backoff)

Retries use exponential backoff: 1s → 2s → 4s → 8s (max 3 attempts).

### Circuit Breaker

After 5 consecutive failures, the circuit breaker opens:
- Requests fail immediately for 30 seconds
- After timeout, one test request is allowed (half-open)
- Success closes the circuit; failure re-opens it

## API Reference

### UmbracoComposeProvider

```typescript
class UmbracoComposeProvider implements ICMSProvider {
  id: 'umbraco-compose';

  // Configure the provider
  configure(config: UmbracoComposeProviderConfig): void;

  // Sync content bundle to Umbraco Compose
  syncUnifiedBundle(
    bundle: UnifiedBundle,
    options?: { onProgress?: ProgressCallback }
  ): Promise<SyncResult>;

  // Test connection to Umbraco Compose
  testConnection(): Promise<boolean>;
}
```

### UmbracoComposeClient

```typescript
class UmbracoComposeClient {
  // Type schema operations
  getTypeSchemas(): Promise<TypeSchema[]>;
  createTypeSchema(schema: MappedTypeSchema): Promise<void>;
  updateTypeSchema(alias: string, schema: MappedTypeSchema): Promise<void>;
  deleteTypeSchema(alias: string): Promise<void>;
  ensureTypeSchema(schema: MappedTypeSchema): Promise<boolean>;

  // Collection operations
  getCollections(): Promise<Collection[]>;
  createCollection(alias: string, description?: string): Promise<void>;
  ensureCollection(alias?: string): Promise<void>;

  // Content ingestion
  ingestContent(
    entries: IngestionEntry[],
    collection?: string
  ): Promise<IngestionResult>;

  // Circuit breaker monitoring
  getCircuitState(): { state: CircuitState; failureCount: number };
  resetCircuitBreaker(): void;
}
```

## Troubleshooting

### Authentication Failures

**Symptom**: `UmbracoAuthError: Authentication failed`

**Solutions**:
1. Verify `UMBRACO_CLIENT_ID` and `UMBRACO_CLIENT_SECRET` are correct
2. Check that the OAuth client has required scopes
3. Ensure the token endpoint is reachable

### Ingestion Failures

**Symptom**: `UmbracoIngestionError: Partial failure`

**Solutions**:
1. Check `error.failedEntries` for specific failures
2. Verify type schema exists for content type
3. Check content data matches schema

### Rate Limiting

**Symptom**: `UmbracoRateLimitError: Rate limit exceeded`

**Solutions**:
1. Reduce batch size
2. Increase `rateLimitMs` configuration
3. Wait for retry-after period

### Circuit Breaker Open

**Symptom**: `Circuit breaker is open`

**Solutions**:
1. Wait 30 seconds for reset timeout
2. Check Umbraco Compose service status
3. Verify network connectivity
4. Call `client.resetCircuitBreaker()` manually (testing only)

## Limitations

### Media Upload

Media upload is not currently supported. The Umbraco Compose Ingestion API does not have documented media upload endpoints.

**Workaround**: Store media assets externally and reference URLs in content.

### Webhooks

Umbraco Compose (beta) does not support webhooks. Content sync is fire-and-forget with 202 response.

### Localization

Multi-language content is not currently supported. All content uses the `$invariant` locale.

## Development

### Running Tests

```bash
# Run all Umbraco Compose tests
SKIP_DB_SETUP=true npm test -- --testPathPatterns="lib/cms-export/umbraco-compose"

# Run specific test file
SKIP_DB_SETUP=true npm test -- --testPathPatterns="umbraco-compose/utils"
```

### Debug Mode

Enable debug logging for detailed request/response information:

```typescript
const provider = new UmbracoComposeProvider({ debug: true });
```

## Version History

- **1.0.0** - Initial implementation
  - Provider scaffolding and registration
  - Dual authentication (OAuth + PAT)
  - Type schema mapping
  - Content transformation
  - Retry logic with exponential backoff
  - Circuit breaker pattern
