import fs from 'node:fs/promises'
import path from 'node:path'
import { digest, pageSlug, pageDirectory, saveSnapshot, writeJson, dataRoot, main, errorRecord, type Snapshot } from './storage'

// Configuration must already be in the process environment before application imports.
async function snapshotPages() {
  const urls = process.argv.slice(2)
  if (!urls.length) throw new Error('Usage: snapshot.ts <url> [url...]')
  const { getWebFetchTools } = await import('@/lib/studio/import/services/web-tools')
  const { ModelConfig } = await import('@/lib/studio/import/config')
  const { getModelConfig } = await import('@/lib/studio/import/openrouter-models')
  const nativeFetch = globalThis.fetch
  let models: Snapshot['models'] | undefined
  const failures: unknown[] = []
  // Record the public model catalogue too: production consults it even to build requests.
  globalThis.fetch = async (input, init) => {
    const response = await nativeFetch(input, init)
    if (String(input) === 'https://openrouter.ai/api/v1/models') {
      if (!response.ok) throw new Error('Model catalogue HTTP ' + response.status)
      models = await response.clone().json() as Snapshot['models']
    }
    return response
  }
  try { await getModelConfig(ModelConfig.primary) } finally { globalThis.fetch = nativeFetch }
  if (!models?.data?.length) throw new Error('No model catalogue captured; cannot make offline replay deterministic')
  for (const url of urls) {
    let tools: ReturnType<typeof getWebFetchTools> | undefined
    try {
      const slug = pageSlug(url), directory = pageDirectory(slug)
      try { await fs.access(path.join(directory, 'manifest.json')); throw new Error('Snapshot exists; use a separate IMPORT_LAB_ROOT to resnapshot') }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
      tools = getWebFetchTools(); tools.clearCache()
      let html: string | undefined
      const stylesheets: string[] = [], stylesheetUrls: string[] = []
      const requests = new Map<string, Promise<Response>>()
      globalThis.fetch = async (input, init) => {
        const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        // One request per resource, including when a stylesheet URL repeats.
        if (!requests.has(requestUrl)) requests.set(requestUrl, nativeFetch(input, init))
        const response = (await requests.get(requestUrl)!).clone()
        if (requestUrl === url) html = await response.clone().text()
        else if (response.ok) {
          const css = await response.clone().text()
          stylesheets.push(css)
          stylesheetUrls.push(requestUrl)
        }
        return response
      }
      const outline = await tools.fetchOutline({ url, stripScriptsStyles: true, collapseWhitespace: true })
      if (outline.error || outline.nonHtml || html === undefined) throw new Error(outline.message || 'No fetched HTML; simple mode and non-HTML pages are unsupported')
      const sections: Snapshot['sections'] = {}
      for (const section of outline.sections || []) sections[section.key] = await tools.getSection({ handle: outline.handle, key: section.key })
      const bytes = { html: Buffer.byteLength(html), outline: Buffer.byteLength(JSON.stringify(outline)), sections: Buffer.byteLength(JSON.stringify(sections)), stylesheets: Buffer.byteLength(JSON.stringify(stylesheets)), models: Buffer.byteLength(JSON.stringify(models)) }
      await saveSnapshot(directory, { html, outline, sections, models, stylesheets, manifest: {
        version: 1, url, stylesheetUrls, finalUrl: outline.finalUrl || url, fetchedAt: new Date().toISOString(), sha256: digest(html), sectionKeys: (outline.sections || []).map(section => section.key), bytes
      } })
      console.log(slug)
    } catch (error) { failures.push({ url, ...errorRecord(error) }); console.error('Snapshot failed:', url, errorRecord(error)); process.exitCode = 1 }
    finally { globalThis.fetch = nativeFetch; tools?.clearCache() }
  }
  await writeJson(path.join(dataRoot(), 'snapshot-failures.json'), failures)
}
if (require.main === module) main(snapshotPages)
