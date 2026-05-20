'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Template Gallery Section - FR-007
 *
 * Showcases available templates without requiring sign-up.
 * Click to preview, "Use This Template" triggers sign-up flow.
 */

// Reduced template set per persona feedback - fewer placeholders, more focused
const templates = [
  {
    id: 'minimal-portfolio',
    name: 'Minimal Portfolio',
    category: 'Portfolio',
    thumbnail: '/templates/minimal-portfolio.jpg',
    gradient: 'from-slate-800 to-slate-900',
    accent: 'bg-white',
  },
  {
    id: 'agency-starter',
    name: 'Agency Starter',
    category: 'Agency',
    thumbnail: '/templates/agency-starter.jpg',
    gradient: 'from-indigo-900 to-purple-900',
    accent: 'bg-indigo-500',
  },
  {
    id: 'shop-modern',
    name: 'Modern Shop',
    category: 'E-commerce',
    thumbnail: '/templates/shop-modern.jpg',
    gradient: 'from-emerald-900 to-teal-900',
    accent: 'bg-emerald-500',
  },
  {
    id: 'tech-startup',
    name: 'Tech Startup',
    category: 'Corporate',
    thumbnail: '/templates/tech-startup.jpg',
    gradient: 'from-cyan-900 to-blue-900',
    accent: 'bg-cyan-500',
  },
];

export function TemplateGallery() {
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  return (
    <section id="templates" className="bg-[#0a0a0a] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Start with a template
            </h2>
            <p className="mt-2 text-lg text-white/60">
              Professional designs ready to customize. No sign-up required to preview.
            </p>
          </div>
          <Button variant="ghost" asChild className="group text-white/70 hover:text-white">
            <Link href="/templates">
              View all templates
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>

        {/* Template grid */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-all duration-300 hover:border-white/20"
              onMouseEnter={() => setHoveredTemplate(template.id)}
              onMouseLeave={() => setHoveredTemplate(null)}
            >
              {/* Template preview */}
              <div className={cn('aspect-[4/3] bg-gradient-to-br', template.gradient)}>
                {/* Simulated page layout */}
                <div className="flex h-full flex-col p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className={cn('h-4 w-16 rounded', template.accent, 'opacity-80')} />
                    <div className="flex gap-2">
                      <div className="h-2 w-8 rounded bg-white/20" />
                      <div className="h-2 w-8 rounded bg-white/20" />
                      <div className="h-2 w-8 rounded bg-white/20" />
                    </div>
                  </div>

                  {/* Hero */}
                  <div className="mt-auto mb-auto space-y-2 text-center">
                    <div className="mx-auto h-3 w-24 rounded bg-white/30" />
                    <div className="mx-auto h-2 w-32 rounded bg-white/15" />
                    <div className="mx-auto mt-3 flex justify-center gap-2">
                      <div className={cn('h-5 w-14 rounded', template.accent, 'opacity-60')} />
                      <div className="h-5 w-14 rounded bg-white/10" />
                    </div>
                  </div>

                  {/* Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-8 rounded bg-white/5" />
                    <div className="h-8 rounded bg-white/5" />
                    <div className="h-8 rounded bg-white/5" />
                  </div>
                </div>

                {/* Hover overlay */}
                <div
                  className={cn(
                    'absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity duration-300',
                    hoveredTemplate === template.id ? 'opacity-100' : 'opacity-0'
                  )}
                >
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="bg-white text-black hover:bg-white/90">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Preview
                    </Button>
                    <Button size="sm" asChild className="bg-catalyst-orange text-white hover:bg-catalyst-orange/90">
                      <Link href={`/sign-up?template=${template.id}`}>
                        Use Template
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Template info */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">{template.name}</h3>
                  <Badge variant="secondary" className="bg-white/10 text-white/60">
                    {template.category}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
