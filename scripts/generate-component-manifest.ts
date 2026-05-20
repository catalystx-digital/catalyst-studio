#!/usr/bin/env tsx
/**
 * Component Manifest Generator
 *
 * Scans lib/studio/components/cms/ for all *.def.ts files and generates
 * a JSON manifest with component metadata for zero-startup-overhead discovery.
 *
 * Output: lib/studio/components/cms/_generated/component-manifest.json
 *
 * Usage:
 *   tsx scripts/generate-component-manifest.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import { glob } from 'glob'

interface ComponentManifestEntry {
  type: string
  category: string
  path: string
  aliases?: string[]
  description?: string
  keywords?: string[]
}

interface ComponentManifest {
  generatedAt: string
  totalComponents: number
  components: ComponentManifestEntry[]
}

const CMS_COMPONENTS_DIR = path.join(process.cwd(), 'lib/studio/components/cms')
const OUTPUT_DIR = path.join(CMS_COMPONENTS_DIR, '_generated')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'component-manifest.json')

async function generateManifest(): Promise<void> {
  console.log('🔍 Scanning for component definitions...')

  // Find all *.def.ts files
  const defFiles = await glob('**/*.def.ts', {
    cwd: CMS_COMPONENTS_DIR,
    absolute: false,
    ignore: ['node_modules/**', '_generated/**', '__tests__/**']
  })

  console.log(`📄 Found ${defFiles.length} definition files`)

  const components: ComponentManifestEntry[] = []

  // Process each definition file
  for (const defFile of defFiles) {
    const fullPath = path.join(CMS_COMPONENTS_DIR, defFile)
    const relativePath = path.join('lib/studio/components/cms', defFile)

    try {
      // Dynamically import the definition file
      // Convert Windows path to file:// URL for ESM compatibility
      const fileUrl = new URL(`file:///${fullPath.replace(/\\/g, '/')}`).href
      const module = await import(fileUrl)

      // Find the ComponentDefinition export
      const definitionExport = Object.values(module).find(
        (value): value is any =>
          typeof value === 'object' &&
          value !== null &&
          'type' in value &&
          'category' in value &&
          'schema' in value
      )

      if (!definitionExport) {
        console.warn(`⚠️  No definition found in ${defFile}`)
        continue
      }

      // Extract metadata
      const entry: ComponentManifestEntry = {
        type: definitionExport.type,
        category: definitionExport.category,
        path: relativePath.replace(/\\/g, '/'), // Normalize path separators
      }

      // Add optional fields if present
      if (definitionExport.description) {
        entry.description = definitionExport.description
      }

      if (definitionExport.detection?.keywords) {
        entry.keywords = definitionExport.detection.keywords
      }

      if (definitionExport.detection?.commonNames) {
        entry.aliases = definitionExport.detection.commonNames
      }

      components.push(entry)
      console.log(`✅ ${definitionExport.type}`)
    } catch (error) {
      console.error(`❌ Error processing ${defFile}:`, error)
    }
  }

  // Sort by type for deterministic output
  components.sort((a, b) => a.type.localeCompare(b.type))

  // Generate manifest
  const manifest: ComponentManifest = {
    generatedAt: new Date().toISOString(),
    totalComponents: components.length,
    components
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Write manifest
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2), 'utf-8')

  console.log(`\n✨ Manifest generated successfully!`)
  console.log(`📊 Total components: ${components.length}`)
  console.log(`📁 Output: ${OUTPUT_FILE}`)

  // Print summary by category
  const byCategory = components.reduce((acc, comp) => {
    acc[comp.category] = (acc[comp.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('\n📦 Components by category:')
  Object.entries(byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`)
    })
}

// Run the generator
generateManifest()
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error generating manifest:', error)
    process.exit(1)
  })
