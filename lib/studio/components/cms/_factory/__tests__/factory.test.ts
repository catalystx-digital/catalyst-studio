import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import type { FallbackProps } from 'react-error-boundary'
import { z } from 'zod'
import { CMSComponentFactory } from '../factory'
import { ComponentCategory, ComponentType } from '../../_core/types'
import { initializeCMSComponents } from '../initialize'
import { renderCMSComponents } from '../renderer.server'
import { CMSBatchRenderer, CMSComponentRenderer } from '../renderer'
import { preloadComponents } from '../../_core/lazy-loader'

describe('CMSComponentFactory', () => {
  const factory = CMSComponentFactory.getInstance()
  const testType = 'factory-test-component' as ComponentType

  beforeEach(() => {
    factory.unregisterComponent(testType)
    factory.clearCache()
    ;(factory as unknown as { initializationPromise: Promise<void> | null }).initializationPromise = null
  })

  afterEach(() => {
    factory.unregisterComponent(testType)
    factory.clearCache()
    ;(factory as unknown as { initializationPromise: Promise<void> | null }).initializationPromise = null
  })

  it('rejects and does not cache components after a failed load', async () => {
    ;(factory as unknown as { initializationPromise: Promise<void> | null }).initializationPromise =
      Promise.reject(new Error('initialization failed'))

    await expect(factory.loadComponent(testType)).rejects.toThrow('initialization failed')

    expect(factory.getComponent(testType)).toBeUndefined()
    expect(factory.getCacheStats().cachedCount).toBe(0)
  })

  it('can load a later successful registration after an earlier failure', async () => {
    ;(factory as unknown as { initializationPromise: Promise<void> | null }).initializationPromise =
      Promise.reject(new Error('initialization failed'))

    await expect(factory.loadComponent(testType)).rejects.toThrow('initialization failed')
    ;(factory as unknown as { initializationPromise: Promise<void> | null }).initializationPromise = null

    const Component = () => React.createElement('div', null, 'loaded')
    factory.registerComponent(testType, Component, {
      keywords: [],
      patterns: [],
      commonNames: [],
      pageLocation: ['main'],
      confidence: 1,
      description: 'Test component',
    }, {
      schema: z.object({}),
    })

    await expect(factory.loadComponent(testType)).resolves.toBe(Component)
  })

  it('registers feature comparison under its canonical component type', async () => {
    await initializeCMSComponents()

    expect(factory.hasComponent(ComponentType.FeatureComparison)).toBe(true)
    expect(factory.getComponentMetadata(ComponentType.FeatureComparison)?.commonNames).toContain('FeatureComparison')
    expect(factory.hasComponent(ComponentType.PricingTable)).toBe(true)
  })

  it('does not register placeholder-backed subcomponents as renderable components', async () => {
    await initializeCMSComponents()

    expect(factory.hasComponent(ComponentType.SideMenu)).toBe(false)
    expect(factory.hasComponent(ComponentType.NavMenuItem)).toBe(false)
    expect(factory.hasComponent(ComponentType.PromoItem)).toBe(false)
  })

  it('rejects unknown component types instead of resolving placeholders', async () => {
    await expect(factory.loadComponent(testType)).rejects.toThrow(
      `Failed to load component ${testType}`,
    )
    expect(factory.getComponent(testType)).toBeUndefined()
  })

  it('server renderer rejects load errors instead of returning fallback or null', async () => {
    await expect(
      renderCMSComponents(
        [
          {
            id: 'missing-component',
            type: testType,
            category: ComponentCategory.Content,
            content: {},
          },
        ],
        { fallback: React.createElement('div', null, 'masked') } as any,
      ),
    ).rejects.toThrow(`Failed to load component ${testType}`)
  })

  it('client renderer reports dynamic load errors once through its ErrorBoundary', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    const onError = jest.fn()

    render(
      React.createElement(CMSComponentRenderer, {
        id: 'missing-client-component',
        type: testType,
        category: ComponentCategory.Content,
        content: {},
        onError,
        errorFallback: ({ error }: FallbackProps) =>
          React.createElement('div', { role: 'alert' }, `boundary: ${error.message}`),
      }),
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        `Failed to load component ${testType}`,
      )
    })
    expect(onError).toHaveBeenCalledTimes(1)

    consoleError.mockRestore()
  })

  it.each([
    ComponentType.MegaMenu,
    ComponentType.SideMenu,
    ComponentType.Breadcrumb,
  ])('lazy preload rejects component type %s when it has no loader', async (type) => {
    await expect(preloadComponents([type])).rejects.toThrow(
      `No loader found for component type: ${type}`,
    )
  })

  it('batch renderer surfaces preload rejections through its ErrorBoundary', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    const preloadError = new Error('preload failed')
    const preloadSpy = jest
      .spyOn(factory, 'preloadComponents')
      .mockRejectedValueOnce(preloadError)
    const Component = () => React.createElement('div', null, 'loaded')

    factory.registerComponent(testType, Component, {
      keywords: [],
      patterns: [],
      commonNames: [],
      pageLocation: ['main'],
      confidence: 1,
      description: 'Test component',
    }, {
      schema: z.object({}),
    })

    render(
      React.createElement(CMSBatchRenderer, {
        preload: true,
        components: [
          {
            id: 'preload-rejects',
            type: testType,
            category: ComponentCategory.Content,
            content: {},
          },
        ],
        errorFallback: ({ error }: FallbackProps) =>
          React.createElement('div', { role: 'alert' }, `batch: ${error.message}`),
      }),
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('batch: preload failed')
    })

    preloadSpy.mockRestore()
    consoleError.mockRestore()
  })
})
