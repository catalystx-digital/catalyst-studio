import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AccordionServer } from './accordion.server'

describe('Accordion Adapter - slots coercion', () => {
  it('renders from areas.items children when present', async () => {
    const props = {
      content: {
        heading: 'FAQ',
        areas: {
          items: [
            { id: 'i1', type: 'accordion-item', category: 'content', content: { title: 'A', content: 'A1' } },
            { id: 'i2', type: 'accordion-item', category: 'content', content: { title: 'B', content: 'B1' } }
          ]
        }
      }
    } as any
    render(<AccordionServer {...props} />)
    expect(await screen.findByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('falls back to legacy items when areas missing', async () => {
    const props = {
      content: {
        heading: 'FAQ',
        items: [
          { id: 'l1', title: 'L1', content: 'LC1' },
          { id: 'l2', title: 'L2', content: 'LC2' }
        ]
      }
    } as any
    render(<AccordionServer {...props} />)
    expect(await screen.findByText('L1')).toBeInTheDocument()
    expect(screen.getByText('L2')).toBeInTheDocument()
  })
})
