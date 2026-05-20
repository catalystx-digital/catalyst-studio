'use client';

import React from 'react';
import {
  UploadCloud,
  Camera,
  Briefcase,
  ShoppingBag,
  Megaphone,
  Layers,
  Code2,
} from 'lucide-react';

const colorClasses = {
  blue: 'bg-gray-800 text-blue-400 hover:bg-gray-700 border border-gray-700',
  purple: 'bg-gray-800 text-purple-400 hover:bg-gray-700 border border-gray-700',
  green: 'bg-gray-800 text-green-400 hover:bg-gray-700 border border-gray-700',
  orange: 'bg-gray-800 text-catalyst-orange hover:bg-gray-700 border border-gray-700',
  indigo: 'bg-gray-800 text-indigo-400 hover:bg-gray-700 border border-gray-700',
  cyan: 'bg-gray-800 text-cyan-400 hover:bg-gray-700 border border-gray-700',
  amber: 'bg-gray-800 text-amber-400 hover:bg-gray-700 border border-gray-700',
} as const;

type TagColor = keyof typeof colorClasses;

interface CategoryTag {
  id: string;
  label: string;
  prompt: string;
  icon: React.ComponentType<{ className?: string }>;
  color: TagColor;
}

const CATEGORY_TAGS: CategoryTag[] = [
  {
    id: 'import-website',
    label: 'Import website',
    prompt:
      'Import an existing website into Catalyst Studio, recreating its structure, navigation, SEO metadata, and primary CTAs. URL: ',
    icon: UploadCloud,
    color: 'amber',
  },
  {
    id: 'photography-portfolio',
    label: 'Photography portfolio',
    prompt:
      'Design a photography portfolio with a rotating hero gallery, category navigation for commissions and shoots, and an embedded social feed to drive booking inquiries.',
    icon: Camera,
    color: 'indigo',
  },
  {
    id: 'freelancer-services',
    label: 'Freelancer services',
    prompt:
      'Build a freelancer services site with a value-focused hero, service packages, pricing tiers, testimonials, and a contact form alongside a case study portfolio.',
    icon: Briefcase,
    color: 'orange',
  },
  {
    id: 'solo-founder-storefront',
    label: 'Solo founder storefront',
    prompt:
      'Launch a solo founder product site highlighting the offer, seasonal bundles, social proof, FAQs, and a conversion-focused checkout or lead capture flow.',
    icon: ShoppingBag,
    color: 'green',
  },
  {
    id: 'campaign-hub',
    label: 'Campaign landing hub',
    prompt:
      'Create a small business marketing campaign hub that surfaces active promos, KPIs, event sign-ups, gated resources, and clear CTAs for sales follow-up.',
    icon: Megaphone,
    color: 'purple',
  },
  {
    id: 'agency-credentials',
    label: 'Agency credentials',
    prompt:
      'Produce a digital agency credentials site with an attention-grabbing hero, service breakdowns, animated case studies, blog highlights, and client testimonials.',
    icon: Layers,
    color: 'blue',
  },
  {
    id: 'developer-portfolio',
    label: 'Developer portfolio',
    prompt:
      'Craft a UX and web developer portfolio featuring skills highlights, project grid, resume download, and a streamlined contact section for collaborations.',
    icon: Code2,
    color: 'cyan',
  },
];

interface QuickCategoryTagsProps {
  onTagClick: (prompt: string) => void;
}

export function QuickCategoryTags({ onTagClick }: QuickCategoryTagsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORY_TAGS.map((tag) => {
        const Icon = tag.icon;
        return (
          <button
            key={tag.id}
            onClick={() => onTagClick(tag.prompt)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
              transition-all duration-200 transform hover:scale-105
              ${colorClasses[tag.color]}
            `}
            aria-label={`Use ${tag.label} template`}
            type="button"
          >
            <Icon className="w-4 h-4" />
            <span>{tag.label}</span>
          </button>
        );
      })}
    </div>
  );
}

