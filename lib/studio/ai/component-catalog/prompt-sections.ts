import type { PromptSchemaField } from '@/lib/studio/ai/prompt-schema-builder'
import type { ComponentPropertyInfo } from './types'

export const PROMPT_NEWLINE = '\n'
export const PROMPT_SECTION_SEPARATOR = `${PROMPT_NEWLINE}${PROMPT_NEWLINE}`

export function createStaticSection(lines: string[]): string {
  return lines.join(PROMPT_NEWLINE)
}

export function trimTrailingEmptyLines(buffer: string[]): void {
  while (buffer.length > 0 && buffer[buffer.length - 1].trim() === '') {
    buffer.pop()
  }
}

export function formatList(values: string[], limit = 6): string {
  if (values.length <= limit) {
    return values.join(', ')
  }
  return `${values.slice(0, limit).join(', ')}, …`
}

export function compactPromptText(value: string, maxLength = 180): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

export function formatFieldOptions(options: Array<string | number>): string {
  return formatList(options.map(value => String(value)))
}

export function renderSchemaFieldNode(node: PromptSchemaField, depth: number, lines: string[]): void {
  const indent = '  '.repeat(depth)
  const label = node.path !== node.name ? node.path : node.name
  const requirement = node.required ? 'required' : 'optional'
  const notes: string[] = []

  if (node.allowedTypes && node.allowedTypes.length > 0) {
    notes.push(`allowedTypes: ${formatList(node.allowedTypes)}`)
  }
  if (node.options && node.options.length > 0) {
    notes.push(`options: ${formatFieldOptions(node.options)}`)
  }
  if (node.description) {
    notes.push(compactPromptText(node.description))
  }

  const suffix = notes.length > 0 ? ` — ${notes.join(' | ')}` : ''
  lines.push(`${indent}- ${label}: ${node.type} (${requirement})${suffix}`)

  node.children?.forEach(child => renderSchemaFieldNode(child, depth + 1, lines))
}

export function renderPropertyNode(property: ComponentPropertyInfo, depth: number, lines: string[]): void {
  const indent = '  '.repeat(depth)
  const requirement = property.required ? 'required' : 'optional'
  const notes: string[] = []

  if (property.allowedTypes && property.allowedTypes.length > 0) {
    notes.push(`allowedTypes: ${formatList(property.allowedTypes)}`)
  }
  if (property.description) {
    notes.push(compactPromptText(property.description))
  }
  if (property.source === 'aiMetadata') {
    notes.push('source: aiMetadata (propsMeta missing)')
  }
  if (property.source === 'schema') {
    notes.push('derived from schema')
  }

  const suffix = notes.length > 0 ? ` — ${notes.join(' | ')}` : ''
  lines.push(`${indent}- ${property.name}: ${property.type} (${requirement})${suffix}`)
}

export const ORDERING_RULES_SECTION = createStaticSection([
  '=== ORDERING RULES (MANDATORY) ===',
  '- Return components STRICTLY in the order they appear on the page (top-to-bottom DOM/visual order).',
  '- Do NOT group, sort, or rearrange by type, semantics, confidence, or any other criteria.',
  '- The output list order must mirror the page reading order exactly.'
])

export const CONTENT_EXTRACTION_SECTION = createStaticSection([
  '=== CONTENT EXTRACTION ===',
  'Extract actual content for each component including:',
  '- Text content (headings, paragraphs, labels)',
  '- Image URLs or descriptions as structured MediaReference objects when the schema field is media/image',
  '- Link destinations and labels as structured SmartLink objects only when the schema field documents a SmartLink/link-object shape; keep string URL fields as strings',
  '- Form fields and buttons',
  '- Stick strictly to documented schema fields; skip editorial summaries or filler fields that are not in the contract.',
  '- Component names must be registered catalog types only. Never invent generic wrappers such as "section", "container", "wrapper", "block", "group", or "layout".',
  '- Generic heading plus repeated linked cards/items should map to card-grid.cards[] for static projects/services/resources/projects/case studies, or content-feed.pinned[] for dated news/blog/article feeds. Never emit items[] unless the specific component contract lists items.',
  '- Do not emit raw HTML containers such as html-block unless html-block appears in COMPONENT CONTRACTS for this request. Convert visible raw HTML sections into the closest available registered component.',
  '- Any other relevant data'
])

