import type { WebFetchTools, FetchOutlineArgs, GetSectionArgs } from '@/lib/studio/import/services/web-tools'
import type { Snapshot } from './storage'

export function createReplayTools(snapshot: Snapshot, maxSections?: number, web?: WebFetchTools) {
  // Fixture runners set their environment before replay loads production configuration.
  const { WebFetchTools, extractBackgroundImages, extractExternalStylesheetUrls, parseCssForBackgroundImages, parseCssForBackgroundColors, parseCssForHiddenSelectors } = require('@/lib/studio/import/services/web-tools') as typeof import('@/lib/studio/import/services/web-tools')
  const cacheTools = web ?? new WebFetchTools()
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
  const outline = copy(snapshot.outline)
  if (maxSections !== undefined) outline.sections = outline.sections?.slice(0, maxSections)
  const omitted = snapshot.manifest.sectionKeys.filter(key => !outline.sections?.some(section => section.key === key))
  const styling = { rebuilt: false, stylesheetsSaved: snapshot.stylesheets.length, stylesheetsPaired: 0, baseUsed: 'page-url', stylesheetIssues: [] as string[], hiddenSelectors: 0, backgroundImages: 0 }
  return {
    omitted,
    styling,
    getRawHtml: cacheTools.getRawHtml.bind(cacheTools),
    getPageStyling: cacheTools.getPageStyling.bind(cacheTools),
    async fetchOutline(args: FetchOutlineArgs) {
      if (args.url !== snapshot.manifest.url && args.url !== snapshot.manifest.finalUrl) throw new Error('Replay URL is outside the saved snapshot')
      if (args.stripScriptsStyles === false || args.collapseWhitespace === false) throw new Error('Replay requires the saved production outline settings')
      const baseUrl = snapshot.manifest.finalUrl
      const baseOrigin = new URL(baseUrl).origin
      const linkedUrls = extractExternalStylesheetUrls(snapshot.html, baseUrl).filter(url => {
        try { return new URL(url).origin === baseOrigin } catch { return false }
      }).slice(0, 5)
      const savedUrls = snapshot.manifest.stylesheetUrls
      const urls = savedUrls ?? linkedUrls
      const mapPaired = urls.length === snapshot.stylesheets.length
      const paired = savedUrls !== undefined && mapPaired
      const bgImageMap = extractBackgroundImages(snapshot.html)
      snapshot.stylesheets.forEach((css, index) => {
        parseCssForBackgroundImages(css, bgImageMap.byClass, bgImageMap.byId, mapPaired ? urls[index] : baseUrl)
        parseCssForBackgroundColors(css, bgImageMap.bgColorByClass, bgImageMap.bgColorById)
        parseCssForHiddenSelectors(css, bgImageMap.hiddenByClass, bgImageMap.hiddenById)
      })
      // Replay seeds the production cache so its accessors remain unchanged.
      cacheTools['cache'].set(outline.handle, {
        url: snapshot.manifest.url, finalUrl: baseUrl, status: outline.status,
        rawHtml: snapshot.html, bgImageMap, stylesheets: paired ? snapshot.stylesheets.map((text, index) => ({ url: urls[index], text })) : [], headMeta: copy(outline.headMeta || {}),
        sections: new Map((outline.sections || []).map(section => [section.key, copy(snapshot.sections[section.key].slice)])),
        resources: copy(outline.resourcesSummary || { anchors: [], images: [], videos: [], forms: [], links: [] }),
        limits: { maxSectionBytes: outline.limits?.maxSectionBytes || 0 }
      })
      Object.assign(styling, {
        rebuilt: true, stylesheetsPaired: paired ? urls.length : 0,
        stylesheetIssues: paired ? [] : ['Saved stylesheets are map only: URL/text pairs were not saved; none supplied to the browser.'],
        baseUsed: mapPaired ? urls === savedUrls ? 'saved-urls' : 'stylesheet-links' : 'page-url',
        hiddenSelectors: bgImageMap.hiddenByClass.size + bgImageMap.hiddenById.size,
        backgroundImages: bgImageMap.byClass.size + bgImageMap.byId.size
      })
      return copy(outline)
    },
    async getSection(args: GetSectionArgs) {
      if (args.handle !== outline.handle) throw new Error('Unknown replay handle')
      if (!Object.prototype.hasOwnProperty.call(snapshot.sections, args.key) || omitted.includes(args.key)) throw new Error('Unknown replay section: ' + args.key)
      return copy(snapshot.sections[args.key])
    },
    release(handle: string) {
      if (handle !== outline.handle) throw new Error('Unknown replay release handle')
      cacheTools['cache'].delete(handle)
    },
    getLastFetchOutline() { return copy(outline) }
  }
}
