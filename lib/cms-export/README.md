# CMS Export Providers

This folder contains providers for **exporting content TO external CMS platforms**.

**Direction**: Catalyst Studio → External CMS (PUSH)

**Interface**: `ICMSProvider` (defined in `types.ts`)

## Important Distinction

This is NOT the same as `scripts/generate-head/providers/` which **reads FROM**
CMS platforms to generate static sites (PULL direction).

| System | Location | Direction | Purpose |
|--------|----------|-----------|---------|
| **CMS Export** | `lib/cms-export/` | PUSH | Export content TO external CMS |
| **Site Generation** | `scripts/generate-head/providers/` | PULL | Read content FROM CMS |

## Providers

- `optimizely/` - Export to Optimizely CMS
- `contentful/` - Export to Contentful
- `strapi/` - Export to Strapi
- `contentstack/` - Export to Contentstack
- `kontent/` - Export to Kontent.ai
- `mock/` - Mock provider for testing

---

# Provider Architecture

## Overview

The Provider Architecture provides a unified interface for integrating multiple CMS platforms into Catalyst Studio. It encapsulates all CMS-specific code behind a common interface, enabling seamless switching between different content management systems.

## Architecture Components

### Core Components

1. **ICMSProvider Interface** - The contract all CMS providers must implement
2. **ProviderRegistry** - Singleton registry for managing provider instances
3. **Universal Type System** - Common format for content types across all platforms
4. **Mock Provider** - Testing implementation for development

### Directory Structure

```
lib/cms-export/
├── index.ts                 # Public API exports
├── registry.ts             # ProviderRegistry singleton
├── types.ts                # ICMSProvider interface & types
├── tsconfig.json           # TypeScript strict mode config
├── universal/              # Universal type system
│   ├── types.ts           # Core type definitions
│   ├── primitives.ts      # Layer 1: Primitive types
│   ├── common.ts          # Layer 2: Common patterns
│   └── extensions.ts      # Layer 3: Platform extensions
├── mock/                   # Mock provider for testing
│   └── MockProvider.ts
└── __tests__/             # Unit tests
    ├── registry.test.ts
    ├── types.test.ts
    └── mock-provider.test.ts
```

## Universal Type System

### Three-Layer Architecture

The Universal Type System uses a three-layer approach to handle field types across different CMS platforms:

#### Layer 1: Primitives
Universal basic types supported by all platforms:
- `text` - Short text (max 255 chars)
- `longText` - Long text content
- `number` - Numeric values
- `boolean` - True/false values
- `date` - Date/time values
- `json` - JSON data
- `decimal` - Decimal numbers

#### Layer 2: Common Patterns
Complex types commonly found across platforms:
- `richText` - Formatted text with markup
- `media` - Images, videos, documents
- `collection` - Arrays of items
- `component` - Reusable components
- `select` - Dropdown selections
- `repeater` - Repeatable field groups
- `slug` - URL-friendly identifiers
- `tags` - Categorization tags

#### Layer 3: Extensions
Platform-specific features registered per provider. These are isolated and require fallback strategies when switching platforms.

### Content Type Structure

```typescript
interface UniversalContentType {
  version: string;              // Semantic version
  id: string;                   // Unique identifier
  name: string;                 // Human-readable name
  type: 'page' | 'component';   // Content classification
  isRoutable: boolean;          // Has URL/routing
  fields: UniversalField[];     // Field definitions
  metadata: TypeMetadata;       // AI tracking & history
}

interface UniversalContentItem {
  id: string;                          // Unique identifier
  contentTypeId: string;               // Reference to content type
  title: string;                       // Item title
  slug: string;                        // URL-friendly identifier
  content: Record<string, any>;        // Field values
  metadata?: Record<string, any>;      // Additional metadata
  status: 'draft' | 'published' | 'archived';
  relationships?: ContentRelationship[]; // Links to other content
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  version?: string;
  platformSpecific?: Record<string, any>; // CMS-specific data
}
```

## How to Implement a New Provider

### Step 1: Create Provider Directory

```bash
mkdir lib/cms-export/{provider-name}
```

### Step 2: Implement ICMSProvider Interface

