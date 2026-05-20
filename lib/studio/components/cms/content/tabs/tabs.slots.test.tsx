import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TabsServer } from './tabs.server'

describe('Tabs Adapter - slots coercion', () => {
  it('renders from areas.items children when present', async () => {
    const props = {
      content: {
        heading: 'Tabs',
        areas: {
          items: [
            { id: 't1', type: 'tab-item', category: 'content', content: { label: 'Tab A', content: 'Alpha' } },
            { id: 't2', type: 'tab-item', category: 'content', content: { label: 'Tab B', content: 'Beta' } }
          ]
        }
      }
    } as any
    render(<TabsServer {...props} />)
    expect(await screen.findByText('Tab A')).toBeInTheDocument()
    expect(screen.getByText('Tab B')).toBeInTheDocument()
  })

  it('falls back to legacy tabs when areas missing', async () => {
    const props = {
      content: {
        heading: 'Tabs',
        tabs: [
          { id: 'x', label: 'X', content: 'X1' },
          { id: 'y', label: 'Y', content: 'Y1' }
        ]
      }
    } as any
    render(<TabsServer {...props} />)
    expect(await screen.findByText('X')).toBeInTheDocument()
    expect(screen.getByText('Y')).toBeInTheDocument()
  })
})
