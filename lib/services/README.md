# Service Layer Architecture

## Overview

The service layer provides a centralized business logic layer for the Catalyst Studio application. It implements the repository pattern and ensures proper separation of concerns between API routes and data access.

## Architecture

```
API Routes (Controllers)
    ↓
Service Layer (Business Logic)
    ↓
Prisma Client (ORM)
    ↓
PostgreSQL Database
```

## Services

### PageService

Manages WebsitePage operations including creation, updates, hierarchy, and publishing.

```typescript
import { ServiceFactory } from '@/lib/services';

const services = ServiceFactory.getInstance(prisma);
const page = await services.pageService.createPage({
  websiteId: 'web-1',
  type: 'page',
  title: 'My Page',
  content: { components: [] }
});
```

**Key Methods:**
- `createPage()` - Creates page with structure
- `updatePage()` - Updates page and structure
- `deletePage()` - Deletes page and structure
- `duplicatePage()` - Duplicates page with new structure
- `setPagePublished()` - Publishes/unpublishes page
- `getPagesByWebsite()` - Gets all pages for website
- `getPagesHierarchy()` - Gets pages with hierarchy

### ContentDataService

Manages WebsiteCustomContentData operations for custom content types.

```typescript
const contentData = await services.contentDataService.createContentData({
  websiteId: 'web-1',
  title: 'Blog Post',
  data: { body: 'Content here' },
  contentTypeId: 'type-1'
});
```

**Key Methods:**
- `createContentData()` - Creates custom content
- `validateContentData()` - Validates against schema
- `bulkCreateContentData()` - Bulk create operations
- `publishContentData()` - Publishes content
- `searchContentData()` - Searches content
- `exportContentData()` - Exports to JSON
- `importContentData()` - Imports from JSON

### ComponentService

Manages WebsiteComponentType definitions and templates.

```typescript
const componentType = await services.componentService.createComponentType({
  type: 'hero-banner',
  category: 'heroes',
  name: 'Hero Banner',
  defaultProperties: { height: '400px' }
});
```

**Key Methods:**
- `createComponentType()` - Creates component type
- `getComponentTypesByCategory()` - Gets types by category
- `cloneComponentType()` - Clones a type
- `validateComponentProperties()` - Validates properties
- `setComponentTypeLocked()` - Locks/unlocks type
- `setComponentTypeActive()` - Activates/deactivates

### SharedComponentService

Manages WebsiteSharedComponent instances used across pages.

```typescript
const sharedComponent = await services.sharedComponentService.createSharedComponent({
  websiteId: 'web-1',
  websiteComponentTypeId: 'type-1',
  name: 'Main Header',
  config: { logo: 'logo.png' }
});
```

**Key Methods:**
- `createSharedComponent()` - Creates shared component
- `getSharedComponentUsageCount()` - Gets usage count
- `findPagesUsingSharedComponent()` - Finds pages using component
- `cloneSharedComponent()` - Clones component
- `updateSharedComponentVersion()` - Updates version

### StructureService

Manages WebsiteStructure for URL paths and hierarchy.

```typescript
const structure = await services.structureService.createStructure({
  websiteId: 'web-1',
  slug: 'about-us',
  websitePageId: 'page-1',
  parentId: null
});
```

**Key Methods:**
- `createStructure()` - Creates structure entry
- `getStructureTree()` - Gets full hierarchy tree
- `moveStructure()` - Moves to new parent
- `generateUniqueSlug()` - Generates unique slug
- `generateFullPath()` - Generates full URL path
- `getBreadcrumbs()` - Gets breadcrumb trail
- `rebuildFullPaths()` - Rebuilds all paths
- `duplicateStructureSubtree()` - Duplicates subtree

## Usage Patterns

### Transaction Support

Services handle transactions internally for data consistency:

```typescript
// Service handles transaction internally
const page = await pageService.createPage(data);
// Both page and structure are created atomically
```

### Error Handling

Services throw domain-specific errors:

```typescript
try {
  await structureService.deleteStructure(id);
} catch (error) {
  if (error.message === 'Cannot delete structure with children') {
    // Handle specific error
  }
}
```

### Bulk Operations

Services support efficient bulk operations:

```typescript
const result = await contentDataService.bulkCreateContentData(records);
console.log(`Created: ${result.success}, Failed: ${result.failed}`);
```

## Testing

Each service has comprehensive unit tests:

```bash
npm test lib/services/__tests__
```

## Migration from Direct Prisma Usage

### Before (Direct Prisma)
```typescript
// In API route
const page = await prisma.websitePage.create({ data: {...} });
const structure = await prisma.websiteStructure.create({ data: {...} });
```

### After (Service Layer)
```typescript
// In API route
const services = ServiceFactory.getInstance(prisma);
const page = await services.pageService.createPage(data);
// Service handles both page and structure creation
```

## Best Practices

1. **Always use services for business logic** - Don't bypass services in API routes
2. **Let services handle transactions** - Services ensure data consistency
3. **Use service validation** - Services validate data before operations
4. **Handle service errors properly** - Services throw meaningful errors
5. **Use bulk operations when possible** - More efficient than individual operations

## Type Safety

All services are fully typed with TypeScript interfaces:

```typescript
import { IPageService, CreatePageDto } from '@/lib/services';

const createPage: CreatePageDto = {
  websiteId: string,
  type: 'page' | 'folder',
  title: string,
  // TypeScript ensures all required fields
};
```