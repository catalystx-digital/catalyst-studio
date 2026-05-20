/**
 * Verify LLM prompts show expanded type structures
 * Run with: npx tsx scripts/verify-llm-prompts.ts
 */

import { buildPromptContractBundle, clearPromptContractBundleCache } from '../lib/studio/ai/prompt-contract-builder'

async function verifyLLMPrompts() {
  console.log('='.repeat(60))
  console.log('LLM Prompt Type Verification')
  console.log('='.repeat(60))
  console.log('')

  // Clear cache to ensure fresh build
  clearPromptContractBundleCache()

  const bundle = await buildPromptContractBundle({ forceRefresh: true })

  console.log(`Registry size: ${bundle.registrySize}`)
  console.log(`Components: ${bundle.components.length}`)
  console.log(`Subcomponents: ${bundle.subcomponents.length}`)
  console.log(`Warnings: ${bundle.warnings.length}`)
  console.log('')

  // Find hero-with-image component
  const heroWithImage = bundle.components.find(c => c.type === 'hero-with-image')

  if (!heroWithImage) {
    console.log('✗ hero-with-image component not found!')
    process.exit(1)
  }

  console.log('► hero-with-image Component Fields')
  console.log('-'.repeat(60))

  let hasExpandedTypes = true
  const tests: [string, boolean, string][] = []

  heroWithImage.fields.forEach(field => {
    console.log(`  ${field.name}: ${field.type.substring(0, 80)}${field.type.length > 80 ? '...' : ''}`)

    // Check specific fields for expanded types
    if (field.name === 'image') {
      const hasBackgroundPosition = field.type.includes('backgroundPosition')
      const hasObjectFit = field.type.includes('objectFit')
      tests.push(['image field has backgroundPosition', hasBackgroundPosition, field.type])
      tests.push(['image field has objectFit', hasObjectFit, field.type])
      if (!hasBackgroundPosition || !hasObjectFit) hasExpandedTypes = false
    }

    if (field.name === 'ctaButtons') {
      const hasLabel = field.type.includes('label: string')
      const hasHref = field.type.includes('href: string')
      const isArray = field.type.includes('Array<')
      tests.push(['ctaButtons is Array type', isArray, field.type])
      tests.push(['ctaButtons has label: string', hasLabel, field.type])
      tests.push(['ctaButtons has href: string', hasHref, field.type])
      if (!hasLabel || !hasHref || !isArray) hasExpandedTypes = false
    }
  })

  console.log('')
  console.log('► Type Expansion Verification')
  console.log('-'.repeat(60))

  tests.forEach(([name, passed, type]) => {
    console.log(`  ${passed ? '✓' : '✗'} ${name}`)
  })

  console.log('')

  // Check for [object Object] in any type
  const hasObjectObject = heroWithImage.fields.some(f => f.type.includes('[object Object]'))
  console.log(`  ${!hasObjectObject ? '✓' : '✗'} No [object Object] in type strings`)

  // Check for unresolved custom types like 'HeroWithImageCTA[]'
  const hasUnresolvedTypes = heroWithImage.fields.some(f =>
    /^[A-Z][a-zA-Z]+\[\]$/.test(f.type) || // e.g., "CTAButton[]"
    /^[A-Z][a-zA-Z]+$/.test(f.type) // e.g., "HeroImage" (without expansion)
  )
  console.log(`  ${!hasUnresolvedTypes ? '✓' : '✗'} No unresolved custom type names`)

  console.log('')
  console.log('='.repeat(60))

  if (hasExpandedTypes && !hasObjectObject && !hasUnresolvedTypes) {
    console.log('✓ LLM prompts show expanded type structures correctly!')
    console.log('='.repeat(60))
    process.exit(0)
  } else {
    console.log('✗ Some type expansions failed')
    console.log('='.repeat(60))
    process.exit(1)
  }
}

verifyLLMPrompts().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
