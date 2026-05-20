#!/usr/bin/env tsx
/**
 * Component Migration Validator
 *
 * Validates the migration progress from old format (*.propsmeta.ts) to new format (*.def.ts).
 * Scans all component folders and identifies which components have been migrated.
 *
 * Migration criteria:
 * - Migrated: Has *.def.ts file
 * - Not migrated: Has only *.propsmeta.ts file (no *.def.ts)
 *
 * Usage:
 *   tsx scripts/validate-component-migration.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import { glob } from 'glob'

interface MigrationStatus {
  componentPath: string
  componentName: string
  category: string
  hasDefFile: boolean
  hasPropsMetaFile: boolean
  status: 'migrated' | 'not-migrated' | 'partial'
}

interface MigrationReport {
  timestamp: string
  totalComponents: number
  migrated: number
  notMigrated: number
  partial: number
  migrationPercentage: string
  migratedComponents: string[]
  notMigratedComponents: string[]
  partialComponents: string[]
  statusByCategory: Record<string, {
    total: number
    migrated: number
    notMigrated: number
  }>
}

const CMS_COMPONENTS_DIR = path.join(process.cwd(), 'lib/studio/components/cms')

// Directories to ignore
const IGNORE_DIRS = [
  '_core',
  '_factory',
  '_generated',
  '__tests__',
  'node_modules',
  'adapters'
]

async function findComponentFolders(): Promise<string[]> {
  const categories = fs.readdirSync(CMS_COMPONENTS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !IGNORE_DIRS.includes(entry.name))
    .map(entry => entry.name)

  const componentFolders: string[] = []

  for (const category of categories) {
    const categoryPath = path.join(CMS_COMPONENTS_DIR, category)
    const components = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !IGNORE_DIRS.includes(entry.name))
      .map(entry => path.join(category, entry.name))

    componentFolders.push(...components)
  }

  return componentFolders
}

async function checkMigrationStatus(componentPath: string): Promise<MigrationStatus> {
  const fullPath = path.join(CMS_COMPONENTS_DIR, componentPath)
  const componentName = path.basename(componentPath)
  const category = path.dirname(componentPath)

  // Check for *.def.ts file
  const defFiles = await glob('*.def.ts', { cwd: fullPath })
  const hasDefFile = defFiles.length > 0

  // Check for *.propsmeta.ts file
  const propsMetaFiles = await glob('*.propsmeta.ts', { cwd: fullPath })
  const hasPropsMetaFile = propsMetaFiles.length > 0

  // Determine status
  let status: 'migrated' | 'not-migrated' | 'partial'
  if (hasDefFile && hasPropsMetaFile) {
    status = 'migrated' // Has both (legacy kept for backward compat)
  } else if (hasDefFile) {
    status = 'migrated' // New format only
  } else if (hasPropsMetaFile) {
    status = 'not-migrated' // Old format only
  } else {
    status = 'partial' // Neither (component might be incomplete)
  }

  return {
    componentPath,
    componentName,
    category,
    hasDefFile,
    hasPropsMetaFile,
    status
  }
}

async function generateReport(): Promise<MigrationReport> {
  console.log('🔍 Scanning component folders...')

  const componentFolders = await findComponentFolders()
  console.log(`📂 Found ${componentFolders.length} component folders`)

  const statuses = await Promise.all(
    componentFolders.map(folder => checkMigrationStatus(folder))
  )

  // Categorize components
  const migrated = statuses.filter(s => s.status === 'migrated')
  const notMigrated = statuses.filter(s => s.status === 'not-migrated')
  const partial = statuses.filter(s => s.status === 'partial')

  // Calculate percentage
  const totalValid = migrated.length + notMigrated.length
  const percentage = totalValid > 0
    ? ((migrated.length / totalValid) * 100).toFixed(1)
    : '0.0'

  // Group by category
  const statusByCategory: Record<string, { total: number; migrated: number; notMigrated: number }> = {}

  statuses.forEach(status => {
    if (!statusByCategory[status.category]) {
      statusByCategory[status.category] = { total: 0, migrated: 0, notMigrated: 0 }
    }
    statusByCategory[status.category].total++
    if (status.status === 'migrated') {
      statusByCategory[status.category].migrated++
    } else if (status.status === 'not-migrated') {
      statusByCategory[status.category].notMigrated++
    }
  })

  return {
    timestamp: new Date().toISOString(),
    totalComponents: statuses.length,
    migrated: migrated.length,
    notMigrated: notMigrated.length,
    partial: partial.length,
    migrationPercentage: `${percentage}%`,
    migratedComponents: migrated.map(s => `${s.category}/${s.componentName}`).sort(),
    notMigratedComponents: notMigrated.map(s => `${s.category}/${s.componentName}`).sort(),
    partialComponents: partial.map(s => `${s.category}/${s.componentName}`).sort(),
    statusByCategory
  }
}

function printReport(report: MigrationReport): void {
  console.log('\n' + '='.repeat(70))
  console.log('📊 Component Migration Status Report')
  console.log('='.repeat(70))
  console.log(`\n⏰ Generated: ${new Date(report.timestamp).toLocaleString()}`)

  console.log('\n📈 Overall Progress:')
  console.log(`   Total Components: ${report.totalComponents}`)
  console.log(`   ✅ Migrated: ${report.migrated}/${report.totalComponents - report.partial} (${report.migrationPercentage})`)
  console.log(`   ❌ Not Migrated: ${report.notMigrated}/${report.totalComponents - report.partial}`)
  if (report.partial > 0) {
    console.log(`   ⚠️  Incomplete: ${report.partial}`)
  }

  // Progress bar
  const barLength = 50
  const validTotal = report.totalComponents - report.partial
  const migratedBars = Math.round((report.migrated / validTotal) * barLength)
  const notMigratedBars = barLength - migratedBars
  console.log('\n   Progress:')
  console.log(`   [${'█'.repeat(migratedBars)}${'░'.repeat(notMigratedBars)}]`)

  // By category
  console.log('\n📦 Migration Status by Category:')
  const categories = Object.keys(report.statusByCategory).sort()
  categories.forEach(category => {
    const stats = report.statusByCategory[category]
    const categoryPct = stats.total > 0
      ? ((stats.migrated / (stats.migrated + stats.notMigrated)) * 100).toFixed(0)
      : '0'
    console.log(`   ${category.padEnd(20)} ${stats.migrated.toString().padStart(2)}/${stats.total.toString().padStart(2)} (${categoryPct.padStart(3)}%)`)
  })

  if (report.migratedComponents.length > 0) {
    console.log('\n✅ Migrated Components:')
    report.migratedComponents.forEach(comp => {
      console.log(`   - ${comp}`)
    })
  }

  if (report.notMigratedComponents.length > 0) {
    console.log('\n❌ Not Migrated Components:')
    report.notMigratedComponents.slice(0, 20).forEach(comp => {
      console.log(`   - ${comp}`)
    })
    if (report.notMigratedComponents.length > 20) {
      console.log(`   ... and ${report.notMigratedComponents.length - 20} more`)
    }
  }

  if (report.partialComponents.length > 0) {
    console.log('\n⚠️  Incomplete Components (missing both .def.ts and .propsmeta.ts):')
    report.partialComponents.forEach(comp => {
      console.log(`   - ${comp}`)
    })
  }

  console.log('\n' + '='.repeat(70))
  console.log('💡 Next Steps:')
  console.log('   1. Migrate components using: npm run cms:create')
  console.log('   2. Review hero-simple.def.ts as reference example')
  console.log('   3. Re-run this validator to track progress')
  console.log('='.repeat(70) + '\n')
}

// Run the validator
async function main() {
  try {
    const report = await generateReport()
    printReport(report)

    // Save report to file
    const outputDir = path.join(CMS_COMPONENTS_DIR, '_generated')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const outputFile = path.join(outputDir, 'migration-report.json')
    fs.writeFileSync(outputFile, JSON.stringify(report, null, 2), 'utf-8')
    console.log(`📄 Full report saved to: ${outputFile}\n`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Error generating migration report:', error)
    process.exit(1)
  }
}

main()
