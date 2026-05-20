import type { GeneratorDiagnostic, DiagnosticsSummary, SiteSnapshot } from '../../core/types'

export function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function buildDiagnosticsModule(diagnostics: GeneratorDiagnostic[], summary: DiagnosticsSummary): string {
  return stringifyJson({ summary, diagnostics })
}

export function buildSiteDataModule(snapshot: SiteSnapshot): string {
  const json = JSON.stringify(snapshot, null, 2)
  return `export const siteSnapshot = ${json} as const

type Snapshot = typeof siteSnapshot

export function getPageByFullPath(fullPath: string): Snapshot['pages'][number] | undefined {
  return siteSnapshot.pages.find(page => page.fullPath === fullPath)
}
`
}
