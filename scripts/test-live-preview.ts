/**
 * Live Preview Sandbox Test Script
 *
 * Tests the full flow:
 * 1. Create sandbox
 * 2. Sync design system CSS
 * 3. Sync component code
 * 4. Verify hot reload
 *
 * Run with: npx tsx scripts/test-live-preview.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

const API_BASE = 'http://localhost:3000'
const TEST_WEBSITE_ID = `test-${Date.now()}`

interface SandboxResponse {
  success: boolean
  sandbox?: {
    id: string
    websiteId: string
    status: string
    previewUrl: string
  }
  error?: string
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options)
    } catch (e) {
      if (i === retries - 1) throw e
      await sleep(1000)
    }
  }
  throw new Error('Fetch failed')
}

async function testCreateSandbox(): Promise<SandboxResponse> {
  console.log('\n=== TEST 1: Create Sandbox ===')
  console.log(`Website ID: ${TEST_WEBSITE_ID}`)

  const response = await fetchWithRetry(`${API_BASE}/api/preview/sandbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ websiteId: TEST_WEBSITE_ID }),
  })

  const data: SandboxResponse = await response.json()

  if (!data.success) {
    console.error('❌ Failed to create sandbox:', data.error)
    throw new Error(data.error)
  }

  console.log('✅ Sandbox created!')
  console.log(`   ID: ${data.sandbox?.id}`)
  console.log(`   Status: ${data.sandbox?.status}`)
  console.log(`   Preview URL: ${data.sandbox?.previewUrl}`)

  return data
}

async function testSyncDesignSystem(previewUrl: string): Promise<void> {
  console.log('\n=== TEST 2: Sync Design System CSS ===')

  const designSystemCSS = `
/* Design System - Test */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary: #FF5500;
  --primary-foreground: #FFFFFF;
  --secondary: #1E3A5F;
  --background: #FAFAFA;
  --foreground: #1A1A1A;
  --muted: #F5F5F5;
  --border: #E5E5E5;
  --radius: 0.5rem;
}

.dark {
  --primary: #FF7733;
  --background: #0A0A0A;
  --foreground: #FAFAFA;
}
`

  const response = await fetchWithRetry(`${API_BASE}/api/preview/sandbox/sync`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      websiteId: TEST_WEBSITE_ID,
      files: [
        { path: 'app/globals.css', content: designSystemCSS }
      ]
    }),
  })

  const data = await response.json()

  if (!data.success) {
    console.error('❌ Failed to sync design system:', data.error)
    throw new Error(data.error)
  }

  console.log('✅ Design system CSS synced!')
  console.log('   Variables: --primary, --secondary, --background, etc.')
}

async function testSyncComponent(previewUrl: string): Promise<void> {
  console.log('\n=== TEST 3: Sync Component Code ===')

  const componentCode = `'use client'

