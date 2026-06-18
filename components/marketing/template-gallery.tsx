'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Download, Layers, Eye, Globe, Share2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Use Cases / Capabilities Gallery — Overhauled from generic templates.
 *
 * Directly implements "Multiple Ways to Use Catalyst Studio" from the README.
 * Showcases real end-to-end workflows for first-time visitors:
 *   AI Import, Visual Builder + Globals, Live Preview, Headless UCS, Universal Export, Standalone CMS.
 *
 * No fake template images (none exist in /public). Pure illustrative cards + concrete copy.
 * CTAs drive to quickstart (via docs) and hosted demo.
 */

const useCases = [
  {
    id: 'ai-import',
    icon: Download,
    title: 'AI-Powered Import from Live Websites',
    category: 'Migration',
    description: 'Point the importer at any public URL. AI analyzes structure, extracts reusable components, navigation, shared elements, and the full design system into editable Catalyst content.',
    visualLabel: 'Imported website canvas',
    detail: 'See README screenshots: AI import flow & progress',
  },
  {
    id: 'visual-builder',
    icon: Layers,
    title: 'Visual Site Builder + Globals',
    category: 'Editing',
    description: 'Drag-and-drop page hierarchy powered by React Flow. 60 production CMS components. Global/shared components with overrides that propagate instantly to every instance.',
    visualLabel: 'React Flow hierarchy editor',
    detail: 'Reordering, reparenting, proposals, undo/redo, responsive modes',
  },
  {
    id: 'live-preview',
    icon: Eye,
    title: 'Live Database-Backed Preview',
    category: 'Validation',
    description: 'Instant preview of every change using the same renderer and UCS runtime that serves the public site and GraphQL. No static export step required during editing.',
    visualLabel: 'Live preview sandbox',
    detail: 'Exactly matches production output. Works on seeded demo immediately.',
  },
  {
    id: 'headless-graphql',
    icon: Globe,
    title: 'Headless GraphQL (UCS)',
    category: 'Delivery',
    description: 'Query pages, structure, global components, design tokens, and resolved media from any frontend. The identical content model that powers the builder and preview.',
    visualLabel: 'UCS GraphQL API',
    detail: 'Same resolvers for preview, public site [...slug], and external consumers.',
  },
  {
    id: 'universal-export',
    icon: Share2,
    title: 'Universal Export to Any CMS',
    category: 'Delivery',
    description: 'Define content types, pages, and shared components once. Push complete schemas and populated entries to Optimizely CMS, Kontent.ai, Contentstack, Umbraco, Strapi, and more.',
    visualLabel: 'Export to client CMS',
    detail: 'Active adapters + mock provider. Model in Catalyst, deliver to client platform.',
  },
  {
    id: 'standalone-cms',
    icon: Database,
    title: 'Complete Standalone Visual CMS',
    category: 'Production',
    description: 'Use Catalyst end-to-end without exporting: build, manage content types, media, design system, and publish via the included public renderer. Perfect for many projects.',
    visualLabel: 'Full studio + preview',
    detail: 'No external CMS required. Full team collab, API keys, and audit included.',
  },
];

export function TemplateGallery() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section id="templates" className="bg-[#0a0a0a] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Section header — mirrors README exactly */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Multiple Ways to Use Catalyst Studio
            </h2>
            <p className="mt-2 text-lg text-white/60">
              As a visual CMS, a headless GraphQL API, an AI migration tool, or a universal content modeling layer. Explore the real workflows.
            </p>
          </div>
          <Button variant="ghost" asChild className="group text-white/70 hover:text-white">
            <Link href="https://github.com/catalystx/catalyst-studio-oss/blob/main/README.md#quickstart-simplest-possible" target="_blank" rel="noopener noreferrer">
              See full quickstart &amp; docs
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>

        {/* Use-case grid — 6 concrete real-world capabilities */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((useCase) => {
            const Icon = useCase.icon;
            return (
              <div
                key={useCase.id}
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-all duration-300 hover:border-white/20"
                onMouseEnter={() => setHovered(useCase.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Visual mock area */}
                <div className="aspect-[16/10] bg-gradient-to-br from-[#0f172a] via-[#0b1120] to-[#020617] p-5">
                  <div className="flex h-full flex-col">
                    {/* Mini header bar */}
                    <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[1px] text-white/40">
                      <Icon className="h-3.5 w-3.5" />
                      {useCase.visualLabel}
                    </div>

                    {/* Capability illustration (abstract, no external images) */}
                    <div className="relative flex-1 rounded-lg border border-white/10 bg-black/40 p-4">
                      <div className="space-y-3">
                        {/* Top bar representing canvas / query / export panel */}
                        <div className="h-2 w-3/4 rounded bg-white/15" />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="h-9 rounded bg-white/10" />
                          <div className="h-9 rounded bg-catalyst-orange/20" />
                        </div>
                        <div className="h-2 w-1/2 rounded bg-white/10" />
                        <div className="h-2 w-5/6 rounded bg-white/10" />

                        {/* Small "global" or "resolved" indicator */}
                        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-emerald-400/70">
                          <div className="h-1.5 w-1.5 rounded-full bg-current" />
                          {useCase.category === 'Migration' ? 'AI detected 12 components + 3 globals' : 
                           useCase.category === 'Editing' ? 'Global nav • 4 instances • propagate ready' : 
                           useCase.category === 'Validation' ? 'Live from DB — 0ms drift' : 
                           useCase.category === 'Delivery' ? 'UCS / GraphQL ready' : 
                           'Schema + entries ready for export'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hover / action overlay */}
                <div
                  className={cn(
                    'absolute inset-0 flex items-center justify-center bg-black/70 transition-opacity duration-300',
                    hovered === useCase.id ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  )}
                >
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" asChild className="bg-white text-black hover:bg-white/90">
                      <Link href="https://github.com/catalystx/catalyst-studio-oss/blob/main/README.md#quickstart-simplest-possible" target="_blank" rel="noopener noreferrer">
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Learn more
                      </Link>
                    </Button>
                    <Button size="sm" asChild className="bg-catalyst-orange text-white hover:bg-catalyst-orange/90">
                      <Link href="/sign-up">
                        Try in demo
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Info block */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold leading-tight text-white">{useCase.title}</h3>
                      <Badge variant="secondary" className="mt-1.5 bg-white/10 text-[10px] text-white/60">
                        {useCase.category}
                      </Badge>
                    </div>
                    <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-white/40" />
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-white/65">
                    {useCase.description}
                  </p>

                  <p className="mt-3 text-xs text-catalyst-orange/80">
                    {useCase.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom reinforcement */}
        <p className="mt-8 text-center text-sm text-white/50">
          All flows demonstrated in the seeded demo created by <span className="font-mono text-white/70">npm run verify:quickstart</span>. No keys required.
        </p>
      </div>
    </section>
  );
}
