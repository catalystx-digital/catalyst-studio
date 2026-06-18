'use client';

import {
  Sparkles,
  Layers,
  Database,
  Globe,
  Share2,
  Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Features Section — completely rewritten to match README
 *
 * Clear benefit-oriented messaging for visitors with zero prior knowledge.
 * References actual codebase capabilities: 53 components, React Flow, global/shared components,
 * UCS GraphQL, live DB-backed preview, AI import + greenfield, 6+ export adapters, content types, design system.
 */
const features = [
  {
    icon: Sparkles,
    title: 'AI Import & Greenfield Generation',
    description: 'Point at any live website — AI detects components, extracts navigation, shared elements, and design system. Or generate complete structured sites from a single prompt.',
    gradient: 'from-catalyst-orange/20 to-transparent',
    detail: 'Optional OpenRouter key. Core demo works without it.',
  },
  {
    icon: Layers,
    title: 'Visual Site Builder with React Flow',
    description: 'Drag, drop, reorder pages and folders. Full hierarchy management. 60 production-ready CMS components (heroes, navigation, blog, pricing, forms, data viz, and more).',
    gradient: 'from-catalyst-blue/20 to-transparent',
    detail: 'Global/shared components with live overrides + one-click propagation.',
  },
  {
    icon: Database,
    title: 'Complete Self-Contained CMS + Live Preview',
    description: 'Per-site Content Types for structured modeling. Design system extraction & tokens. Media library with usage tracking. Everything renders from the real database — no external services.',
    gradient: 'from-emerald-500/20 to-transparent',
    detail: 'Instant preview at studio/preview/site/... Fully functional without export.',
  },
  {
    icon: Globe,
    title: 'Headless GraphQL API (UCS)',
    description: 'Use Catalyst as a real headless CMS. Full GraphQL endpoint serves pages, structure, global components, design tokens, and resolved media. Same model powers preview, builder, and API.',
    gradient: 'from-purple-500/20 to-transparent',
    detail: 'Query from Next.js, Nuxt, custom frontends, or anything that speaks GraphQL.',
  },
  {
    icon: Share2,
    title: 'Universal Export to Any CMS',
    description: 'Model once inside the studio, then push schema + content to your client\'s existing platform. Active adapters for Optimizely CMS (full), Kontent.ai, Contentstack, Umbraco Compose, Strapi, and Contentful.',
    gradient: 'from-pink-500/20 to-transparent',
    detail: 'Mock provider for local testing. Extensible — add your own adapter.',
  },
  {
    icon: Users,
    title: 'Collaboration, Keys & Extensibility',
    description: 'Team invites, role-based access (owner/admin/member). Scoped API keys with rotation + audit. Usage tracking. Add new components, customize the library, or extend export providers.',
    gradient: 'from-cyan-500/20 to-transparent',
    detail: 'Everything is local-first and fully hackable.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="bg-[#080808] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Section header — benefit first, scannable */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Model once. Edit visually. Deliver anywhere.
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg text-white/60">
            AI migration, professional visual editing, production-grade CMS, headless GraphQL, and universal export — all in one local-first studio. Core demo runs with a single command.
          </p>
        </div>

        {/* Feature grid — now 6 real-capability cards with concrete details */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="group relative overflow-hidden border-white/10 bg-white/5 transition-all duration-300 hover:border-white/20"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Gradient overlay on hover */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                />

                <CardContent className="relative p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 transition-colors group-hover:bg-white/20">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/70">
                    {feature.description}
                  </p>
                  {/* Concrete capability line for credibility */}
                  {feature.detail && (
                    <p className="mt-3 border-t border-white/10 pt-3 text-xs font-medium text-catalyst-orange/90">
                      {feature.detail}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
