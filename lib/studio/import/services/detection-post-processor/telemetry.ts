/**
 * Detection Post-Processor Telemetry
 *
 * Tracks processor activity including:
 * - Which processors fire
 * - What changes they make (type changes, additions, removals)
 * - Duration of each processor
 *
 * @module telemetry
 */

import type { DetectedComponent } from '@/lib/studio/import/detection/types'

/**
 * Records a type change for telemetry
 */
export interface TypeChange {
  componentId?: string
  from: string
  to: string
}

/**
 * Telemetry data for a single processor run
 */
export interface ProcessorTelemetry {
  processorName: string
  activated: boolean
  componentsBefore: number
  componentsAfter: number
  typesChanged: TypeChange[]
  componentsRemoved: number
  componentsAdded: number
  timestamp: Date
  siteUrl?: string
  duration?: number // ms
}

/**
 * Telemetry data for an entire import session
 */
export interface ImportTelemetry {
  importId: string
  siteUrl: string
  processors: ProcessorTelemetry[]
  totalDuration: number
  startTime: Date
  endTime: Date
}

/**
 * Extended component type that may have runtime mutations
 */
interface RuntimeComponent extends DetectedComponent {
  componentType?: string
  id?: string
}

/**
 * Snapshot of component state for comparison
 */
interface ComponentSnapshot {
  count: number
  types: Map<string, string> // id -> type
  ids: Set<string>
}

/**
 * Creates a snapshot of component state for comparison
 */
function createSnapshot(components: DetectedComponent[]): ComponentSnapshot {
  const types = new Map<string, string>()
  const ids = new Set<string>()

  for (let i = 0; i < components.length; i++) {
    const component = components[i] as RuntimeComponent
    const id = component.id || `idx-${i}`
    ids.add(id)
    types.set(id, component.componentType || String(component.type) || 'unknown')
  }

  return {
    count: components.length,
    types,
    ids
  }
}

/**
 * Detects type changes between two snapshots
 */
function detectTypeChanges(before: ComponentSnapshot, after: ComponentSnapshot): TypeChange[] {
  const changes: TypeChange[] = []

  for (const [id, beforeType] of Array.from(before.types.entries())) {
    const afterType = after.types.get(id)
    if (afterType && afterType !== beforeType) {
      changes.push({
        componentId: id,
        from: beforeType,
        to: afterType
      })
    }
  }

  return changes
}

/**
 * Collects telemetry for processor runs during an import session
 */
export class TelemetryCollector {
  private importId: string = ''
  private siteUrl: string = ''
  private processors: ProcessorTelemetry[] = []
  private startTime: Date = new Date()
  private enabled: boolean = true

  /**
   * Starts a new telemetry session
   */
  startSession(importId: string, siteUrl: string): void {
    this.importId = importId
    this.siteUrl = siteUrl
    this.processors = []
    this.startTime = new Date()
  }

  /**
   * Records a processor run by comparing before/after state
   */
  recordProcessor(
    name: string,
    componentsBefore: DetectedComponent[],
    componentsAfter: DetectedComponent[],
    duration: number
  ): ProcessorTelemetry {
    const beforeSnapshot = createSnapshot(componentsBefore)
    const afterSnapshot = createSnapshot(componentsAfter)

    const typesChanged = detectTypeChanges(beforeSnapshot, afterSnapshot)

    // Count added/removed components
    const addedIds = Array.from(afterSnapshot.ids).filter(id => !beforeSnapshot.ids.has(id))
    const removedIds = Array.from(beforeSnapshot.ids).filter(id => !afterSnapshot.ids.has(id))

    const activated =
      typesChanged.length > 0 ||
      addedIds.length > 0 ||
      removedIds.length > 0

    const telemetry: ProcessorTelemetry = {
      processorName: name,
      activated,
      componentsBefore: beforeSnapshot.count,
      componentsAfter: afterSnapshot.count,
      typesChanged,
      componentsRemoved: removedIds.length,
      componentsAdded: addedIds.length,
      timestamp: new Date(),
      siteUrl: this.siteUrl,
      duration
    }

    this.processors.push(telemetry)

    // Log to console
    if (this.enabled) {
      this.logProcessor(telemetry)
    }

    return telemetry
  }

  /**
   * Logs a processor telemetry entry to console
   */
  private logProcessor(telemetry: ProcessorTelemetry): void {
    const parts: string[] = [
      `[Telemetry] Processor: ${telemetry.processorName}`,
      `activated: ${telemetry.activated}`,
      `duration: ${telemetry.duration}ms`
    ]

    if (telemetry.typesChanged.length > 0) {
      parts.push(`typesChanged: ${telemetry.typesChanged.length}`)
    }

    if (telemetry.componentsAdded > 0) {
      parts.push(`added: ${telemetry.componentsAdded}`)
    }

    if (telemetry.componentsRemoved > 0) {
      parts.push(`removed: ${telemetry.componentsRemoved}`)
    }

    console.log(parts.join(' - '))

    // Log type changes in detail
    for (const change of telemetry.typesChanged) {
      console.log(`  [TypeChange] ${change.componentId || 'unknown'}: ${change.from} → ${change.to}`)
    }
  }

