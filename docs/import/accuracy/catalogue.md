# How other tools model page content, and a proposed importer catalogue

**Status: provisional.** The founder approves or changes the family list at gate G1 (see [method.md](method.md)). Until then, set `C` in `scripts/experiments/import-lab/component-families.json` is the working mapping, and nothing in the app changes.

Terminology: this report says `region`; the lab and the method use `placement` (`header | main | sidebar | footer`) for the same idea.

Tag key: [V] = checked against the linked page during this research. [U] = from memory or a second-hand source, not checked.

## 1. Comparison table

| System | How many block/section types | Repeated items and media | How the look is kept apart from the content |
|---|---|---|---|
| WordPress Gutenberg | 185 entries in the core block reference, counting sub-blocks (Column, Accordion Item, Tab Panel) and site blocks [V] https://developer.wordpress.org/block-editor/reference-guides/core-blocks/ | Built by nesting: Group, Columns, Cover, Media & Text hold ordinary blocks. There is no card type; a "card" is a pattern (a saved arrangement of blocks) [V same page] | Three layers. **Supports** add colour, spacing, typography, layout and alignment controls to any block [V] https://developer.wordpress.org/block-editor/reference-guides/block-api/block-supports/. **Styles** are "just a CSS class". **Variations** are preset attributes or inner blocks, told apart by `isActive`, and exist so you do not build "entirely new blocks" [V] https://developer.wordpress.org/block-editor/reference-guides/block-api/block-variations/ |
| Notion | 33 API block types (paragraph, headings 1–4, lists, toggle, tab, column list/column, image, embed, table, callout, quote…) [V] https://developers.notion.com/reference/block | Items are generic child blocks in a `children` array. There is no item schema | Almost none. Colour is a text annotation. Layout comes only from column_list |
| Editor.js | Set by plugins; the core defines none [V] https://editorjs.io/base-concepts/ | Flat list of blocks in clean JSON | Separate "Block Tunes" plugins [V same page] |
| Webflow | Free-form; you build components yourself | Component properties (text, image, link, visibility) [U]. **Slots** hold nested content. One write-up says one hero with three slots replaced 14 hero variants [U, blog] https://www.pravinkumar.co/blog/webflow-components-2-slots-composition-2026 | **Component style variants** (for example a card that is horizontal or vertical) [V] https://webflow.com/updates/component-style-variants-now-available |
| Framer | Free-form | Property controls include Array, Object, ResponsiveImage, Link and Enum [V] https://www.framer.com/developers/property-controls | Enum controls plus padding, gap and border controls. Canvas variants [U] |
| Builder.io | Custom components | `list` input with `subFields` (for example reviewText, reviewAuthor, image) [V] https://www.builder.io/c/docs/custom-components-input-types | `enum` dropdowns, plus a separate style panel |
| Puck | Custom components in a config | `fields` feed the render function; array fields and slots [U] https://puckeditor.com/docs/integrating-puck/component-configuration | `defaultProps` and field choices [V] |
| Plasmic | Custom components | Slots [U] | Toggle, group, interaction and global variants: "different visual states of a component" [V] https://docs.plasmic.app/learn/variants/ |
| Sanity | Whatever you define: an array of objects or references, plus Portable Text for rich text | Arrays of typed objects. Portable Text allows custom inline types (image, code…) [V] https://www.portabletext.org/ | "Model for meaning, not presentation" [V] https://www.sanity.io/docs/developer-guides/how-to-use-structured-content-for-page-building. Its example set is Hero, Text with Illustration, Gallery, Form, Video, CTA |
| Storyblok | Three kinds of block: content type, nestable, universal [V] https://www.storyblok.com/docs/concepts/blocks | Nested through a Blocks field | Presets [V mention] |
| Contentful | Whatever you define | **Topics** (the content itself, "free of being locked to… layout") versus **assemblies** (page structure that arranges topics) [V] https://www.contentful.com/help/topics-and-assemblies/ | Kept in the assemblies |
| Payload | A `blocks` field: a list of mixed blocks, each marked with a `blockType` field [V] https://payloadcms.com/docs/fields/blocks | Official website template has 8 blocks: Archive, Banner, CallToAction, Code, Content, Form, MediaBlock, RelatedPosts [V] https://github.com/payloadcms/payload/tree/main/templates/website/src/blocks. The hero is a separate field with a type setting (none, high, medium or low impact) [U] | Setting fields on each block |
| Tailwind Plus (marketing) | 16 section categories: Hero, Feature, CTA, Bento, Pricing, Header, Newsletter, Stats, Testimonials, Blog, Contact, Team, Content, Logo Clouds, FAQs, Footers [V, category list from search] https://tailwindcss.com/plus/ui-blocks/marketing | The same card anatomy repeats in every category [U, my reading] | Many visual examples inside each category. The look is the example, not a new category |
| shadcnblocks.com (a third party, not the official shadcn) | More than 100 categories and 2,028 blocks; Hero alone has 285 [V] https://www.shadcnblocks.com/blocks | — | Every visual variant is its own block. This is the anti-pattern we have today |
| Shopify Online Store 2.0 | Sections plus blocks. Up to 25 sections per template and up to 50 blocks per section [V] https://shopify.dev/docs/storefronts/themes/architecture/sections | **Theme blocks** are defined once and reused across sections, and can nest [V] https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks | `settings` on both sections and blocks. `presets` give ready-made starting set-ups [V] |
| schema.org | WebPageElement has 6 subtypes: SiteNavigationElement, Table, WPAdBlock, WPFooter, WPHeader, WPSideBar [V] https://schema.org/WebPageElement | ItemList, with ListItem entries [U, standard] | Not covered (it describes meaning only) |
| VIPS page segmentation | No types. Blocks form a tree, split by "degree of coherence" [V] https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr-2003-79.pdf | — | — |
| Webis-WebSeg-20 | 8,490 pages, 42,450 segmentations collected from crowd workers, with no type labels. People "mostly agree" on the segments; they disagree mostly about **granularity** (how finely to cut) [V] https://zenodo.org/records/3988124 | — | — |
| WebClasSeg-25 (SIGIR 2025) | Labels by what a segment does: main content, header, footer, navigation… (full list not seen) [V partial] https://dl.acm.org/doi/10.1145/3726302.3730309 | — | Adds a second, separate "digital maturity" label |

