import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'

const sitemapResponse = {
  nodes: [
    {
      id: 'node-1',
      type: 'page',
      position: { x: 0, y: 0 },
      data: {
        label: 'Home',
        metadata: { status: 'published', contentTypeId: 'ct-1' },
        fullPath: 'home',
        components: []
      }
    },
    {
      id: 'node-2',
      type: 'page',
      position: { x: 200, y: 200 },
      data: {
        label: 'About',
        metadata: { status: 'draft', contentTypeId: 'ct-1' },
        fullPath: 'home/about',
        components: []
      }
    }
  ],
  edges: [{ id: 'e1-2', source: 'node-1', target: 'node-2', type: 'smoothstep' }],
  websiteId: 'test-site'
}

const proposalResponse = {
  narrative: {
    project_summary: 'Summary for Test Site.',
    ia_highlights: [{ section: 'Navigation', insight: 'Clear flows' }],
    content_type_notes: [{ typeName: 'Landing Page', summary: 'Ready', opportunities: ['Add CTA'] }],
    uplift_plan: ['Refresh hero'],
    design_concepts: [
      {
        conceptId: 'concept-alpha',
        positioning: 'Studio retail',
        paletteAngle: 'Warm gradients',
        bestUseCases: ['Homepage']
      }
    ],
    call_to_action: 'Schedule a workshop.'
  },
  context: {
    website: {
      id: 'test-site',
      name: 'Test Site',
      conceptId: 'concept-alpha',
      proposalTitle: 'Test Site Proposal',
      tagline: 'Audience-first retail'
    },
    sitemap: {
      nodes: [{ id: 'node-1', label: 'Home', depth: 1, status: 'published' }],
      stats: { total: 2, published: 1, draft: 1, depthMax: 1 }
    },
    contentTypes: [{ id: 'ct-1', name: 'Landing Page', category: 'page', instanceCount: 2 }],
    importBrief: null,
    designConcepts: [
      {
        id: 'concept-alpha',
        name: 'Alpha',
        palette: { primary: '#111', secondary: '#222', accent: '#333', neutral: '#444', surface: '#555' },
        typography: { heading: 'Sora', body: 'Inter' }
      }
    ]
  },
  assets: {
    designConcepts: [
      {
        id: 'concept-alpha',
        name: 'Alpha',
        palette: { primary: '#111', secondary: '#222', accent: '#333', neutral: '#444', surface: '#555' },
        typography: { heading: 'Sora', body: 'Inter' }
      }
    ]
  }
}

test.describe('Site Builder proposal export', () => {
  test('exports proposal PDF from builder menu', async ({ page }) => {
    await page.route('**/api/studio/sitemap/**', (route) => route.fulfill({ json: sitemapResponse }))
    await page.route('**/api/studio/site-builder/global-components**', (route) =>
      route.fulfill({ json: [] })
    )
    await page.route('**/api/studio/site-builder/components**', (route) =>
      route.fulfill({ json: { items: [], total: 0 } })
    )
    await page.route('**/api/content-types**', (route) => route.fulfill({ json: { data: [] } }))
    await page.route('**/api/studio/import/jobs/**', (route) =>
      route.fulfill({ json: { id: 'job-1', status: 'completed' } })
    )
    await page.route('**/api/website/test-site/design-system**', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            website: { id: 'test-site', name: 'Test Site' },
            concepts: [
              { id: 'concept-alpha', name: 'Alpha', isDefault: true },
              { id: 'concept-beta', name: 'Beta', isDefault: false }
            ],
            activeConcept: { id: 'concept-alpha' },
            designSystem: null
          }
        }
      })
    )

    await page.route('**/api/studio/site-builder/test-site/proposal', async (route) => {
      const body = await route.request().postDataJSON()
      expect(body.conceptId).toBeDefined()
      route.fulfill({ json: proposalResponse })
    })

    await page.goto(
      '/studio/site-builder?websiteId=test-site&websiteName=Test%20Site&conceptId=concept-alpha&importJobId=job-1'
    )

    await expect(page.getByPlaceholder('Search pages...')).toBeVisible()

    await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByText('Extract proposal (PDF)').click()
    await expect(page.getByText('Proposal title')).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /Generate proposal/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('test-site')

    const stream = await download.createReadStream()
    if (!stream) {
      throw new Error('Unable to read proposal PDF')
    }
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    const pdfBuffer = Buffer.concat(chunks)
    expect(pdfBuffer.byteLength).toBeGreaterThan(1000)

    const pdfText = pdfBuffer.toString('latin1')
    expect(pdfText).toContain('/Title (Test Site Proposal')
  })
})
