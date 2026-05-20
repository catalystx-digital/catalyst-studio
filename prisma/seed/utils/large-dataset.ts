import { PrismaClient } from '../../../lib/generated/prisma'
import { performance } from 'perf_hooks'

export interface DatasetGeneratorOptions {
  websiteId: string
  itemCount: number
  includeComponents?: boolean
  includeAnalytics?: boolean
  batchSize?: number
}

export interface PerformanceMetrics {
  itemCount: number
  executionTime: number
  memoryUsed: number
  itemsPerSecond: number
  averageItemTime: number
}

/**
 * Generates large datasets for performance testing
 * Supports datasets from 100 to 5000+ items
 */
export class LargeDatasetGenerator {
  private prisma: PrismaClient
  private metrics: PerformanceMetrics[] = []

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Generate a large dataset with specified item count
   */
  async generateLargeDataset(options: DatasetGeneratorOptions): Promise<PerformanceMetrics> {
    const {
      websiteId,
      itemCount,
      includeComponents = true,
      includeAnalytics = false,
      batchSize = 100
    } = options

    console.log(`🏗️  Generating dataset with ${itemCount} items...`)
    
    const startTime = performance.now()
    const startMemory = process.memoryUsage().heapUsed

    // Create content types for the dataset
    const contentTypes = await this.createContentTypes(websiteId, Math.min(10, Math.ceil(itemCount / 100)))
    
    // Generate items in batches to manage memory
    const batches = Math.ceil(itemCount / batchSize)
    let totalItemsCreated = 0

    for (let batch = 0; batch < batches; batch++) {
      const batchStart = batch * batchSize
      const batchEnd = Math.min(batchStart + batchSize, itemCount)
      const batchItemCount = batchEnd - batchStart

      console.log(`  Processing batch ${batch + 1}/${batches} (items ${batchStart + 1}-${batchEnd})`)
      
      // Generate content items for this batch
      const items = await this.generateContentItemBatch(
        websiteId,
        contentTypes,
        batchItemCount,
        batchStart
      )
      
      totalItemsCreated += items.length

      // Generate components if requested
      if (includeComponents && batch % 2 === 0) { // Add components to every other batch
        await this.generateComponentsForItems(websiteId, items.slice(0, Math.min(10, items.length)))
      }

      // Generate analytics if requested
      if (includeAnalytics && batch % 3 === 0) { // Add analytics to every third batch
        await this.generateAnalyticsData(items.slice(0, Math.min(5, items.length)))
      }

      // Brief pause between batches to prevent memory issues
      if (batch < batches - 1) {
        await this.sleep(100)
      }
    }

    const endTime = performance.now()
    const endMemory = process.memoryUsage().heapUsed
    
    const metrics: PerformanceMetrics = {
      itemCount: totalItemsCreated,
      executionTime: endTime - startTime,
      memoryUsed: (endMemory - startMemory) / (1024 * 1024), // Convert to MB
      itemsPerSecond: totalItemsCreated / ((endTime - startTime) / 1000),
      averageItemTime: (endTime - startTime) / totalItemsCreated
    }

    this.metrics.push(metrics)
    
    console.log(`✅ Dataset generation complete:`)
    console.log(`   • Items created: ${metrics.itemCount}`)
    console.log(`   • Time taken: ${(metrics.executionTime / 1000).toFixed(2)}s`)
    console.log(`   • Memory used: ${metrics.memoryUsed.toFixed(2)}MB`)
    console.log(`   • Throughput: ${metrics.itemsPerSecond.toFixed(2)} items/second`)
    
    return metrics
  }

  /**
   * Create content types for the large dataset
   */
  private async createContentTypes(websiteId: string, count: number) {
    const contentTypes = []
    
    for (let i = 0; i < count; i++) {
      const contentType = await this.prisma.contentType.create({
        data: {
          key: `large_dataset_type_${i}`,
          name: `Dataset Type ${i}`,
          pluralName: `Dataset Type ${i}s`,
          category: i % 3 === 0 ? 'page' : i % 3 === 1 ? 'component' : 'folder',
          displayField: 'title',
          fields: this.generateFieldDefinitions(i),
          websiteId
        }
      })
      contentTypes.push(contentType)
    }
    
    return contentTypes
  }

