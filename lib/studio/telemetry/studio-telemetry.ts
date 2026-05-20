export type ProposalExportTelemetryPayload = {
  websiteId: string
  conceptId?: string | null
  alternateConceptCount: number
  durationMs?: number
  failureStage?: string | null
}

export type StudioTelemetryEventMap = {
  proposal_export_requested: ProposalExportTelemetryPayload
  proposal_export_failed: ProposalExportTelemetryPayload
  proposal_export_completed: ProposalExportTelemetryPayload
}

type StudioTelemetryEventName = keyof StudioTelemetryEventMap

export function emitStudioTelemetry<E extends StudioTelemetryEventName>(
  event: E,
  payload: StudioTelemetryEventMap[E]
): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('studio-telemetry', {
        detail: {
          event,
          payload,
          timestamp: Date.now()
        }
      })
    )
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[studio-telemetry] ${event}`, payload)
  }
}
