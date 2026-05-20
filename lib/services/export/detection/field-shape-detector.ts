// Provider-agnostic FieldShapeDetector
// Minimal local implementation to support MVP and type-safety.

export type DetectionMode = 'off' | 'dry-run'

export interface FieldShapeDetectorOptions {
  mode?: DetectionMode
  minConfidence?: number
  logger?: (entry: unknown) => void
}

export interface FieldShapeDetectionResult {
  classification: string
  confidence: number
  path?: string
  sample?: unknown
  meetsThreshold: boolean
  reasons: string[]
  mode: DetectionMode
}

export default class FieldShapeDetector {
  private readonly mode: DetectionMode
  private readonly minConfidence: number
  private readonly logger?: (entry: unknown) => void

  constructor(opts: FieldShapeDetectorOptions = {}) {
    this.mode = opts.mode ?? 'dry-run'
    const mc = typeof opts.minConfidence === 'number' ? opts.minConfidence : 0.6
    this.minConfidence = Math.max(0, Math.min(1, mc))
    this.logger = opts.logger
  }

  detect(value: unknown, path?: string): FieldShapeDetectionResult {
    const { classification, confidence, reasons } = this.classify(value)

    // Optionally log internal decisions for debugging (not used in current story)
    if (this.logger) {
      try {
        this.logger({ classification, confidence, path })
      } catch {
        // ignore logger errors
      }
    }

    return {
      classification,
      confidence,
      path,
      sample: undefined,
      meetsThreshold: confidence >= this.minConfidence,
      reasons,
      mode: this.mode,
    }
  }

  private classify(value: unknown): { classification: string; confidence: number; reasons: string[] } {
    const reasons: string[] = []

    if (Array.isArray(value)) {
      if (value.length === 0) {
        reasons.push('empty array')
        return { classification: 'array_empty', confidence: 0.4, reasons }
      }
      const allObjects = value.every(v => v !== null && typeof v === 'object')
      if (allObjects) {
        const hasIdShape = value.every(v => typeof (v as any).id !== 'undefined')
        if (hasIdShape) {
          reasons.push('array of objects with id')
          return { classification: 'array_content_reference', confidence: 0.82, reasons }
        }
        reasons.push('array of objects')
        return { classification: 'array_object', confidence: 0.62, reasons }
      }
      reasons.push('array of primitives')
      return { classification: 'array_primitive', confidence: 0.45, reasons }
    }

    if (value !== null && typeof value === 'object') {
      const obj = value as Record<string, unknown>
      if (Object.prototype.hasOwnProperty.call(obj, 'id')) {
        reasons.push('object has id property')
        return { classification: 'content_reference', confidence: 0.76, reasons }
      }
      reasons.push('plain object')
      return { classification: 'object', confidence: 0.6, reasons }
    }

    // Fallback for primitives
    reasons.push('primitive value')
    return { classification: 'primitive', confidence: 0.3, reasons }
  }
}


