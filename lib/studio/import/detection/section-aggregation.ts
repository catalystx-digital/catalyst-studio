import type { DetectedComponent, InvalidDetectedComponent, PageMetadata, ParserRepairNote } from './types'
import type { DetectionSectionTask } from './section-plan'

export interface SectionExtractionArtifact {
  sectionKey: string
  sectionOrder: number
  durationMs?: number
  components: DetectedComponent[]
  pageMetadata?: PageMetadata
  invalidComponents?: InvalidDetectedComponent[]
  parserRepairs?: ParserRepairNote[]
  requiredSectionEmpty?: boolean
  satisfiedBySectionKey?: string
  /** Extraction threw for this section; its components were never produced. */
  extractionFailed?: boolean
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
    const isBlock = task.sectionKey.startsWith('block:')
    const regionArtifacts = isBlock
      ? artifacts.filter(candidate => tasks.some(regionTask => regionTask.role === task.role && regionTask.sectionKey === candidate.sectionKey))
      : artifacts
    if (!artifact || (artifact.components.length > 0 &&
      (!isBlock || satisfiesRequiredRole(task, artifact)))) {
      continue
    }
    if (artifact.extractionFailed) {
      // An empty required section means the model looked and found nothing,
      // which is a detection bug worth failing on. A section whose extraction
      // threw is a different thing: the rest of the page is still good, and the
      // caller already has the section's own error. Drop the region, keep the page.
      continue
    }
    const satisfiedBy = findRequiredRoleSatisfaction(task, regionArtifacts)
    if (satisfiedBy) {
      if (!isBlock || artifact.components.length === 0) {
        artifact.requiredSectionEmpty = true
      }
      artifact.satisfiedBySectionKey = satisfiedBy.sectionKey
      continue
    }
    if (isBlock && regionArtifacts.some(candidate => candidate.extractionFailed)) {
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
