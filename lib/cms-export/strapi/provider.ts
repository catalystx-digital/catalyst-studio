import { ICMSProvider, UniversalContentType, UniversalContentItem, ProviderConnectionError } from '../types'
import fetch from 'node-fetch'
import type {
  ContentTypeExport,
  UnifiedExportBundle,
  UnifiedBundleSyncResult,
  UnifiedBundleSyncOptions
} from '@/lib/services/export/types'
import { formatUnifiedBundleSyncResult } from '@/lib/cms-export/helpers/unified-bundle-result'
import { buildUniversalContentType } from '@/lib/services/export/helpers/content-type-builder'

type ProviderConfig = {
  baseUrl?: string
  apiToken?: string // Strapi Content API token
  adminToken?: string // Optional: Strapi Admin JWT
  adminEmail?: string // Optional: Admin login email
  adminPassword?: string // Optional: Admin login password
}

type StrapiCTBContentType = {
  uid: string
  apiID?: string
  schema?: {
    displayName?: string
    singularName?: string
    pluralName?: string
    description?: string
    kind?: string
    collectionName?: string
    attributes?: Record<string, any>
  }
}

export class StrapiProvider implements ICMSProvider {
  readonly id = 'strapi'

  private baseUrl = 'http://localhost:1337'
  private apiToken?: string
  private adminToken?: string
  private adminEmail?: string
  private adminPassword?: string
  private compiledByKey: Record<string, { fields: any[]; baseType?: '_page' | '_component'; category?: string; originalKey?: string }> = {}
  private contentTypeMapping: Map<string, { key: string; baseType: '_page' | '_component' }> = new Map()
  // Batch schema creation (avoid multiple Strapi restarts)
  private pendingCTBOps: Map<string, any> = new Map()
  private pendingComponentOps: Map<string, any> = new Map()
  private batchTimer: any = null
  private batchInFlight: Promise<void> | null = null
  private readonly batchWindowMs = 600
  private componentCache: { byUid: Map<string, any> } | null = null
  private componentDefinitions: Map<string, { uid: string; typeKey: string; op: any; targetSingular?: string; relationField?: string }> = new Map()
  private dynamicZoneRegistry: Map<string, Map<string, { components: Map<string, { uid: string; typeKey: string; targetSingular?: string; relationField?: string }> }>> = new Map()

  configure(config: ProviderConfig) {
    const baseUrl = (config as any).baseUrl || (config as any).endpoint
    const apiToken = (config as any).apiToken || (config as any).apiKey
    if (baseUrl) {
      let url = String(baseUrl).trim()
      url = url.replace(/\/+$/, '')
      url = url.replace(/\/api$/i, '')
      this.baseUrl = url
    }
    if (apiToken) this.apiToken = String(apiToken)
    if (config.adminToken) this.adminToken = config.adminToken
    if (config.adminEmail) this.adminEmail = config.adminEmail
    if (config.adminPassword) this.adminPassword = config.adminPassword
  }

  async getContentType(id: string): Promise<UniversalContentType | null> {
    try {
      await this.ensureAdminToken()
      const list2 = await this.req('/content-type-builder/content-types', {}, true)
      const items2: StrapiCTBContentType[] = (list2 && (list2.data || list2)) || []
      const found2 = this.findCT(items2, id)
      if (found2) return this.toUniversalFromCTB(found2)
    } catch {}
    return null
  }

  async createContentType(type: UniversalContentType): Promise<UniversalContentType> {
    // Queue this type and flush in a single batch update-schema call
    await this.ensureAdminToken()
    await this.loadContentTypes()
    const singular = this.toKebab(type.id || type.name)
    const exists = this.resolveCollectionFor(singular)
    if (exists) return type

    const plural = this.toKebab((type as any).pluralName || `${singular}s`)
    const fields = Array.isArray((type as any).fields) ? (type as any).fields : []
    const attrs: any[] = []
    const componentCollector = this.pendingComponentOps
    for (const f of fields) {
      const attr = this.mapFieldToStrapiAttribute(f, componentCollector, singular)
      if (attr) attrs.push({ action: 'create', name: attr.name, properties: attr.properties })
    }
    if (!attrs.some(a => a.name === 'title')) attrs.unshift({ action: 'create', name: 'title', properties: { type: 'string' } })

    const ctOp = {
      action: 'create', uid: `api::${singular}.${singular}`, modelName: singular, kind: 'collectionType',
      globalId: singular.replace(/(^|[-_])(\w)/g, (_, __, c) => (c || '').toUpperCase()), pluginOptions: {}, collectionName: plural.replace(/-/g, '_'),
      modelType: 'contentType', attributes: attrs, status: 'DRAFT', draftAndPublish: true,
      singularName: singular, pluralName: plural, displayName: type.name || singular
    }
    this.pendingCTBOps.set(singular, ctOp)

    // Debounced batch flush; all concurrent calls await the same in-flight promise
    if (!this.batchInFlight) {
      this.batchInFlight = new Promise<void>((resolve, reject) => {
        if (this.batchTimer) clearTimeout(this.batchTimer)
        this.batchTimer = setTimeout(async () => {
          try {
            const ops = Array.from(this.pendingCTBOps.values())
            const componentEntries = Array.from(this.pendingComponentOps.entries())
            const hasPendingComponents = componentEntries.length > 0
            this.pendingCTBOps.clear()
            this.pendingComponentOps.clear()
            this.batchTimer = null
            if (ops.length > 0 || hasPendingComponents) {
              let components: any[] = []
              if (hasPendingComponents) {
                await this.loadComponents()
                const existing = this.componentCache?.byUid ?? new Map<string, any>()
                components = componentEntries
                  .filter(([uid]) => !existing.has(uid))
                  .map(([, op]) => op)
              }
              if (components.length > 0 || ops.length > 0) {
                const payload = { data: { components, contentTypes: ops } }
                await this.req('/content-type-builder/update-schema', { method: 'POST', headers: { 'Content-Type': 'application/json' } as any, body: JSON.stringify(payload) }, true)
                // Poll status with tolerance for restart windows
                const start = Date.now()
                while (Date.now() - start < 60000) {
                  try {
                    const s = await this.req('/content-type-builder/update-schema-status', {}, true)
                    const upd = s && s.data && s.data.isUpdating
                    if (!upd) break
                  } catch { /* tolerate reload */ }
                  await new Promise((r) => setTimeout(r, 800))
                }
                // Clear caches to refresh mapping
                this.ctCache = null
                this.componentCache = null
              }
            }
            resolve()
          } catch (e) {
            reject(e)
          } finally {
            this.batchInFlight = null
          }
        }, this.batchWindowMs)
      })
    }
    await this.batchInFlight
    return type
  }

