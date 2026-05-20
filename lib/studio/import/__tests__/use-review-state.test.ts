/**
 * useReviewState Hook Tests
 * 
 * Tests for the review state management hook
 */

import { renderHook, act } from '@testing-library/react'
import { useReviewState } from '../hooks/use-review-state'
import { DetectedStructure, ComponentDetection } from '../services/review-service'

const mockComponents: ComponentDetection[] = [
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
    confidence: 85,
    location: {
      page: 'https://example.com',
      selector: 'section.hero',
      index: 1
    },
    detectedProps: { heading: 'Welcome' },
    suggested_mapping: 'hero-01',
    status: 'pending'
  },
  {
    id: 'comp-3',
    type: 'features',
    confidence: 65,
    location: {
      page: 'https://example.com',
      selector: 'section.features',
      index: 2
    },
    detectedProps: { items: [] },
    suggested_mapping: 'features-grid',
    status: 'pending'
  }
]

const mockStructure: DetectedStructure = {
  pages: [],
  components: mockComponents,
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
    overall: 81.67,
    byType: {},
    byPage: {}
  }
}

describe('useReviewState', () => {
  it('should initialize with provided structure', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', mockStructure)
    )

    expect(result.current.components).toHaveLength(3)
    expect(result.current.components[0].id).toBe('comp-1')
    expect(result.current.selectedComponent).toBeNull()
  })

  it('should handle component approval', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', mockStructure)
    )

    act(() => {
      result.current.actions.approveComponent('comp-1')
    })

    const approvedComponent = result.current.components.find(c => c.id === 'comp-1')
    expect(approvedComponent?.status).toBe('approved')
  })

  it('should handle component rejection', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', mockStructure)
    )

    act(() => {
      result.current.actions.rejectComponent('comp-2')
    })

    const rejectedComponent = result.current.components.find(c => c.id === 'comp-2')
    expect(rejectedComponent?.status).toBe('rejected')
  })

  it('should handle bulk approval', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', mockStructure)
    )

    act(() => {
      result.current.actions.bulkApprove(['comp-1', 'comp-2'])
    })

    const comp1 = result.current.components.find(c => c.id === 'comp-1')
    const comp2 = result.current.components.find(c => c.id === 'comp-2')
    
    expect(comp1?.status).toBe('approved')
    expect(comp2?.status).toBe('approved')
  })

  it('should handle bulk rejection', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', mockStructure)
    )

    act(() => {
      result.current.actions.bulkReject(['comp-2', 'comp-3'])
    })

    const comp2 = result.current.components.find(c => c.id === 'comp-2')
    const comp3 = result.current.components.find(c => c.id === 'comp-3')
    
    expect(comp2?.status).toBe('rejected')
    expect(comp3?.status).toBe('rejected')
  })

  it('should update component mapping', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', mockStructure)
    )

    act(() => {
      result.current.actions.updateMapping('comp-1', 'header-minimal')
    })

    const updatedComponent = result.current.components.find(c => c.id === 'comp-1')
    expect(updatedComponent?.user_override).toBe('header-minimal')
    expect(updatedComponent?.status).toBe('modified')
  })

  it('should track change history', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', mockStructure)
    )

    act(() => {
      result.current.actions.approveComponent('comp-1')
    })

    expect(result.current.changeHistory).toHaveLength(1)
    expect(result.current.changeHistory[0].type).toBe('approve')
    expect(result.current.changeHistory[0].componentIds).toContain('comp-1')
  })

  it('should handle undo operation', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', mockStructure)
    )

    // First approve a component
    act(() => {
      result.current.actions.approveComponent('comp-1')
    })

    const approvedComponent = result.current.components.find(c => c.id === 'comp-1')
    expect(approvedComponent?.status).toBe('approved')

    // Then undo
    act(() => {
      result.current.actions.undo()
    })

    const revertedComponent = result.current.components.find(c => c.id === 'comp-1')
    expect(revertedComponent?.status).toBe('pending')
  })

  it('should handle redo operation', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', mockStructure)
    )

    // Initially, cannot undo or redo
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)

    // Approve, then undo, then redo
    act(() => {
      result.current.actions.approveComponent('comp-1')
    })

    // After an action, can undo but not redo
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)

    act(() => {
      result.current.actions.undo()
    })

    // After undo, can redo
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)

    act(() => {
      result.current.actions.redo()
    })

    // After redo, can undo again but not redo
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)

    const component = result.current.components.find(c => c.id === 'comp-1')
    expect(component?.status).toBe('approved')
  })

  it('should auto-approve similar components', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', {
        ...mockStructure,
        components: [
          ...mockComponents,
          {
            id: 'comp-4',
            type: 'header',
            confidence: 92,
            location: {
              page: 'https://example.com/about',
              selector: 'header',
              index: 0
            },
            detectedProps: { logo: '/logo.png' },
            suggested_mapping: 'header-default',
            status: 'pending'
          }
        ]
      })
    )

    // First approve the reference component
    act(() => {
      result.current.actions.approveComponent('comp-1')
    })

    // Then auto-approve similar
    act(() => {
      result.current.actions.autoApproveSimilar('comp-1', 0.9)
    })

    const similarComponent = result.current.components.find(c => c.id === 'comp-4')
    expect(similarComponent?.status).toBe('approved')
  })

  it('should update review notes', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', mockStructure)
    )

    act(() => {
      result.current.actions.updateNotes('comp-1', 'This looks good')
    })

    const component = result.current.components.find(c => c.id === 'comp-1')
    expect(component?.reviewNotes).toBe('This looks good')
  })

  it('should handle filter changes', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', mockStructure)
    )

    act(() => {
      result.current.setFilter({
        confidence: 'high',
        status: 'pending',
        type: 'header',
        searchTerm: 'test'
      })
    })

    expect(result.current.filter.confidence).toBe('high')
    expect(result.current.filter.status).toBe('pending')
    expect(result.current.filter.type).toBe('header')
    expect(result.current.filter.searchTerm).toBe('test')
  })

  it('should handle component selection', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', mockStructure)
    )

    act(() => {
      result.current.setSelectedComponent('comp-2')
    })

    expect(result.current.selectedComponent).toBe('comp-2')
  })

  it('should preserve status when updating mapping for non-pending components', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', mockStructure)
    )

    // First approve the component
    act(() => {
      result.current.actions.approveComponent('comp-1')
    })

    // Then update its mapping
    act(() => {
      result.current.actions.updateMapping('comp-1', 'header-custom')
    })

    const component = result.current.components.find(c => c.id === 'comp-1')
    expect(component?.user_override).toBe('header-custom')
    expect(component?.status).toBe('approved') // Status should remain approved
  })

  it('should limit change history properly when undoing and making new changes', () => {
    const { result } = renderHook(() => 
      useReviewState('job-123', mockStructure)
    )

    // Make several changes
    act(() => {
      result.current.actions.approveComponent('comp-1')
      result.current.actions.approveComponent('comp-2')
      result.current.actions.approveComponent('comp-3')
    })

    // Undo twice
    act(() => {
      result.current.actions.undo()
      result.current.actions.undo()
    })

    // Make a new change (should clear future history)
    act(() => {
      result.current.actions.rejectComponent('comp-1')
    })

    expect(result.current.changeHistory).toHaveLength(2) // First approval + new rejection
  })
})