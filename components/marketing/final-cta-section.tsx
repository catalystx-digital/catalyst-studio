'use client';

import Link from 'next/link';
import { ArrowRight, Terminal, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Final CTA Section — rewritten to drive the actual easiest path (quickstart)
 * and reinforce the honest low-barrier story from the README.
 */
export function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden bg-[#080808] px-4 py-24 sm:px-6 lg:px-8">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-t from-catalyst-orange/10 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-catalyst-orange/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Ready to try the real thing?
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-lg text-white/60 sm:text-xl">
          Run one command. Get a fully seeded visual builder, live preview, content types, and headless GraphQL — no AI key, no credit card, nothing to configure.
        </p>

        {/* Prominent quickstart reminder */}
        <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 font-mono text-sm text-catalyst-orange">
          <Terminal className="h-4 w-4" />
          npm run verify:quickstart
        </div>

        {/* CTAs — local quickstart first, hosted second */}
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            asChild
            className="w-full bg-catalyst-orange text-white hover:bg-catalyst-orange/90 sm:w-auto"
          >
            <Link href="https://github.com/catalystx/catalyst-studio-oss/blob/main/README.md#quickstart-simplest-possible" target="_blank" rel="noopener noreferrer">
              <Terminal className="mr-2 h-4 w-4" />
              Open the Quickstart Guide
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            asChild
            className="w-full border-white/20 bg-transparent text-white hover:bg-white/10 sm:w-auto"
          >
            <Link href="/sign-up">
              <Play className="mr-2 h-4 w-4" />
              Explore Hosted Demo
            </Link>
          </Button>
        </div>

        <p className="mt-4 text-sm text-white/50">
          Full demo (builder + preview + CMS + UCS) works instantly. AI features are optional.
        </p>
      </div>
    </section>
  );
}
