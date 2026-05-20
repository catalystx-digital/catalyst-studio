import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { ComponentBuilder } from '@/lib/studio/import/services/page-builder/component-builder'
import type { ComponentType, DetectionResult } from '@/lib/studio/import/services/interfaces'

function loadRawDetection(rawPath: string) {
  const absolute = path.resolve(rawPath)
  const input = fs.readFileSync(absolute, 'utf-8')
  return JSON.parse(input) as {
    pageTemplate?: any
    components: Array<[string, number, Record<string, any>]>
    pageMetadata?: Record<string, any>
  }
}

function createComponentTypes(raw: ReturnType<typeof loadRawDetection>['components']): ComponentType[] {
  const uniqueTypes = Array.from(new Set(raw.map(entry => entry[0])))
  return uniqueTypes.map<ComponentType>(type => ({
    id: type,
    type,
    category: 'eval',
    version: '1.0.0',
    defaultConfig: {},
    placeholderData: {},
    styles: {},
    aiMetadata: {},
    confidence: 1,
    isGlobal: false,
    websiteId: 'eval',
    website: {} as any,
    createdBy: null,
    updatedBy: null,
    patterns: []
  }))
}

function toDetectionResults(raw: ReturnType<typeof loadRawDetection>['components']): DetectionResult[] {
  return raw.map<DetectionResult>(([type, confidence, content], index) => ({
    id: `${type}-${index}`,
    type,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    content,
    confidence,
    metadata: typeof content === 'object' && content && typeof (content as any).region === 'string'
      ? { region: (content as any).region }
      : {}
  }))
}

function sanitizeContent(content: Record<string, any>): Record<string, any> {
  if (!content || typeof content !== 'object') {
    return {}
  }

  const copy: Record<string, any> = {}
  Object.entries(content).forEach(([key, value]) => {
    if (value === undefined) {
      return
    }
    copy[key] = value
  })
  return copy
}

export function buildExpectedFromRaw(rawPath: string, outputPath: string) {
  const raw = loadRawDetection(rawPath)
  const builder = new ComponentBuilder()
  const componentTypes = createComponentTypes(raw.components)
  const detections = toDetectionResults(raw.components)
  const instances = builder.mapToComponentInstances(detections, componentTypes)

  const normalizedComponents = instances.map((instance, index) => {
    const [type, confidence] = raw.components[index]
    const props = instance.props as Record<string, any>
    const content = sanitizeContent(props?.content as Record<string, any>)
    return {
      type,
      confidence,
      content
    }
  })

  const expected = {
    pageTemplate: raw.pageTemplate ?? null,
    components: normalizedComponents,
    pageMetadata: raw.pageMetadata ?? {}
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(expected, null, 2)}\n`, 'utf-8')
}

function main() {
  const [rawPath, outputPath] = process.argv.slice(2)
  if (!rawPath || !outputPath) {
    console.error('Usage: tsx scripts/eval/build-expected-from-raw.ts <raw-json-path> <output-path>')
    process.exit(1)
  }
  buildExpectedFromRaw(rawPath, outputPath)
}

const invokedFromCli = (() => {
  const entry = process.argv?.[1]
  if (!entry) {
    return false
  }
  try {
    const entryUrl = pathToFileURL(path.resolve(entry)).href
    return entryUrl === import.meta.url
  } catch {
    return false
  }
})()

if (invokedFromCli) {
  main()
}
