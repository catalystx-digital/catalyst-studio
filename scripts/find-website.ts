#!/usr/bin/env tsx
import { resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

// Use the generated project's Prisma client
const generatedDir = resolve('tmp/head-validator/cmgu3cd8q000pv8osmwgdl8hd')
const envPath = resolve(generatedDir, '.env.local')

async function findWebsite() {
  if (!existsSync(envPath)) {
    console.log('❌ Generated .env.local not found. Run the validator first.')
    return
  }

  // Read environment variables from generated .env.local
  const envContent = readFileSync(envPath, 'utf8')
  const databaseUrlMatch = envContent.match(/^DATABASE_URL="?([^"]*)"?$/m)
  const directUrlMatch = envContent.match(/^DIRECT_URL="?([^"]*)"?$/m)

  if (!databaseUrlMatch) {
    console.log('❌ DATABASE_URL not found in generated .env.local')
    return
  }

  const databaseUrl = databaseUrlMatch[1]

  console.log('🔍 Searching for website in database...')
  console.log(`   Using: ${databaseUrl.substring(0, 50)}...`)
  console.log('')

  // Use a simple PostgreSQL query to find websites
  const { spawn } = await import('node:child_process')

  return new Promise((resolve, reject) => {
    const child = spawn('psql', [databaseUrl, '-c', `
      SELECT
        id,
        name,
        domain,
        is_active as "isActive",
        created_at as "createdAt"
      FROM "Website"
      ORDER BY created_at DESC
      LIMIT 10;
    `], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    })

    let output = ''
    let error = ''

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        output += data.toString()
      })
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        error += data.toString()
      })
    }

    child.on('close', (code) => {
      if (code === 0) {
        const lines = output.trim().split('\n')

        if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
          console.log('❌ No websites found in the database')
          return
        }

        // Skip header if present
        const dataLines = lines[0].includes('id') ? lines.slice(1) : lines

        if (dataLines.length === 0) {
          console.log('❌ No website data found')
          return
        }

        console.log('✅ Recent websites in database:')
        console.log('')

        // Parse and display results
        dataLines.forEach((line, index) => {
          if (line.trim()) {
            const parts = line.split('|').map(p => p.trim())
            if (parts.length >= 4) {
              const [id, name, domain, isActive] = parts
              const status = isActive === 'true' ? '🟢 Active' : '🔴 Inactive'
              console.log(`  ${status} ${id}`)
              console.log(`      Name: ${name}`)
              console.log(`      Domain: ${domain}`)
              console.log('')
            }
          }
        })

        console.log('💡 To validate a website, run:')
        console.log('   pnpm tsx scripts/head-validator/index.ts --website-id <WEBSITE_ID> --provider ucs --force')

      } else {
        console.log('❌ Error running database query:', error)
        console.log('   Make sure psql is installed and the database is accessible')
      }
      resolve()
    })

    child.on('error', (err) => {
      console.log('❌ Failed to run psql command. Make sure PostgreSQL client tools are installed.')
      console.log('   Error:', err.message)
      resolve()
    })
  })
}

findWebsite().catch(console.error)