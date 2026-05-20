import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DesignConceptSwitcher, ColorPaletteEditor } from '../page'
import type { DesignSystem } from '@/lib/studio/import/types/design-system.types'

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (value: string) => void }) => (
    <select onChange={(event) => onValueChange?.(event.target.value)} data-testid="concept-select">
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  )
}))

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (value: boolean) => void }) => (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  )
}))

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (value: boolean) => void }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  )
}))

jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}))

const baseDesignSystem: DesignSystem = {
  palette: {
    primary: [{ value: '#111111', confidence: 1, source: 'literal' }],
    secondary: [{ value: '#222222', confidence: 1, source: 'literal' }],
    accent: [{ value: '#333333', confidence: 1, source: 'literal' }],
    neutral: [{ value: '#444444', confidence: 1, source: 'literal' }],
    surface: [{ value: '#ffffff', confidence: 1, source: 'literal' }]
  },
  typography: {
    heading: [],
    body: [],
    ui: []
  },
  spacing: {
    name: 'spacing',
    values: [],
    unit: 'px',
    confidence: 1,
    source: 'literal'
  },
  radii: {
    name: 'radii',
    values: [],
    unit: 'px',
    confidence: 1,
    source: 'literal'
  },
  shadows: [],
  effects: [],
  metadata: {
    sourceUrls: [],
    capturedAt: new Date().toISOString(),
    confidence: 1,
    extractionMethod: 'deterministic',
    version: '1.0.0'
  },
  diagnostics: [],
  version: '1.0.0'
}

describe('design system concept UI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    if (typeof global.fetch === 'function') {
      try {
        (global.fetch as jest.Mock).mockReset?.()
      } catch {
        // ignore
      }
    }
  })

  it('fires onConceptChange when selecting a concept', () => {
    const onConceptChange = jest.fn()
    const onRefresh = jest.fn().mockResolvedValue(undefined)
    render(
      <DesignConceptSwitcher
        websiteId="site-1"
        concepts={[
          { id: 'concept-1', name: 'Concept 1', slug: 'concept-1', position: 0, isDefault: true, websiteId: 'site-1', createdAt: new Date(), updatedAt: new Date() } as any,
          { id: 'concept-2', name: 'Concept 2', slug: 'concept-2', position: 1, isDefault: false, websiteId: 'site-1', createdAt: new Date(), updatedAt: new Date() } as any
        ]}
        activeConceptId="concept-1"
        onConceptChange={onConceptChange}
        onRefresh={onRefresh}
      />
    )

    fireEvent.click(screen.getByText('Concept 2'))
    expect(onConceptChange).toHaveBeenCalledWith('concept-2')
  })

  it('enables shuffle button when conceptId is present', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          designSystem: baseDesignSystem,
          seed: 'seed'
        }
      })
    }) as any

    render(
      <ColorPaletteEditor
        designSystem={baseDesignSystem}
        websiteId="site-1"
        conceptId="concept-1"
        concepts={[]}
        enableConceptFeatures
      />
    )

    const button = screen.getByRole('button', { name: /Shuffle palette/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/website/site-1/design-system/concepts/concept-1/shuffle',
        expect.any(Object)
      )
    })
  })

  it('disables shuffle button when conceptId is missing', () => {
    render(
      <ColorPaletteEditor
        designSystem={baseDesignSystem}
        websiteId="site-1"
        concepts={[]}
        enableConceptFeatures
      />
    )

    const button = screen.getByRole('button', { name: /Shuffle palette/i })
    expect(button).toBeDisabled()
  })
})
