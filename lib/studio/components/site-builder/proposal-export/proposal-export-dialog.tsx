'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, CheckCircle2, AlertTriangle, FileText, FileType } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useProposalExport, type ExportFormat } from './use-proposal-export'
import { ProposalDocument } from './proposal-document'
import { DesignConceptPreview } from './design-concept-preview'

interface ProposalExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  websiteId?: string | null
  websiteName?: string | null
  defaultConceptId?: string | null
  importJobId?: string | null
}

export const ProposalExportDialog: React.FC<ProposalExportDialogProps> = ({
  open,
  onOpenChange,
  websiteId,
  websiteName,
  defaultConceptId,
  importJobId
}) => {
  const {
    conceptOptions,
    isLoadingConcepts,
    form,
    exportFormat,
    setExportFormat,
    status,
    progress,
    logs,
    failureStage,
    startExport,
    previewConcepts,
    registerPreviewNode,
    registerDocumentNode,
    documentState,
    canDownloadAgain,
    handleDownloadAgain
  } = useProposalExport({
    websiteId,
    websiteName,
    defaultConceptId,
    importJobId,
    dialogOpen: open
  })

  const disableGenerate = !websiteId || !form.conceptId || status === 'assembling'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl bg-[#0B1120]/95 text-white border border-white/10">
          <DialogHeader>
            <DialogTitle>Export proposal</DialogTitle>
            <DialogDescription className="text-white/70">
              Assemble IA, content types, and concept showcases into a Catalyst-branded deck.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="proposal-title">Proposal title</Label>
                <Input
                  id="proposal-title"
                  value={form.proposalTitle}
                  onChange={(event) => form.setProposalTitle(event.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>

              <div className="space-y-2">
                <Label>Design concept</Label>
                <Select
                  value={form.conceptId ?? undefined}
                  onValueChange={(value) => form.setConceptId(value)}
                  disabled={isLoadingConcepts}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Select a concept" />
                  </SelectTrigger>
                  <SelectContent>
                    {conceptOptions.map((concept) => (
                      <SelectItem key={concept.id} value={concept.id}>
                        {concept.name}
                        {concept.isDefault ? ' · Default' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proposal-tagline">Target audience tagline</Label>
                <Input
                  id="proposal-tagline"
                  value={form.tagline}
                  onChange={(event) => form.setTagline(event.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/50">
                  Surfaces on the cover + executive summary to anchor the pitch narrative.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                <div>
                  <p className="font-medium">Include alternate concepts</p>
                  <p className="text-sm text-white/70">
                    Capture previews + palette notes for every available concept.
                  </p>
                </div>
                <Switch checked={form.includeAlternates} onCheckedChange={form.setIncludeAlternates} />
              </div>

              <div className="space-y-3">
                <Label>Export format</Label>
                <RadioGroup
                  value={exportFormat}
                  onValueChange={(value) => setExportFormat(value as ExportFormat)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pdf" id="format-pdf" />
                    <Label htmlFor="format-pdf" className="cursor-pointer flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      PDF
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="docx" id="format-docx" />
                    <Label htmlFor="format-docx" className="cursor-pointer flex items-center gap-1.5">
                      <FileType className="h-4 w-4" />
                      Word (.docx)
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-white/50">
                  {exportFormat === 'pdf' ? 'PDF is best for sharing. Cannot be edited.' : 'Word format allows editing before sending to clients.'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 p-4 space-y-3">
                <p className="text-sm tracking-[0.25em] uppercase text-white/50">Progress</p>
                <div className="space-y-2">
                  {progress.map((step) => (
                    <div key={step.key} className="flex items-center gap-2 text-sm">
                      {step.state === 'complete' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                      {step.state === 'active' && <Loader2 className="h-4 w-4 animate-spin text-white" />}
                      {step.state === 'pending' && (
                        <span className="h-2 w-2 rounded-full bg-white/30 inline-block" />
                      )}
                      <span
                        className={
                          step.state === 'pending'
                            ? 'text-white/50'
                            : step.state === 'active'
                              ? 'text-white'
                              : 'text-emerald-400'
                        }
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 p-4 h-40">
                <p className="text-sm tracking-[0.25em] uppercase text-white/50 mb-2">Log</p>
                <ScrollArea className="h-28 text-xs text-white/70">
                  <div className="space-y-1">
                    {logs.length === 0 && <p className="text-white/40">Waiting for next run…</p>}
                    {logs.map((entry) => (
                      <p key={entry}>{entry}</p>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {status === 'error' && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-white">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Export failed</AlertTitle>
                  <AlertDescription>
                    Stage {failureStage ?? 'unknown'} failed — review logs and retry.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <div className="text-xs text-white/60">
              Website ID: {websiteId ?? 'unknown'}
              {importJobId ? ` · Brief ${importJobId}` : ''}
            </div>
            <div className="flex items-center gap-2">
              {canDownloadAgain && (
                <Button type="button" variant="secondary" onClick={handleDownloadAgain}>
                  Download again
                </Button>
              )}
              <Button
                type="button"
                disabled={disableGenerate}
                onClick={startExport}
                className="bg-[#FF5500] hover:bg-[#FF5500]/90 text-white"
              >
                {status === 'assembling' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {exportFormat === 'pdf' ? 'Generate PDF' : 'Generate Word'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div
        aria-hidden
        className="pointer-events-none"
        style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}
      >
        <div
          ref={registerDocumentNode}
          className="flex flex-col items-center gap-8 rounded-[48px] bg-[#01040C] p-10"
        >
          {documentState && (
            <ProposalDocument
              {...documentState}
              conceptAssets={documentState.conceptAssets}
              sitemapPreview={documentState.sitemapPreview}
            />
          )}
        </div>
        <div className="mt-8 flex flex-col gap-6">
          {previewConcepts.map((concept) => (
            <DesignConceptPreview
              key={concept.id}
              concept={concept}
              mode="full"
              showSampleCard
              ref={(node) => registerPreviewNode(concept.id, node)}
            />
          ))}
        </div>
      </div>
    </>
  )
}
