/**
 * Review Interface Component Tests
 * 
 * Tests for the main review interface component
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ReviewInterface } from '../components/review-interface'
import { DetectedStructure } from '../services/review-service'

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}))

const mockDetectedStructure: DetectedStructure = {
  pages: [
    {
      url: 'https://example.com',
      title: 'Home',
      components: ['comp-1', 'comp-2']
    }
  ],
  components: [
    {
      id: 'comp-1',
      type: 'header',
      confidence: 95,
      location: {
        page: 'https://example.com',
        selector: 'header',
        index: 0
      },
      detectedProps: { logo: '/logo.png' },
      suggested_mapping: 'header-default',
      status: 'pending'
    },
    {
      id: 'comp-2',
      type: 'hero',
      confidence: 75,
      location: {
        page: 'https://example.com',
        selector: 'section.hero',
        index: 1
      },
      detectedProps: { heading: 'Welcome' },
      suggested_mapping: 'hero-01',
      status: 'pending'
    }
  ],
  designTokens: {
    images: [],
    textPatterns: [],
    contentOrganization: [],
    componentUsage: []
  },
  navigation: {
    pages: [],
    sections: []
  },
  confidence: {
    overall: 85,
    byType: { header: 95, hero: 75 },
    byPage: { 'https://example.com': 85 }
  }
}

describe('ReviewInterface', () => {
  const mockOnSave = jest.fn()
  const mockOnCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render the review interface with components', () => {
    render(
      <ReviewInterface
        importJobId="test-job"
        detectedStructure={mockDetectedStructure}
        originalUrl="https://example.com"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('Review Imported Structure')).toBeInTheDocument()
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
    expect(screen.getByText('header')).toBeInTheDocument()
    expect(screen.getByText('hero')).toBeInTheDocument()
  })

  it('should display progress information', () => {
    render(
      <ReviewInterface
        importJobId="test-job"
        detectedStructure={mockDetectedStructure}
        originalUrl="https://example.com"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('Review Progress')).toBeInTheDocument()
    expect(screen.getByText('2 pending')).toBeInTheDocument()
    expect(screen.getByText('0 approved')).toBeInTheDocument()
  })

  it('should filter components by confidence', () => {
    render(
      <ReviewInterface
        importJobId="test-job"
        detectedStructure={mockDetectedStructure}
        originalUrl="https://example.com"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    const confidenceFilter = screen.getByText('All Confidence')
    fireEvent.click(confidenceFilter)
    
    const highOption = screen.getByText('High (90%+)')
    fireEvent.click(highOption)

    // Only header component should be visible (95% confidence)
    expect(screen.getByText('header')).toBeInTheDocument()
    expect(screen.queryByText('hero')).not.toBeInTheDocument()
  })

  it('should handle component approval', async () => {
    render(
      <ReviewInterface
        importJobId="test-job"
        detectedStructure={mockDetectedStructure}
        originalUrl="https://example.com"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    // Click on a component to select it
    const headerComponent = screen.getByText('header').closest('div[data-component-id]')
    if (headerComponent) {
      fireEvent.click(headerComponent)
    }

    // Find and click approve button
    const approveButtons = screen.getAllByRole('button', { name: /approve/i })
    const approveButton = approveButtons.find(btn => 
      btn.textContent?.toLowerCase().includes('approve') &&
      !btn.textContent?.toLowerCase().includes('all')
    )
    
    if (approveButton) {
      fireEvent.click(approveButton)
    }

    await waitFor(() => {
      expect(screen.getByText('1 approved')).toBeInTheDocument()
    })
  })

  it('should handle bulk selection', () => {
    render(
      <ReviewInterface
        importJobId="test-job"
        detectedStructure={mockDetectedStructure}
        originalUrl="https://example.com"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    // Select checkboxes for bulk operation
    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach(checkbox => fireEvent.click(checkbox))

    expect(screen.getByText('2 selected')).toBeInTheDocument()
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Reject')).toBeInTheDocument()
  })

  it('should handle save action', async () => {
    const modifiedStructure = {
      ...mockDetectedStructure,
      components: [
        { ...mockDetectedStructure.components[0], status: 'approved' as const },
        { ...mockDetectedStructure.components[1], status: 'approved' as const }
      ]
    }

    render(
      <ReviewInterface
        importJobId="test-job"
        detectedStructure={modifiedStructure}
        originalUrl="https://example.com"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    const saveButton = screen.getByRole('button', { name: /save as templates/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            type: 'header'
          }),
          expect.objectContaining({
            name: expect.any(String),
            type: 'hero'
          })
        ])
      )
    })
  })

  it('should handle cancel action', () => {
    render(
      <ReviewInterface
        importJobId="test-job"
        detectedStructure={mockDetectedStructure}
        originalUrl="https://example.com"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('should disable save button when no components are approved', () => {
    render(
      <ReviewInterface
        importJobId="test-job"
        detectedStructure={mockDetectedStructure}
        originalUrl="https://example.com"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    const saveButton = screen.getByRole('button', { name: /save as templates/i })
    expect(saveButton).toBeDisabled()
  })

  it('should search components', () => {
    render(
      <ReviewInterface
        importJobId="test-job"
        detectedStructure={mockDetectedStructure}
        originalUrl="https://example.com"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search components...')
    fireEvent.change(searchInput, { target: { value: 'header' } })

    expect(screen.getByText('header')).toBeInTheDocument()
    expect(screen.queryByText('hero')).not.toBeInTheDocument()
  })

  it('should show component details when selected', () => {
    render(
      <ReviewInterface
        importJobId="test-job"
        detectedStructure={mockDetectedStructure}
        originalUrl="https://example.com"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    // Initially show placeholder
    expect(screen.getByText('Select a component to view details')).toBeInTheDocument()

    // Click on a component
    const headerComponent = screen.getByText('header').closest('div')
    if (headerComponent) {
      fireEvent.click(headerComponent)
    }

    // Should show component details
    expect(screen.getByText('Component Details')).toBeInTheDocument()
    expect(screen.getByText('Template Mapping')).toBeInTheDocument()
  })

  it('should toggle sections', () => {
    render(
      <ReviewInterface
        importJobId="test-job"
        detectedStructure={mockDetectedStructure}
        originalUrl="https://example.com"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    const sectionToggle = screen.getByText('https://example.com').closest('button')
    if (sectionToggle) {
      // Click to collapse
      fireEvent.click(sectionToggle)
      
      // Components should be hidden
      expect(screen.queryByText('header-default')).not.toBeInTheDocument()
      
      // Click to expand
      fireEvent.click(sectionToggle)
      
      // Components should be visible again
      expect(screen.getByText('header-default')).toBeInTheDocument()
    }
  })
})