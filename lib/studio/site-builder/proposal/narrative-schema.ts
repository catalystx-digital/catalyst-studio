import { z } from 'zod'
import { ProposalNarrative } from './types'

export const ProposalNarrativeSchema = z.object({
  project_summary: z.string().max(900),
  ia_highlights: z
    .array(
      z.object({
        section: z.string(),
        insight: z.string()
      })
    )
    .max(8),
  content_type_notes: z
    .array(
      z.object({
        typeName: z.string(),
        summary: z.string(),
        opportunities: z.array(z.string()).max(3).optional()
      })
    )
    .max(10),
  uplift_plan: z.array(z.string()).max(6),
  design_concepts: z
    .array(
      z.object({
        conceptId: z.string(),
        positioning: z.string().max(280),
        paletteAngle: z.string().max(400),
        bestUseCases: z.array(z.string()).max(3).optional()
      })
    )
    .max(4),
  call_to_action: z.string().max(300),
  design_evolution_narrative: z.string().max(600).optional()
})

export type ProposalNarrativePayload = z.infer<typeof ProposalNarrativeSchema>

const clamp = (value: unknown, max: number) =>
  typeof value === 'string' ? value.slice(0, max) : value

export function sanitizeNarrativePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload
  }

  const sanitized = JSON.parse(JSON.stringify(payload))
  sanitized.project_summary = clamp(sanitized.project_summary, 900)
  sanitized.call_to_action = clamp(sanitized.call_to_action, 300)

  if (Array.isArray(sanitized.design_concepts)) {
    sanitized.design_concepts = sanitized.design_concepts.map((concept: Record<string, unknown>) => ({
      ...concept,
      positioning: clamp(concept.positioning, 280),
      paletteAngle: clamp(concept.paletteAngle, 180)
    }))
  }

  if (Array.isArray(sanitized.uplift_plan)) {
    sanitized.uplift_plan = sanitized.uplift_plan.map((item: unknown) => clamp(item, 200))
  }

  if (Array.isArray(sanitized.content_type_notes)) {
    sanitized.content_type_notes = sanitized.content_type_notes.map((note: Record<string, unknown>) => ({
      ...note,
      summary: clamp(note.summary, 500)
    }))
  }

  if (sanitized.design_evolution_narrative) {
    sanitized.design_evolution_narrative = clamp(sanitized.design_evolution_narrative, 600)
  }

  return sanitized
}

export function validateNarrativePayload(payload: unknown): ProposalNarrative {
  return ProposalNarrativeSchema.parse(payload)
}
