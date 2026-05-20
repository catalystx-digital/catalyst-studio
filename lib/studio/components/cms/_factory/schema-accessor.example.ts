/**
 * Usage Examples for getSchemaForContent()
 *
 * This file demonstrates how to use the unified schema accessor.
 * Run with: npx tsx lib/studio/components/cms/_factory/schema-accessor.example.ts
 */

import { getSchemaForContent, getSchemaCacheStats } from './schema-accessor'
import { loadAllDefinitions } from '../_core/definition-loader'
import { ComponentType } from '../_core/types'

async function main() {
  if (process.env.NODE_ENV === 'development') {
  console.log('=== getSchemaForContent() Usage Examples ===\n')
  }

  // Note: getSchemaForContent is async and will auto-initialize definitions

  // Example 1: Get schema for a Hero component
  if (process.env.NODE_ENV === 'development') {
  console.log('Example 1: Get schema for HeroBanner')
  }
  const heroSchema = await getSchemaForContent(ComponentType.HeroBanner)
  if (process.env.NODE_ENV === 'development') {
  console.log(`- Found ${heroSchema.length} fields`)
  }
  if (process.env.NODE_ENV === 'development') {
  console.log(`- Fields: ${heroSchema.map(f => f.name).join(', ')}`)
  }
  if (process.env.NODE_ENV === 'development') {
  console.log('')
  }

  // Example 2: Get schema for an About component
  if (process.env.NODE_ENV === 'development') {
  console.log('Example 2: Get schema for AboutSection')
  }
  const aboutSchema = await getSchemaForContent(ComponentType.AboutSection)
  if (process.env.NODE_ENV === 'development') {
  console.log(`- Found ${aboutSchema.length} fields`)
  }
  if (process.env.NODE_ENV === 'development') {
  console.log(`- Sample field: ${aboutSchema[0]?.name} (${aboutSchema[0]?.type})`)
  }
  if (process.env.NODE_ENV === 'development') {
  console.log('')
  }

  // Example 3: Unknown type returns empty array
  if (process.env.NODE_ENV === 'development') {
  console.log('Example 3: Unknown type')
  }
  const unknownSchema = await getSchemaForContent('NonExistent')
  if (process.env.NODE_ENV === 'development') {
  console.log(`- Found ${unknownSchema.length} fields (expected 0)`)
  }
  if (process.env.NODE_ENV === 'development') {
  console.log('')
  }

  // Example 4: Cache statistics
  if (process.env.NODE_ENV === 'development') {
  console.log('Example 4: Cache statistics')
  }
  const stats = getSchemaCacheStats()
  if (process.env.NODE_ENV === 'development') {
  console.log(`- Cached schemas: ${stats.size}`)
  }
  if (process.env.NODE_ENV === 'development') {
  console.log(`- Types: ${stats.types.join(', ')}`)
  }
  if (process.env.NODE_ENV === 'development') {
  console.log('')
  }

  // Example 5: Inspect field details
  if (process.env.NODE_ENV === 'development') {
  console.log('Example 5: Field details for HeroBanner.heading')
  }
  const headingField = heroSchema.find(f => f.name === 'heading')
  if (headingField) {
    if (process.env.NODE_ENV === 'development') {
    console.log(`- Name: ${headingField.name}`)
    }
    if (process.env.NODE_ENV === 'development') {
    console.log(`- Type: ${headingField.type}`)
    }
    if (process.env.NODE_ENV === 'development') {
    console.log(`- Label: ${headingField.label}`)
    }
    if (process.env.NODE_ENV === 'development') {
    console.log(`- Required: ${headingField.required}`)
    }
  }
  if (process.env.NODE_ENV === 'development') {
  console.log('')
  }

  if (process.env.NODE_ENV === 'development') {
  console.log('✓ All examples completed successfully')
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error)
}
