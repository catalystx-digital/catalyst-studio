'use client'

import React, { forwardRef } from 'react'
import Image from 'next/image'
import { ProposalContextSummary, ProposalDesignComparison, ProposalDesignConceptPreview, ProposalNarrative, ProposalSEOAnalysis, ProposalOriginalScreenshot, AgencyBranding } from '@/lib/studio/site-builder/proposal/types'
import { cn } from '@/lib/utils'
import { DesignConceptPreview } from './design-concept-preview'

interface ConceptPreviewAsset {
  concept: ProposalDesignConceptPreview
  previewUrl?: string | null
  previewAvailable: boolean
}

export interface ProposalDocumentProps {
  websiteName: string
  proposalTitle: string
  narrative: ProposalNarrative
  context: ProposalContextSummary
  sitemapPreview?: string | null
  conceptAssets: ConceptPreviewAsset[]
  capturedAt: string
}

const TYPOGRAPHY = {
  label: 'text-[11px] uppercase tracking-[0.45em] text-white/60',
  heading: 'text-[34px] leading-snug font-semibold',
  body: 'text-[17px] leading-relaxed text-white/80'
}

const cardBase =
  'bg-white/[0.07] border border-white/[0.08] rounded-[28px] shadow-[0_45px_90px_rgba(2,6,23,0.65)] px-10 py-8 backdrop-blur'

const SlideEyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className={cn(TYPOGRAPHY.label, 'mb-2 text-white/50')}>{children}</p>
)

const SlideSectionHeading = ({ title, eyebrow }: { title: string; eyebrow?: string }) => (
  <div>
    {eyebrow && <SlideEyebrow>{eyebrow}</SlideEyebrow>}
    <h3 className={cn(TYPOGRAPHY.heading, 'text-white')}>{title}</h3>
  </div>
)

const ProposalPanel = ({
  children,
  className,
  pageBreak = false
}: {
  children: React.ReactNode
  className?: string
  pageBreak?: boolean
}) => (
  <section
    className={cn(
      'relative flex flex-col gap-6 overflow-hidden rounded-[36px] bg-gradient-to-br from-[#0B1120] via-[#11192C] to-[#0A0F1C] px-12 py-10 text-white shadow-[0_55px_140px_rgba(0,0,0,0.65)]',
      className
    )}
    style={
      pageBreak
        ? {
            breakAfter: 'page',
            pageBreakAfter: 'always'
          }
        : undefined
    }
  >
    {children}
  </section>
)

