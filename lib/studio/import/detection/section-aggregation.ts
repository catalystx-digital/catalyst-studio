import type { DetectedComponent, PageMetadata } from './types'
import type { DetectionSectionTask } from './section-plan'

export interface SectionExtractionArtifact {
  sectionKey: string
  sectionOrder: number
  components: DetectedComponent[]
  pageMetadata?: PageMetadata
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

  return tasks
    .map(task => byKey.get(task.sectionKey))
    .filter((artifact): artifact is SectionExtractionArtifact => Boolean(artifact))
    .flatMap(artifact => artifact.components)
}
