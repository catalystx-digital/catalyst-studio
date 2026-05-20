import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { toPng, toPdf } from '@/lib/studio/export-utils'
import { emitStudioTelemetry } from '@/lib/studio/telemetry/studio-telemetry'
import {
  ProposalApiResponse,
  ProposalContextSummary,
  ProposalDesignConceptPreview,
  ProposalNarrative
} from '@/lib/studio/site-builder/proposal/types'
import {
  generateProposalDocx,
  slugifyFilename,
  downloadBlob
} from '@/lib/studio/site-builder/proposal/docx-generator'
import { ProposalDocumentProps } from './proposal-document'

type ExportStatus = 'idle' | 'assembling' | 'success' | 'error'
type ExportStage = 'collect-ia' | 'summarize-brief' | 'generate-narrative' | 'render-document'
export type ExportFormat = 'pdf' | 'docx'

interface UseProposalExportOptions {
  websiteId?: string | null
  websiteName?: string | null
  defaultConceptId?: string | null
  importJobId?: string | null
  dialogOpen: boolean
}

interface ConceptOption {
  id: string
  name: string
  isDefault?: boolean
}

interface DocumentState extends ProposalDocumentProps {}

const getProgressSteps = (format: ExportFormat): Array<{ key: ExportStage; label: string }> => [
  { key: 'collect-ia', label: 'Collecting IA' },
  { key: 'summarize-brief', label: 'Summarizing brief' },
  { key: 'generate-narrative', label: 'Generating narrative' },
  { key: 'render-document', label: format === 'docx' ? 'Generating Word document' : 'Rendering PDF' }
]

const waitForNextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'proposal'