## 2. What nearly everyone agrees on

1. **Few types that say what the content is for; the look is a setting.** Gutenberg uses styles, variations and supports. Webflow and Plasmic use variants. Shopify uses settings and presets. Framer and Builder use enums. Sanity and Contentful state the rule directly: model meaning, not presentation. The only large type catalogue, shadcnblocks with 285 heroes, is a gallery for copying code, not a content model.
2. **One reusable item shape inside sections.** Examples: Shopify theme blocks, Builder list `subFields`, Notion `children`, Framer Array of Object. Repeated things are items of one kind, not separate types.
3. **Nesting beats special cases.** Gutenberg Group and Columns, Webflow slots, Shopify nested theme blocks and Storyblok nestable blocks all handle "a sidebar with a promo in it" as a container plus ordinary content.
4. **Page regions are their own axis.** Header, footer, sidebar and main are labelled separately from content type: schema.org WPHeader, WPFooter and WPSideBar; WebClasSeg-25's labels by function. **Where a block sits should be a property, not a new family.**
5. **Humans agree on the cut, not on how fine it is** (Webis). The catalogue should let a whole region be one block that holds items, rather than forcing a choice between "one card" and "a grid of cards".
6. **Heroes, CTAs, FAQs, pricing, stats, testimonials and logos** show up as named categories in every section library (Tailwind's 16, Sanity's examples, Payload's). They are the stable vocabulary people expect.

## 3. Proposed catalogue: 15 families

### The shared shapes

**Section** (every family uses it): `eyebrow`, `heading`, `intro` (rich text), `media` (optional), `links[]`, `items[]`, `region` (header | main | aside | footer), plus the family's layout properties.

**Item** (one shape used everywhere):
```
Item {
  title?        // plain text
  subtitle?     // role, kicker, tag line
  body?         // rich text (HTML subset / Portable-Text-like)
  media?        { kind: image|icon|video|embed, url, alt, poster? }
  links[]       { label, url, emphasis: primary|secondary|plain, children?: Link[] }
  meta[]        { key, value }   // price, period, rating, date, author, stat value, address line
}
```
Why this shape:
- **It can hold anything a web page shows.** An icon is just an image (a URL or an inline SVG), never a name from a built-in icon set. That fixes today's biggest loss.
- **`meta` absorbs small labelled facts** such as price, rating, date or role, so pricing, reviews and posts need no new fields.
- **Nested `links` cover footer columns and menus with sub-menus.**
- **It matches Builder `subFields`, Shopify theme blocks and Tailwind's card anatomy.**
- **One shape means the model filling in content learns one target, not 53.**

### The families

Each entry gives the family's job, a decision rule a classifier can follow, what it holds, and its layout settings.

1. **Site header.** The top bar that repeats on every page, with the logo and main menu. *Rule:* first block on the page, holds the site logo and 3 or more site links. *Holds:* logo media, links with children (mega-menus), utility links, CTA link. *Settings:* sticky, transparent, mobile menu style.
2. **Site footer.** The bottom region that repeats on every page. *Rule:* last block(s) on the page, holding link columns, legal text or copyright. *Holds:* link columns (items with a title and links), badges (items with media only: payment, certification, app stores), social links, legal text, a newsletter form (stored as a nested form). *Settings:* columns, dark or light.
3. **Local navigation.** Navigation inside the page. *Rule:* a list of links about *this* page or section (breadcrumb trail, side menu, table of contents), with no body text. *Settings:* kind (breadcrumb | vertical | toc), placement.
4. **Hero.** The page's opening statement. *Rule:* the first content block after the header, holding the page's main heading (the only H1) plus an intro and/or a primary CTA. If there is no H1, it is not a hero. *Holds:* the section fields; several slides become items. *Settings:* media position (none | background | left | right | below), media kind (image | video), height, alignment, slideshow on/off.
5. **Content section.** Prose, optionally with one image or embed. *Rule:* mainly running text, with at most one media item and no repeated item structure. *Holds:* heading, rich body (lists, inline images and pull quotes allowed), media, links. *Settings:* media position, text columns (1 or 2), width. Author bios and "about us" land here.
6. **Collection.** A set of repeated, similar items. *Rule:* 2 or more sibling items that share the same inner structure (card, feature, person, post, step). *Holds:* items. *Settings:* layout (grid | list | bento | carousel | timeline), columns, item style (card | plain | icon-left), source (static | feed). Team, features, blog lists, related posts and timelines all land here.
7. **Logo strip.** A row of brand marks. *Rule:* items that are only images (logos), with no text beyond an optional caption. *Settings:* grid | marquee, greyscale. (Kept separate from Collection because the boundary is crisp and the section appears in every library.)
8. **Stats.** Big numbers. *Rule:* items where a number or short value is the most prominent text. *Holds:* item.title = the value ("98%"), body = its label. *Settings:* layout, emphasis.
9. **Testimonials.** Quotations from people. *Rule:* items whose body is a quotation credited to a person or source. *Holds:* item.body = quote, title = name, subtitle = role, meta.rating, media = photo. *Settings:* single | grid | carousel, show rating. A single pull quote that stands alone lands here as one item.
10. **Pricing.** Plans for sale. *Rule:* items carrying a price value, plus a feature list and a buy link. *Holds:* meta.price, meta.period, body = feature list, links, a "featured" flag via meta. *Settings:* columns, billing toggle. Comparison grids go to Table.
11. **Disclosure.** Content hidden behind a click. *Rule:* items where only the titles show until clicked (accordion, FAQ, tabs). *Holds:* item.title = question or tab label, body = answer, media optional. *Settings:* mode (accordion | tabs), open on load.
12. **Call to action.** A short push toward one action. *Rule:* a short heading, at most 2 sentences, and 1–3 prominent links, with no form fields and no repeated items. *Settings:* style (banner | inline | card), background media, placement. Sidebar promos land here with `region: aside`.
13. **Form.** Anything you type into. *Rule:* contains input fields. This rule beats CTA and Contact. *Holds:* fields[] {label, type, required, options}, submit label, the section fields. *Settings:* layout (stacked | inline | side-by-side with text).
14. **Table and chart.** Data in rows and columns. *Rule:* data in rows × columns (an HTML table or a grid of ticks and crosses) or a chart. *Holds:* columns[], rows[][], caption; for a chart, the kind plus a data series, or a fallback image. *Settings:* striped, sticky header.
15. **Media.** Pictures, video or a map with little text. *Rule:* media makes up most of the block and text is only captions (gallery, video, embedded map). *Holds:* items that carry media and a caption. *Settings:* layout (single | grid | masonry | carousel), aspect ratio, lightbox.

**Contact and location** are not a family. Address, phone and hours become `meta` in a Content section, the map is a Media embed, and a contact form is a Form. (Open choice 5 below.)

**Precedence when several rules fire:** Form > Site header/footer (by position) > Hero > Disclosure > Pricing > Testimonials > Stats > Logo strip > Table > Collection > Media > CTA > Content section.

## 4. Where today's 53 types go

| Family | Today's types |
|---|---|
| Site header | navbar, mobile-menu |
| Site footer | footer |
| Local navigation | breadcrumbs, sidemenu, sidebar-nav |
| Hero | hero-banner, hero-simple, hero-minimal, hero-with-image, hero-video, hero-carousel, hero-split, article-header |
| Content section | text-block, html-block, two-column, about-section, feature-showcase (one feature with an image), author-bio, blog-post (article body), contact-info |
| Collection | card-grid, card-item (a single item inside a collection, not a type of its own), feature-grid, feature-list, team-grid, content-feed, blog-list, related-posts, timeline |
| Logo strip | logo-cloud |
| Stats | statistics |
| Testimonials | testimonials, reviews, quote-block |
| Pricing | pricing-table, pricing-card |
| Disclosure | accordion, tabs |
| Call to action | cta-banner, cta-simple, cta-button-group |
| Form | cta-with-form, contact-form, simple-form |
| Table and chart | data-table, chart, feature-comparison |
| Media | image-gallery, video-player, video-embed, location-map |

That covers all 53 types in 15 families. The block question offers 50 of them (mobile-menu, sidebar-nav and card-item are never block choices), so set `C` maps exactly those 50. hero-carousel becomes Hero with slides; any other carousel is a layout setting of Collection, Testimonials or Media.

## 5. Risks and open choices

1. **Where Hero ends and Content section begins.** The "has the H1 and comes first" rule is crisp but fails on pages with no H1 or several H1s. Fallback: the first large-type block above the fold. Option: drop Hero and make it a `prominence: hero` setting on Content section. That removes 7 near-twins in one step but loses a label every library uses. My recommendation: keep Hero, and make the rule position plus H1.
2. **One Disclosure family, or separate ones?** Accordion and tabs have the same data (title plus hidden panel), so one family with a `mode` setting is safe. Carousel is *not* disclosure: it is a layout of Collection, Testimonials or Media, because its items are fully visible cards. Putting carousels under Disclosure would bring back the "which one?" flipping we have today.
3. **Collection against its specialised children** (Stats, Testimonials, Pricing, Logo strip). Every specialised family is "a Collection whose items carry X". If the classifier still flips here, merge them into Collection with an `itemKind` setting. Nothing is lost, because the item shape is the same. Measure how often each pair flips before deciding.
4. **Granularity** (the main source of human disagreement in Webis). Should a feature row plus its heading be one Collection or a Content section followed by a Collection? Rule: section heading and intro belong to the Collection whenever they sit directly above it.
5. **Contact as a family.** Folding it into Content plus meta loses structured addresses (the schema.org PostalAddress kind). If capturing addresses matters for accuracy scoring, add a 16th family, "Contact details".
6. **Regions.** Sidebar promos and footer badges depend on `region` being set correctly. The segmenter must pass region down; otherwise a sidebar promo looks like a main-column CTA.
7. **Rich text inside items** must allow inline images and lists, or html-block-style content will be lost again. A Portable-Text-like subset is the proven model.
8. **Charts** cannot be rebuilt reliably from pixels. Plan to store the image as a fallback.
9. **Things not checked:** Webflow slot details, Puck array fields and slots, Payload hero types, Framer canvas variants, WebClasSeg-25's full label list (the paper returned a 403 error).
