import { useState, useEffect, useCallback, useRef } from 'react'
import { Node, Edge } from 'reactflow'

interface PerformanceConfig {
  enableVirtualization?: boolean
  enableCaching?: boolean
  enableProgressiveLoading?: boolean
  cacheTimeout?: number
  batchSize?: number
  debounceDelay?: number
}

interface CacheEntry {
  data: any
  timestamp: number
  key: string
}

export function useSiteBuilderPerformance(config: PerformanceConfig = {}) {
  const {
    enableVirtualization = true,
    enableCaching = true,
    enableProgressiveLoading = true,
    cacheTimeout = 60000, // 1 minute
    batchSize = 20,
    debounceDelay = 300
  } = config

  // Cache management
  const cache = useRef<Map<string, CacheEntry>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)

  // Performance metrics
  const [metrics, setMetrics] = useState({
    cacheHits: 0,
    cacheMisses: 0,
    averageLoadTime: 0,
    memoryUsage: 0
  })

  // Cache operations
  const getCached = useCallback((key: string) => {
    if (!enableCaching) return null

    const entry = cache.current.get(key)
    if (!entry) {
      setMetrics(prev => ({ ...prev, cacheMisses: prev.cacheMisses + 1 }))
      return null
    }

    const now = Date.now()
    if (now - entry.timestamp > cacheTimeout) {
      cache.current.delete(key)
      setMetrics(prev => ({ ...prev, cacheMisses: prev.cacheMisses + 1 }))
      return null
    }

    setMetrics(prev => ({ ...prev, cacheHits: prev.cacheHits + 1 }))
    return entry.data
  }, [enableCaching, cacheTimeout])

  const setCached = useCallback((key: string, data: any) => {
    if (!enableCaching) return

    cache.current.set(key, {
      key,
      data,
      timestamp: Date.now()
    })

    // Clean old cache entries
    const now = Date.now()
    cache.current.forEach((entry, k) => {
      if (now - entry.timestamp > cacheTimeout) {
        cache.current.delete(k)
      }
    })
  }, [enableCaching, cacheTimeout])

  // Progressive loading for large datasets
  const loadProgressively = useCallback(async <T,>(
    items: T[],
    processor: (batch: T[]) => Promise<void>
  ) => {
    if (!enableProgressiveLoading) {
      await processor(items)
      return
    }

    setIsLoading(true)
    setLoadProgress(0)

    const totalBatches = Math.ceil(items.length / batchSize)
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      await processor(batch)
      
      const progress = Math.round(((i + batchSize) / items.length) * 100)
      setLoadProgress(Math.min(progress, 100))
      
      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    setIsLoading(false)
    setLoadProgress(100)
  }, [enableProgressiveLoading, batchSize])

  // Debounced operations
  const debounce = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    delay: number = debounceDelay
  ) => {
    let timeoutId: NodeJS.Timeout

    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => func(...args), delay)
    }
  }, [debounceDelay])

  // Memory usage monitoring
  useEffect(() => {
    const updateMemoryUsage = () => {
      if ('memory' in performance) {
        const memInfo = (performance as any).memory
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memInfo.usedJSHeapSize / 1048576 // Convert to MB
        }))
      }
    }

    const interval = setInterval(updateMemoryUsage, 5000)
    return () => clearInterval(interval)
  }, [])

  // Optimize nodes for rendering
  const optimizeNodes = useCallback((nodes: Node[]): Node[] => {
    if (!enableVirtualization) return nodes

    // Sort nodes by position for better spatial locality
    const sortedNodes = [...nodes].sort((a, b) => {
      const distA = Math.abs(a.position.x) + Math.abs(a.position.y)
      const distB = Math.abs(b.position.x) + Math.abs(b.position.y)
      return distA - distB
    })

    // Add level of detail based on zoom
    return sortedNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        optimized: true,
        lod: 'full' // Could be 'full', 'simplified', 'minimal'
      }
    }))
  }, [enableVirtualization])

  // Optimize edges for rendering
  const optimizeEdges = useCallback((edges: Edge[], visibleNodes: Set<string>): Edge[] => {
    if (!enableVirtualization) return edges

    // Only render edges connected to visible nodes
    return edges.filter(edge => 
      visibleNodes.has(edge.source) || visibleNodes.has(edge.target)
    )
  }, [enableVirtualization])

  // Clear cache
  const clearCache = useCallback(() => {
    cache.current.clear()
    setMetrics(prev => ({
      ...prev,
      cacheHits: 0,
      cacheMisses: 0
    }))
  }, [])

  // Preload data
  const preload = useCallback(async (dataLoader: () => Promise<any>) => {
    const cacheKey = 'preload-' + dataLoader.toString()
    const cached = getCached(cacheKey)
    
    if (cached) return cached

    const startTime = performance.now()
    const data = await dataLoader()
    const loadTime = performance.now() - startTime

    setCached(cacheKey, data)
    
    setMetrics(prev => ({
      ...prev,
      averageLoadTime: (prev.averageLoadTime + loadTime) / 2
    }))

    return data
  }, [getCached, setCached])

  return {
    // Performance features
    optimizeNodes,
    optimizeEdges,
    loadProgressively,
    debounce,
    preload,
    
    // Cache management
    getCached,
    setCached,
    clearCache,
    
    // State
    isLoading,
    loadProgress,
    metrics,
    
    // Config
    config: {
      enableVirtualization,
      enableCaching,
      enableProgressiveLoading,
      cacheTimeout,
      batchSize,
      debounceDelay
    }
  }
}