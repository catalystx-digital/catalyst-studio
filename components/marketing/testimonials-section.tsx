'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Testimonials Section - FR-005
 *
 * Social proof through user testimonials.
 * Note: Replace with real testimonials from actual users.
 */

const testimonials = [
  {
    id: 1,
    quote:
      "We imported a 40-page client site with the AI tool, cleaned it up visually in the React Flow canvas, and exported clean structured content to their Optimizely instance in one afternoon. The time savings are insane.",
    author: 'Sarah Chen',
    role: 'Founder',
    company: 'WebCraft Agency',
    avatar: null,
    type: 'agency',
  },
  {
    id: 2,
    quote:
      "The global components + propagation finally solved our consistency problems. Update the nav or footer once and it updates everywhere. Design system tokens actually work across the whole project.",
    author: 'Marcus Rodriguez',
    role: 'Senior Designer',
    company: 'PixelPerfect Studios',
    avatar: null,
    type: 'designer',
  },
  {
    id: 3,
    quote:
      "As a freelancer I run the entire quickstart on my laptop, show clients live edits in the preview pane, then hand off either the full Catalyst instance or a clean export. No vendor lock-in for them or me.",
    author: 'Emma Thompson',
    role: 'Freelance Developer',
    company: 'Self-employed',
    avatar: null,
    type: 'developer',
  },
  {
    id: 4,
    quote:
      "Our team uses the UCS GraphQL API for three different frontends while non-technical stakeholders edit safely in the visual builder. One source of truth, zero midnight support calls.",
    author: 'David Park',
    role: 'Technical Director',
    company: 'Digital First Agency',
    avatar: null,
    type: 'agency',
  },
];

export function TestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  const nextTestimonial = () => {
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section className="bg-[#080808] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Real workflows. Real results.
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg text-white/60">
            AI import to export in hours. Consistent globals. One headless source of truth. The same studio developers and clients both love.
          </p>
        </div>

        {/* Testimonials carousel */}
        <div className="relative mt-16">
          {/* Desktop: Grid layout */}
          <div className="hidden gap-6 lg:grid lg:grid-cols-2">
            {testimonials.slice(0, 2).map((testimonial) => (
              <TestimonialCard key={testimonial.id} testimonial={testimonial} />
            ))}
          </div>
          <div className="mt-6 hidden gap-6 lg:grid lg:grid-cols-2">
            {testimonials.slice(2, 4).map((testimonial) => (
              <TestimonialCard key={testimonial.id} testimonial={testimonial} />
            ))}
          </div>

          {/* Mobile: Carousel */}
          <div className="lg:hidden">
            <TestimonialCard testimonial={testimonials[activeIndex]} />

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                onClick={prevTestimonial}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* Dots */}
              <div className="flex gap-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      'h-2 w-2 rounded-full transition-colors',
                      index === activeIndex ? 'bg-catalyst-orange' : 'bg-white/20'
                    )}
                    aria-label={`Go to testimonial ${index + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={nextTestimonial}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Next testimonial"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({
  testimonial,
}: {
  testimonial: (typeof testimonials)[0];
}) {
  return (
    <div className="relative rounded-xl border border-white/10 bg-white/5 p-6 sm:p-8">
      {/* Quote icon */}
      <Quote className="absolute right-6 top-6 h-8 w-8 text-catalyst-orange/20" />

      {/* Quote */}
      <blockquote className="relative text-lg leading-relaxed text-white/80">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>

      {/* Author */}
      <div className="mt-6 flex items-center gap-4">
        {/* Avatar */}
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-catalyst-orange to-catalyst-blue text-lg font-bold text-white">
          {testimonial.author
            .split(' ')
            .map((n) => n[0])
            .join('')}
        </div>
        <div>
          <div className="font-semibold text-white">{testimonial.author}</div>
          <div className="text-sm text-white/60">
            {testimonial.role}, {testimonial.company}
          </div>
        </div>
      </div>
    </div>
  );
}
