/**
 * Tests for Schema Accessor
 */

import { describe, it, expect, beforeAll } from '@jest/globals'
import { getSchemaForContent, clearAllSchemaCaches, getSchemaCacheStats } from '../schema-accessor'
import { ComponentType } from '../../_core/types'

describe('getSchemaForContent', () => {
  it('should return FieldSchema[] for valid component type', async () => {
    const schema = await getSchemaForContent(ComponentType.HeroBanner)

    expect(Array.isArray(schema)).toBe(true)
    expect(schema.length).toBeGreaterThan(0)

    // Check that we have expected fields from HeroBanner
    const headingField = schema.find(f => f.name === 'heading')
    expect(headingField).toBeDefined()
    expect(headingField?.type).toBe('string')
    expect(headingField?.label).toBe('Primary headline text')
  })

  it('should return empty array for unknown type', async () => {
    const schema = await getSchemaForContent('NonExistentComponent')

    expect(Array.isArray(schema)).toBe(true)
    expect(schema.length).toBe(0)
  })

  it('should cache results for performance', async () => {
    // Clear cache first
    clearAllSchemaCaches()

    // First call should populate cache
    const schema1 = await getSchemaForContent(ComponentType.HeroBanner)
    const stats1 = getSchemaCacheStats()
    expect(stats1.size).toBe(1)
    expect(stats1.types).toContain(ComponentType.HeroBanner)

    // Second call should return cached result
    const schema2 = await getSchemaForContent(ComponentType.HeroBanner)
    expect(schema2).toBe(schema1) // Same reference = cached
  })

  it('should convert Zod schema fields correctly', async () => {
    const schema = await getSchemaForContent(ComponentType.AboutSection)

    // Check various field types
    const headingField = schema.find(f => f.name === 'heading')
    expect(headingField?.type).toBe('string')
    expect(headingField?.required).toBe(true)

    const subheadingField = schema.find(f => f.name === 'subheading')
    expect(subheadingField?.required).toBe(false) // optional field

    const valuesField = schema.find(f => f.name === 'values')
    expect(valuesField?.type).toBe('array')
    expect(valuesField?.required).toBe(false)
  })

  it('should work for multiple component types', async () => {
    const heroSchema = await getSchemaForContent(ComponentType.HeroBanner)
    const aboutSchema = await getSchemaForContent(ComponentType.AboutSection)
    const navSchema = await getSchemaForContent(ComponentType.NavBar)

    expect(heroSchema.length).toBeGreaterThan(0)
    expect(aboutSchema.length).toBeGreaterThan(0)
    expect(navSchema.length).toBeGreaterThan(0)

    // Schemas should be different
    expect(heroSchema).not.toBe(aboutSchema)
    expect(heroSchema).not.toBe(navSchema)
  })
})
