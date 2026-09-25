import { z } from 'zod/v4'
import { SmartLinkSchema } from '@/lib/studio/components/cms/_core/value-objects/schemas/smart-link.schema'
import { normalizeFooterContent, normalizeNavbarContent } from '@/lib/studio/import/services/page-builder/component-helpers/normalizers/nav-normalizers'
import { normalizeHeroBannerContent } from '@/lib/studio/import/services/page-builder/component-helpers/normalizers/hero-normalizers'
import { normalizeCtaBannerContent } from '@/lib/studio/import/services/page-builder/component-helpers/normalizers/cta-normalizers'

// TextBlockDef accepts rich text as a string, including headings and class attributes.
const richText = z.string().describe('Rich text HTML accepted by production.')

const media = z.strictObject({kind:z.enum(['image','icon','video','embed']).optional(),url:z.string().min(1).optional(),alt:z.string().optional(),poster:z.string().optional()})
  .refine(value=>value.kind!=='icon'||(!!value.url&&/^(?:https?:\/\/|\/|\.\/|\.\.\/|data:image\/|<svg\b)/i.test(value.url)), 'An icon must be an image URL or inline SVG')
  .describe('Icons must use an image URL, data:image URL, or inline SVG; never a named icon identifier.')
type Link = {type?:'internal'|'external'|'email'|'phone'|'anchor';label?:string;url?:string;href?:string;path?:string;pageId?:string;openInNewTab?:boolean;emphasis?:'primary'|'secondary'|'plain';children?:Link[]}
// The family contract describes the link tree; production's SmartLink schema is
// the authority for destination requirements and canonical output.
const link: z.ZodType<Link> = z.lazy(() => z.strictObject({type:z.enum(['internal','external','email','phone','anchor']).optional(),label:z.string().optional(),url:z.string().optional(),href:z.string().optional(),path:z.string().optional(),pageId:z.string().optional(),openInNewTab:z.boolean().optional(),emphasis:z.enum(['primary','secondary','plain']).optional(),children:z.array(link).optional()}).refine(value => value.type !== undefined || (Boolean(value.label) && Boolean(value.children?.length)), 'A navigation parent needs a label and children'))
const item = z.strictObject({title:z.string().optional(),subtitle:z.string().optional(),body:richText.optional(),media:media.optional(),links:z.array(link).optional(),meta:z.array(z.strictObject({key:z.string().optional(),value:z.string().optional()})).optional()})
const section = {eyebrow:z.string().optional(),heading:z.string().optional(),intro:richText.optional(),media:media.optional(),links:z.array(link).optional(),items:z.array(item).optional(),placement:z.enum(['header','main','sidebar','footer']).optional()}
const formFields = z.array(z.strictObject({label:z.string().optional(),type:z.string().optional(),required:z.boolean().optional(),options:z.array(z.string()).optional()}))
const settings = <T extends z.ZodRawShape>(shape:T) => z.strictObject({...section,settings:z.strictObject(shape).optional()})
const columns = z.number().int().min(1).max(6)
const position = z.enum(['none','background','left','right','below'])
export const familySchemas: Record<string,z.ZodType> = {
  'site-header':settings({sticky:z.boolean().optional(),transparent:z.boolean().optional(),mobileMenuStyle:z.enum(['dropdown','drawer','full-screen']).optional()}),
  'site-footer':z.strictObject({...section,form:z.strictObject({fields:formFields,submitLabel:z.string().optional()}).optional(),settings:z.strictObject({columns:columns.optional(),tone:z.enum(['dark','light']).optional()}).optional()}),
  'local-nav':settings({kind:z.enum(['breadcrumb','vertical','toc']).optional()}),
  hero:settings({mediaPosition:position.optional(),mediaKind:z.enum(['image','video']).optional(),height:z.enum(['small','medium','large','full']).optional(),alignment:z.enum(['left','center','right']).optional(),slideshow:z.boolean().optional()}),
  content:settings({mediaPosition:position.optional(),textColumns:z.union([z.literal(1),z.literal(2),z.literal(3)]).optional(),width:z.enum(['narrow','normal','wide','full']).optional()}),
  collection:z.strictObject({...section,items:z.array(item).min(1),settings:z.strictObject({layout:z.enum(['grid','list','bento','carousel','timeline']).optional(),columns:columns.optional(),itemStyle:z.enum(['card','plain','icon-left']).optional(),source:z.enum(['static','feed']).optional()}).optional()}),
  'logo-strip':settings({layout:z.enum(['grid','marquee']).optional(),greyscale:z.boolean().optional()}),
  stats:settings({layout:z.enum(['grid','row']).optional(),emphasis:z.enum(['primary','secondary','plain']).optional()}),
  testimonials:settings({layout:z.enum(['single','grid','carousel']).optional(),showRating:z.boolean().optional()}),
  pricing:settings({columns:columns.optional(),billingToggle:z.boolean().optional()}),
  disclosure:settings({mode:z.enum(['accordion','tabs']).optional(),openOnLoad:z.boolean().optional()}),
  cta:settings({style:z.enum(['banner','inline','card']).optional(),backgroundMedia:media.optional()}),
  form:z.strictObject({...section,fields:formFields,submitLabel:z.string().optional(),settings:z.strictObject({layout:z.enum(['stacked','inline','side-by-side']).optional()}).optional()}),
  table:z.union([
    z.strictObject({...section,columns:z.array(z.string()).optional(),rows:z.array(z.array(z.string())),caption:z.string().optional(),chartImage:z.string().optional(),settings:z.strictObject({striped:z.boolean().optional(),stickyHeader:z.boolean().optional()}).optional()}),
    z.strictObject({...section,columns:z.array(z.string()).optional(),rows:z.array(z.array(z.string())).optional(),caption:z.string().optional(),chartImage:z.string(),settings:z.strictObject({striped:z.boolean().optional(),stickyHeader:z.boolean().optional()}).optional()})
  ]).describe('A table requires rows or chartImage.'),
  media:settings({layout:z.enum(['single','grid','masonry','carousel']).optional(),aspectRatio:z.enum(['16:9','4:3','21:9','1:1','9:16']).optional(),lightbox:z.boolean().optional()})
}
export const familyJsonSchemas: Record<string,unknown> = Object.fromEntries(Object.entries(familySchemas).map(([name,schema])=>[name,z.toJSONSchema(schema)]))

