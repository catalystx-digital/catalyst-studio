# Export Ordering Utility - Usage Guide

## Overview

The `export-ordering.ts` module provides topological sorting for component exports to ensure dependent components are exported in the correct order. This is critical when exporting components to standalone files, as sub-components must be defined before parent components that use them.

## Problem Statement

Some components depend on others:
- `Accordion` uses `AccordionItem`
- `Tabs` uses `TabItem`
- `NavBar` uses `NavMenuItem` and `MobileMenu`
- `Footer` uses `NavMenuItem` and `SocialLinkItem`

When exporting these components to standalone files or building a component library, sub-components must be exported **before** parent components.

## API Reference

### `sortForExport(componentTypes: string[]): string[]`

Topologically sorts an array of component types for export.

**Parameters:**
- `componentTypes`: Array of component type strings to sort

**Returns:**
- Sorted array with dependencies appearing before dependents

**Example:**
```typescript
import { sortForExport } from '@/lib/studio/components/cms/_core/export-ordering'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'

const components = [
  ComponentType.Accordion,
  ComponentType.AccordionItem,
  ComponentType.NavBar,
  ComponentType.NavMenuItem
]

const sorted = sortForExport(components)
// Result: [AccordionItem, NavMenuItem, Accordion, NavBar]
// Sub-components come first
```

### `getExportOrder(): string[]`

Gets the export order for all registered component definitions.

**Returns:**
- Array of all component types in correct export order

**Example:**
```typescript
import { getExportOrder } from '@/lib/studio/components/cms/_core/export-ordering'

const allComponents = getExportOrder()
// Returns all component types sorted for export
```

### `getDependencies(componentType: string): string[]`

Gets the direct dependencies of a component type.

**Parameters:**
- `componentType`: Component type to check

**Returns:**
- Array of component types this component depends on

**Example:**
```typescript
import { getDependencies, ComponentType } from '@/lib/studio/components/cms/_core/export-ordering'

const deps = getDependencies(ComponentType.NavBar)
// Returns: [NavMenuItem, MobileMenu]
```

### `getDependents(componentType: string): string[]`

Gets all components that depend on the given component type (reverse dependencies).

**Parameters:**
- `componentType`: Component type to check

**Returns:**
- Array of component types that depend on this component

**Example:**
```typescript
import { getDependents, ComponentType } from '@/lib/studio/components/cms/_core/export-ordering'

const dependents = getDependents(ComponentType.NavMenuItem)
// Returns: [NavBar, Footer, SideMenu, SidebarNav]
```

### `isSubComponent(componentType: string): boolean`

Checks if a component is used as a sub-component by other components.

**Parameters:**
- `componentType`: Component type to check

**Returns:**
- `true` if component is a dependency of other components

**Example:**
```typescript
import { isSubComponent, ComponentType } from '@/lib/studio/components/cms/_core/export-ordering'

isSubComponent(ComponentType.AccordionItem) // true
isSubComponent(ComponentType.NavBar) // false
```

### `validateDependencies(): object`

Validates the dependency graph for issues (circular dependencies, missing types).

**Returns:**
- Validation result object with:
  - `valid`: boolean indicating if graph is valid
  - `circularDependencies`: array of circular dependency chains
  - `missingTypes`: array of component types not in ComponentType enum

**Example:**
```typescript
import { validateDependencies } from '@/lib/studio/components/cms/_core/export-ordering'

const validation = validateDependencies()
if (!validation.valid) {
  console.error('Dependency issues:', validation)
}
```

## Use Cases

### 1. Component Library Export

When exporting components to a standalone library:

```typescript
import { getExportOrder } from '@/lib/studio/components/cms/_core/export-ordering'
import { getDefinition } from '@/lib/studio/components/cms/_core/definition-loader'

async function exportComponentLibrary() {
  const exportOrder = getExportOrder()

  for (const componentType of exportOrder) {
    const definition = getDefinition(componentType)
    if (!definition) continue

    // Generate component file
    const componentCode = generateComponentCode(definition)

    // Write to file system
    await writeComponentFile(componentType, componentCode)
  }
}
```

### 2. Build Pipeline Integration

When building a component bundle:

