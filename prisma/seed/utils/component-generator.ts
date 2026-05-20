import { PrismaClient } from '../../../lib/generated/prisma'

export interface ComponentGeneratorOptions {
  websiteId: string
  depth: number
  componentType?: string
  includeCircularRefs?: boolean
  confidence?: number
}

export interface GeneratedComponent {
  type: string
  category: string
  props: Record<string, any>
  content: Record<string, any>
  aiMetadata: Record<string, any>
  confidence: number
  depth: number
  children?: GeneratedComponent[]
}

/**
 * Generates deeply nested component structures for testing
 * Supports up to 25 levels of nesting for stress testing
 */
export class ComponentGenerator {
  private prisma: PrismaClient
  private componentCounter = 0
  private generatedComponents: Map<string, GeneratedComponent> = new Map()

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Generate a nested component structure
   */
  generateNestedComponent(
    depth: number,
    currentLevel = 0,
    parentId?: string
  ): GeneratedComponent {
    const componentId = `nested-component-${this.componentCounter++}-L${currentLevel}`
    
    const component: GeneratedComponent = {
      type: this.getComponentType(currentLevel),
      category: this.getComponentCategory(currentLevel),
      props: this.generateProps(currentLevel),
      content: {},
      aiMetadata: this.generateAIMetadata(currentLevel),
      confidence: this.calculateConfidence(currentLevel),
      depth: currentLevel
    }

    // Add nested children if not at max depth
    if (currentLevel < depth) {
      // Optimize for MVP: reduce children at deeper levels to prevent exponential growth
      let childCount = 1 // Default to 1 child for linear chain
      if (currentLevel < 3) {
        childCount = 2 // Only first few levels get multiple children
      } else if (currentLevel >= 8) {
        childCount = 1 // Deep levels always single child
      }
      
      component.children = []
      
      for (let i = 0; i < childCount; i++) {
        const child = this.generateNestedComponent(depth, currentLevel + 1, componentId)
        component.children.push(child)
      }

      // Add children to content
      component.content.nestedComponents = component.children
    }

    // Add level-specific content
    component.content = {
      ...component.content,
      title: `Component Level ${currentLevel}`,
      description: `This component is nested ${currentLevel} levels deep`,
      levelInfo: {
        current: currentLevel,
        maxDepth: depth,
        parentId: parentId || null,
        componentId
      }
    }

    this.generatedComponents.set(componentId, component)
    return component
  }

  /**
   * Generate a circular reference component structure
   */
  generateCircularReference(): GeneratedComponent[] {
    const components: GeneratedComponent[] = []
    
    // Create Component A
    const componentA: GeneratedComponent = {
      type: 'circular-container-a',
      category: 'test-circular',
      props: { id: 'circular-a', circular: true },
      content: {
        title: 'Circular Component A',
        description: 'References Component B which references back to A'
      },
      aiMetadata: {
        detectionPatterns: ['circular', 'recursive'],
        isCircular: true
      },
      confidence: 0.75,
      depth: 0
    }

    // Create Component B
    const componentB: GeneratedComponent = {
      type: 'circular-container-b',
      category: 'test-circular',
      props: { id: 'circular-b', circular: true },
      content: {
        title: 'Circular Component B',
        description: 'References Component A creating a circular dependency'
      },
      aiMetadata: {
        detectionPatterns: ['circular', 'recursive'],
        isCircular: true
      },
      confidence: 0.75,
      depth: 0
    }

    // Create circular references
    componentA.content.referencedComponent = componentB
    componentB.content.referencedComponent = componentA

    components.push(componentA, componentB)
    return components
  }

  /**
   * Generate a cross-referenced component network
   */
  generateCrossReferencedNetwork(nodeCount: number = 5): GeneratedComponent[] {
    const components: GeneratedComponent[] = []
    
    // Create network nodes
    for (let i = 0; i < nodeCount; i++) {
      const component: GeneratedComponent = {
        type: `network-node-${i}`,
        category: 'test-network',
        props: {
          nodeId: i,
          networkSize: nodeCount
        },
        content: {
          title: `Network Node ${i}`,
          connections: []
        },
        aiMetadata: {
          detectionPatterns: ['network', 'cross-reference'],
          nodePosition: i
        },
        confidence: 0.85,
        depth: 0
      }
      components.push(component)
    }

    // Create cross-references (each node references 2-3 others)
    components.forEach((component, index) => {
      const connectionCount = 2 + Math.floor(Math.random() * 2)
      const connections = new Set<number>()
      
      while (connections.size < connectionCount) {
        const targetIndex = Math.floor(Math.random() * nodeCount)
        if (targetIndex !== index) {
          connections.add(targetIndex)
        }
      }

      component.content.connections = Array.from(connections).map(i => ({
        targetNode: components[i].type,
        relationshipType: ['parent', 'child', 'sibling', 'reference'][Math.floor(Math.random() * 4)]
      }))
    })

    return components
  }

