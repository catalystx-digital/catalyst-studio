# Enhanced Seed Data System

## Overview

This modular seed data system provides comprehensive test coverage for the Epic 13 export system. It includes 45+ test cases across basic, complex, and edge case scenarios to validate all aspects of content export functionality.

## Quick Start

```bash
# Run all seed scenarios (except performance)
npm run seed

# Run with performance benchmarks
npx ts-node prisma/seed/index.ts --performance

# Run specific scenarios
npx ts-node prisma/seed/index.ts --no-basic --no-complex  # Edge cases only
npx ts-node prisma/seed/index.ts --no-edge                 # Basic and complex only
```

## Structure

```
prisma/seed/
├── index.ts              # Main orchestrator
├── basic/               # 20 basic test scenarios
│   ├── simple-content-types.ts
│   ├── basic-content-items.ts
│   └── single-level-components.ts
├── complex/             # 15 complex scenarios
│   ├── nested-components.ts
│   ├── multi-component-items.ts
│   └── large-collections.ts
├── edge-cases/          # 10 edge case scenarios
│   ├── circular-refs.ts
│   ├── max-nesting.ts
│   └── invalid-references.ts
└── utils/               # Utility functions
    ├── component-generator.ts
    └── large-dataset.ts
```

## Test Coverage

### Basic Scenarios (20 test cases)
- Simple content types with primitive fields
- Basic content items without components
- Single-level component structures
- Standard navigation and hero components
- Empty and null field handling
- Special characters and Unicode support

### Complex Scenarios (15 test cases)
- Multi-level nested components (3, 5, 8, 10, 12 levels)
  - **MVP Note**: Maximum nesting depth limited to 12 levels for performance optimization
  - Production target: 25 levels (post-MVP enhancement)
- Content with 10+ component references
- Cross-type component sharing
- Large content collections (100+ items)
- Recursive component structures
- Component networks with cross-references

### Edge Cases (10 test cases)
- Circular reference patterns (A→B→A, chains, self-references)
- Maximum nesting depth (12 levels for MVP, 25 levels planned post-MVP)
- Empty/null scenarios
- Invalid component references
- Orphaned components
- Malformed data structures
- Special characters in all fields
- Maximum field sizes (65K strings, 1000-item arrays)

## Command Options

| Option | Description |
|--------|-------------|
| `--no-basic` | Skip basic scenarios |
| `--no-complex` | Skip complex scenarios |
| `--no-edge` | Skip edge case scenarios |
| `--performance` | Include performance benchmarks |
| `--no-clean` | Don't clean database first |
| `--help` | Show help message |

## Performance Targets

Based on Epic 13 requirements:
- Small datasets (< 100 items): < 5 seconds
- Medium datasets (100-1000 items): < 30 seconds
- Large datasets (1000+ items): < 2 minutes
- Memory usage: < 512MB for all operations

## Component Patterns

### Nested Components
```javascript
// Example: 5-level nested structure
{
  type: "container",
  content: {
    nestedComponents: [{
      type: "section",
      depth: 1,
      children: [{
        type: "card",
        depth: 2,
        children: [/* continues to depth 5 */]
      }]
    }]
  }
}
```

### Circular References
```javascript
// Example: Simple circular reference
componentA.content.reference = componentB.id
componentB.content.reference = componentA.id
```

### Global vs Local Components
```javascript
// Global component (shared across pages)
{ props: { isGlobal: true }, category: "navigation" }

// Local component (page-specific)
{ props: { isGlobal: false }, category: "content" }
```

## Validation

The seed system includes built-in validation:

1. **Schema Validation**: All data conforms to Prisma schema
2. **Referential Integrity**: All references are valid
3. **Epic 13 Coverage**: Validates all export requirements
4. **Performance Metrics**: Tracks execution time and memory

## Troubleshooting

### Common Issues

#### Out of Memory Error
```bash
# Increase Node memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run seed
```

#### Slow Performance
```bash
# Run without performance tests
npx ts-node prisma/seed/index.ts --no-performance

# Clean database first
npx ts-node prisma/seed/index.ts --clean
```

#### Validation Errors
```bash
# Check for circular references
SELECT * FROM CMSComponent WHERE category = 'edge-case-circular';

# Find orphaned components
SELECT * FROM CMSComponent c
WHERE NOT EXISTS (
  SELECT 1 FROM ContentItem ci
  WHERE ci.content::text LIKE '%' || c.id || '%'
);
```

## Environment Variables

```env
# Optional: Configure batch sizes
SEED_BATCH_SIZE=100
SEED_MAX_MEMORY=512
SEED_ENABLE_LOGGING=true
```

## Integration with Export System

The seed data is designed to test:
1. **Content Type Export**: All field types and categories
2. **Content Item Export**: Various statuses and content structures
3. **Component Export**: Global/local detection and usage tracking
4. **Site Structure Export**: Folder hierarchies and navigation
5. **Error Handling**: Invalid references and malformed data

## Metrics and Reporting

After seeding, the system reports:
- Total test cases created
- Coverage for each Epic 13 requirement
- Execution time and memory usage
- Validation results
- Performance baselines

## Development

### Adding New Test Cases

1. Choose appropriate category (basic/complex/edge-case)
2. Add test function to relevant file
3. Update index.ts to include new tests
4. Document patterns in this README

### Running Tests
```bash
# Run seed tests
npm test -- seed/

# Run specific test suite
npm test -- seed/utils/component-generator.test.ts
```

## Related Documentation

- [Seed Data Audit Report](../../docs/seed-data-audit.md)
- [Gap Analysis](../../docs/seed-data-gaps.md)
- [Component Storage Patterns](../../docs/component-storage-patterns.md)
- [Complex Component Patterns](../../docs/complex-component-patterns.md)
- [Performance Baselines](../../docs/seed-performance-baseline.md)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review validation output for specific errors
3. Consult Epic 13 PRD for requirements
4. Contact development team if issues persist