export const VALUE_OBJECT_OUTPUT_SECTION = createStaticSection([
  '=== VALUE OBJECT OUTPUT SHAPES (MANDATORY) ===',
  '- Never emit null for optional fields. If a value is absent, omit the optional field entirely.',
  '- SmartLink fields MUST be objects, never raw strings.',
  '- Do not convert every field named href into SmartLink. If the contract says string, emit a string. Known exception: navbar/footer logo.href remains a string URL/path while logo.src is a MediaReference object.',
  '- Internal same-site paths: { "type": "internal", "pageId": "<stable-slug>", "path": "/path" }.',
  '- External absolute URLs: { "type": "external", "url": "https://example.com/path" }.',
  '- Email links: { "type": "email", "href": "mailto:name@example.com" }.',
  '- Phone links: { "type": "phone", "href": "tel:+123456789" }.',
  '- Anchor links: { "type": "anchor", "href": "#section-id" }.',
  '- MediaReference fields MUST be objects, never raw URL strings.',
  '- MediaReference image URLs: { "mediaId": "detected:<stable-kebab-id>", "mediaType": "image", "url": "https://example.com/image.jpg" }. mediaType is required and must be exactly "image".',
  '- Image object fields wrap MediaReference under src: { "src": { "mediaId": "detected:<stable-kebab-id>", "mediaType": "image", "url": "https://example.com/image.jpg" }, "alt": "..." }.',
  '- For fields named image, heroImage, slides[].image, cards[].image, pinned[].image, or logo-like image objects, do not flatten mediaId/mediaType/url onto the image object; put them under image.src. If the contract lists a string URL field such as hero-banner.backgroundImage, emit the URL string exactly as the contract requires.',
  '- Use deterministic detected:<stable-kebab-id> mediaId values from the field/component/URL. Do not invent real CMS media IDs.',
  '- Button variant fields are enums, not CSS classes. Emit variant only on documented button/action fields that list variant. Never invent a top-level component variant field. Emit only a documented enum value such as primary, secondary, or outline; never emit raw class names like "btn", "btn-skin-2", "button-primary", or class lists.'
])

export const CONTENT_REFERENCE_RULES_SECTION = createStaticSection([
  '=== CONTENT REFERENCE RULES (MANDATORY) ===',
  "- For any property with type 'content[]', each array element MUST be an object that includes a 'type' field. Use the allowedTypes list when provided; if no list is supplied, treat it as a wildcard and choose the canonical component type that matches the UI.",
  "- Required content[] or list fields must include every real item in page order. Never output an empty array when the UI renders entries.",
  "- If 'allowedTypes' contains a single value, ALWAYS set element.type to that exact value (e.g., features: [{ type: \"feature-item\", ... }]).",
  "- When copy, media, or CTAs share the same section heading (e.g., split/two-column layouts), wrap them in the appropriate container component instead of emitting adjacent single-column components.",
  "- For single content references (type 'content' or 'contentReference'), return an object with a 'type' field using the allowed type.",
  "- Do NOT return arrays of plain objects without 'type' for content[] fields.",
  "- Use sub-component types like 'feature-item' or 'testimonial-item' exactly when indicated by allowedTypes; when the list is omitted, pick the correct canonical type based on the rendered element.",
  '- Flatten subcomponents: emit the documented fields directly on each content[] item. Do not wrap them in "content", "data", "attributes", "props", or similar containers.',
  '  Example: "features": [{ "type": "feature-item", "title": "...", "description": "...", "icon": "star", "link": { "type": "internal", "pageId": "offers", "path": "/offers" } }].',
  '- Before finalizing, re-check every required array (cards[], slides[], testimonials[], etc.) and repopulate it if it is empty.'
])