  /**
   * Generate a batch of content items
   */
  private async generateContentItemBatch(
    websiteId: string,
    contentTypes: any[],
    batchSize: number,
    offset: number
  ) {
    const items = []
    
    for (let i = 0; i < batchSize; i++) {
      const itemIndex = offset + i
      const contentType = contentTypes[itemIndex % contentTypes.length]
      
      const item = await this.prisma.websitePage.create({
        data: {
          contentTypeId: contentType.id,
          websiteId,
          type: "page",
          title: `Large Dataset Item ${itemIndex}`,
          status: itemIndex % 3 === 0 ? 'published' : itemIndex % 3 === 1 ? 'draft' : 'archived',
          content: this.generateLargeContent(itemIndex),
          metadata: {
            batchIndex: Math.floor(itemIndex / 100),
            itemIndex,
            generated: new Date().toISOString(),
            performanceTest: true
          },
          publishedAt: itemIndex % 3 === 0 ? new Date() : null
        }
      })
      items.push(item)
    }
    
    return items
  }

  /**
   * Generate components for items
   */
  private async generateComponentsForItems(websiteId: string, items: any[]) {
    for (const item of items) {
      await this.prisma.websiteComponentType.create({
        data: {
          type: `dataset-component-${item.id}`,
          category: 'performance-test',
          version: '1.0.0',
          defaultConfig: {
            itemId: item.id,
            testData: true
          },
          placeholderData: {
            title: `Component for ${item.title}`,
            data: this.generateTestData(100) // 100 data points
          },
          aiMetadata: {
            detectionPatterns: ['performance', 'test'],
            confidence: Math.random()
          },
          confidence: Math.random(),
          websiteId,
          createdBy: 'dataset-generator'
        }
      })
    }
  }

  /**
   * Generate analytics data for items
   */
  private async generateAnalyticsData(items: any[]) {
    for (const item of items) {
      for (let day = 0; day < 7; day++) {
        const date = new Date()
        date.setDate(date.getDate() - day)
        
        // Note: Using a mock component ID since ComponentAnalytics requires it
        await this.prisma.componentAnalytics.create({
          data: {
            componentId: `mock-component-${item.id}`,
            componentType: 'performance-test',
            renderCount: Math.floor(Math.random() * 10000),
            avgRenderTime: Math.random() * 100,
            errorCount: Math.floor(Math.random() * 10),
            impressions: Math.floor(Math.random() * 50000),
            interactions: Math.floor(Math.random() * 5000),
            conversionRate: Math.random(),
            mobileViews: Math.floor(Math.random() * 20000),
            tabletViews: Math.floor(Math.random() * 10000),
            desktopViews: Math.floor(Math.random() * 25000),
            date
          }
        })
      }
    }
  }

  /**
   * Generate field definitions for content types
   */
  private generateFieldDefinitions(index: number) {
    const fields = [
      { name: 'title', type: 'text', required: true, label: 'Title' },
      { name: 'slug', type: 'text', required: true, label: 'Slug' },
      { name: 'description', type: 'textarea', required: false, label: 'Description' },
      { name: 'content', type: 'richtext', required: false, label: 'Content' }
    ]
    
    // Add more fields based on index to create variety
    if (index % 2 === 0) {
      fields.push(
        { name: 'image', type: 'media', required: false, label: 'Image' },
        { name: 'gallery', type: 'array', required: false, label: 'Gallery' }
      )
    }
    
    if (index % 3 === 0) {
      fields.push(
        { name: 'price', type: 'number', required: false, label: 'Price' },
        { name: 'quantity', type: 'number', required: false, label: 'Quantity' }
      )
    }
    
    if (index % 5 === 0) {
      fields.push(
        { name: 'metadata', type: 'object', required: false, label: 'Metadata' },
        { name: 'tags', type: 'array', required: false, label: 'Tags' }
      )
    }
    
    return fields
  }