export const ProposalDocument = forwardRef<HTMLDivElement, ProposalDocumentProps>(
  ({ websiteName, proposalTitle, narrative, context, sitemapPreview, conceptAssets, capturedAt }, ref) => {
    const iaHighlights = narrative.ia_highlights.slice(0, 6)
    const contentTypeNotes = narrative.content_type_notes.slice(0, 4)
    const remainingContentTypes = Math.max(narrative.content_type_notes.length - contentTypeNotes.length, 0)
    const featuredConcepts = conceptAssets.slice(0, 3)
    const upliftSteps = narrative.uplift_plan.slice(0, 6)
    const remainingUpliftItems = Math.max(narrative.uplift_plan.length - upliftSteps.length, 0)
    const designNarrativeById = new Map(narrative.design_concepts.map((entry) => [entry.conceptId, entry]))
    const capturedDate = new Date(capturedAt)
    const capturedDateLabel = Number.isNaN(capturedDate.getTime()) ? '' : capturedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const capturedDateTime = Number.isNaN(capturedDate.getTime()) ? '' : capturedDate.toLocaleString()
    const tagline = context.website.tagline || narrative.project_summary.split('.').at(0) || 'Audience-first experience uplift'
    const deckWidth = 1280
    const hasDesignComparison = Boolean(context.designComparison?.hasOriginalDesign)
    const activationSlideNumber = 4 + Math.max(featuredConcepts.length, 1)

    // Helper to show N/A for zero or missing values
    const formatSeoStat = (value: number | undefined | null): string => {
      if (value === undefined || value === null || value === 0) return 'N/A'
      return String(value)
    }
    const renderConceptBlock = (asset: ConceptPreviewAsset) => {
      const paletteEntries = Object.values(asset.concept.palette)
      const narrativeEntry = designNarrativeById.get(asset.concept.id)
      const hasScreenshot = Boolean(asset.previewUrl && asset.previewAvailable)
      return (
        <div
          key={asset.concept.id}
          className={cn(cardBase, 'grid grid-cols-[0.34fr_0.66fr] gap-10 items-stretch px-10 py-12')}
          style={{ breakInside: 'avoid' }}
        >
          <div className="space-y-5">
            <div>
              <SlideEyebrow>Concept</SlideEyebrow>
              <p className="text-3xl font-semibold">{asset.concept.name === 'Default' ? 'Custom Design Concept' : asset.concept.name}</p>
            </div>
            {narrativeEntry?.positioning && (
              <p className="text-base text-white/85">{narrativeEntry.positioning}</p>
            )}
            {narrativeEntry?.paletteAngle && (
              <p className="text-sm text-white/65">{narrativeEntry.paletteAngle}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {paletteEntries.map((color) => (
                <span
                  key={`${asset.concept.id}-${color}`}
                  className="h-9 w-9 rounded-full border border-white/20"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            {narrativeEntry?.bestUseCases?.length ? (
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Best use cases</p>
                <ul className="mt-2 space-y-1 text-sm text-white/80">
                  {narrativeEntry.bestUseCases.map((useCase) => (
                    <li key={useCase} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/40" />
                      <span>{useCase}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="relative rounded-[32px] border border-white/10 bg-black/40 shadow-[0_35px_80px_rgba(2,6,23,0.65)] overflow-hidden px-6 py-6 min-h-[640px] flex items-center justify-center">
            {hasScreenshot ? (
              <img
                src={asset.previewUrl!}
                alt={`${asset.concept.name} preview`}
                className="h-full w-full object-contain rounded-3xl"
                style={{ maxHeight: '100%' }}
              />
            ) : (
              <div className="h-full w-full bg-[#050915] rounded-3xl">
                <DesignConceptPreview concept={asset.concept} mode="full" showSampleCard />
              </div>
            )}
          </div>
        </div>
      )
    }

    const renderContentTypeCard = (note: (typeof contentTypeNotes)[number]) => (
      <div
        key={note.typeName}
        className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 shadow-[0_12px_40px_rgba(3,7,18,0.45)]"
      >
        <p className="text-lg font-semibold text-white">{note.typeName}</p>
        <p className="text-sm text-white/70 mt-1">{note.summary}</p>
        {note.opportunities && note.opportunities.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-white/60">
            {note.opportunities.map((opp) => (
              <li key={opp} className="flex items-start gap-2">
                <span className="mt-2 h-1 w-1 rounded-full bg-white/40" />
                <span>{opp}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )

    return (
      <div
        ref={ref}
        className="flex flex-col gap-10 rounded-[52px] bg-[#01040C] px-10 py-14"
        style={{ width: `${deckWidth}px` }}
      >
        <ProposalPanel>
          <div className="flex flex-col gap-10">
            <div className={cn(cardBase, 'flex flex-col justify-between gap-8 min-h-[320px]')}>
              <div className="flex items-start justify-between gap-8">
                <div className="space-y-5 max-w-[720px]">
                  <SlideEyebrow>Slide 01 · Cover</SlideEyebrow>
                  <h1 className="text-[48px] leading-tight font-semibold">
                    {proposalTitle || `${websiteName} Proposal`}
                  </h1>
                  <p className="text-xl text-white/80 max-w-[560px]">{tagline}</p>
                  <p className="text-base text-white/60">
                    Prepared for {websiteName} · {capturedDateLabel}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  {context.agencyBranding?.logoUrl ? (
                    <img
                      src={context.agencyBranding.logoUrl}
                      alt={context.agencyBranding.agencyName || 'Agency'}
                      className="h-11 w-auto object-contain"
                    />
                  ) : (
                    <Image
                      src="/images/logos/catalyst-studio.svg"
                      alt="Catalyst Studio"
                      width={164}
                      height={44}
                      priority={false}
                    />
                  )}
                  <p className={cn(TYPOGRAPHY.label, 'text-right text-white/40 tracking-[0.35em]')}>
                    {context.agencyBranding?.agencyName || 'Proposal Deck'}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-4 text-sm text-white/60">
                <span>Captured via Catalyst Site Builder</span>
                {capturedDateTime && <span>{capturedDateTime}</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className={cn(cardBase, 'space-y-4')}>
                <SlideSectionHeading eyebrow="Executive Summary" title="Why this build matters" />
                <p className={cn(TYPOGRAPHY.body, 'text-white/90 whitespace-pre-line max-w-[520px]')}>
                  {narrative.project_summary}
                </p>
              </div>
              <div className={cn(cardBase, 'space-y-4')}>
                <SlideSectionHeading eyebrow="Information Architecture" title="System snapshot" />
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-4xl font-semibold">{context.sitemap.stats.total}</p>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/60 mt-1">Nodes</p>
                  </div>
                  <div>
                    <p className="text-4xl font-semibold">{context.sitemap.stats.depthMax}</p>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/60 mt-1">Depth</p>
                  </div>
                  <div>
                    <p className="text-4xl font-semibold">{context.sitemap.stats.published}</p>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/60 mt-1">Published</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-white/80">
                  {iaHighlights.map((highlight) => (
                    <li key={highlight.section}>
                      <span className="font-semibold text-white">{highlight.section}</span> — {highlight.insight}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </ProposalPanel>

        <ProposalPanel>
          <div className="flex items-center justify-between">
            <SlideSectionHeading eyebrow="Slide 02 · Architecture" title="Full Sitemap Snapshot" />
            <p className="text-sm text-white/60">Auto-layout + Fit View applied before capture</p>
          </div>
          <div className={cn(cardBase, 'space-y-6')}>
            <p className="text-sm text-white/70 max-w-3xl">
              The complete IA graph is rendered below at full width. Nodes are spaced using builder auto-layout to
              highlight navigation depth and critical gaps.
            </p>
            {sitemapPreview ? (
              <div className="w-full overflow-hidden rounded-[32px] border border-white/10 bg-white/5">
                <img
                  src={sitemapPreview}
                  alt="Sitemap preview"
                  className="w-full"
                  style={{ minHeight: 520 }}
                />
              </div>
            ) : (
              <div className="flex min-h-[520px] flex-col items-center justify-center rounded-[32px] border border-dashed border-white/20 px-8 text-center text-white/60">
                <p className="text-sm">Snapshot unavailable — re-run export from the canvas view.</p>
              </div>
            )}
          </div>
        </ProposalPanel>

        <ProposalPanel>
          <SlideSectionHeading eyebrow="Slide 03 · Content Systems" title="Reusable publishing blocks" />
          <div className="mt-6 grid grid-cols-2 gap-6">
            {contentTypeNotes.length === 0 && (
              <p className="text-sm text-white/60 col-span-2">No content type guidance received for this export.</p>
            )}
            {contentTypeNotes.map((note) => renderContentTypeCard(note))}
          </div>
          {remainingContentTypes > 0 && (
            <p className="text-xs text-white/60 mt-4">
              +{remainingContentTypes} more content types documented in builder.
            </p>
          )}
        </ProposalPanel>

        {/* SEO Analysis Section */}
        {context.seoAnalysis && (
          <ProposalPanel>
            <SlideSectionHeading eyebrow="SEO Analysis" title="Search optimization status" />
            <div className="grid grid-cols-[1fr_1.5fr] gap-8">
              <div className={cn(cardBase, 'space-y-6')}>
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold',
                      context.seoAnalysis.score >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
                      context.seoAnalysis.score >= 40 ? 'bg-amber-500/20 text-amber-400' :
                      'bg-red-500/20 text-red-400'
                    )}
                  >
                    {context.seoAnalysis.score}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/50">SEO Score</p>
                    <p className="text-lg font-semibold text-white">
                      {context.seoAnalysis.score >= 70 ? 'Good' : context.seoAnalysis.score >= 40 ? 'Needs Work' : 'Critical'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-2xl font-semibold text-white">{formatSeoStat(context.seoAnalysis.stats.totalPages)}</p>
                    <p className="text-xs text-white/60">Total pages</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">{formatSeoStat(context.seoAnalysis.stats.pagesWithMeta)}</p>
                    <p className="text-xs text-white/60">With meta</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">{formatSeoStat(context.seoAnalysis.stats.imagesWithAlt)}</p>
                    <p className="text-xs text-white/60">Images w/alt</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">{formatSeoStat(context.seoAnalysis.stats.internalLinks)}</p>
                    <p className="text-xs text-white/60">Internal links</p>
                  </div>
                </div>
              </div>
              <div className={cn(cardBase, 'space-y-4')}>
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Issues Found</p>
                {context.seoAnalysis.issues.length === 0 ? (
                  <p className="text-sm text-emerald-400">No critical SEO issues detected.</p>
                ) : (
                  <ul className="space-y-3">
                    {context.seoAnalysis.issues.slice(0, 5).map((issue, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span
                          className={cn(
                            'mt-1 h-2 w-2 rounded-full shrink-0',
                            issue.severity === 'critical' ? 'bg-red-500' :
                            issue.severity === 'warning' ? 'bg-amber-500' :
                            'bg-blue-400'
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/90 break-words">{issue.message}</p>
                          <p className="text-xs text-white/50">{issue.category}{issue.affectedPages ? ` · ${issue.affectedPages} pages` : ''}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {narrative.seo_recommendations && (
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-xs uppercase tracking-[0.35em] text-white/50 mb-2">Recommendations</p>
                    <p className="text-sm text-white/80">{narrative.seo_recommendations}</p>
                  </div>
                )}
              </div>
            </div>
          </ProposalPanel>
        )}

        {/* Original Website Screenshots Section */}
        {context.originalScreenshots && context.originalScreenshots.length > 0 && (
          <ProposalPanel>
            <SlideSectionHeading eyebrow="Current Website" title="Original page captures" />
            <div className={cn(cardBase, 'space-y-4')}>
              <p className="text-sm text-white/70">
                Screenshots captured during the import process showing the original website appearance.
              </p>
              <div className="grid grid-cols-3 gap-4">
                {context.originalScreenshots.slice(0, 6).map((screenshot, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden aspect-video">
                      <img
                        src={screenshot.url}
                        alt={`Original page: ${screenshot.pageUrl}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-white/50 truncate">{screenshot.pageUrl}</p>
                  </div>
                ))}
              </div>
            </div>
          </ProposalPanel>
        )}

        {hasDesignComparison && context.designComparison && (
          <ProposalPanel pageBreak>
            <SlideSectionHeading eyebrow="Slide 04 - Design Evolution" title="From current to proposed" />
            <div className={cn(cardBase, 'space-y-8')}>
              {narrative.design_evolution_narrative && (
                <p className="text-base text-white/80 max-w-3xl">
                  {narrative.design_evolution_narrative}
                </p>
              )}
              <div className="grid grid-cols-2 gap-10">
                {/* Original Design */}
                <div className="space-y-6">
                  <div>
                    <p className={cn(TYPOGRAPHY.label, 'mb-2')}>Current Design</p>
                    <p className="text-xl font-semibold text-white/90">Original Palette</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(context.designComparison.originalPalette).map(([name, color]) => (
                      <div key={name} className="flex flex-col items-center gap-2">
                        <span
                          className="h-12 w-12 rounded-xl border border-white/20"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-white/50 capitalize">{name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4">
                    <p className="text-xs uppercase tracking-[0.35em] text-white/50">Typography</p>
                    <p className="text-sm text-white/80 mt-2">
                      Heading: <span className="font-semibold">{context.designComparison.originalTypography.heading}</span>
                    </p>
                    <p className="text-sm text-white/80">
                      Body: <span className="font-semibold">{context.designComparison.originalTypography.body}</span>
                    </p>
                  </div>
                </div>
                {/* Proposed Design */}
                <div className="space-y-6">
                  <div>
                    <p className={cn(TYPOGRAPHY.label, 'mb-2')}>Proposed Design</p>
                    <p className="text-xl font-semibold text-white/90">Modernized Palette</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(context.designComparison.proposedPalette).map(([name, color]) => (
                      <div key={name} className="flex flex-col items-center gap-2">
                        <span
                          className="h-12 w-12 rounded-xl border border-white/20"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-white/50 capitalize">{name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4">
                    <p className="text-xs uppercase tracking-[0.35em] text-white/50">Typography</p>
                    <p className="text-sm text-white/80 mt-2">
                      Heading: <span className="font-semibold">{context.designComparison.proposedTypography.heading}</span>
                    </p>
                    <p className="text-sm text-white/80">
                      Body: <span className="font-semibold">{context.designComparison.proposedTypography.body}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ProposalPanel>
        )}

        {featuredConcepts.length > 0 ? (
          featuredConcepts.map((asset, index) => (
            <ProposalPanel key={asset.concept.id} pageBreak>
              <SlideSectionHeading eyebrow={`Slide ${index + 4} · Design Concept`} title={asset.concept.name === 'Default' ? 'Custom Design Concept' : asset.concept.name} />
              {renderConceptBlock(asset)}
            </ProposalPanel>
          ))
        ) : (
          <ProposalPanel>
            <div className={cn(cardBase, 'text-white/70')}>
              Concept previews are not available for this website yet.
            </div>
          </ProposalPanel>
        )}

        <ProposalPanel pageBreak>
          <SlideSectionHeading eyebrow={`Slide ${activationSlideNumber} · Activation`} title="Implementation roadmap" />
          <div className="grid grid-cols-[1.3fr_0.9fr] gap-6">
            <div className={cn(cardBase, 'flex flex-col overflow-hidden')}>
              <SlideSectionHeading eyebrow="Implementation" title="Uplift Plan" />
              <ol className="mt-4 space-y-2 text-white/85 text-sm list-decimal pl-4 pr-2">
                {upliftSteps.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ol>
              {remainingUpliftItems > 0 && (
                <p className="text-xs text-white/60 mt-3">
                  +{remainingUpliftItems} additional steps captured in the working plan.
                </p>
              )}
            </div>
            <div
              className={cn(
                cardBase,
                'flex flex-col justify-between bg-gradient-to-br from-[#FF6B2C] via-[#FF9464] to-[#FFD4B6] text-[#1C0A05] py-8'
              )}
            >
              <div>
                <p className="mt-1 text-2xl font-semibold leading-snug">{narrative.call_to_action}</p>
              </div>
              <div className="space-y-4">
                <button className="inline-flex items-center justify-center rounded-full border border-[#1C0A05]/20 bg-white/30 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-[#1C0A05]">
                  {context.agencyBranding?.agencyName ? `Book with ${context.agencyBranding.agencyName}` : 'Get Started'}
                </button>
                <p className="text-xs uppercase tracking-[0.4em] text-[#1C0A05]/90">
                  {context.agencyBranding?.agencyName || 'Your Partner'} · {context.website.name}
                </p>
                {context.agencyBranding?.contactEmail && (
                  <p className="text-xs text-[#1C0A05]/90">
                    Contact: {context.agencyBranding.contactEmail}
                  </p>
                )}
              </div>
            </div>
          </div>
        </ProposalPanel>
      </div>
    )
  }
)

ProposalDocument.displayName = 'ProposalDocument'
