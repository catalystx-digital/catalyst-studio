/**
 * Manual test runner for type-strings.ts
 * Run with: npx tsx scripts/test-type-strings.ts
 */

import {
  CTAButton,
  CTAButtonAlt,
  Link,
  Image,
  BackgroundSettings,
  HeroCTA,
  HeroImage,
  HeroMedia,
  NavItem,
  FooterColumn,
  TYPE_STRINGS,
} from '../lib/studio/components/cms/_core/type-strings'

type TestCase = [string, boolean]

function runTests() {
  console.log('='.repeat(60))
  console.log('Type Strings Test Suite')
  console.log('='.repeat(60))
  console.log('')

  const tests: TestCase[] = []

  // Basic type constants
  console.log('► Basic Type Constants')
  tests.push(['CTAButton contains label: string', CTAButton.includes('label: string')])
  tests.push(['CTAButton contains href: string', CTAButton.includes('href: string')])
  tests.push(['CTAButton contains variant?:', CTAButton.includes('variant?:')])
  tests.push(['CTAButtonAlt uses text: string', CTAButtonAlt.includes('text: string')])
  tests.push(['CTAButtonAlt uses url: string', CTAButtonAlt.includes('url: string')])
  tests.push(['Image contains src?: string', Image.includes('src?: string')])
  tests.push(['Image contains alt?: string', Image.includes('alt?: string')])
  tests.push(['Link contains label: string', Link.includes('label: string')])
  tests.push(['BackgroundSettings contains overlayColor', BackgroundSettings.includes('overlayColor')])

  // Hero types
  console.log('► Hero Component Types')
  tests.push(['HeroCTA contains label: string', HeroCTA.includes('label: string')])
  tests.push(['HeroImage contains backgroundPosition', HeroImage.includes('backgroundPosition')])
  tests.push(['HeroImage contains objectFit', HeroImage.includes('objectFit')])
  tests.push(['HeroMedia contains type discriminator', HeroMedia.includes("type: 'image'|'video'|'embed'")])

  // Navigation types
  console.log('► Navigation Types')
  tests.push(['NavItem supports nested children', NavItem.includes('children?: Array<')])
  tests.push(['FooterColumn contains links array', FooterColumn.includes('links: Array<')])

  // Composed types
  console.log('► Composed Types')
  tests.push(['HeroImage includes renditions array', HeroImage.includes('renditions?: Array<')])

  // Array composition
  console.log('► Array Composition')
  const ctaArray = `Array<${CTAButton}>`
  tests.push(['Array<CTAButton> starts with Array<{', ctaArray.startsWith('Array<{')])
  tests.push(['Array<CTAButton> contains label', ctaArray.includes('label: string')])
  tests.push(['Array<CTAButton> contains href', ctaArray.includes('href: string')])

  // TYPE_STRINGS export
  console.log('► TYPE_STRINGS Export')
  tests.push(['TYPE_STRINGS.CTAButton equals CTAButton', TYPE_STRINGS.CTAButton === CTAButton])
  tests.push(['TYPE_STRINGS.Image equals Image', TYPE_STRINGS.Image === Image])
  tests.push(['TYPE_STRINGS.HeroImage equals HeroImage', TYPE_STRINGS.HeroImage === HeroImage])
  tests.push(['TYPE_STRINGS.NavItem equals NavItem', TYPE_STRINGS.NavItem === NavItem])

  // Type string format
  console.log('► Type String Format')
  tests.push(['CTAButton starts with {', CTAButton.trim().startsWith('{')])
  tests.push(['CTAButton ends with }', CTAButton.trim().endsWith('}')])
  tests.push(['Image starts with {', Image.trim().startsWith('{')])
  tests.push(['Image ends with }', Image.trim().endsWith('}')])

  // All TYPE_STRINGS entries exist
  console.log('► TYPE_STRINGS Completeness')
  const requiredKeys = [
    'CTAButton', 'CTAButtonAlt', 'Link', 'Image', 'BackgroundSettings',
    'HeroCTA', 'HeroImage', 'HeroMedia', 'HeroOverlay',
    'NavItem', 'FooterColumn', 'SocialLink', 'Logo',
    'TimelineEvent', 'FAQItem', 'TestimonialItem',
    'FormField', 'SubmitButton', 'Author', 'Category'
  ]
  requiredKeys.forEach(key => {
    tests.push([`TYPE_STRINGS has ${key}`, key in TYPE_STRINGS])
  })

  console.log('')
  console.log('='.repeat(60))
  console.log('Results')
  console.log('='.repeat(60))

  let passed = 0
  let failed = 0

  tests.forEach(([name, result]) => {
    if (result) {
      console.log('  ✓', name)
      passed++
    } else {
      console.log('  ✗', name)
      failed++
    }
  })

  console.log('')
  console.log('='.repeat(60))
  console.log(`Total: ${tests.length} tests, ${passed} passed, ${failed} failed`)
  console.log('='.repeat(60))

  if (failed > 0) {
    process.exit(1)
  }
}

runTests()