export const useProposalExport = ({
  websiteId,
  websiteName,
  defaultConceptId,
  importJobId,
  dialogOpen
}: UseProposalExportOptions) => {
  const [conceptOptions, setConceptOptions] = useState<ConceptOption[]>([])
  const [isLoadingConcepts, setIsLoadingConcepts] = useState(false)
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [currentStage, setCurrentStage] = useState<ExportStage | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [failureStage, setFailureStage] = useState<ExportStage | null>(null)
  // Skip "this website" fallback placeholder - use neutral "Website" instead
  const [formProposalTitle, setFormProposalTitle] = useState(() => {
    const name = websiteName && websiteName !== 'this website' ? websiteName : 'Website'
    return `${name} Proposal`
  })
  const [formTagline, setFormTagline] = useState('Audience-first experience uplift')
  const [formConceptId, setFormConceptId] = useState<string | null>(defaultConceptId ?? null)
  const [includeAlternates, setIncludeAlternates] = useState(true)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf')
  const [documentState, setDocumentState] = useState<DocumentState | null>(null)
  const [previewConcepts, setPreviewConcepts] = useState<ProposalDesignConceptPreview[]>([])
  const [lastExportBlob, setLastExportBlob] = useState<Blob | null>(null)
  const [lastExportFormat, setLastExportFormat] = useState<ExportFormat>('pdf')

  const previewRefs = useRef(new Map<string, HTMLElement | null>())
  const proposalDocumentRef = useRef<HTMLDivElement | null>(null)
  const MAX_SITEMAP_CAPTURE_DIMENSION = 3200

  const captureWithRetry = useCallback(
    async <T,>(fn: () => Promise<T>, retries = 2): Promise<T> => {
      let attempt = 0
      let lastError: unknown
      while (attempt <= retries) {
        try {
          return await fn()
        } catch (error) {
          lastError = error
          attempt += 1
          if (attempt > retries) {
            break
          }
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
        }
      }
      throw lastError instanceof Error ? lastError : new Error('Capture failed')
    },
    []
  )

  useEffect(() => {
    if (websiteName && websiteName !== 'this website') {
      setFormProposalTitle((prev) => {
        // Update if empty, uses placeholder 'Website', or uses fallback 'this website'
        const isPlaceholder = !prev || prev === 'Website Proposal' || prev === 'this website Proposal'
        return isPlaceholder ? `${websiteName} Proposal` : prev
      })
    }
  }, [websiteName])

  useEffect(() => {
    if (!dialogOpen || !websiteId) {
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setIsLoadingConcepts(true)
        const response = await fetch(`/api/website/${websiteId}/design-system`)
        if (!response.ok) {
          throw new Error('Failed to load design concepts')
        }
        const payload = await response.json()
        const options: ConceptOption[] = Array.isArray(payload?.data?.concepts)
          ? payload.data.concepts.map((concept: any) => ({
              id: concept.id,
              name: concept.name,
              isDefault: Boolean(concept.isDefault)
            }))
          : []
        if (!cancelled) {
          setConceptOptions(options)
          if (!formConceptId && options.length > 0) {
            const preferred =
              options.find((option) => option.id === defaultConceptId) ??
              options.find((option) => option.isDefault) ??
              options[0]
            setFormConceptId(preferred.id)
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.warn('[proposal-export] concept fetch failed', error)
        }
        if (!cancelled) {
          setConceptOptions([])
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConcepts(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dialogOpen, websiteId, defaultConceptId, formConceptId])

  useEffect(() => {
    if (!dialogOpen) {
      setStatus('idle')
      setCurrentStage(null)
      setLogs([])
      setFailureStage(null)
      setPreviewConcepts([])
      setDocumentState(null)
    }
  }, [dialogOpen])

  const appendLog = useCallback((message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }, [])

  const registerPreviewNode = useCallback((conceptId: string, node: HTMLDivElement | null) => {
    if (node) {
      previewRefs.current.set(conceptId, node)
    } else {
      previewRefs.current.delete(conceptId)
    }
  }, [])

  const registerDocumentNode = useCallback((node: HTMLDivElement | null) => {
    proposalDocumentRef.current = node
  }, [])

  const progress = useMemo(
    () =>
      getProgressSteps(exportFormat).map((step) => {
        const steps = getProgressSteps(exportFormat)
        const index = steps.findIndex((entry) => entry.key === step.key)
        const currentIndex = currentStage ? steps.findIndex((entry) => entry.key === currentStage) : -1
        let state: 'pending' | 'active' | 'complete' = 'pending'
        if (index < currentIndex) {
          state = 'complete'
        } else if (index === currentIndex) {
          state = 'active'
        }
        return { ...step, state }
      }),
    [currentStage]
  )

  const captureConceptPreviews = useCallback(
    async (concepts: ProposalDesignConceptPreview[]) => {
      const captures: Array<{ id: string; previewUrl: string | null; available: boolean }> = []
      for (let index = 0; index < concepts.length; index++) {
        const concept = concepts[index]
        appendLog(`Capturing concept ${index + 1}/${concepts.length}`)
        const node = previewRefs.current.get(concept.id)
        if (!node) {
          captures.push({ id: concept.id, previewUrl: null, available: false })
          continue
        }
        try {
          const dataUrl = await captureWithRetry(
            () =>
              toPng(node, {
                backgroundColor: '#0B1120',
                width: node.clientWidth,
                height: node.clientHeight,
                scale: 1
              }),
            2
          )
          captures.push({ id: concept.id, previewUrl: dataUrl, available: true })
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
          console.warn('[proposal-export] concept capture failed', concept.id, error)
          }
          appendLog(`Concept ${concept.name} capture failed; using palette fallback.`)
          captures.push({ id: concept.id, previewUrl: null, available: false })
        }
      }
      return captures
    },
    [appendLog, captureWithRetry]
  )

    const captureSitemap = useCallback(async () => {
    // Hide dialog overlay during capture to prevent it appearing in screenshot
    const hideDialogForCapture = () => {
      document.body.classList.add('proposal-capturing')
      const styleId = 'proposal-capture-hide-dialog'
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style')
        style.id = styleId
        style.textContent = `
          body.proposal-capturing [data-radix-dialog-overlay],
          body.proposal-capturing [role="dialog"],
          body.proposal-capturing [data-radix-dialog-content] {
            visibility: hidden !important;
            opacity: 0 !important;
          }
        `
        document.head.appendChild(style)
      }
    }

    const restoreDialogAfterCapture = () => {
      document.body.classList.remove('proposal-capturing')
      const style = document.getElementById('proposal-capture-hide-dialog')
      if (style) style.remove()
    }

    hideDialogForCapture()

    try {
      const attemptCapture = async () => {
        const canvasRoot =
          (document.querySelector('.site-builder-canvas') as HTMLElement | null) ||
          (document.querySelector('.react-flow__renderer') as HTMLElement | null) ||
          (document.querySelector('.react-flow') as HTMLElement | null) ||
          (document.querySelector('.react-flow__viewport') as HTMLElement | null)
        if (!canvasRoot) {
          appendLog('Sitemap canvas not found; skipping snapshot.')
          return null
        }
        window.dispatchEvent(new CustomEvent('run-auto-layout'))
        await new Promise((resolve) => setTimeout(resolve, 1100))
        window.dispatchEvent(new CustomEvent('sitebuilder:fit-view'))
        await new Promise((resolve) => setTimeout(resolve, 600))
        await waitForNextFrame()
        await waitForNextFrame()
        await new Promise((resolve) => setTimeout(resolve, 250))
        const bounds = canvasRoot.getBoundingClientRect()
        const baseWidth = Math.max(canvasRoot.scrollWidth, canvasRoot.clientWidth, bounds.width)
        const baseHeight = Math.max(canvasRoot.scrollHeight, canvasRoot.clientHeight, bounds.height)
        if (!baseWidth || !baseHeight) {
          appendLog('Sitemap capture aborted: zero-sized canvas.')
          return null
        }
        const longestSide = Math.max(baseWidth, baseHeight)
        const scale = Math.min(MAX_SITEMAP_CAPTURE_DIMENSION / longestSide, 1)
        const width = Math.max(1, Math.floor(baseWidth * scale))
        const height = Math.max(1, Math.floor(baseHeight * scale))
        appendLog(`Capturing sitemap snapshot (${width}x${height})…`)
        const dataUrl = await captureWithRetry(
          () =>
            toPng(canvasRoot, {
              backgroundColor: '#0B1120',
              width,
              height,
              scale
            }),
          2
        )
        return dataUrl
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        const snapshot = await attemptCapture()
        if (snapshot) {
          return snapshot
        }
        appendLog('Retrying sitemap capture…')
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[proposal-export] sitemap capture failed', error)
      }
      appendLog('Sitemap capture failed; preview will be unavailable.')
    } finally {
      restoreDialogAfterCapture()
    }
    return null
  }, [appendLog, captureWithRetry, MAX_SITEMAP_CAPTURE_DIMENSION])

  const renderPdf = useCallback(
    async (download: boolean) => {
      const target = proposalDocumentRef.current
      if (!target) {
        throw new Error('Proposal document not ready')
      }
      const extension = lastExportFormat === 'docx' ? '.docx' : '.pdf'
    const filename = slugify(formProposalTitle || websiteName || 'proposal') + extension
      const blob = await toPdf(target, {
        filename,
        metadata: {
          title: formProposalTitle || `${websiteName ?? 'Website'} Proposal`,
          subject: 'Catalyst Studio Proposal',
          author: 'Catalyst Studio',
          creator: 'Catalyst Studio',
          keywords: 'catalyst studio, proposal, site builder'
        },
        document: {
          orientation: 'portrait',
          backgroundColor: '#0B1120'
        },
        download
      })
      if (blob) {
        setLastExportBlob(blob)
      }
      return blob
    },
    [formProposalTitle, websiteName]
  )

  const startExport = useCallback(async () => {
    if (!websiteId) {
      toast.error('Missing website ID; reopen the builder from the dashboard and try again.')
      return
    }
    if (!formConceptId) {
      toast.error('Select a design concept before exporting.')
      return
    }
    try {
      setStatus('assembling')
      setLastExportBlob(null)
      setFailureStage(null)
      setLogs([])
      setCurrentStage('collect-ia')
      appendLog('Preparing export payload...')
      const startedAt = performance.now()
      emitStudioTelemetry('proposal_export_requested', {
        websiteId,
        conceptId: formConceptId,
        alternateConceptCount: includeAlternates ? Math.max(conceptOptions.length - 1, 0) : 0,
        durationMs: 0,
        failureStage: null
      })

      const response = await fetch(`/api/studio/site-builder/${websiteId}/proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptId: formConceptId,
          includeAlternates,
          proposalTitle: formProposalTitle,
          importJobId,
          tagline: formTagline
        })
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error || 'Proposal export failed to start')
      }

      setCurrentStage('summarize-brief')
      appendLog('Context assembled')
      const payload: ProposalApiResponse = await response.json()

      setDocumentState({
        websiteName: payload.context.website.name,
        proposalTitle: formProposalTitle || `${payload.context.website.name} Proposal`,
        narrative: payload.narrative,
        context: payload.context as ProposalContextSummary,
        conceptAssets: payload.assets.designConcepts.map((concept) => ({
          concept,
          previewUrl: null,
          previewAvailable: true
        })),
        sitemapPreview: null,
        capturedAt: new Date().toISOString()
      })

      setPreviewConcepts(payload.assets.designConcepts)
      setCurrentStage('generate-narrative')
      appendLog('Narrative received from OpenRouter')
      await waitForNextFrame()
      appendLog('Capturing concept previews and sitemap...')

      const [conceptCaptures, sitemapImage] = await Promise.all([
        captureConceptPreviews(payload.assets.designConcepts),
        captureSitemap()
      ])

      setDocumentState((prev) =>
        prev
          ? {
              ...prev,
              conceptAssets: prev.conceptAssets.map((asset) => {
                const capture = conceptCaptures.find((entry) => entry.id === asset.concept.id)
                return {
                  concept: asset.concept,
                  previewUrl: capture?.previewUrl ?? null,
                  previewAvailable: Boolean(capture?.available)
                }
              }),
              sitemapPreview: sitemapImage ?? prev.sitemapPreview ?? null,
              capturedAt: new Date().toISOString()
            }
          : prev
      )
      setCurrentStage('render-document')

      if (exportFormat === 'docx') {
        appendLog('Generating Word document...')
        const docxBlob = await generateProposalDocx({
          websiteName: payload.context.website.name,
          proposalTitle: formProposalTitle || `${payload.context.website.name} Proposal`,
          tagline: formTagline,
          narrative: payload.narrative,
          context: payload.context as ProposalContextSummary,
          conceptAssets: conceptCaptures.map((capture) => {
            const concept = payload.assets.designConcepts.find((c) => c.id === capture.id)
            return {
              concept: concept!,
              previewUrl: capture.previewUrl ?? undefined,
              previewAvailable: capture.available
            }
          }),
          sitemapPreview: sitemapImage ?? undefined
        })
        const filename = slugifyFilename(formProposalTitle || websiteName || 'proposal') + '.docx'
        downloadBlob(docxBlob, filename)
        setLastExportBlob(docxBlob)
        setLastExportFormat('docx')
      } else {
        appendLog('Rendering PDF')
        await waitForNextFrame()
        await renderPdf(true)
        setLastExportFormat('pdf')
      }

      setStatus('success')
      const duration = performance.now() - startedAt
      emitStudioTelemetry('proposal_export_completed', {
        websiteId: websiteId ?? payload.context.website.id,
        conceptId: payload.context.website.conceptId,
        alternateConceptCount: payload.assets.designConcepts.length - 1,
        durationMs: duration,
        failureStage: null
      })
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('[proposal-export] failed', error)
      }
      const stage = currentStage ?? 'collect-ia'
      setStatus('error')
      setFailureStage(stage)
      emitStudioTelemetry('proposal_export_failed', {
        websiteId: websiteId ?? 'unknown',
        conceptId: formConceptId,
        alternateConceptCount: includeAlternates ? Math.max(conceptOptions.length - 1, 0) : 0,
        durationMs: undefined,
        failureStage: stage
      })
      toast.error(error instanceof Error ? error.message : 'Proposal export failed')
    }
  }, [
    websiteId,
    formConceptId,
    includeAlternates,
    formProposalTitle,
    formTagline,
    conceptOptions.length,
    importJobId,
    appendLog,
    captureConceptPreviews,
    captureSitemap,
    renderPdf,
    currentStage,
    exportFormat,
    websiteName
  ])

  const handleDownloadAgain = useCallback(() => {
    if (!lastExportBlob) {
      return
    }
    const extension = lastExportFormat === 'docx' ? '.docx' : '.pdf'
    const filename = slugify(formProposalTitle || websiteName || 'proposal') + extension
    const url = URL.createObjectURL(lastExportBlob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 500)
  }, [lastExportBlob, formProposalTitle, websiteName, lastExportFormat])

  return {
    conceptOptions,
    isLoadingConcepts,
    form: {
      proposalTitle: formProposalTitle,
      setProposalTitle: setFormProposalTitle,
      tagline: formTagline,
      setTagline: setFormTagline,
      conceptId: formConceptId,
      setConceptId: setFormConceptId,
      includeAlternates,
      setIncludeAlternates
    },
    exportFormat,
    setExportFormat,
    status,
    currentStage,
    progress,
    logs,
    failureStage,
    startExport,
    previewConcepts,
    registerPreviewNode,
    registerDocumentNode,
    documentState,
    canDownloadAgain: Boolean(lastExportBlob),
    handleDownloadAgain
  }
}
