'use client';

import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Final CTA Section
 *
 * Strong call to action before the footer.
 * Reinforces the value proposition and encourages sign-up.
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
          Ready to build faster?
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60 sm:text-xl">
          Join thousands of agencies and freelancers who ship client sites 3x faster
          with Catalyst Studio. Start building today.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            asChild
            className="w-full bg-catalyst-orange text-white hover:bg-catalyst-orange/90 sm:w-auto"
          >
            <Link href="/sign-up">
              Start Free Today
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
              View Demo
            </Link>
          </Button>
        </div>

        <p className="mt-4 text-sm text-white/40">
          Free forever for 1 site &bull; No credit card required
        </p>
      </div>
    </section>
  );
}
