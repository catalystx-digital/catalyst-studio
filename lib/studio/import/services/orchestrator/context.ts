import type { ImportFailure, ImportResult, ImportDiagnostic } from '../interfaces/import-orchestrator.interface'

type ImportStatistics = Required<ImportResult['statistics']>

export class OrchestrationContext {
  readonly websiteId: string
  readonly startedAt: number

  private componentTypes: any[] = []
  private pages: any[] = []
  private structures: any[] = []
  private sharedComponents: any[] = []
  private failedPages: ImportFailure[] = []
  private diagnostics: ImportDiagnostic[] = []
  private readonly statistics: ImportStatistics = {
    totalPages: 0,
    totalComponents: 0,
    uniqueComponentTypes: 0,
    sharedComponentsDetected: 0,
    failedPages: 0,
    processingTimeMs: 0
  }

  constructor(websiteId: string, startedAt: number) {
    this.websiteId = websiteId
    this.startedAt = startedAt
  }

  getComponentTypes(): any[] {
    return this.componentTypes
  }

  getPages(): any[] {
    return this.pages
  }

  getStructures(): any[] {
    return this.structures
  }

  getSharedComponents(): any[] {
    return this.sharedComponents
  }

  getFailedPages(): ImportFailure[] {
    return this.failedPages
  }

  getPartialResult(): Partial<ImportResult> {
    return {
      websiteId: this.websiteId,
      componentTypes: this.componentTypes,
      pages: this.pages,
      structures: this.structures,
      sharedComponents: this.sharedComponents,
      failedPages: this.failedPages,
      diagnostics: this.diagnostics,
      statistics: { ...this.statistics }
    }
  }

  setComponentTypes(componentTypes: any[]): void {
    this.componentTypes = componentTypes
    this.statistics.uniqueComponentTypes = componentTypes.length
  }

  setPages(pages: any[]): void {
    this.pages = pages
    this.statistics.totalPages = pages.length
  }

  setStructures(structures: any[]): void {
    this.structures = structures
  }

  setSharedComponents(sharedComponents: any[]): void {
    this.sharedComponents = sharedComponents
    this.statistics.sharedComponentsDetected = sharedComponents.length
  }

  addDiagnostics(diagnostics: ImportDiagnostic[]): void {
    if (diagnostics.length === 0) {
      return
    }
    this.diagnostics.push(...diagnostics)
  }

  getDiagnostics(): ImportDiagnostic[] {
    return this.diagnostics
  }

  setFailedPages(failedPages: ImportFailure[]): void {
    this.failedPages = failedPages
    this.statistics.failedPages = failedPages.length
  }

  addFailedPage(failure: ImportFailure): void {
    this.failedPages.push(failure)
    this.statistics.failedPages = this.failedPages.length
  }

  setTotalComponents(count: number): void {
    this.statistics.totalComponents = count
  }

  finalize(processingTimeMs: number): ImportResult {
    this.statistics.processingTimeMs = processingTimeMs
    return {
      websiteId: this.websiteId,
      componentTypes: this.componentTypes,
      pages: this.pages,
      structures: this.structures,
      sharedComponents: this.sharedComponents,
      failedPages: this.failedPages,
      diagnostics: this.diagnostics,
      statistics: { ...this.statistics }
    }
  }
}
