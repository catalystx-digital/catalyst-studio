import type { DetectedComponent, InvalidDetectedComponent, PageMetadata } from './types'
import type { DetectionSectionTask } from './section-plan'

export interface SectionExtractionArtifact {
  sectionKey: string
  sectionOrder: number
  durationMs?: number
  components: DetectedComponent[]
  pageMetadata?: PageMetadata
  invalidComponents?: InvalidDetectedComponent[]
  requiredSectionEmpty?: boolean
  satisfiedBySectionKey?: string
}

function satisfiesRequiredRole(task: DetectionSectionTask, artifact: SectionExtractionArtifact): boolean {
  if (task.role === 'header') {
    return artifact.components.some(component => component.type === 'navbar')
  }
  if (task.role === 'footer') {
    return artifact.components.some(component => component.type === 'footer')
  }
  return artifact.components.length > 0
}

function findRequiredRoleSatisfaction(
  task: DetectionSectionTask,
  artifacts: SectionExtractionArtifact[]
): SectionExtractionArtifact | undefined {
  return artifacts.find(artifact => artifact.sectionKey !== task.sectionKey && satisfiesRequiredRole(task, artifact))
}

export function aggregateSectionArtifacts(
  tasks: DetectionSectionTask[],
  artifacts: SectionExtractionArtifact[]
): DetectedComponent[] {
  const byKey = new Map(artifacts.map(artifact => [artifact.sectionKey, artifact]))
  const missing = tasks.filter(task => task.required && !byKey.has(task.sectionKey))
  if (missing.length > 0) {
    throw new Error(`Missing required section artifacts: ${missing.map(task => task.sectionKey).join(', ')}`)
  }

  for (const task of tasks) {
    if (!task.required) {
      continue
    }
    const artifact = byKey.get(task.sectionKey)
    if (!artifact || artifact.components.length > 0) {
      continue
    }
    const satisfiedBy = findRequiredRoleSatisfaction(task, artifacts)
    if (satisfiedBy) {
      artifact.requiredSectionEmpty = true
      artifact.satisfiedBySectionKey = satisfiedBy.sectionKey
      continue
    }
    const invalidSummary = artifact.invalidComponents?.length
      ? `; ${artifact.invalidComponents.length} invalid component${artifact.invalidComponents.length === 1 ? '' : 's'} isolated`
      : ''
    throw new Error(`Required section ${task.sectionKey} produced no components${invalidSummary}`)
  }

  return tasks
    .map(task => byKey.get(task.sectionKey))
    .filter((artifact): artifact is SectionExtractionArtifact => Boolean(artifact))
    .flatMap(artifact => artifact.components)
}
