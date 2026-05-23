import React from 'react'
import { z } from 'zod'
import { CMSComponentFactory } from '../factory'
import { ComponentCategory, ComponentType } from '../../_core/types'
import { initializeCMSComponents } from '../initialize'

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

  it('does not cache fallback components after a failed load', async () => {
    ;(factory as unknown as { initializationPromise: Promise<void> | null }).initializationPromise =
      Promise.reject(new Error('initialization failed'))

    const fallback = await factory.loadComponent(testType)

    expect(typeof fallback).toBe('function')
    expect(factory.getComponent(testType)).toBeUndefined()
    expect(factory.getCacheStats().cachedCount).toBe(0)
  })

  it('can load a later successful registration after an earlier failure', async () => {
    ;(factory as unknown as { initializationPromise: Promise<void> | null }).initializationPromise =
      Promise.reject(new Error('initialization failed'))

    await factory.loadComponent(testType)
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
})
