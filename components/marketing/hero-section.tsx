'use client';

import Link from 'next/link';
import { Play, ArrowRight, Terminal, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Hero Section
 *
 * Aligned to polished README:
 * - Direct quote of core value prop
 * - Prominent one-command quickstart (npm run verify:quickstart)
 * - Emphasizes: full demo works with zero AI keys
 * - Highlights real strengths: AI import/greenfield, visual builder, UCS headless, universal export
 * - Scannable for portfolio / first-time visitors
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#080808] px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#0b1120] to-[#020617] opacity-90" />
        <div className="absolute -left-1/3 top-10 h-96 w-96 rounded-full bg-catalyst-orange/20 blur-3xl" />
        <div className="absolute -right-1/4 bottom-0 h-[28rem] w-[28rem] rounded-full bg-catalyst-blue/25 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),transparent_55%)]" />
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          {/* Badge - honest positioning */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white/80">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Open source • Fully hackable locally
          </div>

          {/* Headline — pulled directly from README value prop */}
          <h1 className="mx-auto max-w-5xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            AI-Powered Visual Website Studio{' '}
            <span className="bg-gradient-to-r from-catalyst-orange to-catalyst-blue bg-clip-text text-transparent">
              &amp; CMS
            </span>
          </h1>

          {/* Subheadline — direct from README first line + emphasis on simplicity */}
          <p className="mx-auto mt-6 max-w-3xl text-lg text-white/70 sm:text-xl">
            Import any live site with AI, edit visually, preview instantly, and export to the CMS your clients already use — or run it as a complete standalone CMS with a GraphQL headless API.
          </p>

          {/* Key differentiator callout - scannable for visitors with zero context */}
          <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-left">
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-3">
              <div className="inline-flex items-center gap-2 font-mono text-catalyst-orange">
                <Terminal className="h-4 w-4" />
                <span>npm run verify:quickstart</span>
              </div>
              <div className="text-white/60">
                One command. Full seeded demo. <span className="font-medium text-emerald-400">No AI key required.</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-white/50">
              Starts Postgres, runs migrations, seeds sample site, launches on port 3100. Visual builder + live preview + CMS ready immediately.
            </p>
          </div>

          {/* CTAs - drive quickstart first, hosted demo second */}
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              variant="outline"
              size="lg"
              asChild
              className="group w-full border-catalyst-orange/50 bg-transparent text-catalyst-orange hover:border-catalyst-orange hover:bg-catalyst-orange/10 sm:w-auto"
            >
              <Link href="https://github.com/catalystx/catalyst-studio-oss/blob/main/README.md#quickstart-simplest-possible" target="_blank" rel="noopener noreferrer">
                <Terminal className="mr-2 h-4 w-4" />
                Quickstart Guide
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>

            <Button
              size="lg"
              asChild
              className="w-full bg-catalyst-orange text-white hover:bg-catalyst-orange/90 sm:w-auto"
            >
              <Link href="/sign-up">
                <Play className="mr-2 h-4 w-4" />
                Try Hosted Demo
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="lg"
              asChild
              className="w-full text-white/70 hover:bg-white/5 hover:text-white sm:w-auto"
            >
              <a href="https://github.com/catalystx/catalyst-studio-oss" target="_blank" rel="noopener noreferrer">
                <Github className="mr-2 h-4 w-4" />
                View on GitHub
              </a>
            </Button>
          </div>

          {/* Trust / barrier-lowering line */}
          <p className="mt-4 text-sm text-white/50">
            Core experience (builder, preview, content modeling, seeded demos) runs with zero paid services or API keys.
          </p>

          {/* Ultra-scannable feature row for clueless visitors */}
          <div className="mx-auto mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-widest text-white/40">
            <span>AI Import &amp; Greenfield</span>
            <span className="hidden sm:inline">•</span>
            <span>React Flow Visual Builder</span>
            <span className="hidden sm:inline">•</span>
            <span>60 Production Components</span>
            <span className="hidden sm:inline">•</span>
            <span>UCS Headless GraphQL</span>
            <span className="hidden sm:inline">•</span>
            <span>Universal Export</span>
          </div>
        </div>

        {/* Visual Proof — improved caption to reference real product */}
        <div className="mt-16 sm:mt-20">
          <div className="relative mx-auto max-w-5xl">
            {/* Glow effect */}
            <div className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-catalyst-orange/20 via-catalyst-blue/20 to-catalyst-orange/20 opacity-50 blur-xl" />

            {/* Preview container */}
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/70" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                  <div className="h-3 w-3 rounded-full bg-green-500/70" />
                </div>
                <div className="ml-4 flex-1 rounded-md bg-white/10 px-3 py-1 text-xs text-white/50">
                  studio / site-builder — React Flow hierarchy + live preview
                </div>
              </div>

              {/* Product screenshot placeholder - shows actual UI mockup */}
              <div className="relative aspect-[16/9] bg-gradient-to-br from-[#0f172a] to-[#020617]">
                {/* Simulated site builder interface */}
                <div className="absolute inset-0 flex">
                  {/* Left sidebar */}
                  <div className="w-16 border-r border-white/10 bg-white/5 p-2">
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-10 w-10 rounded-lg bg-white/10" />
                      ))}
                    </div>
                  </div>

                  {/* Main canvas - now labeled as hierarchy */}
                  <div className="flex-1 p-4">
                    {/* Hero block mockup */}
                    <div className="rounded-lg border border-dashed border-catalyst-orange/30 bg-catalyst-orange/5 p-6">
                      <div className="h-8 w-48 rounded bg-white/20" />
                      <div className="mt-3 h-4 w-full max-w-md rounded bg-white/10" />
                      <div className="mt-2 h-4 w-3/4 rounded bg-white/10" />
                      <div className="mt-4 flex gap-2">
                        <div className="h-10 w-28 rounded-lg bg-catalyst-orange/50" />
                        <div className="h-10 w-28 rounded-lg bg-white/10" />
                      </div>
                    </div>

                    {/* Feature blocks mockup */}
                    <div className="mt-4 grid grid-cols-3 gap-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-4">
                          <div className="h-8 w-8 rounded-lg bg-catalyst-blue/30" />
                          <div className="mt-3 h-3 w-20 rounded bg-white/20" />
                          <div className="mt-2 h-2 w-full rounded bg-white/10" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right panel */}
                  <div className="w-64 border-l border-white/10 bg-white/5 p-4">
                    <div className="space-y-3">
                      <div className="h-4 w-20 rounded bg-white/20" />
                      <div className="space-y-2">
                        <div className="h-8 w-full rounded bg-white/10" />
                        <div className="h-8 w-full rounded bg-white/10" />
                        <div className="grid grid-cols-4 gap-1">
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="h-6 w-full rounded bg-white/10" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Animated cursor */}
                <div className="pointer-events-none absolute left-1/3 top-1/3 animate-pulse">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white drop-shadow-lg">
                    <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="currentColor" />
                  </svg>
                </div>
              </div>

              {/* Real capability caption under the visual mock (portfolio-friendly) */}
              <div className="border-t border-white/10 bg-black/40 px-4 py-2 text-center text-xs text-white/50">
                Visual site hierarchy powered by React Flow • 60 CMS components • Globals with one-click propagation • Instant DB-backed preview
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