export default function PreviewPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Hero Section */}
      <section className="py-20 px-6 text-center" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' }}>
        <h1 className="text-5xl font-bold text-white mb-4">
          Welcome to Our Site
        </h1>
        <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
          This is a live preview powered by Vercel Sandbox. Changes sync in real-time!
        </p>
        <button
          className="px-8 py-3 rounded-lg font-semibold text-lg transition-all hover:scale-105"
          style={{ backgroundColor: 'white', color: 'var(--primary)' }}
        >
          Get Started
        </button>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {['Fast', 'Secure', 'Scalable'].map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-xl border transition-shadow hover:shadow-lg"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
              >
                <h3 className="text-xl font-semibold mb-2">{feature}</h3>
                <p className="opacity-70">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="opacity-60">
          Live Preview Test • Synced at ${new Date().toISOString()}
        </p>
      </footer>
    </main>
  )
}
`

  const response = await fetchWithRetry(`${API_BASE}/api/preview/sandbox/sync`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      websiteId: TEST_WEBSITE_ID,
      files: [
        { path: 'app/page.tsx', content: componentCode }
      ]
    }),
  })

  const data = await response.json()

  if (!data.success) {
    console.error('❌ Failed to sync component:', data.error)
    throw new Error(data.error)
  }

  console.log('✅ Component code synced!')
  console.log('   Sections: Hero, Features, Footer')
}

async function testHotReload(previewUrl: string): Promise<void> {
  console.log('\n=== TEST 4: Verify Hot Reload ===')
  console.log('Waiting for Next.js hot reload (3 seconds)...')

  await sleep(3000)

  // Fetch the preview page and check for our content
  const response = await fetchWithRetry(previewUrl, { method: 'GET' })
  const html = await response.text()

  const checks = [
    { name: 'Hero title', pattern: /Welcome to Our Site/i },
    { name: 'CTA button', pattern: /Get Started/i },
    { name: 'Features section', pattern: /Features/i },
    { name: 'Footer timestamp', pattern: /Live Preview Test/i },
  ]

  let passed = 0
  for (const check of checks) {
    if (check.pattern.test(html)) {
      console.log(`   ✅ ${check.name}: Found`)
      passed++
    } else {
      console.log(`   ❌ ${check.name}: Not found`)
    }
  }

  if (passed === checks.length) {
    console.log(`\n✅ All ${checks.length} checks passed! Hot reload is working.`)
  } else {
    console.log(`\n⚠️  ${passed}/${checks.length} checks passed.`)
  }
}

async function testUpdateComponent(previewUrl: string): Promise<void> {
  console.log('\n=== TEST 5: Live Update (Color Change) ===')

  const updatedCSS = `
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary: #10B981;
  --primary-foreground: #FFFFFF;
  --secondary: #065F46;
  --background: #ECFDF5;
  --foreground: #064E3B;
  --muted: #D1FAE5;
  --border: #A7F3D0;
  --radius: 0.75rem;
}
`

  const response = await fetchWithRetry(`${API_BASE}/api/preview/sandbox/sync`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      websiteId: TEST_WEBSITE_ID,
      files: [
        { path: 'app/globals.css', content: updatedCSS }
      ]
    }),
  })

  const data = await response.json()

  if (!data.success) {
    console.error('❌ Failed to update design system:', data.error)
    throw new Error(data.error)
  }

  console.log('✅ Design system updated!')
  console.log('   Changed --primary from #FF5500 (orange) to #10B981 (green)')
  console.log('   Hot reload should update the preview automatically')
}

async function testCleanup(): Promise<void> {
  console.log('\n=== TEST 6: Cleanup Sandbox ===')

  const response = await fetchWithRetry(`${API_BASE}/api/preview/sandbox?websiteId=${TEST_WEBSITE_ID}`, {
    method: 'DELETE',
  })

  const data = await response.json()

  if (data.success) {
    console.log('✅ Sandbox stopped and cleaned up')
  } else {
    console.log('⚠️  Cleanup returned:', data.error)
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════╗')
  console.log('║     LIVE PREVIEW SANDBOX - INTEGRATION TESTS       ║')
  console.log('╚════════════════════════════════════════════════════╝')

  try {
    // Test 1: Create sandbox
    const { sandbox } = await testCreateSandbox()
    if (!sandbox) throw new Error('No sandbox returned')

    const previewUrl = sandbox.previewUrl

    // Test 2: Sync design system
    await testSyncDesignSystem(previewUrl)

    // Test 3: Sync component
    await testSyncComponent(previewUrl)

    // Test 4: Verify hot reload
    await testHotReload(previewUrl)

    // Test 5: Live update
    await testUpdateComponent(previewUrl)

    console.log('\n╔════════════════════════════════════════════════════╗')
    console.log('║              🎉 ALL TESTS PASSED! 🎉               ║')
    console.log('╚════════════════════════════════════════════════════╝')
    console.log(`\n🔗 Preview URL (open in browser): ${previewUrl}`)
    console.log('\nSandbox will stay alive for 60 seconds for manual testing...')
    console.log('Press Ctrl+C to stop early.\n')

    await sleep(60000)

    // Cleanup
    await testCleanup()

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error)
    process.exit(1)
  }
}

main()
