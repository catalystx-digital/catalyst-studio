import { buildPageTemplatePrompt, getPageCatalogSummary } from '@/lib/studio/ai/page-catalog'

describe('page-catalog prompt builder', () => {
  it('includes registered templates and selection guidance', async () => {
    const summary = await getPageCatalogSummary(true)
    const prompt = buildPageTemplatePrompt(summary)

    expect(prompt).toContain('PAGE TEMPLATE OVERVIEW')
    expect(prompt).toContain('Home-eligible template keys')
    expect(prompt).toContain('SELECTION RULES:')
    expect(prompt).toContain('marketing/home-default')
  })
})