```typescript
// lib/cms-export/{provider-name}/{ProviderName}Provider.ts

import { 
  ICMSProvider, 
  ProviderCapabilities,
  UniversalContentType,
  UniversalContentItem,
  ContentFilter,
  PaginationOptions,
  ContentValidationResult
} from '../types';

export class {ProviderName}Provider implements ICMSProvider {
  readonly id = '{provider-name}';
  readonly name = '{Provider Name}';
  readonly version = '1.0.0';

  // Content Type Operations
  async getContentTypes(): Promise<UniversalContentType[]> {
    // Fetch content types from CMS API
    // Transform to universal format
    return transformedTypes;
  }

  async getContentType(id: string): Promise<UniversalContentType | null> {
    // Fetch specific type
    // Transform and return
  }

  async createContentType(type: UniversalContentType): Promise<UniversalContentType> {
    // Transform from universal to native
    // Create in CMS
    // Return created type
  }

  async updateContentType(id: string, type: UniversalContentType): Promise<UniversalContentType> {
    // Update content type
  }

  async deleteContentType(id: string): Promise<boolean> {
    // Delete content type
  }

  async validateContentType(type: UniversalContentType): Promise<ValidationResult> {
    // Validate content type
  }

  // Content Item Operations (NEW - Required)
  async createContentItem(item: UniversalContentItem): Promise<UniversalContentItem> {
    // Transform to native format
    // Create content item in CMS
    // Return created item
  }

  async updateContentItem(id: string, item: UniversalContentItem): Promise<UniversalContentItem> {
    // Update content item
  }

  async deleteContentItem(id: string): Promise<boolean> {
    // Delete content item
  }

  async getContentItem(id: string): Promise<UniversalContentItem | null> {
    // Fetch content item
    // Transform and return
  }

  async getContentItems(
    filter?: ContentFilter,
    pagination?: PaginationOptions
  ): Promise<{ items: UniversalContentItem[]; total: number }> {
    // Query content items with filtering and pagination
    // Transform results
  }

  async validateContentItem(item: UniversalContentItem): Promise<ContentValidationResult> {
    // Validate content item
  }

  // Provider Capabilities
  getProviderCapabilities(): ProviderCapabilities {
    return {
      supportsComponents: true,
      supportsPages: true,
      supportsRichText: true,
      supportsMedia: true,
      supportsReferences: true,
      supportsLocalizations: false,
      supportsVersioning: false,
      supportsScheduling: false,
      supportsWebhooks: false
    };
  }

  // Transformation Methods
  mapToUniversal(nativeType: any): UniversalContentType {
    // Transform native CMS format to universal
  }

  mapFromUniversal(universalType: UniversalContentType): any {
    // Transform universal to native CMS format
  }

  // Optional
  setDryRun?(enabled: boolean): void {
    // Enable/disable dry run mode
  }
}
```

### Step 3: Register Provider

```typescript
import { providerRegistry } from 'lib/cms-export';
import { {ProviderName}Provider } from 'lib/cms-export/{provider-name}/{ProviderName}Provider';

// Register the provider
const provider = new {ProviderName}Provider();
providerRegistry.register('{provider-name}', provider);

// Set as active provider
providerRegistry.setActiveProvider('{provider-name}');
```

### Step 4: Add Tests

Create comprehensive tests for your provider implementation:

```typescript
// lib/cms-export/{provider-name}/__tests__/{provider-name}.test.ts

describe('{ProviderName}Provider', () => {
  // Test all interface methods
  // Test type transformations
  // Test error handling
});
```

## Using the Provider Architecture

### Basic Usage

```typescript
import { providerRegistry, MockProvider } from 'lib/cms-export';

// Register a provider
const mockProvider = new MockProvider();
providerRegistry.register('mock', mockProvider);

// Get active provider
const provider = providerRegistry.getActiveProvider();
if (provider) {
  // Use provider methods
  const contentTypes = await provider.getContentTypes();
  console.log('Available types:', contentTypes);
}
```

### Switching Providers

```typescript
// Register multiple providers
providerRegistry.register('optimizely', optimizelyProvider);
providerRegistry.register('contentful', contentfulProvider);

// Switch active provider
providerRegistry.setActiveProvider('contentful');
```

