import './lib/load-env'

const websiteId = process.argv[2] || 'cmkcbb10n0001v8m83kfgfdfl'

async function main() {
  const { PrismaClient } = await import('../lib/generated/prisma')
  const prisma = new PrismaClient()

  // Get pages and their content
  const pages = await prisma.websitePage.findMany({
    where: { websiteId },
    select: { id: true, title: true, type: true, content: true },
    orderBy: { createdAt: 'asc' }
  })

  console.log(`=== PAGES FOR ${websiteId} ===\n`)

  for (const page of pages) {
    console.log(`PAGE: ${page.title} (${page.type})`)
    console.log('---')

    const content = page.content as { components?: unknown[] } | null
    const components = content?.components || []

    for (const comp of components) {
      const c = comp as Record<string, unknown>
      const compContent = c?.content as Record<string, unknown> | null

      console.log('  TYPE: ' + c?.type)

      if (c?.type === 'stats-grid') {
        console.log('  STATS CONTENT: ' + JSON.stringify(compContent, null, 2))
      }
      if (c?.type === 'testimonials') {
        const testimonials = compContent?.testimonials as unknown[] | undefined
        console.log('  TESTIMONIALS COUNT: ' + (testimonials?.length || 0))
      }
      if (c?.type === 'footer') {
        console.log('  FOOTER badges: ' + JSON.stringify(compContent?.badges || 'NONE'))
        console.log('  FOOTER certifications: ' + JSON.stringify(compContent?.certifications || 'NONE'))
        console.log('  FOOTER paymentIcons: ' + JSON.stringify(compContent?.paymentIcons || 'NONE'))
        console.log('  FOOTER newsletter: ' + JSON.stringify(compContent?.newsletter || 'NONE'))
      }
      console.log('')
    }
    console.log('='.repeat(50))
  }

  await prisma.$disconnect()
}

main()
