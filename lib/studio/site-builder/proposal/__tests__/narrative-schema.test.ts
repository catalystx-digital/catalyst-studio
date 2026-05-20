import { sanitizeNarrativePayload, validateNarrativePayload } from '../narrative-schema'

describe('Proposal narrative schema', () => {
  const sample = {
    project_summary: 'Concise overview.',
    ia_highlights: [{ section: 'Navigation', insight: 'Clear entry points for key paths.' }],
    content_type_notes: [
      { typeName: 'Case Study', summary: 'Strong baseline', opportunities: ['Add testimonials'] }
    ],
    uplift_plan: ['Modernize hero banners'],
    design_concepts: [
      {
        conceptId: 'concept-1',
        positioning: 'Studio retail posture',
        paletteAngle: 'High-contrast gradients',
        bestUseCases: ['Homepage', 'Campaigns']
      }
    ],
    call_to_action: 'Schedule a workshop with Catalyst Studio.'
  }

  it('accepts valid payloads', () => {
    expect(validateNarrativePayload(sample)).toEqual(sample)
  })

  it('rejects invalid payloads', () => {
    const invalid = { ...sample, project_summary: 'x'.repeat(950) }
    expect(() => validateNarrativePayload(invalid)).toThrow()
  })

  it('sanitizes long strings before validation', () => {
    const raw = {
      ...sample,
      project_summary: 'x'.repeat(950),
      call_to_action: 'y'.repeat(400),
      design_concepts: [
        {
          conceptId: 'concept-1',
          positioning: 'z'.repeat(400),
          paletteAngle: 'p'.repeat(500)
        }
      ],
      uplift_plan: ['u'.repeat(400)]
    }
    const sanitized = sanitizeNarrativePayload(raw)
    expect(() => validateNarrativePayload(sanitized)).not.toThrow()
  })
})
