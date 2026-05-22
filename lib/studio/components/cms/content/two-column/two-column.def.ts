/**
 * Two Column Component Definition
 *
 * Layout wrapper for side-by-side content. Use when visual separation exists between content sections.
 * Single source of truth for all metadata.
 */

import { z } from "zod";
import { defineComponent } from "../../_core/component-definition";
import { ComponentType, ComponentCategory } from "../../_core/types";
import { ComponentListSchema } from "../../_core/value-objects";

/**
 * Two Column component definition
 */
export const TwoColumnDef = defineComponent({
  type: ComponentType.TwoColumn,
  category: ComponentCategory.Content,

  // Zod schema (single source of truth for props)
  schema: z.object({
    leftColumn: ComponentListSchema
      .optional()
      .describe("Content items displayed in the left column"),
    rightColumn: ComponentListSchema
      .optional()
      .describe("Content items displayed in the right column"),
    columnRatio: z
      .enum(["25-75", "30-70", "40-60", "50-50", "60-40", "70-30", "75-25"])
      .optional()
      .describe("Width ratio between left and right columns"),
    reverseOnMobile: z
      .boolean()
      .optional()
      .describe("Reverse column order on mobile devices"),
    gap: z
      .enum(["small", "medium", "large"])
      .optional()
      .describe("Spacing between columns"),
    verticalAlignment: z
      .enum(["top", "center", "bottom"])
      .optional()
      .describe("Vertical alignment of column content"),
  }),

  // Detection metadata
  detection: {
    keywords: [
      "columns",
      "split",
      "side-by-side",
      "layout",
      "two-column",
      "grid",
      "section",
      "half",
    ],
    patterns: [
      "two column",
      "side by side",
      "split layout",
      "left right",
      "50/50",
      "half and half",
    ],
    commonNames: [
      "two-column",
      "split-section",
      "two-col",
      "columns",
      "side-by-side",
    ],
    pageLocation: ["main", "hero"],
    confidence: 0.85,
    suggestedVariants: ["default", "compact", "expanded"],
    relatedComponents: [ComponentType.HeroSplit, ComponentType.FeatureList],
    industry: ["general", "corporate", "education", "portfolio"],
    semanticRole: "section",
    accessibility: {
      ariaLabel: "Two column content section",
      role: "region",
    },
  },

  // LLM extraction directives
  directives: [
    "*** CRITICAL: NEVER place hero-with-image, hero-banner, hero-simple, hero-split, or any hero component inside leftColumn or rightColumn. ***",
    "*** Heroes MUST be top-level components. If you see a hero image in a sidebar+content page, emit it as a SEPARATE component BEFORE the two-column. ***",
    "**LAYOUT DETECTION RULE**: When you observe visual separation between content sections arranged SIDE-BY-SIDE (not stacked vertically), ALWAYS wrap them in a two-column component.",
    "",
    "**Visual Separation Detection**:",
    "  - Sidebar/sidemenu on left with main content on right → two-column with 25-75 or 30-70 ratio",
    "  - Navigation panel alongside article/content body → two-column with 25-75 or 30-70 ratio",
    "  - Image on one side, text on the other → two-column with 40-60 or 50-50 ratio",
    "  - Two equal content areas side by side → two-column with 50-50 ratio",
    "  - Any CSS flexbox/grid with side-by-side children → two-column",
    "",
    "**Column Ratio Selection** (estimate from visual proportions):",
    "  - 25-75: Narrow sidebar (nav menu, filters) + wide content area",
    "  - 30-70: Standard sidebar + content layout",
    "  - 40-60: Slightly wider left column (image + text)",
    "  - 50-50: Equal split (two cards, two features, comparison)",
    "  - 60-40: Wider left content area",
    "  - 70-30: Wide content + narrow sidebar on right",
    "  - 75-25: Wide content + narrow right panel",
    "",
    "**Structure**:",
    "  leftColumn: array of child components",
    "  rightColumn: array of child components",
    '  columnRatio: "25-75" | "30-70" | "40-60" | "50-50" | "60-40" | "70-30" | "75-25"',
    "",
    "**Supported child component types**:",
    "  - sidemenu / sidebar-nav → for navigation menus",
    "  - breadcrumbs → for breadcrumb navigation",
    "  - html-block → for rich content/article body",
    "  - text-block → for structured text sections",
    "  - image → for standalone images",
    "  - video-embed → for video content",
    "  - cta-simple → for call-to-action buttons",
    "  - card-grid → for card layouts",
    "  - content-feed → for news/blog listings",
    "  - two-column → nested for complex layouts",
    "",
    "**Common Page Layout Patterns**:",
    "  1. Sidebar + Content page (most common):",
    "     {",
    '       "type": "two-column",',
    '       "columnRatio": "25-75",',
    '       "leftColumn": [{ "type": "sidemenu", ... }],',
    '       "rightColumn": [{ "type": "breadcrumbs", ... }, { "type": "html-block", ... }]',
    "     }",
    "",
    "  2. Text + Image section:",
    "     {",
    '       "type": "two-column",',
    '       "columnRatio": "50-50",',
    '       "leftColumn": [{ "type": "text-block", "heading": "...", "body": "..." }],',
    '       "rightColumn": [{ "type": "image", "src": "...", "alt": "..." }]',
    "     }",
    "",
    "**CRITICAL**: When a page has a sidebar/sidemenu alongside main content, you MUST wrap them in two-column. Do NOT emit sidemenu and html-block as separate top-level components - they belong together in a two-column layout.",
    "",
    "A page can have multiple two-column sections at different levels - emit each one appropriately.",
    "Always set columnRatio based on the visual width proportions you observe.",
  ],

  // Sample content for AI tools and testing
  sample: {
    leftColumn: [
      {
        id: "sample-text-block",
        type: ComponentType.TextBlock,
        content: {
          heading: "Why Choose Us",
          body: "We provide industry-leading solutions tailored to your needs.",
        },
      },
    ],
    rightColumn: [
      {
        id: "sample-image-gallery",
        type: ComponentType.ImageGallery,
        content: {
          images: [{ src: "/images/feature-1.jpg", alt: "Feature showcase" }],
        },
      },
    ],
    columnRatio: "50-50",
    gap: "medium",
    verticalAlignment: "center",
    reverseOnMobile: true,
  },

  // Human-readable description
  description:
    "Layout wrapper for side-by-side content. Use when visual separation exists between content sections (sidebar + content, image + text, or any two columns displayed horizontally). Supports nested components in each column.",
});

// Export inferred TypeScript type
export type TwoColumnContent = z.infer<typeof TwoColumnDef.schema>;