  /**
   * Ends the session and returns the complete telemetry
   */
  endSession(): ImportTelemetry {
    const endTime = new Date()
    const totalDuration = endTime.getTime() - this.startTime.getTime()

    const summary: ImportTelemetry = {
      importId: this.importId,
      siteUrl: this.siteUrl,
      processors: this.processors,
      totalDuration,
      startTime: this.startTime,
      endTime
    }

    // Log summary
    if (this.enabled) {
      this.logSummary(summary)
    }

    return summary
  }

  /**
   * Logs session summary to console
   */
  private logSummary(summary: ImportTelemetry): void {
    const activatedCount = summary.processors.filter(p => p.activated).length
    const totalTypeChanges = summary.processors.reduce((sum, p) => sum + p.typesChanged.length, 0)

    console.log(
      `[Telemetry] Session complete: ${summary.processors.length} processors, ` +
      `${activatedCount} activated, ${totalTypeChanges} type changes, ` +
      `${summary.totalDuration}ms total`
    )
  }

  /**
   * Enables or disables telemetry logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Gets the current session's processors
   */
  getProcessors(): ProcessorTelemetry[] {
    return [...this.processors]
  }
}

/**
 * Global telemetry collector instance
 */
export const telemetryCollector = new TelemetryCollector()

/**
 * Result of a processor skip due to high confidence
 */
export interface SkippedProcessorTelemetry extends ProcessorTelemetry {
  skippedDueToConfidence: true
  avgConfidence: number
  threshold: number
}

/**
 * Records a skipped processor for telemetry purposes
 */
export function recordSkippedProcessor(
  name: string,
  components: DetectedComponent[],
  avgConfidence: number,
  threshold: number
): SkippedProcessorTelemetry {
  const telemetry: SkippedProcessorTelemetry = {
    processorName: name,
    activated: false,
    componentsBefore: components.length,
    componentsAfter: components.length,
    typesChanged: [],
    componentsRemoved: 0,
    componentsAdded: 0,
    timestamp: new Date(),
    siteUrl: telemetryCollector['siteUrl'],
    duration: 0,
    skippedDueToConfidence: true,
    avgConfidence,
    threshold
  }

  // Log the skip
  console.log(
    `[Telemetry] Processor: ${name} - SKIPPED (confidence ${avgConfidence.toFixed(2)} > threshold ${threshold})`
  )

  return telemetry
}

/**
 * Helper function to wrap a processor call with telemetry
 */
export function withTelemetry<T extends DetectedComponent[]>(
  name: string,
  components: T,
  processorFn: (components: T) => void
): void {
  // Capture before state (deep clone component types)
  const beforeState = components.map((c, i) => {
    const rc = c as RuntimeComponent
    return {
      component: c.component,
      type: c.type,
      confidence: c.confidence,
      content: {},
      id: rc.id || `idx-${i}`,
      componentType: rc.componentType || String(c.type)
    }
  }) as Array<DetectedComponent & { id?: string; componentType?: string }>

  const startTime = performance.now()

  // Run processor
  processorFn(components)

  const duration = Math.round(performance.now() - startTime)

  // Capture after state
  const afterState = components.map((c, i) => {
    const rc = c as RuntimeComponent
    return {
      component: c.component,
      type: c.type,
      confidence: c.confidence,
      content: {},
      id: rc.id || `idx-${i}`,
      componentType: rc.componentType || String(c.type)
    }
  }) as Array<DetectedComponent & { id?: string; componentType?: string }>

  // Record telemetry
  telemetryCollector.recordProcessor(
    name,
    beforeState as DetectedComponent[],
    afterState as DetectedComponent[],
    duration
  )
}

/**
 * Helper function to wrap a processor call with confidence check + telemetry.
 *
 * This function:
 * 1. Checks if the processor should be skipped due to high average confidence
 * 2. If skipped, logs the skip and returns without running the processor
 * 3. If not skipped, runs the processor with normal telemetry tracking
 *
 * Use this for TYPE-CHANGING processors (not metadata-only processors).
 *
 * @param name - Processor name (must match PROCESSOR_THRESHOLDS keys)
 * @param components - Components to process
 * @param processorFn - Processor function to run
 * @param checkConfidence - Confidence check function (imported from confidence-config)
 */
export function withConfidenceCheck<T extends DetectedComponent[]>(
  name: string,
  components: T,
  processorFn: (components: T) => void,
  checkConfidence: (name: string, components: T) => { shouldSkip: boolean; avgConfidence: number; threshold: number }
): void {
  // Check if we should skip based on confidence
  const { shouldSkip, avgConfidence, threshold } = checkConfidence(name, components)

  if (shouldSkip) {
    // Record skip in telemetry and return without running processor
    recordSkippedProcessor(name, components, avgConfidence, threshold)
    return
  }

  // Run processor with normal telemetry
  withTelemetry(name, components, processorFn)
}