export const FULL_PAGE_COVERAGE_SECTION = createStaticSection([
  '=== FULL PAGE COVERAGE (MANDATORY) ===',
  'You MUST detect and emit a component for EVERY distinct visual section on the page. Do NOT stop after detecting a few components.',
  '',
  'COMMON MISSED SECTIONS - Check for these specifically:',
  '- *** SECTION TITLE BANNERS: H2 headings between breadcrumbs and main content (e.g., "Advance Care Planning", "Emergency Department") → Use cta-banner with heading only ***',
  '- QUICK LINKS / NAVIGATION TILES: Colored buttons or icon tiles below the hero (e.g., "I need help now", "Make a donation", "Patient info") → Use card-grid or cta-button-group',
  '- FEATURE CARDS / SERVICE CARDS: Colorful 2x2 or 3x3 grids of cards linking to sections (e.g., "Emergency Department", "Foundation", "Research") → Use card-grid',
  '- MULTIPLE TWO-COLUMN ROWS: Pages often have 2-3 stacked rows of side-by-side cards → Emit a SEPARATE two-column component for EACH row:',
  '    * Row 1: Emergency Dept + Teen Health Info → two-column',
  '    * Row 2: Translation resources + Telehealth → two-column (DIFFERENT component!)',
  '    * Do NOT merge multiple rows into one two-column - each visual row is a separate component',
  '- MULTIPLE CTA SECTIONS: Pages often have 2-3 distinct CTA sections (donation, newsletter, contact) → Emit a separate cta-simple/cta-banner for EACH one',
  '- SUPPORT/DONATION SECTIONS: "Support Us", "Ways to Give", "Make a Difference" sections with donation CTAs → Use cta-banner or cta-simple',
  '- STATISTICS/IMPACT SECTIONS: Numbers showcasing impact (e.g., "5000 patients treated") → Use statistics component',
  '- PARTNER/SPONSOR LOGOS: Logo strips showing partnerships → Use logo-cloud',
  '',
  'DETECTION CHECKLIST (scan the entire page):',
  '1. Header region: navbar, utility bars, search, quick links',
  '2. Hero region: carousel, banner, or image hero',
  '2b. Section title banner: H2 between breadcrumbs and main content (for subsection/department pages) → cta-banner',
  '3. Main region (SCAN ALL SECTIONS TOP TO BOTTOM):',
  '   - Quick navigation tiles/buttons immediately after hero',
  '   - Feature/service card grids',
  '   - News/content feeds',
  '   - Statistics/impact numbers',
  '   - Testimonials/quotes',
  '   - CTA sections (may be multiple!)',
  '   - Forms (newsletter, contact)',
  '4. Footer region: footer with columns, links, social',
  '',
  'If you detect fewer than 5-6 components for a typical homepage, you have likely MISSED sections. Re-scan the page.'
])

export const CRITICAL_COMPLETENESS_SECTION = createStaticSection([
  '=== CRITICAL CONTENT COMPLETENESS (NON-NEGOTIABLE) ===',
  '- hero-carousel: ALWAYS return a populated slides[] array with fully detailed slide objects as described. When a slide has an image, emit slides[].image.src.mediaType exactly as "image". Missing or empty slides[] is incorrect when slides are visible.',
  '- card-grid: ALWAYS return a populated cards[] array using documented nested CardItem fields only: title, description, image, href, and icon. Omit icon when not present; never emit icon:null.',
  '- cta-with-form: ALWAYS include heading/subheading plus actual form configuration (placeholder, buttonText, formAction, emailFieldName, success/error messaging, privacy text/link). Summary-only outputs fail the contract.',
  '- hero-with-image: ALWAYS supply heading, copy, supporting media (image.src MediaReference object + alt), and CTA buttons when present. CTA buttons must use the "variant" field and structured href object, and include every visible action.',
  '- feature-grid: ALWAYS return the features[] array with feature-item children capturing icon, title, description, and optional link.',
  '- footer: ALWAYS populate columns[].links[], socialLinks[], and legalLinks[] with documented schema fields only. Summaries, id/type wrappers, or empty arrays are not acceptable when content is rendered.',
  '- blog-list: ALWAYS return a populated posts[] array with blog-card children when article teasers are visible on the page.',
  '- blog-post: ALWAYS include bodyHtml with the full article content. Empty bodyHtml is never acceptable when the page has article text.',
  '',
  'MULTIPLE INSTANCES: A page may have MULTIPLE instances of the same component type. For example:',
  '- Multiple card-grid sections (quick links grid + feature cards grid + resource cards grid)',
  '- Multiple cta-simple/cta-banner sections (donation CTA + newsletter CTA + contact CTA)',
  '- Multiple content-feed sections (news feed + events feed)',
  'Emit EACH instance as a separate component in DOM order.'
])

