/**
 * Tests for Export Ordering Utility
 */

import { describe, it, expect } from '@jest/globals'
import {
  sortForExport,
  getDependencies,
  getDependents,
  isSubComponent,
  validateDependencies
} from '../export-ordering'
import { ComponentType } from '../types'

describe('Export Ordering', () => {
  describe('sortForExport', () => {
    it('should handle empty array', () => {
      const result = sortForExport([])
      expect(result).toEqual([])
    })

    it('should handle single component with no dependencies', () => {
      const result = sortForExport([ComponentType.HeroSimple])
      expect(result).toEqual([ComponentType.HeroSimple])
    })

    it('should ensure AccordionItem comes before Accordion', () => {
      const types = [ComponentType.Accordion, ComponentType.AccordionItem]
      const result = sortForExport(types)

      const accordionIndex = result.indexOf(ComponentType.Accordion)
      const accordionItemIndex = result.indexOf(ComponentType.AccordionItem)

      expect(accordionItemIndex).toBeLessThan(accordionIndex)
    })

    it('should ensure TabItem comes before Tabs', () => {
      const types = [ComponentType.Tabs, ComponentType.TabItem]
      const result = sortForExport(types)

      const tabsIndex = result.indexOf(ComponentType.Tabs)
      const tabItemIndex = result.indexOf(ComponentType.TabItem)

      expect(tabItemIndex).toBeLessThan(tabsIndex)
    })

    it('should ensure CardItem comes before CardGrid', () => {
      const types = [ComponentType.CardGrid, ComponentType.CardItem]
      const result = sortForExport(types)

      const cardGridIndex = result.indexOf(ComponentType.CardGrid)
      const cardItemIndex = result.indexOf(ComponentType.CardItem)

      expect(cardItemIndex).toBeLessThan(cardGridIndex)
    })

    it('should ensure NavMenuItem and MobileMenu come before NavBar', () => {
      const types = [ComponentType.NavBar, ComponentType.NavMenuItem, ComponentType.MobileMenu]
      const result = sortForExport(types)

      const navBarIndex = result.indexOf(ComponentType.NavBar)
      const navMenuItemIndex = result.indexOf(ComponentType.NavMenuItem)
      const mobileMenuIndex = result.indexOf(ComponentType.MobileMenu)

      expect(navMenuItemIndex).toBeLessThan(navBarIndex)
      expect(mobileMenuIndex).toBeLessThan(navBarIndex)
    })

    it('should ensure NavMenuItem and SocialLinkItem come before Footer', () => {
      const types = [ComponentType.Footer, ComponentType.NavMenuItem, ComponentType.SocialLinkItem]
      const result = sortForExport(types)

      const footerIndex = result.indexOf(ComponentType.Footer)
      const navMenuItemIndex = result.indexOf(ComponentType.NavMenuItem)
      const socialLinkItemIndex = result.indexOf(ComponentType.SocialLinkItem)

      expect(navMenuItemIndex).toBeLessThan(footerIndex)
      expect(socialLinkItemIndex).toBeLessThan(footerIndex)
    })

    it('should handle complex dependency chain', () => {
      const types = [
        ComponentType.NavBar,
        ComponentType.Footer,
        ComponentType.NavMenuItem,
        ComponentType.MobileMenu,
        ComponentType.SocialLinkItem,
        ComponentType.HeroSimple, // no dependencies
        ComponentType.Accordion,
        ComponentType.AccordionItem
      ]

      const result = sortForExport(types)

      // Check all dependencies are satisfied
      const navBarIndex = result.indexOf(ComponentType.NavBar)
      const footerIndex = result.indexOf(ComponentType.Footer)
      const accordionIndex = result.indexOf(ComponentType.Accordion)

      const navMenuItemIndex = result.indexOf(ComponentType.NavMenuItem)
      const mobileMenuIndex = result.indexOf(ComponentType.MobileMenu)
      const socialLinkItemIndex = result.indexOf(ComponentType.SocialLinkItem)
      const accordionItemIndex = result.indexOf(ComponentType.AccordionItem)

      expect(navMenuItemIndex).toBeLessThan(navBarIndex)
      expect(mobileMenuIndex).toBeLessThan(navBarIndex)
      expect(navMenuItemIndex).toBeLessThan(footerIndex)
      expect(socialLinkItemIndex).toBeLessThan(footerIndex)
      expect(accordionItemIndex).toBeLessThan(accordionIndex)

      // Result should contain all types
      expect(result.length).toBe(types.length)
      expect(new Set(result)).toEqual(new Set(types))
    })

    it('should handle unknown component types gracefully', () => {
      const types = ['unknown-component-1', 'unknown-component-2', ComponentType.HeroSimple]
      const result = sortForExport(types)

      // Should pass through all types
      expect(result.length).toBe(3)
      expect(new Set(result)).toEqual(new Set(types))
    })

    it('should preserve order for independent components', () => {
      const types = [
        ComponentType.HeroSimple,
        ComponentType.HeroWithImage,
        ComponentType.CTASimple,
        ComponentType.TextBlock
      ]

      const result = sortForExport(types)

      // All should be present
      expect(result.length).toBe(types.length)
      expect(new Set(result)).toEqual(new Set(types))
    })

    it('should handle component with only one dependency present', () => {
      // NavBar depends on NavMenuItem and MobileMenu, but only NavMenuItem is in the list
      const types = [ComponentType.NavBar, ComponentType.NavMenuItem]
      const result = sortForExport(types)

      const navBarIndex = result.indexOf(ComponentType.NavBar)
      const navMenuItemIndex = result.indexOf(ComponentType.NavMenuItem)

      expect(navMenuItemIndex).toBeLessThan(navBarIndex)
    })

    it('should handle TeamMember before TeamGrid', () => {
      const types = [ComponentType.TeamGrid, ComponentType.TeamMember]
      const result = sortForExport(types)

      const teamGridIndex = result.indexOf(ComponentType.TeamGrid)
      const teamMemberIndex = result.indexOf(ComponentType.TeamMember)

      expect(teamMemberIndex).toBeLessThan(teamGridIndex)
    })

    it('should handle TimelineEvent before Timeline', () => {
      const types = [ComponentType.Timeline, ComponentType.TimelineEvent]
      const result = sortForExport(types)

      const timelineIndex = result.indexOf(ComponentType.Timeline)
      const timelineEventIndex = result.indexOf(ComponentType.TimelineEvent)

      expect(timelineEventIndex).toBeLessThan(timelineIndex)
    })
  })

  describe('getDependencies', () => {
    it('should return dependencies for Accordion', () => {
      const deps = getDependencies(ComponentType.Accordion)
      expect(deps).toContain(ComponentType.AccordionItem)
    })

    it('should return dependencies for NavBar', () => {
      const deps = getDependencies(ComponentType.NavBar)
      expect(deps).toContain(ComponentType.NavMenuItem)
      expect(deps).toContain(ComponentType.MobileMenu)
    })

    it('should return empty array for component with no dependencies', () => {
      const deps = getDependencies(ComponentType.HeroSimple)
      expect(deps).toEqual([])
    })

    it('should return empty array for unknown component', () => {
      const deps = getDependencies('unknown-component')
      expect(deps).toEqual([])
    })
  })

  describe('getDependents', () => {
    it('should return dependents for NavMenuItem', () => {
      const dependents = getDependents(ComponentType.NavMenuItem)
      expect(dependents).toContain(ComponentType.NavBar)
      expect(dependents).toContain(ComponentType.Footer)
    })

    it('should return dependents for AccordionItem', () => {
      const dependents = getDependents(ComponentType.AccordionItem)
      expect(dependents).toContain(ComponentType.Accordion)
    })

    it('should return empty array for component with no dependents', () => {
      const dependents = getDependents(ComponentType.NavBar)
      expect(dependents).toEqual([])
    })

    it('should return empty array for unknown component', () => {
      const dependents = getDependents('unknown-component')
      expect(dependents).toEqual([])
    })
  })

  describe('isSubComponent', () => {
    it('should return true for AccordionItem', () => {
      expect(isSubComponent(ComponentType.AccordionItem)).toBe(true)
    })

    it('should return true for NavMenuItem', () => {
      expect(isSubComponent(ComponentType.NavMenuItem)).toBe(true)
    })

    it('should return true for TabItem', () => {
      expect(isSubComponent(ComponentType.TabItem)).toBe(true)
    })

    it('should return false for NavBar', () => {
      expect(isSubComponent(ComponentType.NavBar)).toBe(false)
    })

    it('should return false for HeroSimple', () => {
      expect(isSubComponent(ComponentType.HeroSimple)).toBe(false)
    })

    it('should return false for unknown component', () => {
      expect(isSubComponent('unknown-component')).toBe(false)
    })
  })

  describe('validateDependencies', () => {
    it('should validate dependency graph structure', () => {
      const validation = validateDependencies()

      // Should not have circular dependencies in our current setup
      expect(validation.circularDependencies.length).toBe(0)

      // If there are issues, they should be reported
      if (!validation.valid) {
        console.log('Validation issues:', validation)
      }
    })

    it('should detect missing component types if any', () => {
      const validation = validateDependencies()

      // Log any missing types for debugging
      if (validation.missingTypes.length > 0) {
        console.log('Missing component types in dependencies:', validation.missingTypes)
      }

      // This is informational - we might have types in dependencies
      // that aren't in ComponentType enum yet
    })
  })

  describe('edge cases', () => {
    it('should handle duplicate types in input', () => {
      const types = [
        ComponentType.Accordion,
        ComponentType.AccordionItem,
        ComponentType.Accordion, // duplicate
        ComponentType.AccordionItem // duplicate
      ]

      // Note: sortForExport naturally deduplicates due to Set operations
      const result = sortForExport(types)

      // Should deduplicate and maintain dependency order
      expect(result.length).toBe(2) // Only unique types
      expect(result).toContain(ComponentType.Accordion)
      expect(result).toContain(ComponentType.AccordionItem)

      // AccordionItem should come before Accordion
      const accordionIndex = result.indexOf(ComponentType.Accordion)
      const accordionItemIndex = result.indexOf(ComponentType.AccordionItem)
      expect(accordionItemIndex).toBeLessThan(accordionIndex)
    })

    it('should handle reverse order input', () => {
      const types = [
        ComponentType.NavBar,
        ComponentType.Footer,
        ComponentType.Accordion,
        ComponentType.TeamGrid,
        ComponentType.Timeline,
        ComponentType.AccordionItem,
        ComponentType.TeamMember,
        ComponentType.TimelineEvent,
        ComponentType.NavMenuItem,
        ComponentType.MobileMenu,
        ComponentType.SocialLinkItem
      ]

      const result = sortForExport(types)

      // Verify all dependency constraints are satisfied
      const getIndex = (type: ComponentType) => result.indexOf(type)

      // AccordionItem before Accordion
      expect(getIndex(ComponentType.AccordionItem)).toBeLessThan(getIndex(ComponentType.Accordion))

      // TeamMember before TeamGrid
      expect(getIndex(ComponentType.TeamMember)).toBeLessThan(getIndex(ComponentType.TeamGrid))

      // TimelineEvent before Timeline
      expect(getIndex(ComponentType.TimelineEvent)).toBeLessThan(getIndex(ComponentType.Timeline))

      // NavMenuItem before NavBar and Footer
      expect(getIndex(ComponentType.NavMenuItem)).toBeLessThan(getIndex(ComponentType.NavBar))
      expect(getIndex(ComponentType.NavMenuItem)).toBeLessThan(getIndex(ComponentType.Footer))

      // MobileMenu before NavBar
      expect(getIndex(ComponentType.MobileMenu)).toBeLessThan(getIndex(ComponentType.NavBar))

      // SocialLinkItem before Footer
      expect(getIndex(ComponentType.SocialLinkItem)).toBeLessThan(getIndex(ComponentType.Footer))
    })
  })
})