const options = (type: string) => ({ parentCanonicalType: type })
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const menuInput = (value: unknown): unknown => record(value) && value.type
  ? { label: value.label, href: value, ...(value.children ? { children: (value.children as unknown[]).map(menuInput) } : {}) }
  : value
const menuOutput = (value: unknown): unknown => {
  if (!record(value)) return value
  const href = record(value.href) ? value.href : {}
  return {
    ...href,
    ...(value.label === undefined ? {} : { label: value.label }),
    ...(value.children === undefined ? {} : { children: (value.children as unknown[]).map(menuOutput) })
  }
}

/** Run the normalizer for the matching production type and field, then project
 * its repaired value back into the family contract. No other family fields are repaired. */
function repairFamilyFields(type: string, content: Record<string, unknown>): Record<string, unknown> {
  const repaired = { ...content }
  if (type === 'site-footer') {
    const footerLinks = (links: unknown[]): unknown[] => {
      if (!links.length) return []
      const result = normalizeFooterContent({ columns: [{ title: 'Links', links: links.map(menuInput) }] }, options('footer')).content
      const column = Array.isArray(result.columns) ? result.columns[0] as Record<string, unknown> : undefined
      const normalized = Array.isArray(column?.links) ? column.links : []
      if (normalized.length !== links.length) throw new Error('Footer link repair discarded a link')
      return normalized.map(menuOutput)
    }
    if (Array.isArray(content.links)) repaired.links = footerLinks(content.links)
    if (Array.isArray(content.items)) repaired.items = content.items.map(item => record(item) && Array.isArray(item.links)
      ? { ...item, links: footerLinks(item.links) }
      : item)
    if (record(content.media) && content.media.url === '') {
      const result = normalizeFooterContent({ logo: content.media }, options('footer')).content
      if (result.logo === undefined) delete repaired.media
    }
  } else if (type === 'site-header' && Array.isArray(content.links)) {
    // Navbar normalizes menu trees in place; unlike footer it does not repair
    // destination aliases or discard arbitrary presentation fields.
    const result = normalizeNavbarContent({ menuItems: content.links }, options('navbar')).content
    repaired.links = Array.isArray(result.menuItems) ? result.menuItems : content.links
  } else if (type === 'hero' && Array.isArray(content.links)) {
    const result = normalizeHeroBannerContent({ ctaButtons: content.links.map(menuInput) }, options('hero-banner')).content
    repaired.links = Array.isArray(result.ctaButtons) ? result.ctaButtons.map(menuOutput) : []
  } else if (type === 'cta' && record(content.settings) && record(content.settings.backgroundMedia)) {
    const result = normalizeCtaBannerContent({ backgroundImage: content.settings.backgroundMedia }, options('cta-banner')).content
    if (result.backgroundImage === undefined) {
      repaired.settings = { ...content.settings }
      delete (repaired.settings as Record<string, unknown>).backgroundMedia
    }
  }
  return repaired
}

/** Apply the same SmartLink requirements and field pruning as production, at every depth. */
export function validateFamilyContent(type: string, content: Record<string, unknown>): Record<string, unknown> {
  const result = familySchemas[type]?.safeParse(repairFamilyFields(type, content))
  if (!result?.success) throw new Error(result?.error.message ?? 'Unknown component family: ' + type)
  const parsed = result.data as Record<string, unknown>
  const parseLink = (value: Link): Record<string, unknown> => {
    const hasDestination = value.url !== undefined || value.href !== undefined || value.path !== undefined || value.pageId !== undefined
    const canonical = hasDestination || !value.children?.length ? SmartLinkSchema.parse(value) : { label: value.label }
    return {
      ...canonical,
      ...(value.emphasis === undefined ? {} : { emphasis: value.emphasis }),
      ...(value.children === undefined ? {} : { children: value.children.map(parseLink) })
    }
  }
  const parseLinks = (record: Record<string, unknown>): Record<string, unknown> => ({
    ...record,
    ...(Array.isArray(record.links) ? { links: (record.links as Link[]).map(parseLink) } : {})
  })
  const normalized = parseLinks(parsed)
  if (Array.isArray(parsed.items)) normalized.items = parsed.items.map(item => parseLinks(item as Record<string, unknown>))
  return normalized
}