  /**
   * Generate large content object
   */
  private generateLargeContent(index: number) {
    return {
      title: `Large Dataset Item ${index}`,
      description: this.generateLoremIpsum(100),
      content: this.generateLoremIpsum(500),
      metadata: {
        index,
        timestamp: Date.now(),
        random: Math.random()
      },
      tags: this.generateTags(10),
      data: this.generateTestData(50),
      nested: {
        level1: {
          level2: {
            level3: {
              value: `Deep nested value ${index}`
            }
          }
        }
      }
    }
  }

  /**
   * Generate Lorem Ipsum text
   */
  private generateLoremIpsum(wordCount: number): string {
    const words = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 
                  'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor',
                  'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 
                  'aliqua', 'enim', 'ad', 'minim', 'veniam']
    
    const text = []
    for (let i = 0; i < wordCount; i++) {
      text.push(words[Math.floor(Math.random() * words.length)])
    }
    return text.join(' ')
  }

  /**
   * Generate test tags
   */
  private generateTags(count: number): string[] {
    const tags = []
    for (let i = 0; i < count; i++) {
      tags.push(`tag-${Math.floor(Math.random() * 100)}`)
    }
    return tags
  }

  /**
   * Generate test data array
   */
  private generateTestData(count: number): any[] {
    const data = []
    for (let i = 0; i < count; i++) {
      data.push({
        id: i,
        value: Math.random(),
        label: `Item ${i}`,
        active: i % 2 === 0
      })
    }
    return data
  }

  /**
   * Sleep utility for batch processing
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): string {
    if (this.metrics.length === 0) {
      return 'No performance data available'
    }
    
    let report = '# Performance Report\n\n'
    report += '| Dataset Size | Time (s) | Memory (MB) | Items/sec | Avg Item Time (ms) |\n'
    report += '|--------------|----------|-------------|-----------|--------------------|\n'
    
    for (const metric of this.metrics) {
      report += `| ${metric.itemCount} | ${(metric.executionTime / 1000).toFixed(2)} | `
      report += `${metric.memoryUsed.toFixed(2)} | ${metric.itemsPerSecond.toFixed(2)} | `
      report += `${metric.averageItemTime.toFixed(2)} |\n`
    }
    
    return report
  }
}

/**
 * Run performance benchmarks
 */
export async function runPerformanceBenchmarks(
  prisma: PrismaClient,
  websiteId: string
): Promise<string> {
  const generator = new LargeDatasetGenerator(prisma)
  const testSizes = [100, 500, 1000]
  
  console.log('🚀 Starting performance benchmarks...\n')
  
  for (const size of testSizes) {
    console.log(`\n📊 Testing with ${size} items:`)
    console.log('='.repeat(50))
    
    await generator.generateLargeDataset({
      websiteId,
      itemCount: size,
      includeComponents: size <= 500, // Only include components for smaller sets
      includeAnalytics: size <= 200, // Only include analytics for smallest set
      batchSize: Math.min(100, size)
    })
    
    // Clean up between tests to ensure consistent conditions
    if (size < testSizes[testSizes.length - 1]) {
      console.log('\n🧹 Cleaning up for next test...')
      await cleanupTestData(prisma, websiteId)
    }
  }
  
  return generator.getPerformanceReport()
}

/**
 * Clean up test data
 */
async function cleanupTestData(prisma: PrismaClient, websiteId: string): Promise<void> {
  // Delete performance test data
  await prisma.websitePage.deleteMany({
    where: {
      websiteId,
      type: "page",
      title: {
        startsWith: 'Large Dataset Item'
      }
    }
  })
  
  await prisma.contentType.deleteMany({
    where: {
      websiteId,
      key: {
        startsWith: 'large_dataset_type_'
      }
    }
  })
  
  await prisma.websiteComponentType.deleteMany({
    where: {
      websiteId,
      category: 'performance-test'
    }
  })
}