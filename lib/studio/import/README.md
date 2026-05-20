# Import Pipeline - Web-Based Detection

This directory contains the web-based website structure detection implementation for Epic 11.

## Current Implementation

The active implementation uses direct LLM analysis of webpages (no screenshots):

- Web-based analysis is the default (Playwright and screenshots removed)
- **`web-detection.ts`** - Component detection via LLMs with DetectionAPI patterns
- **`import-pipeline.ts`** - Main orchestration layer for the detection pipeline
- **`types.ts`** - Shared type definitions
- **`index.ts`** - Entry point exporting the pipeline

### Key Notes
- Faster and lower memory usage than screenshot-based approach
- Dynamic component loading from DetectionAPI (Epic 10 set)
- Design system persistence relies solely on the Playwright-based DOM probe; failures raise import errors (no legacy fallback).

### Design System Capture
- `DomProbeService` powers the design system extraction inside `ImportPipeline` and `DesignSystemService`. Capture metadata and evidence links are stored under `designSystem.metadata.domProbe` when a job succeeds.
- Evidence artifacts (capture JSON, manifest, screenshots, diffs, logs) are uploaded to shared storage at `design-system/<websiteId>/<jobId|adhoc>/<runId>/...`. Telemetry events emit the same structure via `data.probe` for dashboards.
- The import pipeline exposes `getLastDomProbeCapture()` for manual debugging of the most recent run.
- Environment flags: set `DOM_PROBE_IMPORT_ENABLED=0` to disable capture globally or `DOM_PROBE_IMPORT_WEBSITE_ALLOWLIST` to scope by website ID; both default to enabling the DOM probe for all studio imports.

## Usage

```typescript
import { importPipeline } from '@/lib/studio/import'

const result = await importPipeline.execute({
  urls: ['https://example.com'],
  // Pipe-delimited chain is supported; defaults include
  // google/gemini-3-pro-preview|google/gemini-2.5-flash|anthropic/claude-sonnet-4.5|x-ai/grok-4.1-fast|anthropic/claude-haiku-4.5|openai/gpt-4o-mini
  model: 'google/gemini-3-pro-preview'
})
```

## Testing

Run tests with:
```bash
npm test -- lib/studio/import/__tests__/
```

All import tests should pass for the web-based flow.