### Type Validation

```typescript
const newType: UniversalContentType = {
  version: '1.0.0',
  id: 'article',
  name: 'Article',
  type: 'page',
  isRoutable: true,
  fields: [...],
  metadata: {...}
};

// Validate before creating
const validation = await provider.validateContentType(newType);
if (validation.valid) {
  const created = await provider.createContentType(newType);
} else {
  console.error('Validation errors:', validation.errors);
}
```

## Provider Capabilities

Providers declare their capabilities to help the system understand what features are available:

```typescript
interface ProviderCapabilities {
  supportsComponents: boolean;      // Component content types
  supportsPages: boolean;           // Page content types
  supportsRichText: boolean;        // Rich text editing
  supportsMedia: boolean;           // Media management
  supportsReferences: boolean;      // Cross-references
  supportsLocalizations: boolean;   // Multi-language
  supportsVersioning: boolean;      // Version control
  supportsScheduling: boolean;      // Scheduled publishing
  supportsWebhooks: boolean;        // Webhook events
  customCapabilities?: Record<string, boolean>;
}
```

## Error Handling

The provider architecture includes specific error types for different scenarios:

- `ProviderNotFoundError` - Provider not registered
- `ProviderValidationError` - Content type validation failed
- `ProviderConnectionError` - CMS API connection issues
- `ProviderTransformationError` - Type mapping failures

```typescript
try {
  await provider.createContentType(type);
} catch (error) {
  if (error instanceof ProviderValidationError) {
    console.error('Validation failed:', error.validationResult);
  } else if (error instanceof ProviderConnectionError) {
    console.error('Connection failed:', error.cause);
  }
}
```

## Singleton Pattern

The ProviderRegistry uses the singleton pattern to ensure consistent provider management across the application:

```typescript
// Always returns the same instance
const registry1 = ProviderRegistry.getInstance();
const registry2 = ProviderRegistry.getInstance();
console.log(registry1 === registry2); // true

// Or use the exported instance
import { providerRegistry } from 'lib/cms-export';
```

## TypeScript Strict Mode

The provider architecture enforces TypeScript strict mode for type safety:

- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`
- `strictFunctionTypes: true`

This ensures robust type checking and prevents common errors.

## Performance Benchmarks

Expected performance targets for provider operations:

| Operation | Target Time |
|-----------|------------|
| getContentTypes() | < 500ms for 100 types |
| getContentType() | < 100ms per lookup |
| validateContentType() | < 50ms per validation |
| mapToUniversal() | < 10ms per transformation |
| mapFromUniversal() | < 10ms per transformation |

## Migration Path

### From Direct Integration to Provider Pattern

1. **Current State**: Direct Optimizely integration in `lib/sync/adapters/`
2. **Story 7.1**: Create provider foundation (this story)
3. **Story 7.2**: Migrate Optimizely to provider pattern
4. **Story 7.3**: Add Contentful provider
5. **Future**: Add more CMS providers as needed

### Feature Flag Control

Use feature flags to control the migration:

```typescript
if (process.env.USE_PROVIDER_PATTERN === 'true') {
  // Use provider pattern
  const provider = providerRegistry.getActiveProvider();
} else {
  // Use direct integration (legacy)
  const client = new OptimizelyApiClient();
}
```

## Testing

### Running Tests

```bash
# Run all provider tests
npm test lib/cms-export/__tests__/

# Run specific test file
npm test lib/cms-export/__tests__/registry.test.ts
```

### Test Coverage

Target: 90% coverage for provider code

```bash
# Check coverage
npm run test:coverage -- lib/cms-export/
```

## Future Enhancements

- **Provider Discovery**: Auto-discovery of available providers
- **Provider Plugins**: Plugin system for extending providers
- **Caching Layer**: Built-in caching for provider operations
- **Provider Metrics**: Performance monitoring and analytics
- **Multi-Provider Support**: Use multiple providers simultaneously
- **Provider Migrations**: Tools for migrating content between providers

## Support

For questions or issues with the provider architecture:
1. Check this documentation
2. Review the tests for usage examples
3. Contact the development team

## License

This provider architecture is part of Catalyst Studio and follows the same license terms.