export const FORBIDDEN_FIELDS_SECTION = createStaticSection([
  '=== FORBIDDEN FIELDS (STRICT ENFORCEMENT) ===',
  'The following fields must NEVER appear in component output:',
  '',
  'FORBIDDEN COMPONENT NAMES:',
  '- Never emit unregistered generic component names: "section", "container", "wrapper", "block", "group", "layout", or "component". Choose the closest registered component type from the catalog.',
  '- For a section heading plus repeated linked project/service/resource cards, use card-grid with cards[].',
  '- For dated or chronological news/blog/article listings, use content-feed with pinned[].',
  '- Never emit "html-block" unless it appears in COMPONENT CONTRACTS. Raw HTML dumps are invalid when a structured component can represent the visible section.',
  '',
  'GLOBAL FORBIDDEN FIELDS (apply to ALL components):',
  '- "region": NEVER emit this field. Region assignment is handled automatically by the importer based on component type and template rules.',
  '- "metadata": NEVER emit a generic "metadata" wrapper object. Use only the specific documented fields for each component.',
  '- "summary": NEVER emit on navigation components (navbar, footer, menu links, etc.). Only use summary when explicitly listed in the component contract.',
  '',
  'COMPONENT-SPECIFIC FORBIDDEN FIELDS:',
  '- hero-banner: Do NOT emit "eyebrow", "region", "metadata". Use heading/subheading/body only.',
  '- hero-carousel: Do NOT emit "region", "metadata" at the component level. Slide-level fields are defined in the slides[] schema.',
  '- hero-simple: Do NOT emit "variant", "theme", "region", or "metadata". Use documented fields only: eyebrow, heading, subheading, body, ctaButtons, supportingLinks, alignment, background, and height.',
  '- image-gallery: Do NOT emit "heading", "title", "description". Gallery content is images[] only; section headings belong to parent components.',
  '- footer.socialLinks[]: Use documented SocialLink fields only: platform, url, icon, and label. platform must be lowercase enum values only: facebook, twitter, linkedin, instagram, youtube, github, website. Do NOT emit id/type.',
  '- footer.legalLinks[]: Use documented link fields only: label plus structured SmartLink href. Do NOT emit id/type on footer legal links unless the schema explicitly requires it.',
  '- footer.columns[]: Use documented FooterColumn fields only: title and links. Nested links[] use documented MenuItem fields only: label plus structured SmartLink href.',
  '',
  'If you detect content that seems like it should go in a forbidden field, either:',
  '1. Use the correct documented field instead (e.g., use "heading" instead of "title" for hero-banner)',
  '2. Omit the field entirely if no documented equivalent exists',
  '3. Place the content in a parent section component where such fields are allowed'
])

export const PAGE_METADATA_SECTION = createStaticSection([
  '=== PAGE METADATA EXTRACTION ===',
  'Extract page metadata (SEO, social, branding, structured data). Return in a field named "pageMetadata" alongside components.',
  'Include: title (<title>), meta description, keywords, canonical URL, language, author, published/modified dates, pageType, primaryPurpose, targetAudience, favicon, logo, primaryColors, fonts, visualStyle, openGraph, twitterCard, schemaOrgData, contactInfo, socialLinks, robots, viewport.',
  'Copy <meta name="description"> exactly—never leave pageMetadata.description blank when the tag exists. Likewise, always surface canonical and OpenGraph URLs if present in <head>.'
])
