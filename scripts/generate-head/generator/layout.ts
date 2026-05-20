import type { SiteSnapshot } from '../core/types'
import { ProjectBuilder } from './project-builder'

export interface LayoutFontUsage {
  target: 'body' | 'heading'
  identifier: string
  importName: string
  optionsLiteral: string
}

export interface LayoutFontPlan {
  imports: string[]
  usages: LayoutFontUsage[]
  unsupported: Array<{ target: 'body' | 'heading'; fontFamily: string }>
}

function buildRootLayout(snapshot: SiteSnapshot, fontPlan?: LayoutFontPlan | null): string {
  const imports: string[] = [
    `import type { Metadata } from 'next'`,
    `import './globals.css'`,
    `import { cn } from '@/lib/utils'`
  ]

  if (fontPlan && fontPlan.imports.length > 0) {
    imports.splice(2, 0, `import { ${fontPlan.imports.join(', ')} } from 'next/font/google'`)
  }

  const declarations: string[] = []

  if (fontPlan && fontPlan.usages.length > 0) {
    fontPlan.usages.forEach(usage => {
      declarations.push(`const ${usage.identifier} = ${usage.importName}(${usage.optionsLiteral})`)
    })
  }

  if (fontPlan && fontPlan.unsupported.length > 0) {
    const commentLines = fontPlan.unsupported
      .map(entry => ` * - ${entry.target === 'heading' ? 'Heading' : 'Body'}: ${entry.fontFamily}`)
      .join('\n')
    declarations.push(`/*\n * TODO: Load custom web fonts defined in the design system:\n${commentLines}\n */`)
  }

  const fontVariables =
    fontPlan && fontPlan.usages.length > 0
      ? fontPlan.usages.map(usage => `${usage.identifier}.variable`)
      : []

  const classArguments = [
    `'min-h-screen bg-background text-foreground'`,
    ...fontVariables
  ]

  // Sanitize strings for JavaScript: escape single quotes, replace newlines with spaces
  const sanitizeForJs = (str: string) =>
    str.replace(/'/g, "\\'").replace(/[\r\n]+/g, ' ').trim()

  const metadata = `export const metadata: Metadata = {
  title: '${sanitizeForJs(snapshot.site.name)}',
  description: '${sanitizeForJs(snapshot.site.description ?? '')}'
}`

  const component = `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={cn(${classArguments.join(', ')})}>
        {children}
      </body>
    </html>
  )
}`

  return `${imports.join('\n')}

${declarations.join('\n')}

${metadata}

${component}
`
}

export function addLayout(
  builder: ProjectBuilder,
  snapshot: SiteSnapshot,
  fontPlan?: LayoutFontPlan | null
): void {
  builder.addFile('app/layout.tsx', buildRootLayout(snapshot, fontPlan))
}