```typescript
import { sortForExport } from '@/lib/studio/components/cms/_core/export-ordering'

function buildComponentBundle(selectedComponents: ComponentType[]) {
  // Sort selected components for export
  const sorted = sortForExport(selectedComponents)

  // Build bundle in correct order
  const bundle = sorted.map(type => {
    return requireComponent(type)
  }).join('\n\n')

  return bundle
}
```

### 3. Code Generation

When generating TypeScript/React code:

```typescript
import { sortForExport } from '@/lib/studio/components/cms/_core/export-ordering'

function generateComponentFile(componentTypes: string[]): string {
  const sorted = sortForExport(componentTypes)

  const imports = sorted.map(type =>
    `import { ${type} } from './${type}'`
  ).join('\n')

  const exports = sorted.map(type =>
    `export { ${type} }`
  ).join('\n')

  return `${imports}\n\n${exports}`
}
```

### 4. Dependency Analysis

When analyzing component relationships:

```typescript
import { getDependents, isSubComponent } from '@/lib/studio/components/cms/_core/export-ordering'

function analyzeComponentImpact(componentType: string) {
  const dependents = getDependents(componentType)
  const isSub = isSubComponent(componentType)

  return {
    type: componentType,
    isSubComponent: isSub,
    affectedComponents: dependents,
    impactLevel: dependents.length > 0 ? 'high' : 'low'
  }
}
```

## Algorithm Details

The utility uses **Kahn's algorithm** for topological sorting:

1. Build a directed graph where edges point from dependencies to dependents
2. Calculate in-degree (number of dependencies) for each node
3. Start with nodes that have no dependencies (in-degree = 0)
4. Process queue: remove node, add to result, decrease in-degree of dependents
5. When a node's in-degree reaches 0, add it to queue
6. If result doesn't contain all nodes, there's a circular dependency

## Error Handling

### Circular Dependencies

If circular dependencies are detected, the utility will:
1. Log a warning to console
2. Return a result with as many sorted components as possible
3. Append remaining components to the end

```typescript
const result = sortForExport([...componentsWithCircularDep])
// Console warning: [export-ordering] Circular dependency detected...
// Result still contains all components (best effort)
```

### Unknown Component Types

Unknown component types are passed through without error:

```typescript
const result = sortForExport(['unknown-type', ComponentType.HeroSimple])
// Result: ['unknown-type', 'hero-simple']
// No error, graceful handling
```

## Extending the Dependency Map

To add new component dependencies, update `COMPONENT_DEPENDENCIES` in `export-ordering.ts`:

```typescript
const COMPONENT_DEPENDENCIES: Record<string, string[]> = {
  // Existing entries...

  // Add new parent-child relationships
  [ComponentType.MyNewComponent]: [
    ComponentType.MySubComponent1,
    ComponentType.MySubComponent2
  ],
}
```

## Testing

Comprehensive tests are available in `__tests__/export-ordering.test.ts`:

```bash
npm test -- export-ordering.test.ts
```

Tests cover:
- Empty array handling
- Single component sorting
- Complex dependency chains
- Edge cases (duplicates, unknown types)
- Dependency queries (getDependencies, getDependents)
- Validation (circular dependencies, missing types)

## Performance

- **Time Complexity**: O(V + E) where V = number of components, E = number of dependencies
- **Space Complexity**: O(V + E) for graph representation
- **Typical Performance**: Sub-millisecond for ~100 components

## Best Practices

1. **Always validate before export**: Run `validateDependencies()` to catch issues early
2. **Cache export order**: If exporting multiple times, cache the result of `getExportOrder()`
3. **Use with definition loader**: Combine with `getAllDefinitions()` for complete metadata
4. **Handle missing components**: Check if component exists before using it in export
5. **Update dependencies proactively**: When adding new components, update `COMPONENT_DEPENDENCIES`

## Related Files

- `lib/studio/components/cms/_core/export-ordering.ts` - Implementation
- `lib/studio/components/cms/_core/__tests__/export-ordering.test.ts` - Tests
- `lib/studio/components/cms/_core/definition-loader.ts` - Component definitions
- `lib/studio/components/cms/_core/types.ts` - Component types
