# OptimizelyProvider

## Overview

The OptimizelyProvider implements the ICMSProvider interface for Optimizely CMS integration. It provides a complete abstraction layer that handles all Optimizely-specific operations while exposing a universal interface.

## Architecture

```
lib/providers/optimizely/
├── index.ts                 # Clean public API exports
├── provider.ts    # Main provider implementation
├── types.ts                 # Optimizely-specific type definitions
├── client.ts               # OAuth-based API client
├── utils.ts                # Helper functions
└── mappers/
    ├── type-mapper.ts      # Universal ↔ Optimizely type mapping
    ├── field-mapper.ts     # Field transformation logic
    └── validation-mapper.ts # Validation rule mapping
```

## Features

### Supported Capabilities
- ✅ Content type CRUD operations
- ✅ Bidirectional type mapping
- ✅ OAuth 2.0 authentication
- ✅ Field layer classification (primitive/common/extension)
- ✅ Validation mapping
- ✅ Template metadata propagation (	emplateKey + 	emplateProps) for page exports
- ✅ Error handling with custom error types
- ✅ Pages and components support

### Optimizely-Specific Features
- Content versioning
- Scheduled publishing
- Content approval workflow
- Preview support

## Configuration

### Environment Variables

```bash
# Required for OAuth authentication
OPTIMIZELY_CLIENT_ID=your_client_id
OPTIMIZELY_CLIENT_SECRET=your_client_secret

# Optional
OPTIMIZELY_PROJECT_ID=your_project_id
OPTIMIZELY_API_URL=https://api.cms.optimizely.com  # Default

# Feature flag to enable provider pattern
USE_PROVIDER_PATTERN=true  # Set to 'false' for legacy direct integration
```

## Usage

### Basic Usage

```typescript
import { ProviderRegistry, OptimizelyProvider } from '@/lib/providers';

// Register provider
const registry = ProviderRegistry.getInstance();
const provider = new OptimizelyProvider();
registry.register('optimizely', provider);
registry.setActiveProvider('optimizely');

// Use provider
const contentTypes = await provider.getContentTypes();
```

### Type Mapping

The provider automatically maps between Optimizely and Universal type formats:

#### Optimizely → Universal
```typescript
// Optimizely format
{
  key: 'ArticlePage',
  displayName: 'Article Page',
  baseType: '_page',
  properties: {
    title: { type: 'String', displayName: 'Title', required: true }
  }
}

// Universal format
{
  id: 'ArticlePage',
  name: 'ArticlePage',
  type: 'page',
  isRoutable: true,
  fields: [
    { name: 'title', type: 'text', layer: 'primitive', required: true }
  ]
}
```

## Field Type Mapping

| Optimizely Type | Universal Type | Layer |
|----------------|----------------|-------|
| String | string | primitive |
| Number/Integer/Float | number | primitive |
| Boolean | boolean | primitive |
| DateTime | date | common |
| XhtmlString | richText | common |
| ContentReference | reference | common |
| ContentArea | array | common |
| Media/Image | media | common |
| SelectOne | select | common |
| SelectMany | multiselect | common |

## Error Handling

The provider uses custom error types for better error tracking:

- `OptimizelyConnectionError` - API connection failures
- `OptimizelyValidationError` - Content validation errors
- `OptimizelyTransformationError` - Type mapping errors

## Testing

```bash
# Run provider tests
npm test lib/providers/optimizely

# Test coverage
npm test -- --coverage lib/providers/optimizely
```

## Migration Path

### From Direct Integration to Provider Pattern

1. **Enable provider pattern** (feature flagged):
   ```bash
   export USE_PROVIDER_PATTERN=true
   ```

2. **Verify functionality** - Both patterns work side-by-side

3. **Remove legacy code** once verified (future story)

### Rollback Strategy

If issues arise:
```bash
# Disable provider pattern immediately
export USE_PROVIDER_PATTERN=false
npm run build && npm run start
```

## Performance Considerations

- **Connection pooling**: HTTP connections are reused
- **Token caching**: OAuth tokens cached until expiry
- **Retry logic**: Built-in retry for transient failures
- **Timeout handling**: 30-second timeout per request

## Limitations

- Maximum field depth: 5 levels
- No support for circular references
- Custom validators mapped as strings
- Some Optimizely-specific features may not have Universal equivalents

## Development

### Adding New Field Types

1. Update field type mapping in `mappers/field-mapper.ts`
2. Add classification logic for layer assignment
3. Update tests in `__tests__/mappers/field-mapper.test.ts`

### Extending Provider Capabilities

1. Add new methods to `OptimizelyProvider` class
2. Implement corresponding client methods if needed
3. Update `ProviderCapabilities` if adding new features
4. Add tests for new functionality

## Troubleshooting

### Authentication Issues
- Verify OAuth credentials in environment
- Check token expiry handling
- Ensure API URL is correct

### Type Mapping Issues
- Check field layer classification
- Verify bidirectional mapping consistency
- Review validation rule transformations

### Performance Issues
- Monitor API call frequency
- Check for unnecessary transformations
- Verify connection pooling is working

## Related Documentation

- [Provider System Overview](../README.md)
- [Universal Type System](../universal/README.md)
- [ICMSProvider Interface](../types.ts)

