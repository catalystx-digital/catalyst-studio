/**
 * Tests for the shared component-category inference used by the greenfield
 * workflow (`greenfield-website.workflow.ts`) and the greenfield bootstrapper
 * (`greenfield-bootstrapper.ts`), which previously held near-duplicate copies.
 *
 * Lives under `lib/studio/workflows/__tests__` so it runs inside the greenfield
 * verification scope (`jest lib/studio/workflows lib/studio/ai`) alongside the
 * callers whose behaviour it pins.
 */

import { inferComponentCategoryFromTypeName } from '@/lib/studio/components/cms/_core/utils';
import { ComponentCategory } from '@/lib/studio/components/cms/_core/types';

describe('inferComponentCategoryFromTypeName', () => {
  describe('keywords both former copies shared', () => {
    it.each([
      ['navbar', ComponentCategory.Navigation],
      ['site-footer', ComponentCategory.Navigation],
      ['hero-simple', ComponentCategory.Heroes],
      ['contact-form', ComponentCategory.Contact],
      ['cta-band', ComponentCategory.CTA],
      ['feature-grid', ComponentCategory.Features],
      ['testimonial-list', ComponentCategory.SocialProof],
      ['about-section', ComponentCategory.About],
      ['blog-list', ComponentCategory.Blog],
      ['pricing-tiers', ComponentCategory.Pricing],
    ])('maps %s to %s', (type, expected) => {
      expect(inferComponentCategoryFromTypeName(type)).toBe(expected);
    });
  });

  describe('keywords unique to the workflow copy (new for bootstrapper callers)', () => {
    it.each([
      ['image-carousel', ComponentCategory.Heroes],
      ['logo-slider', ComponentCategory.Heroes],
      ['call-to-action-block', ComponentCategory.CTA],
      ['quote-block', ComponentCategory.SocialProof],
      ['author-bio', ComponentCategory.About],
      ['related-posts', ComponentCategory.Blog],
      ['price-list', ComponentCategory.Pricing],
      ['data-table', ComponentCategory.Data],
      ['chart', ComponentCategory.Data],
      ['graph-widget', ComponentCategory.Data],
    ])('maps %s to %s', (type, expected) => {
      expect(inferComponentCategoryFromTypeName(type)).toBe(expected);
    });

    it('leaves hero-carousel and hero-slider on Heroes, as both copies already did', () => {
      expect(inferComponentCategoryFromTypeName('hero-carousel')).toBe(ComponentCategory.Heroes);
      expect(inferComponentCategoryFromTypeName('hero-slider')).toBe(ComponentCategory.Heroes);
    });
  });

  describe('unrecognised names fall through to the default', () => {
    it.each([
      'accordion',
      'spacer',
      'video-embed',
      '',
    ])('maps %s to Content', (type) => {
      expect(inferComponentCategoryFromTypeName(type)).toBe(ComponentCategory.Content);
    });
  });

  it('is case-insensitive', () => {
    expect(inferComponentCategoryFromTypeName('HeroBanner')).toBe(ComponentCategory.Heroes);
    expect(inferComponentCategoryFromTypeName('QUOTE-BLOCK')).toBe(ComponentCategory.SocialProof);
  });

  it('resolves compound names on the first matching branch', () => {
    // `carousel` sits in an earlier branch than `testimonial`, so a name
    // carrying both lands on Heroes. Documented in the function comment.
    expect(inferComponentCategoryFromTypeName('testimonial-carousel')).toBe(
      ComponentCategory.Heroes
    );
    expect(inferComponentCategoryFromTypeName('feature-slider')).toBe(ComponentCategory.Heroes);
  });
});