  // HTTP helper (Content API vs Admin)
  private async req(path: string, init: RequestInit = {}, useAdmin = false): Promise<any> {
    const url = `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
    const headers: any = { Accept: 'application/json', ...(init.headers as any) }
    const token = useAdmin ? this.adminToken : this.apiToken
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (useAdmin && this.adminToken) headers['x-strapi-admin'] = 'true'
    const res = await fetch(url as any, { ...init, headers } as any)
    if (!res.ok) {
      const bodyText = await res.text()
      const error = new Error(`${init.method || 'GET'} ${path} failed: ${res.status} ${bodyText.substring(0, 300)}`) as any
      error.status = res.status
      error.body = bodyText
      throw error
    }
    if (res.status === 204) return null
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return res.json()
    return res.text()
  }

  private async ensureAdminToken(): Promise<void> {
    if (this.adminToken) return
    if (!this.adminEmail || !this.adminPassword) {
      throw new ProviderConnectionError('Strapi Admin login requires adminEmail and adminPassword')
    }
    const res = await this.req('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' } as any,
      body: JSON.stringify({ email: this.adminEmail, password: this.adminPassword }),
    })
    const token = (res && (res.token || (res.data && res.data.token))) as string | undefined
    if (!token) throw new ProviderConnectionError('Admin login did not return token')
    this.adminToken = token
  }

  private async ensureApiToken(): Promise<void> {
    if (this.apiToken) return
    await this.ensureAdminToken()
    const body = { name: `poc-seed-${Date.now()}`, description: 'POC Seed Token', type: 'full-access' }
    const created = await this.req('/admin/api-tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' } as any, body: JSON.stringify(body) }, true)
    let token: string | null = null
    if (created && created.data) token = created.data.accessKey || created.data.token || (created.data.attributes && created.data.attributes.plainToken) || null
    if (!token && typeof created === 'string') token = created
    if (!token) throw new ProviderConnectionError('Failed to mint Strapi Content API token')
    this.apiToken = token
  }

  // No auto schema creation in provider; assume types exist

  private toUniversalFromCTB(ct: StrapiCTBContentType): UniversalContentType {
    const schema = ct.schema || {}
    const attrs = schema.attributes || {}
    const fields = Object.keys(attrs).map((key) => {
      const a = attrs[key] || {}
      const type = this.mapStrapiTypeToUniversal(a)
      return { id: key, name: key, type, required: !!a.required, layer: this.inferLayerByType(type) } as any
    })
    const classification: 'page' | 'component' = (attrs as any).components ? 'page' : 'component'
    return { version: '1.0.0', id: ct.apiID || ct.uid || 'unknown', name: schema.displayName || ct.apiID || ct.uid || 'Strapi Type', type: classification, description: schema.description, isRoutable: classification === 'page', fields, metadata: { createdAt: new Date(), updatedAt: new Date(), platformSpecific: { provider: 'strapi' } } }
  }

  private inferLayerByType(t: string): 'primitive' | 'common' | 'extension' {
    const s = (t || '').toLowerCase()
    if (['text', 'longText', 'number', 'decimal', 'boolean', 'date', 'json'].includes(s)) return 'primitive'
    if (['media', 'component', 'repeater', 'collection'].includes(s)) return 'common'
    return 'extension'
  }

  private mapStrapiTypeToUniversal(a: any): string {
    const t = (a && a.type) || 'string'
    switch (t) {
      case 'string': return 'text'
      case 'text': return 'longText'
      case 'richtext': return 'richText'
      case 'integer': return 'number'
      case 'biginteger':
      case 'decimal':
      case 'float': return 'decimal'
      case 'boolean': return 'boolean'
      case 'date':
      case 'datetime': return 'date'
      case 'json': return 'json'
      case 'dynamiczone': return 'repeater'
      case 'media': return 'media'
      case 'relation': return 'component'
      case 'enumeration': return 'text'
      default: return 'text'
    }
  }

  private findCT(items: StrapiCTBContentType[], id: string): StrapiCTBContentType | undefined {
    const idSan = String(id).toLowerCase().replace(/[^a-z0-9_\-]+/g, '_').replace(/^_+|_+$/g, '')
    const idKebab = idSan.replace(/_/g, '-')
    return items.find((ct) => {
      const uid = (ct.uid || '').toLowerCase()
      const apiId = (ct.apiID || '').toLowerCase()
      const singular = (ct.schema && (ct.schema as any).singularName || '').toLowerCase()
      return uid.endsWith(idSan) || uid.endsWith(idKebab) || apiId === idSan || apiId === idKebab || singular === idSan || singular === idKebab
    })
  }

  // Cache of CTB types for mapping contentTypeId -> collection
  private ctCache: { index: Map<string, { uid: string; singular: string; plural: string; apiID?: string; attrs: Set<string>; dynamicZones: Map<string, { components: Map<string, { uid: string; typeKey: string }> }> }> } | null = null

  private sanitizeKey(raw?: string): string {
    if (!raw) return ''
    let s = raw.toString().trim().toLowerCase()
    s = s.replace(/[^a-z0-9_\-]+/g, '-').replace(/^-+|-+$/g, '')
    return s
  }

  // Strapi model/uid segment prefers kebab-case; avoid underscores
  private toKebab(raw?: string): string {
    const s = this.sanitizeKey(raw)
    return s.replace(/_/g, '-')
  }

  private async loadContentTypes(): Promise<void> {
    if (this.ctCache) return
    let items: StrapiCTBContentType[] = []
    try {
      await this.ensureAdminToken()
      const direct = await this.req('/content-type-builder/content-types', {}, true)
      items = (direct && (direct.data || direct)) || []
    } catch {}
    await this.loadComponents()
    const index = new Map<string, { uid: string; singular: string; plural: string; apiID?: string; attrs: Set<string>; dynamicZones: Map<string, { components: Map<string, { uid: string; typeKey: string; targetSingular?: string; relationField?: string }> }> }>()
    for (const ct of items) {
      const uid = ct.uid
      const schema = ct.schema || ({} as any)
      const singular = this.sanitizeKey(schema.singularName || ct.apiID || uid)
      const plural = this.sanitizeKey(schema.pluralName || `${singular}s`)
      const apiID = ct.apiID
      const attributes = schema.attributes || {}
      const attrNames = new Set<string>(Object.keys(attributes))
      const dynamicZones = new Map<string, { components: Map<string, { uid: string; typeKey: string; targetSingular?: string; relationField?: string }> }>()
      for (const key of Object.keys(attributes)) {
        const attr = (attributes as any)[key]
        if (attr && attr.type === 'dynamiczone') {
          const compList: string[] = Array.isArray(attr.components) ? attr.components : []
          const compMap = new Map<string, { uid: string; typeKey: string; targetSingular?: string; relationField?: string }>()
          for (const compUid of compList) {
            const parsed = this.parseComponentUid(compUid)
            const relation = this.getComponentRelation(compUid)
            compMap.set(parsed.safe, {
              uid: compUid,
              typeKey: parsed.typeKey,
              targetSingular: relation?.targetSingular,
              relationField: relation?.relationField
            })
          }
          if (compMap.size > 0) dynamicZones.set(key, { components: compMap })
        }
      }
      const record = { uid, singular, plural, apiID, attrs: attrNames, dynamicZones }
      index.set(singular, record)
      index.set(plural, record)
      if (apiID) index.set(this.sanitizeKey(apiID), record)
      if (uid) {
        const tail = uid.split('.').pop() || uid
        index.set(this.sanitizeKey(tail), record)
      }
      this.dynamicZoneRegistry.set(singular, dynamicZones)
    }
    this.ctCache = { index }
  }

  private normalizeComponentList(input: any): any[] {
    if (!input) return []
    if (Array.isArray(input)) return input
    if (Array.isArray((input as any)?.data)) return (input as any).data
    if (input && typeof input === 'object') {
      const out: any[] = []
      for (const key of Object.keys(input)) {
        const value = (input as any)[key]
        if (Array.isArray(value)) out.push(...value)
        else if (value && typeof value === 'object') out.push(value)
      }
      return out
    }
    return []
  }

  private async loadComponents(): Promise<void> {
    if (this.componentCache) return
    let list: any[] = []
    try {
      await this.ensureAdminToken()
      const res = await this.req('/content-type-builder/components', {}, true)
      list = this.normalizeComponentList(res)
    } catch {
      list = []
    }
    const byUid = new Map<string, any>()
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue
      const uid = (entry.uid as string | undefined)
      if (!uid) continue
      const schema = (entry as any).schema || entry
      byUid.set(uid, schema)
    }
    this.componentCache = { byUid }
  }

  private parseComponentUid(uid: string): { safe: string; typeKey: string } {
    const raw = (uid || '').toString()
    const segment = raw.includes('.') ? raw.split('.').pop() || raw : raw
    const cleaned = segment.replace(/-(fragment|ref|wrapper)$/i, '')
    const safe = this.sanitizeKey(cleaned)
    return { safe, typeKey: safe || cleaned }
  }

  private getComponentRelation(uid: string): { relationField: string; targetSingular: string } | null {
    const cache = this.componentCache?.byUid
    if (!cache) return null
    const entry = cache.get(uid)
    const schema = (entry as any)?.schema || entry
    const attributes = (schema && typeof schema === 'object' ? (schema as any).attributes : undefined) || {}
    for (const key of Object.keys(attributes)) {
      const conf = (attributes as any)[key]
      if (!conf || typeof conf !== 'object') continue
      if (conf.type === 'relation' && typeof conf.target === 'string' && conf.target.startsWith('api::')) {
        const target = conf.target.split('::')[1] || ''
        const singular = target.split('.').pop() || ''
        if (!singular) continue
        return { relationField: key, targetSingular: this.sanitizeKey(singular) }
      }
    }
    return null
  }

  private extractAllowedTypes(field: any): Array<{ safe: string; original: string }> {
    const result = new Map<string, string>()
    const collect = (values: any) => {
      if (!Array.isArray(values)) return
      for (const value of values) {
        if (typeof value !== 'string') continue
        const safe = this.sanitizeKey(value)
        if (!safe) continue
        if (!result.has(safe)) result.set(safe, value)
      }
    }
    collect(field?.allowedTypes)
    collect(field?.items?.allowedTypes)
    collect(field?.platformSpecific?.allowedTypes)
    collect(field?.metadata?.allowedTypes)
    collect(field?.meta?.allowedTypes)
    return Array.from(result.entries()).map(([safe, original]) => ({ safe, original }))
  }
  private collectComponentTypeCandidates(ownerType?: string): Array<{ safe: string; original: string }> {
    const results = new Map<string, string>()
    const ownerSafe = ownerType ? this.sanitizeKey(ownerType) : ''
    const compiledEntries = Object.entries(this.compiledByKey || {})
    for (const [key, meta] of compiledEntries) {
      const baseRaw = (meta?.baseType || meta?.category || '').toString().toLowerCase()
      if (baseRaw === '_page' || baseRaw === 'page') continue
      const typeKey = this.toKebab((meta?.originalKey || key) as string)
      const safe = this.sanitizeKey(typeKey)
      if (!safe || safe === ownerSafe) continue
      if (!results.has(safe)) results.set(safe, typeKey)
    }
    return Array.from(results.entries()).map(([safe, original]) => ({ safe, original }))
  }


  private isContentAreaField(normalized: string, field: any): boolean {
    const check = (normalized || '').replace(/\s+/g, '')
    if (!check) return false
    if (check === 'content[]' || check === 'contentarea' || check === 'contentarray') return true
    if (check.startsWith('array<content') || check.startsWith('array<contentreference>')) return true
    if (check === 'contentreference' || check === 'content') {
      if (Array.isArray(field?.allowedTypes) || Array.isArray(field?.items?.allowedTypes)) return true
    }
    const baseType = String(field?.type || '').toLowerCase()
    const itemType = String(field?.itemType || field?.item?.type || '').toLowerCase()
    const itemKind = String(field?.items?.kind || field?.items?.type || '').toLowerCase()
    if (itemType === 'content' || itemType === 'contentreference') return true
    if (itemKind === 'component' || itemKind === 'content') return true
    if ((baseType === 'array' || baseType === 'collection' || baseType === 'repeater')) {
      if (Array.isArray(field?.allowedTypes) || Array.isArray(field?.items?.allowedTypes)) return true
      if (itemType === 'content' || itemType === 'contentreference') return true
    }
    return false
  }

  private ensureDynamicComponent(rawKey: string, originalKey: string, collector?: Map<string, any>, targetSingular?: string): { uid: string; typeKey: string; safe: string; targetSingular?: string; relationField?: string } {
    let safe = this.sanitizeKey(rawKey || originalKey || 'component')
    if (!safe) safe = 'component'
    const existing = this.componentDefinitions.get(safe)
    if (existing) {
      if (collector) collector.set(existing.uid, existing.op)
      return { uid: existing.uid, typeKey: existing.typeKey, safe, targetSingular: existing.targetSingular, relationField: existing.relationField }
    }
    const displayName = this.toDisplayName(originalKey || rawKey || safe)
    const modelName = `${safe}-fragment`
    const uid = `catalyst.${modelName}`
    let relationField: string | undefined
    const attributes: any[] = []
    attributes.push({ action: 'create', name: 'componentType', properties: { type: 'string' } })
    if (targetSingular) {
      relationField = 'component'
      const targetUid = `api::${targetSingular}.${targetSingular}`
      attributes.push({ action: 'create', name: relationField, properties: { type: 'relation', relation: 'oneToOne', target: targetUid } })    } else {
      attributes.push({ action: 'create', name: 'data', properties: { type: 'json' } })
    }
    const op = {
      action: 'create',
      uid,
      category: 'catalyst',
      status: 'NEW',
      modelName,
      globalId: this.toPascalCase(modelName),
      modelType: 'component',
      displayName: `${displayName} Fragment`,
      attributes
    }
    this.componentDefinitions.set(safe, { uid, typeKey: originalKey || safe, op, targetSingular, relationField })
    if (collector) collector.set(uid, op)
    return { uid, typeKey: originalKey || safe, safe, targetSingular, relationField }
  }

  private registerDynamicZone(ownerType: string | undefined, fieldName: string, components: Map<string, { uid: string; typeKey: string; targetSingular?: string; relationField?: string }>): void {
    if (!ownerType) return
    const key = this.sanitizeKey(ownerType)
    let zones = this.dynamicZoneRegistry.get(key)
    if (!zones) {
      zones = new Map()
      this.dynamicZoneRegistry.set(key, zones)
    }
    zones.set(fieldName, { components })
  }

  private async transformDynamicZones(
    pruned: any,
    mapping: { dynamicZones: Map<string, { components: Map<string, { uid: string; typeKey: string; targetSingular?: string; relationField?: string }> }> },
    originalItem: any,
    componentEntryCache: Map<string, string>
  ): Promise<void> {
    if (!mapping?.dynamicZones || mapping.dynamicZones.size === 0) return
    await this.loadComponents()
    for (const [field, config] of mapping.dynamicZones.entries()) {
      if (!config || !config.components || config.components.size === 0) continue
      const current = pruned[field]
      if (Array.isArray(current) && current.every((entry: any) => entry && typeof entry === 'object' && typeof entry.__component === 'string')) continue
      const rawValue = this.extractContentAreaValue(field, pruned, originalItem, current)
      if (rawValue === undefined || rawValue === null) {
        delete pruned[field]
        continue
      }
      const arr = Array.isArray(rawValue) ? rawValue : [rawValue]
      const transformed: any[] = []
      for (const entry of arr) {
        const dz = await this.buildDynamicZoneEntry(entry, config, componentEntryCache)
        if (dz) transformed.push(dz)
      }
      pruned[field] = transformed
    }
  }

  private extractContentAreaValue(fieldName: string, pruned: any, originalItem: any, currentValue: any): any {
    if (Array.isArray(currentValue) || (currentValue && typeof currentValue === 'object')) return currentValue
    const templateProps = originalItem && typeof originalItem.templateProps === 'object' ? originalItem.templateProps : undefined
    if (templateProps && Object.prototype.hasOwnProperty.call(templateProps, fieldName)) {
      return (templateProps as any)[fieldName]
    }
    const contentObj = originalItem && originalItem.content && typeof originalItem.content === 'object' ? originalItem.content : undefined
    if (contentObj && Object.prototype.hasOwnProperty.call(contentObj, fieldName)) {
      return (contentObj as any)[fieldName]
    }
    if (fieldName === 'components' && Array.isArray(originalItem?.components)) {
      return originalItem.components.map((comp: any) => ({
        id: comp.id,
        type: comp.type,
        position: comp.position,
        properties: comp.properties ?? comp.props ?? {},
        parentId: comp.parentId,
        isShared: comp.isShared,
        sharedId: comp.sharedId,        components: comp.components
      }))
    }
    return currentValue
  }

  private extractComponentProperties(value: any): any {
    if (!value || typeof value !== 'object') return {}
    const source = (value.properties && typeof value.properties === 'object')
      ? value.properties
      : (value.data && typeof value.data === 'object')
        ? value.data
        : value
    const clone = JSON.parse(JSON.stringify(source))
    delete clone.type
    delete clone.componentType
    delete clone.contentType
    delete clone.id
    delete clone.sharedId
    delete clone.isShared
    delete clone.position
    delete clone.parentId
    delete clone.overrides
    delete clone.components
    delete clone.displayOption
    return clone
  }

  private async buildDynamicZoneEntry(
    value: any,
    config: { components: Map<string, { uid: string; typeKey: string; targetSingular?: string; relationField?: string }> },
    componentEntryCache: Map<string, string>
  ): Promise<any | null> {
    if (value === undefined || value === null) return null
    if (typeof value !== 'object') {
      const fallback = Array.from(config.components.values())[0]
      if (!fallback) return null
      return {
        __component: fallback.uid,
        componentType: fallback.typeKey,
        data: { value }
      }
    }
    const typeRaw = value?.type || value?.componentType || value?.contentType || ''
    const safeType = this.sanitizeKey(typeRaw)
    const component = config.components.get(safeType) || Array.from(config.components.values())[0]
    if (!component) return null
    if (component.targetSingular && component.relationField) {
      const componentId = await this.ensureComponentEntry(value, component.targetSingular, componentEntryCache)
      return {
        __component: component.uid,
        componentType: typeRaw || component.typeKey,
        [component.relationField]: { connect: [componentId] }
      }
    }
    const properties = this.extractComponentProperties(value)
    return {
      __component: component.uid,
      componentType: typeRaw || component.typeKey,
      data: properties
    }
  }

  private buildComponentCacheKey(componentTypeKey: string, originalValue: any, fingerprint: any): string {
    if (originalValue && typeof originalValue === 'object') {
      if (originalValue.sharedId) return `${componentTypeKey}:${originalValue.sharedId}`
      if (originalValue.id) return `${componentTypeKey}:${originalValue.id}`
    }
    return `${componentTypeKey}:${JSON.stringify(fingerprint)}`
  }

  private async ensureComponentEntry(
    value: any,
    componentTypeKey: string,
    componentEntryCache: Map<string, string>
  ): Promise<string> {
    const payload = this.extractComponentProperties(value)
    const cacheKey = this.buildComponentCacheKey(componentTypeKey, value, payload)
    const cached = componentEntryCache.get(cacheKey)
    if (cached) return cached
    const mapping = this.resolveCollectionFor(componentTypeKey)
    if (!mapping) throw new Error(`No Strapi content type mapping for component '${componentTypeKey}'`)
    const pruned: any = {}
    for (const attr of mapping.attrs) {
      if (Object.prototype.hasOwnProperty.call(payload, attr)) pruned[attr] = payload[attr]
    }
    const fallbackTitle = (value && value.title) || payload.title || componentTypeKey
    if (!pruned.title && fallbackTitle) pruned.title = fallbackTitle
    const nestedComponents = Array.isArray(value?.components) ? value.components : []
    const original = { content: payload, components: nestedComponents }
    await this.transformDynamicZones(pruned, mapping, original, componentEntryCache)
    const res = await this.req(`/api/${mapping.collection}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' } as any,
      body: JSON.stringify({ data: pruned }),
    })
    const data = res && res.data
    const created = data && (data.data ? data.data : data)
    const idLike = created && (created.documentId || created.id)
    const newId = data && (data.documentId || data.id || String(Math.random()))
    const resultId = String(idLike || newId || Math.random())
    componentEntryCache.set(cacheKey, resultId)
    return resultId
  }

  private toDisplayName(raw: string): string {
    const base = (raw || '').replace(/[_-]+/g, ' ').trim()
    if (!base) return 'Component'
    return base.split(' ').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
  }

  private toPascalCase(raw: string): string {
    return (raw || '').replace(/(^|[-_])(\w)/g, (_, __, c) => (c || '').toUpperCase())
  }

  private resolveCollectionFor(contentTypeId: string): { collection: string; uid: string; attrs: Set<string>; dynamicZones: Map<string, { components: Map<string, { uid: string; typeKey: string }> }> } | null {
    if (!this.ctCache) return null
    const idx = this.ctCache.index
    const keyRaw = this.sanitizeKey(contentTypeId)
    const key = keyRaw
    const kebab = this.toKebab(keyRaw)
    // Try exact key
    let rec = idx.get(key) || idx.get(kebab)
    // Try simple plural/singular variants
    if (!rec) rec = idx.get(this.sanitizeKey(`${key}s`)) || idx.get(this.sanitizeKey(key.replace(/s$/, '')))
    if (!rec) rec = idx.get(this.sanitizeKey(`${kebab}s`)) || idx.get(this.sanitizeKey(kebab.replace(/s$/, '')))
    if (!rec) return null
    const dynamicZones = rec.dynamicZones || new Map<string, { components: Map<string, { uid: string; typeKey: string }> }>()
    this.dynamicZoneRegistry.set(rec.singular, dynamicZones)
    return { collection: rec.plural, uid: rec.uid, attrs: rec.attrs, dynamicZones }
  }




  async syncUnifiedBundle(
    bundle: UnifiedExportBundle,
    _options?: UnifiedBundleSyncOptions
  ): Promise<UnifiedBundleSyncResult> {
    const batchResult = await this.processBatchUnifiedContent(bundle.unifiedContent)
    return formatUnifiedBundleSyncResult(this.id, batchResult)
  }

  // Writes using Content API only
  async processBatchUnifiedContent(unifiedItems: any[]): Promise<{ successful: UniversalContentItem[]; failed: { item: any; error: string }[] }> {
    const successful: UniversalContentItem[] = []
    const failed: { item: any; error: string }[] = []
    const componentEntryCache = new Map<string, string>()

    // Ensure we have a Content API token (mint via admin if provided)
    if (!this.apiToken) {
      try { await this.ensureApiToken() } catch (e: any) {
        const msg = e?.message || 'Failed to obtain Strapi Content API token'
        for (const item of unifiedItems) failed.push({ item, error: msg })
        return { successful, failed }
      }
    }

    // Load content types once to map ids to collections
    await this.loadContentTypes()

    for (const item of unifiedItems) {
      try {
        const mapping = this.resolveCollectionFor(item.type)
        if (!mapping) throw new Error(`No Strapi content type mapping for '${item.type}'`)
        const collection = mapping.collection

        const basePayload: any = (item.content && typeof item.content === 'object') ? { ...(item.content as any) } : {}
        if (!basePayload.title && item.title) basePayload.title = item.title
        // Prune to known attributes to avoid validation errors
        const pruned: any = {}
        for (const k of Object.keys(basePayload)) {
          if (mapping.attrs.has(k)) pruned[k] = (basePayload as any)[k]
        }
        const templateProps = (item.templateProps && typeof item.templateProps === 'object')
          ? JSON.parse(JSON.stringify(item.templateProps))
          : null
        if (templateProps) {
          for (const key of Object.keys(templateProps)) {
            if (mapping.attrs.has(key)) {
              pruned[key] = templateProps[key]
            } else if (mapping.dynamicZones?.has(key)) {
              pruned[key] = templateProps[key]
            }
          }
        }
        if (mapping.attrs.has('templateKey') && item.templateKey) {
          pruned.templateKey = item.templateKey
        }
        if (mapping.attrs.has('templateProps') && templateProps) {
          pruned.templateProps = templateProps
        }
        if (!pruned.title && item.title) pruned.title = item.title
        await this.transformDynamicZones(pruned, mapping, item, componentEntryCache)

        const res = await this.req(`/api/${collection}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' } as any,
          body: JSON.stringify({ data: pruned }),
        })
        const data = res && res.data

        const created = data && (data.data ? data.data : data)
        const idLike = created && (created.documentId || created.id)
        const newId = data && (data.documentId || data.id || String(Math.random()))
        const uni: UniversalContentItem = {
          id: String(idLike || newId || Math.random()),
          contentTypeId: item.type,
          name: pruned.title || item.title || String(idLike || newId),
          title: pruned.title || item.title || String(idLike || newId),
          slug: (item.slug || pruned.slug || pruned.title || item.title || String(idLike || newId)).toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
          content: {},
          contentType: (item.type === 'page' ? 'page' : 'component'),
          fields: pruned,
          status: 'published',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        successful.push(uni)
      } catch (e: any) {
        console.error('[StrapiProvider] failed to create item', {
          type: item?.type,
          title: item?.title,
          error: e?.message,
          body: e?.body,
        })
        const detail = (e && e.body) ? ` - ${e.body}` : ''
        failed.push({ item, error: `${e?.message || String(e)}${detail}` })
      }
    }
    return { successful, failed }
  }

  // Build Strapi CTB operation attribute from a universal-ish field
  private mapFieldToStrapiAttribute(field: any, componentCollector?: Map<string, any>, ownerType?: string): { name: string; properties: Record<string, any> } | null {
    if (!field) return null
    const name = this.sanitizeKey(field.name || field.id)
    if (!name) return null
    const rawInput = String(field.valueType || field.type || 'text').toLowerCase()
    const normalized = rawInput.replace(/\s+/g, '')
    if (this.isContentAreaField(normalized, field)) {
      let allowed = this.extractAllowedTypes(field)
      if ((!allowed || allowed.length === 0) && ownerType) {
        try {
          const compiled = this.compiledByKey?.[ownerType]
          const compiledFields: any[] = Array.isArray(compiled?.fields) ? compiled?.fields : []
          const compiledMatch = compiledFields.find((cf: any) => this.sanitizeKey(cf?.name || cf?.id) === name)
          const compiledAllowed: string[] | undefined = Array.isArray(compiledMatch?.allowedTypes) ? compiledMatch?.allowedTypes : undefined
          if (compiledAllowed && compiledAllowed.length > 0) {
            allowed = compiledAllowed.map((value: string) => ({ safe: this.sanitizeKey(value), original: value }))
          }
        } catch {}
      }
      const zoneComponents = new Map<string, { uid: string; typeKey: string; targetSingular?: string; relationField?: string }>()
      const componentUids: string[] = []
      if (allowed.length === 0) {
        const fallbackKey = this.sanitizeKey(`${ownerType || 'content'}-${name}`) || name
        const ensured = this.ensureDynamicComponent(fallbackKey, fallbackKey, componentCollector)
        componentUids.push(ensured.uid)
        zoneComponents.set(ensured.safe, { uid: ensured.uid, typeKey: ensured.typeKey })
      } else {
        for (const entry of allowed) {
          const targetSingular = entry.safe
          const ensured = this.ensureDynamicComponent(entry.safe, entry.original, componentCollector, targetSingular)
          componentUids.push(ensured.uid)
          zoneComponents.set(entry.safe, {
            uid: ensured.uid,
            typeKey: entry.original,
            targetSingular,
            relationField: ensured.relationField
          })
        }
      }
      if (ownerType) this.registerDynamicZone(ownerType, name, zoneComponents)
      return { name, properties: { type: 'dynamiczone', components: Array.from(new Set(componentUids)) } }
    }
    const props: Record<string, any> = {}
    switch (normalized) {
      case 'text': props.type = 'string'; break
      case 'longtext':
      case 'richtext': props.type = 'richtext'; break
      case 'number': props.type = 'integer'; break
      case 'decimal':
      case 'float': props.type = 'decimal'; break
      case 'boolean': props.type = 'boolean'; break
      case 'date':
      case 'datetime': props.type = 'datetime'; break
      case 'json': props.type = 'json'; break
      case 'media': props.type = 'media'; break
      default:
        props.type = 'string'
    }
    return { name, properties: props }
  }


  private buildCTBOperationsFromCompiled(compiled: any): { contentTypes: any[]; components: Map<string, any> } {
    const all: Array<{ key: string; name?: string; pluralName?: string; fields?: any[]; baseType?: string }> = Array.isArray(compiled?.all)
      ? compiled.all
      : Object.keys(compiled?.byKey || {}).map((k) => ({ key: k, fields: compiled.byKey[k].fields || [] }))

    const makePlural = (s: string) => (s.endsWith('s') ? s : `${s}s`)
    const contentTypes: any[] = []
    const componentCollector = new Map<string, any>()
    for (const ct of all) {
      const singular = this.toKebab(ct.key || ct.name)
      if (!singular) continue
      const plural = this.toKebab(ct.pluralName || makePlural(singular))
      const attrs: any[] = []
      const fields = Array.isArray(ct.fields) ? ct.fields : []
      for (const f of fields) {
        const attr = this.mapFieldToStrapiAttribute(f, componentCollector, singular)
        if (attr) attrs.push({ action: 'create', name: attr.name, properties: attr.properties })
      }
      // Ensure a title field exists for UX
      if (!attrs.some(a => a.name === 'title')) {
        attrs.unshift({ action: 'create', name: 'title', properties: { type: 'string' } })
      }
      const record = {
        action: 'create',
        uid: `api::${singular}.${singular}`,
        modelName: singular,
        kind: 'collectionType',
        globalId: singular.replace(/(^|[-_])(\w)/g, (_, __, c) => (c || '').toUpperCase()),
        pluginOptions: {},
        collectionName: plural.replace(/-/g, '_'),
        modelType: 'contentType',
        attributes: attrs,
        status: 'DRAFT',
        draftAndPublish: true,
        singularName: singular,
        pluralName: plural,
        displayName: ct.name || singular,
      }
      contentTypes.push(record)
    }
    return { contentTypes, components: componentCollector }
  }


  // Compiled type capability with ensure -> creates content types via CTB update-schema
  getCompiledTypeSupport() {
    return {
      compile: (contentTypes: ContentTypeExport[]) => {
        const byKey: Record<string, { fields: any[]; baseType: '_page' | '_component'; category: string; originalKey?: string }> = {}
        const all: Array<{ key: string; name: string; pluralName: string; fields: any[]; baseType: string }> = []

        for (const ct of contentTypes) {
          const universal = buildUniversalContentType(ct)
          const safeId = this.sanitizeKey(universal.id || ct.key || ct.name || ct.id)
          const key = safeId || this.sanitizeKey(ct.key || ct.id || ct.name) || `type_${all.length + 1}`
          const pluralName = this.sanitizeKey((universal as unknown as { pluralName?: string }).pluralName || `${key}s`) || `${key}s`
          const fields = Array.isArray(universal.fields) ? universal.fields : []
          const baseType: '_page' | '_component' = universal.type === 'page' ? '_page' : '_component'

          byKey[key] = {
            fields,
            baseType,
            category: universal.type,
            originalKey: ct.key
          }

          all.push({
            key,
            name: universal.name || key,
            pluralName,
            fields,
            baseType: universal.type
          })
        }

        this.compiledByKey = byKey
        return { byKey, all }
      },
      configure: async (_compiled: any) => { /* no-op */ },
      ensure: async (compiled: any) => {
        await this.ensureAdminToken()
        await this.loadContentTypes()
        const ops = this.buildCTBOperationsFromCompiled(compiled)
        const contentTypes = ops.contentTypes || []
        const componentEntries = Array.from(ops.components.entries())
        const toCreate = contentTypes.filter((ct: any) => {
          const singular = this.sanitizeKey(ct?.singularName || ct?.modelName)
          const exists = this.resolveCollectionFor(singular)
          return !exists
        })
        let components: any[] = []
        if (componentEntries.length > 0) {
          await this.loadComponents()
          const existing = this.componentCache?.byUid ?? new Map<string, any>()
          components = componentEntries
            .filter(([uid]) => !existing.has(uid))
            .map(([, op]) => op)
        }
        if (toCreate.length === 0 && components.length === 0) return
        const payload = { data: { components, contentTypes: toCreate } }
        try {
          await this.req('/content-type-builder/update-schema', { method: 'POST', headers: { 'Content-Type': 'application/json' } as any, body: JSON.stringify(payload) }, true)
        } catch (e: any) {
          const msg = e?.message || ''
          if (!/alreadyexists/i.test(msg)) throw e
        }
        // Poll update status briefly
        const startTs = Date.now()
        while (Date.now() - startTs < 60000) {
          try {
            const s = await this.req('/content-type-builder/update-schema-status', {}, true)
            const upd = s && s.data && s.data.isUpdating
            if (!upd) break
          } catch {}
          await new Promise((r) => setTimeout(r, 800))
        }
        // Clear caches to refresh mapping on next write
        this.ctCache = null
        this.componentCache = null

      },
      registerContentTypeMapping: (dbId: string, safeKey: string, baseType: '_page' | '_component') => {
        this.contentTypeMapping.set(dbId, { key: safeKey, baseType })
      }
    }
  }
}