  /**
   * Generate a recursive component (component containing same type)
   */
  generateRecursiveComponent(maxRecursion: number = 5): GeneratedComponent {
    const generateRecursive = (level: number): GeneratedComponent => {
      const component: GeneratedComponent = {
        type: 'recursive-container',
        category: 'test-recursive',
        props: {
          recursionLevel: level,
          maxRecursion
        },
        content: {
          title: `Recursive Level ${level}`,
          currentLevel: level
        },
        aiMetadata: {
          detectionPatterns: ['recursive', 'self-referencing'],
          recursionDepth: level
        },
        confidence: 0.8,
        depth: level
      }

      if (level < maxRecursion) {
        component.content.childContainer = generateRecursive(level + 1)
      }

      return component
    }

    return generateRecursive(0)
  }

  /**
   * Save generated components to database
   */
  async saveToDatabase(
    components: GeneratedComponent | GeneratedComponent[],
    websiteId: string
  ): Promise<void> {
    const componentsArray = Array.isArray(components) ? components : [components]
    
    for (const component of componentsArray) {
      await this.saveComponentRecursive(component, websiteId)
    }
  }

  private async saveComponentRecursive(
    component: GeneratedComponent,
    websiteId: string,
    parentId?: string
  ): Promise<string> {
    // Save the component
    const saved = await this.prisma.websiteComponentType.create({
      data: {
        type: component.type,
        category: component.category,
        version: '1.0.0',
        defaultConfig: component.props,
        placeholderData: component.content,
        aiMetadata: component.aiMetadata,
        confidence: component.confidence,
        websiteId,
        createdBy: 'component-generator'
      }
    })

    // Save children recursively
    if (component.children) {
      for (const child of component.children) {
        await this.saveComponentRecursive(child, websiteId, saved.id)
      }
    }

    return saved.id
  }

  // Helper methods
  private getComponentType(level: number): string {
    const types = ['container', 'section', 'card', 'list', 'item', 'text', 'button', 'image']
    return types[level % types.length]
  }

  private getComponentCategory(level: number): string {
    const categories = ['layout', 'content', 'navigation', 'forms', 'media']
    return categories[level % categories.length]
  }

  private generateProps(level: number): Record<string, any> {
    return {
      className: `level-${level}`,
      style: {
        padding: `${level * 4}px`,
        margin: `${level * 2}px`
      },
      testProp: `test-value-${level}`,
      isNested: level > 0,
      visibility: level % 2 === 0 ? 'visible' : 'hidden'
    }
  }

  private generateAIMetadata(level: number): Record<string, any> {
    return {
      detectionPatterns: [`level-${level}`, 'nested', 'test'],
      keywords: [`depth-${level}`, 'nested-component'],
      semanticType: 'nested-structure',
      nestingLevel: level,
      confidence: this.calculateConfidence(level)
    }
  }

  private calculateConfidence(level: number): number {
    // Confidence decreases with depth
    return Math.max(0.5, 1 - (level * 0.03))
  }

  /**
   * Generate memory stress test components
   */
  generateMemoryStressComponents(count: number = 100): GeneratedComponent[] {
    const components: GeneratedComponent[] = []
    
    for (let i = 0; i < count; i++) {
      components.push({
        type: `stress-component-${i}`,
        category: 'stress-test',
        props: {
          largeArray: new Array(100).fill(`item-${i}`),
          deepObject: this.generateDeepObject(10),
          longString: 'x'.repeat(10000)
        },
        content: {
          title: `Stress Component ${i}`,
          data: new Array(50).fill(null).map((_, j) => ({
            id: `${i}-${j}`,
            value: Math.random(),
            text: `Lorem ipsum dolor sit amet ${i}-${j}`
          }))
        },
        aiMetadata: {
          detectionPatterns: ['stress', 'performance'],
          dataSize: 'large'
        },
        confidence: 0.9,
        depth: 0
      })
    }
    
    return components
  }

  private generateDeepObject(depth: number): any {
    if (depth === 0) {
      return { value: 'leaf' }
    }
    return {
      level: depth,
      child: this.generateDeepObject(depth - 1)
    }
  }
}

/**
 * Test the component generator
 */
export async function testComponentGenerator(prisma: PrismaClient): Promise<void> {
  const generator = new ComponentGenerator(prisma)
  
  console.log('Testing Component Generator...')
  
  // Test 1: Generate nested components of various depths
  const depths = [1, 5, 10, 15, 20, 25]
  for (const depth of depths) {
    const component = generator.generateNestedComponent(depth)
    console.log(`✅ Generated ${depth}-level nested component`)
  }
  
  // Test 2: Generate circular reference
  const circular = generator.generateCircularReference()
  console.log(`✅ Generated circular reference with ${circular.length} components`)
  
  // Test 3: Generate cross-referenced network
  const network = generator.generateCrossReferencedNetwork(10)
  console.log(`✅ Generated network with ${network.length} nodes`)
  
  // Test 4: Generate recursive component
  const recursive = generator.generateRecursiveComponent(5)
  console.log(`✅ Generated recursive component with 5 levels`)
  
  // Test 5: Memory stress test
  const stressComponents = generator.generateMemoryStressComponents(10)
  console.log(`✅ Generated ${stressComponents.length} stress test components`)
}