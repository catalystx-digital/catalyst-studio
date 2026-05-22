import { render, screen } from '@testing-library/react'
import { ProposalDocument } from '../proposal-document'
import { ProposalContextSummary, ProposalNarrative } from '@/lib/studio/site-builder/proposal/types'

jest.mock('next/image', () => (props: any) => {
  const { src, alt } = props
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} />
})

const narrative: ProposalNarrative = {
  project_summary: 'Executive overview.',
  ia_highlights: [{ section: 'Navigation', insight: 'Clear entry points' }],
  content_type_notes: [{ typeName: 'Blog', summary: 'Needs uplift' }],
  uplift_plan: ['Refresh hero'],
  design_concepts: [
    { conceptId: 'concept-1', positioning: 'Studio', paletteAngle: 'Warm', bestUseCases: ['Home'] }
  ],
  call_to_action: 'Schedule a working session.'
}

const context: ProposalContextSummary = {
  website: {
    id: 'website-1',
    name: 'Catalyst Demo',
    conceptId: 'concept-1',
    proposalTitle: 'Catalyst Demo Proposal',
    tagline: 'Audience-first tagline'
  },
  sitemap: {
    nodes: [{ id: 'node-1', label: 'Home', depth: 1, status: 'published' }],
    stats: { total: 1, published: 1, draft: 0, depthMax: 1 }
  },
  contentTypes: [{ id: 'ct-1', name: 'Landing Page', category: 'page', instanceCount: 1 }],
  importBrief: null,
  designConcepts: [
    {
      id: 'concept-1',
      name: 'Aurora',
      palette: { primary: '#111', secondary: '#222', accent: '#333', neutral: '#444', surface: '#555' },
      typography: { heading: 'Sora', body: 'Inter' }
    }
  ]
}

describe('ProposalDocument', () => {
  it('renders core sections', () => {
    render(
      <ProposalDocument
        websiteName="Catalyst Demo"
        proposalTitle="Catalyst Demo Proposal"
        narrative={narrative}
        context={context}
        conceptAssets={[
          {
            concept: context.designConcepts[0],
            previewUrl: null,
            previewAvailable: false
          }
        ]}
        sitemapPreview={null}
        capturedAt="2024-01-01T00:00:00.000Z"
      />
    )

    expect(screen.getByText(/Executive Summary/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Aurora' })).toBeInTheDocument()
    expect(screen.getByText(/Implementation roadmap/i)).toBeInTheDocument()
    expect(screen.getByText('Schedule a working session.')).toBeInTheDocument()
  })
})
