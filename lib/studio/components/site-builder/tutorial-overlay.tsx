'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TutorialStep {
  title: string
  description: string
  targetSelector?: string // CSS selector for spotlight
  position?: 'top' | 'bottom' | 'left' | 'right'
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Welcome to Site Builder (Demo)',
    description: 'Explore the seeded demo – everything works out of the box. This visual hierarchy (React Flow) editor shows your full page tree. Drag nodes, zoom, and use the AI assistant (sparkles button) for AI import-style edits, content, and components. Press ? for shortcuts.',
    position: 'bottom',
  },
  {
    title: 'Visual Hierarchy Editor',
    description: 'The canvas is a live React Flow sitemap. Click nodes to select pages, drag to reorder hierarchy, double-click to dive into page components. Global sections apply across pages.',
    position: 'bottom',
  },
  {
    title: 'Component Library & Globals',
    description: 'Use the Global Sections (layers icon) or component tools to add powerful reusable blocks. Mark components global for site-wide reuse – fully functional in the demo.',
    targetSelector: '[data-tutorial-id="global-sections"]',
    position: 'right',
  },
  {
    title: 'Add Components',
    description: 'Click the component library button (or ask the AI) to add new sections, headers, footers, and more to your pages. The seeded demo includes rich component types.',
    targetSelector: '[data-tutorial-id="component-library"]',
    position: 'right',
  },
  {
    title: 'Edit Properties & Live CMS',
    description: 'Select any component to edit its content, images, links, and styles in the properties panel. This is a full database-backed CMS – changes are live.',
    targetSelector: '[data-tutorial-id="properties-panel"]',
    position: 'left',
  },
  {
    title: 'AI Canvas Assistant',
    description: 'Click the floating Sparkles button (bottom right). Tell it "add a hero to home", "create about page", or "make this global". It understands your selection and the full component library. Works instantly on the demo site.',
    position: 'left',
  },
  {
    title: 'Design System, Preview & Export',
    description: 'Visit Colors & Styles for live design tokens. Use Preview for the DB-backed renderer. Generate Proposal (export) from top bar or logo menu. For headless/GraphQL API or universal export options, check Settings > API Access.',
    position: 'bottom',
  },
  {
    title: 'Reorder, Auto-Save & More',
    description: 'Drag components or use Alt+↑/↓. Changes auto-save (watch top bar status). Content types, Integrations, and Publish are one click in the rail or logo menu. Everything ready in the seeded demo.',
    targetSelector: '[data-tutorial-id="save-indicator"]',
    position: 'bottom',
  },
]

interface TutorialOverlayProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

export function TutorialOverlay({ isOpen, onClose, onComplete }: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)

  const step = TUTORIAL_STEPS[currentStep]
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1
  const isFirstStep = currentStep === 0

  // Update spotlight position when step changes
  useEffect(() => {
    if (!isOpen || !step.targetSelector) {
      setSpotlightRect(null)
      return
    }

    const updateSpotlight = () => {
      const element = document.querySelector(step.targetSelector!)
      if (element) {
        const rect = element.getBoundingClientRect()
        setSpotlightRect(rect)
      } else {
        setSpotlightRect(null)
      }
    }

    updateSpotlight()

    // Update on resize
    window.addEventListener('resize', updateSpotlight)
    return () => window.removeEventListener('resize', updateSpotlight)
  }, [isOpen, step.targetSelector])

  const handleNext = () => {
    if (isLastStep) {
      onComplete()
    } else {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleSkip = () => {
    onComplete()
  }

  if (!isOpen) return null

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!spotlightRect || !step.position) {
      // Center of screen for non-targeted steps
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    const padding = 20
    const position = step.position

    switch (position) {
      case 'right':
        return {
          top: `${spotlightRect.top + spotlightRect.height / 2}px`,
          left: `${spotlightRect.right + padding}px`,
          transform: 'translateY(-50%)',
        }
      case 'left':
        return {
          top: `${spotlightRect.top + spotlightRect.height / 2}px`,
          right: `${window.innerWidth - spotlightRect.left + padding}px`,
          transform: 'translateY(-50%)',
        }
      case 'bottom':
        return {
          top: `${spotlightRect.bottom + padding}px`,
          left: `${spotlightRect.left + spotlightRect.width / 2}px`,
          transform: 'translateX(-50%)',
        }
      case 'top':
        return {
          bottom: `${window.innerHeight - spotlightRect.top + padding}px`,
          left: `${spotlightRect.left + spotlightRect.width / 2}px`,
          transform: 'translateX(-50%)',
        }
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }
    }
  }

  return (
    <>
      {/* Backdrop with spotlight cutout */}
      <div
        className="fixed inset-0 z-[9998] pointer-events-none"
        style={{
          background: spotlightRect
            ? `radial-gradient(circle at ${spotlightRect.left + spotlightRect.width / 2}px ${
                spotlightRect.top + spotlightRect.height / 2
              }px, transparent ${Math.max(spotlightRect.width, spotlightRect.height) / 2 + 10}px, rgba(0, 0, 0, 0.75) ${
                Math.max(spotlightRect.width, spotlightRect.height) / 2 + 20
              }px)`
            : 'rgba(0, 0, 0, 0.75)',
        }}
      />

      {/* Spotlight border (optional visual enhancement) */}
      {spotlightRect && (
        <div
          className="fixed z-[9999] pointer-events-none border-2 border-primary rounded-lg"
          style={{
            top: `${spotlightRect.top - 4}px`,
            left: `${spotlightRect.left - 4}px`,
            width: `${spotlightRect.width + 8}px`,
            height: `${spotlightRect.height + 8}px`,
            boxShadow: '0 0 0 4px rgba(255, 85, 0, 0.2)',
          }}
        />
      )}

      {/* Tutorial tooltip */}
      <div
        className="fixed z-[10000] bg-card border border-border rounded-lg shadow-2xl max-w-md"
        style={getTooltipPosition()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-1">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 -mt-1 -mr-1"
              onClick={handleSkip}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress indicators */}
          <div className="flex gap-1 mb-4">
            {TUTORIAL_STEPS.map((_, index) => (
              <div
                key={index}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  index === currentStep ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {TUTORIAL_STEPS.length}
            </div>
            <div className="flex gap-2">
              {!isFirstStep && (
                <Button variant="outline" size="sm" onClick={handlePrevious}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <Button size="sm" onClick={handleNext}>
                {isLastStep ? 'Get Started' : 'Next'}
                {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
