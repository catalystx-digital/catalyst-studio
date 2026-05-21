import {
  normalizeSandboxErrorMessage,
  sandboxErrorMessage,
} from '@/lib/studio/hooks/use-sandbox-preview'

describe('sandbox preview error helpers', () => {
  it('normalizes nested sandbox API error payloads to renderable strings', () => {
    expect(
      normalizeSandboxErrorMessage({
        error: {
          message: 'Sandbox permission denied',
          code: 'forbidden',
        },
      })
    ).toBe('Sandbox permission denied')
  })

  it('uses status-specific sandbox messages before API payload details', () => {
    expect(sandboxErrorMessage(503, { error: { message: 'Raw provider detail' } })).toBe(
      'Vercel Sandbox is selected, but Sandbox credentials are not configured.'
    )
  })

  it('falls back when the API payload has no useful message', () => {
    expect(normalizeSandboxErrorMessage({ error: { code: 'unknown' } }, 'Sandbox failed')).toBe(
      'Sandbox failed'
    )
  })
})
