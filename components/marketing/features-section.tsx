'use client';

import {
  Paintbrush,
  FileEdit,
  Rocket,
  LayoutTemplate,
  Palette,
  Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Features Section - FR-006
 *
 * 6 key features highlighted with icons/visuals
 * Benefits-focused copy addressing different persona needs
 */

const features = [
  {
    icon: Paintbrush,
    title: 'Visual Builder',
    description: 'Design without writing code. Drag and drop components to create beautiful, responsive pages in minutes.',
    gradient: 'from-catalyst-orange/20 to-transparent',
  },
  {
    icon: FileEdit,
    title: 'Client-Ready CMS',
    description: 'Let clients edit content safely. They update text and images while you control the design system.',
    gradient: 'from-catalyst-blue/20 to-transparent',
  },
  {
    icon: Rocket,
    title: 'One-Click Publish',
    description: 'Go live instantly with built-in hosting. Custom domains, SSL, and CDN included at no extra cost.',
    gradient: 'from-emerald-500/20 to-transparent',
  },
  {
    icon: LayoutTemplate,
    title: 'Template Library',
    description: 'Start fast with professional templates. Portfolio, agency, e-commerce, and more ready to customize.',
    gradient: 'from-purple-500/20 to-transparent',
  },
  {
    icon: Palette,
    title: 'Design System',
    description: 'Colors, fonts, and components stay in sync. Update once, reflect everywhere across all pages.',
    gradient: 'from-pink-500/20 to-transparent',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Work together on client projects. Invite team members with role-based permissions and handoffs.',
    gradient: 'from-cyan-500/20 to-transparent',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="bg-[#080808] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything you need to build faster
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
            From design to deployment, Catalyst Studio gives you the tools to create
            professional websites without the complexity.
          </p>
        </div>

        {/* Feature grid */}
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
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
