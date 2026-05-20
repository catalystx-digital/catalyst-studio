#!/usr/bin/env node

/**
 * Database Reset Utility
 * Provides comprehensive database reset functionality with various options
 */

import { execSync } from 'child_process'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { parse } from 'url'

// Parse command line arguments
const args = process.argv.slice(2)
const flags = {
  force: args.includes('--force') || args.includes('-f'),
  seed: args.includes('--seed') || args.includes('-s'),
  migrate: args.includes('--migrate') || args.includes('-m'),
  clean: args.includes('--clean') || args.includes('-c'),
  help: args.includes('--help') || args.includes('-h'),
  verbose: args.includes('--verbose') || args.includes('-v')
}

// Help text
const helpText = `
Database Reset Utility

Usage: npx tsx scripts/reset-db.ts [options]

Options:
  --force, -f      Force reset without confirmation
  --seed, -s       Run seeding after reset
  --migrate, -m    Run migrations after reset
  --clean, -c      Only clean database file (SQLite)
  --verbose, -v    Show detailed output
  --help, -h       Show this help message

Examples:
  npx tsx scripts/reset-db.ts                    # Interactive reset
  npx tsx scripts/reset-db.ts --force --seed     # Force reset and seed
  npx tsx scripts/reset-db.ts --clean            # Clean SQLite file only
  npx tsx scripts/reset-db.ts --migrate --seed   # Reset, migrate, and seed
`

// Show help if requested
if (flags.help) {
  console.log(helpText)
  process.exit(0)
}

// Logger utility
const log = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  error: (msg: string) => console.error(`❌ ${msg}`),
  warning: (msg: string) => console.log(`⚠️  ${msg}`),
  verbose: (msg: string) => flags.verbose && console.log(`🔍 ${msg}`)
}

// Execute command with error handling
function executeCommand(command: string, description: string) {
  try {
    log.verbose(`Executing: ${command}`)
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: flags.verbose ? 'inherit' : 'pipe'
    })
    if (!flags.verbose && output) {
      console.log(output)
    }
    log.success(description)
    return true
  } catch (error: any) {
    log.error(`Failed to ${description.toLowerCase()}`)
    if (flags.verbose) {
      console.error(error.message)
    }
    return false
  }
}

// Get database URL from environment
function getDatabaseUrl(): string {
  const envFile = join(process.cwd(), '.env.local')
  if (existsSync(envFile)) {
    require('dotenv').config({ path: envFile })
  } else {
    require('dotenv').config()
  }
  
  return process.env.DATABASE_URL || 'file:./dev.db'
}

// Clean SQLite database file
function cleanSQLiteDatabase(dbUrl: string): boolean {
  if (!dbUrl.startsWith('file:')) {
    log.warning('Clean operation only works with SQLite databases')
    return false
  }
  
  const dbPath = dbUrl.replace('file:', '')
  const absolutePath = join(process.cwd(), dbPath)
  
  log.verbose(`Database path: ${absolutePath}`)
  
  // Remove database files
  const files = [
    absolutePath,
    `${absolutePath}-journal`,
    `${absolutePath}-wal`,
    `${absolutePath}-shm`
  ]
  
  let cleaned = false
  for (const file of files) {
    if (existsSync(file)) {
      try {
        unlinkSync(file)
        log.verbose(`Removed: ${file}`)
        cleaned = true
      } catch (error: any) {
        log.error(`Failed to remove ${file}: ${error.message}`)
      }
    }
  }
  
  if (cleaned) {
    log.success('Database files cleaned')
  } else {
    log.info('No database files to clean')
  }
  
  return true
}

// Confirm action with user
async function confirmAction(message: string): Promise<boolean> {
  if (flags.force) {
    return true
  }
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  return new Promise((resolve) => {
    readline.question(`${message} (y/N): `, (answer: string) => {
      readline.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

// Main reset function
async function resetDatabase() {
  console.log('🔄 Database Reset Utility\n')
  
  const dbUrl = getDatabaseUrl()
  const isSQLite = dbUrl.startsWith('file:')
  
  log.info(`Database: ${isSQLite ? 'SQLite' : 'PostgreSQL/MySQL'}`)
  log.verbose(`Connection: ${dbUrl}`)
  
  // Clean only mode
  if (flags.clean) {
    if (isSQLite) {
      cleanSQLiteDatabase(dbUrl)
    } else {
      log.warning('Clean mode only works with SQLite databases')
      log.info('Use --force --migrate for other databases')
    }
    return
  }
  
  // Confirm reset
  const confirmed = await confirmAction(
    '⚠️  This will DELETE ALL DATA in the database. Continue?'
  )
  
  if (!confirmed) {
    log.info('Reset cancelled')
    return
  }
  
  console.log('')
  
  // Step 1: Clean database (SQLite only)
  if (isSQLite) {
    log.info('Step 1: Cleaning database files...')
    cleanSQLiteDatabase(dbUrl)
  }
  
  // Step 2: Run migrations
  if (flags.migrate || !isSQLite) {
    log.info('Step 2: Running migrations...')
    const migrationSuccess = executeCommand(
      'npx prisma migrate deploy',
      'Migrations applied'
    )
    
    if (!migrationSuccess) {
      log.warning('Migration failed, trying to create new migration...')
      executeCommand(
        'npx prisma migrate dev --name init --skip-seed',
        'Initial migration created'
      )
    }
  } else {
    // For SQLite without migrate flag, use reset
    log.info('Step 2: Resetting database with Prisma...')
    executeCommand(
      'npx prisma migrate reset --force --skip-seed',
      'Database reset'
    )
  }
  
  // Step 3: Generate Prisma client
  log.info('Step 3: Generating Prisma client...')
  executeCommand(
    'npx prisma generate',
    'Prisma client generated'
  )
  
  // Step 4: Seed database
  if (flags.seed) {
    log.info('Step 4: Seeding database...')
    executeCommand(
      'npm run db:seed',
      'Database seeded'
    )
  }
  
  console.log('')
  log.success('🎉 Database reset completed successfully!')
  
  // Show next steps
  console.log('\n📝 Next steps:')
  if (!flags.seed) {
    console.log('  - Run `npm run db:seed` to add sample data')
  }
  console.log('  - Run `npm run dev` to start the development server')
  console.log('  - Run `npm run db:studio` to open Prisma Studio')
}

// Error handler
process.on('unhandledRejection', (error: any) => {
  log.error(`Unhandled error: ${error.message}`)
  process.exit(1)
})

// Run the reset
resetDatabase().catch((error) => {
  log.error(`Reset failed: ${error.message}`)
  process.exit(1)
})