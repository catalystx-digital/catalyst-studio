import { z } from 'zod/v4'
import { parseFragment } from 'parse5'

const allowedTags = new Set(['p','ul','ol','li','strong','em','a','img','blockquote','br','h3','h4','h5','h6'])
const richText = z.string().refine(value => {
  const walk = (node: any): boolean => {
    if (node.tagName && !allowedTags.has(node.tagName)) return false
    if (node.attrs?.some((attr: any) => !((node.tagName === 'a' && attr.name === 'href') || (node.tagName === 'img' && ['src','alt'].includes(attr.name))))) return false
    return (node.childNodes || []).every(walk)
  }
  return walk(parseFragment(value))
}, 'Rich text permits only p, ul, ol, li, strong, em, a, img, blockquote, br, and h3–h6').describe('HTML subset: p, ul, ol, li, strong, em, a[href], img[src,alt], blockquote, br, h3–h6; no other tags or attributes.')

const media = z.strictObject({kind:z.enum(['image','icon','video','embed']).optional(),url:z.string().min(1).optional(),alt:z.string().optional(),poster:z.string().optional()})
  .refine(value=>value.kind!=='icon'||(!!value.url&&/^(?:https?:\/\/|\/|\.\/|\.\.\/|data:image\/|<svg\b)/i.test(value.url)), 'An icon must be an image URL or inline SVG')
  .describe('Icons must use an image URL, data:image URL, or inline SVG; never a named icon identifier.')
type Link = {label?:string;url?:string;emphasis?:'primary'|'secondary'|'plain';children?:Link[]}
const link: z.ZodType<Link> = z.lazy(() => z.strictObject({label:z.string().optional(),url:z.string().optional(),emphasis:z.enum(['primary','secondary','plain']).optional(),children:z.array(link).optional()}))
const item = z.strictObject({title:z.string().optional(),subtitle:z.string().optional(),body:richText.optional(),media:media.optional(),links:z.array(link).optional(),meta:z.array(z.strictObject({key:z.string().optional(),value:z.string().optional()})).optional()})
const section = {eyebrow:z.string().optional(),heading:z.string().optional(),intro:richText.optional(),media:media.optional(),links:z.array(link).optional(),items:z.array(item).optional(),placement:z.enum(['header','main','sidebar','footer']).optional()}
const formFields = z.array(z.strictObject({label:z.string().optional(),type:z.string().optional(),required:z.boolean().optional(),options:z.array(z.string()).optional()}))
const settings = <T extends z.ZodRawShape>(shape:T) => z.strictObject({...section,settings:z.strictObject(shape).optional()})
const count = z.number().int().nonnegative()
const position = z.enum(['none','background','left','right','below'])
export const familySchemas: Record<string,z.ZodType> = {
  'site-header':settings({sticky:z.boolean().optional(),transparent:z.boolean().optional(),mobileMenuStyle:z.string().optional()}),
  'site-footer':z.strictObject({...section,form:z.strictObject({fields:formFields,submitLabel:z.string().optional()}).optional(),settings:z.strictObject({columns:count.optional(),tone:z.enum(['dark','light']).optional()}).optional()}),
  'local-nav':settings({kind:z.enum(['breadcrumb','vertical','toc']).optional()}),
  hero:settings({mediaPosition:position.optional(),mediaKind:z.enum(['image','video']).optional(),height:z.string().optional(),alignment:z.string().optional(),slideshow:z.boolean().optional()}),
  content:settings({mediaPosition:position.optional(),textColumns:z.union([z.literal(1),z.literal(2)]).optional(),width:z.string().optional()}),
  collection:z.strictObject({...section,items:z.array(item),settings:z.strictObject({layout:z.enum(['grid','list','bento','carousel','timeline']).optional(),columns:count.optional(),itemStyle:z.enum(['card','plain','icon-left']).optional(),source:z.enum(['static','feed']).optional()}).optional()}),
  'logo-strip':settings({layout:z.enum(['grid','marquee']).optional(),greyscale:z.boolean().optional()}),
  stats:settings({layout:z.string().optional(),emphasis:z.string().optional()}),
  testimonials:settings({layout:z.enum(['single','grid','carousel']).optional(),showRating:z.boolean().optional()}),
  pricing:settings({columns:count.optional(),billingToggle:z.boolean().optional()}),
  disclosure:settings({mode:z.enum(['accordion','tabs']).optional(),openOnLoad:z.boolean().optional()}),
  cta:settings({style:z.enum(['banner','inline','card']).optional(),backgroundMedia:media.optional()}),
  form:z.strictObject({...section,fields:formFields,submitLabel:z.string().optional(),settings:z.strictObject({layout:z.enum(['stacked','inline','side-by-side']).optional()}).optional()}),
  table:z.union([
    z.strictObject({...section,columns:z.array(z.string()).optional(),rows:z.array(z.array(z.string())),caption:z.string().optional(),chartImage:z.string().optional(),settings:z.strictObject({striped:z.boolean().optional(),stickyHeader:z.boolean().optional()}).optional()}),
    z.strictObject({...section,columns:z.array(z.string()).optional(),rows:z.array(z.array(z.string())).optional(),caption:z.string().optional(),chartImage:z.string(),settings:z.strictObject({striped:z.boolean().optional(),stickyHeader:z.boolean().optional()}).optional()})
  ]).describe('A table requires rows or chartImage.'),
  media:settings({layout:z.enum(['single','grid','masonry','carousel']).optional(),aspectRatio:z.string().optional(),lightbox:z.boolean().optional()})
}
export const familyJsonSchemas: Record<string,unknown> = Object.fromEntries(Object.entries(familySchemas).map(([name,schema])=>[name,z.toJSONSchema(schema)]))
