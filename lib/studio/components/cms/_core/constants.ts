import { ComponentType, ComponentCategory } from './types';

export const COMPONENT_VERSION = '1.0.0';

export const DEPRECATION_WARNING_PREFIX = '[CMS Component Migration]';

export const DEPRECATION_TIMELINE = {
  startDate: new Date('2024-12-26'),
  endDate: new Date('2025-06-26'),
  warningLevel: 'console' as 'console' | 'error' | 'silent'
};

export const PERFORMANCE_THRESHOLDS = {
  renderTime: 50,
  bundleSize: 10240,
  mountTime: 100
};

export const COMPONENT_MAPPINGS = {
  // Legacy to new component type mappings
  'hero': ComponentType.HeroSimple,
  'header': ComponentType.NavBar,
  'footer': ComponentType.NavBar,
  'cta': ComponentType.CTASimple
} as const;

export const CATEGORY_DISPLAY_NAMES: Record<ComponentCategory, string> = {
  [ComponentCategory.Navigation]: 'Navigation',
  [ComponentCategory.Heroes]: 'Heroes',
  [ComponentCategory.Content]: 'Content',
  [ComponentCategory.Features]: 'Features',
  [ComponentCategory.CTA]: 'Call to Action',
  [ComponentCategory.SocialProof]: 'Social Proof',
  [ComponentCategory.Contact]: 'Contact',
  [ComponentCategory.About]: 'About',
  [ComponentCategory.Blog]: 'Blog',
  [ComponentCategory.Pricing]: 'Pricing',
  [ComponentCategory.Data]: 'Data'
};

export const DEFAULT_AI_CONFIDENCE_SCORES = {
  HIGH: 0.9,
  MEDIUM: 0.7,
  LOW: 0.5,
  VERY_LOW: 0.3
};

export const COMPONENT_LOAD_PRIORITIES = {
  CRITICAL: ['navbar', 'hero-simple', 'hero-with-image'],
  HIGH: ['feature-grid', 'cta-simple'],
  NORMAL: ['text-block', 'testimonials'],
  LOW: ['footer', 'blog-list'],
  LAZY: ['location-map', 'data-table']
};