/**
 * Pins the 'reviews' -> 'testimonials' alias, and the reason it has to stay.
 *
 * Background: ComponentType.Reviews is a real registered component backed by
 * social-proof/review-card, and import offers 'reviews' to the model as a
 * candidate type on portfolio/work/case-study/clients routes. The alias
 * converts that pick to 'testimonials'.
 *
 * It looks like the alias is swallowing a valid component, but removing it
 * would break rendering: review-card's schema is a SINGLE review (flat
 * rating/reviewText/author/date), while detection emits a SECTION
 * ({ heading, reviews: [...] }). The two shapes do not meet, so the alias is
 * load-bearing. These tests fail if someone removes it, and also fail if the
 * schema mismatch that justifies it ever goes away.
 */

import { resolveAlias, clearAliasCache } from '../alias-registry'
import { ReviewCardDef } from '../../social-proof/review-card/review-card.def'
import { TestimonialSliderDef } from '../../social-proof/testimonial-slider/testimonial-slider.def'

describe("alias-registry: 'reviews' maps to 'testimonials'", () => {
  beforeEach(() => {
    clearAliasCache()
  })

  it("resolves 'reviews' to 'testimonials'", () => {
    expect(resolveAlias('reviews')).toBe('testimonials')
  })

  describe('the reason the alias has to stay', () => {
    // The shape detection produces for a reviews section, copied from
    // detection/canonical/experience.ts (ComponentType.Reviews sampleContent).
    const detectionReviewsSection = {
      heading: '4.8 rating across 250+ reviews',
      reviews: [
        {
          id: 'review-1',
          rating: 5,
          reviewText: 'Intuitive interface and fast publishing keeps our editors happy.',
          author: 'Priya S.',
          date: '2024-04-12',
        },
      ],
    }

    it('review-card cannot carry a detection reviews section', () => {
      const result = ReviewCardDef.schema.safeParse(detectionReviewsSection)
      expect(result.success).toBe(false)
    })

    it('review-card has no heading field and no reviews array field', () => {
      const shape = Object.keys(ReviewCardDef.schema.shape)
      expect(shape).not.toContain('heading')
      expect(shape).not.toContain('reviews')
    })

    it('review-card is an individual item, not a section', () => {
      // Required, top-level, singular: this is one review, not a collection.
      const shape = Object.keys(ReviewCardDef.schema.shape)
      expect(shape).toEqual(
        expect.arrayContaining(['rating', 'reviewText', 'author', 'date'])
      )
      // And the definition says so itself.
      expect(ReviewCardDef.subOnly).toBe(true)
    })

    it('testimonials accepts a collection, which is what detection emits', () => {
      const shape = Object.keys(TestimonialSliderDef.schema.shape)
      expect(shape).toContain('testimonials')
    })
  })
})
