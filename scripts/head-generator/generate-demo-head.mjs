import { mkdir, writeFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import buildPackageJson, { buildReadme } from './templates/index.mjs'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')
const OUTPUT_DIR = resolve(__dirname, '../../tmp/demo-head')

async function ensureDir(path) {
  await mkdir(path, { recursive: true })
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function writeText(filePath, contents) {
  await writeFile(filePath, `${contents}\n`, 'utf8')
}

async function generate() {
  await rm(OUTPUT_DIR, { recursive: true, force: true })
  await ensureDir(OUTPUT_DIR)

  const pkg = buildPackageJson({ name: 'demo-head', includeTypeScript: false })
  await writeJson(resolve(OUTPUT_DIR, 'package.json'), pkg)

  await writeText(
    resolve(OUTPUT_DIR, 'next.config.mjs'),
    "export default { reactStrictMode: true }"
  )

  await writeJson(resolve(OUTPUT_DIR, '.eslintrc.json'), {
    extends: ['next/core-web-vitals']
  })

  const appDir = resolve(OUTPUT_DIR, 'app')
  await ensureDir(appDir)

  await writeText(
    resolve(appDir, 'layout.jsx'),
    `import './globals.css'\n\nexport const metadata = {\n  title: 'Demo Head',\n  description: 'Generated head demo'\n}\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}`
  )

  await writeText(
    resolve(appDir, 'page.jsx'),
    `export default function Page() {\n  return (\n    <main className="container">\n      <h1>Demo Head</h1>\n      <p>This project was generated for lint validation.</p>\n    </main>\n  )\n}`
  )

  await writeText(resolve(appDir, 'globals.css'), `:root { color-scheme: light dark; }`)

  await writeText(resolve(OUTPUT_DIR, 'README.md'), buildReadme())
}

await generate()

console.log(`✓ Generated demo head project in ${OUTPUT_DIR}`)
