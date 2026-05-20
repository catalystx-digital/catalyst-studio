'use client'

import { useState, useEffect } from 'react'
import { Node, Edge } from 'reactflow'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Brain,
  Shield,
  FileText,
  TrendingUp,
  Search,
  ShoppingCart,
  Users,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Plus,
  ArrowRight,
  Zap,
  Globe,
  Lock,
  BarChart3,
  Package,
  MessageSquare,
  Settings
} from 'lucide-react'

interface AISuggestionsEnhancedProps {
  isOpen: boolean
  onClose: () => void
  nodes: Node[]
  edges: Edge[]
  onAddNode: (node: Node) => void
  onAddSection: (nodeId: string, section: string) => void
  onOptimize: (suggestion: any) => void
}

interface Suggestion {
  id: string
  category: string
  type: 'page' | 'section' | 'optimization' | 'seo' | 'content'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
  icon: any
  action?: () => void
  details?: string[]
}

export function AISuggestionsEnhanced({
  isOpen,
  onClose,
  nodes,
  edges,
  onAddNode,
  onAddSection,
  onOptimize
}: AISuggestionsEnhancedProps) {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(true)

  // Generate suggestions based on current sitemap
  useEffect(() => {
    if (!isOpen) return

    const generateSuggestions = () => {
      const newSuggestions: Suggestion[] = []
      
      // Analyze sitemap structure
      const hasHome = nodes.some(n => n.data.label?.toLowerCase() === 'home')
      const hasAbout = nodes.some(n => n.data.label?.toLowerCase() === 'about')
      const hasContact = nodes.some(n => n.data.label?.toLowerCase() === 'contact')
      const hasPrivacy = nodes.some(n => n.data.label?.toLowerCase().includes('privacy'))
      const hasTerms = nodes.some(n => n.data.label?.toLowerCase().includes('terms'))
      const hasBlog = nodes.some(n => n.data.label?.toLowerCase().includes('blog'))
      const hasProducts = nodes.some(n => n.data.label?.toLowerCase().includes('product'))
      
      // Legal & Compliance Suggestions
      if (!hasPrivacy) {
        newSuggestions.push({
          id: 'add-privacy',
          category: 'Legal',
          type: 'page',
          title: 'Add Privacy Policy Page',
          description: 'Essential for GDPR/CCPA compliance and user trust',
          impact: 'high',
          effort: 'low',
          icon: Lock,
          details: [
            'Required for legal compliance',
            'Builds user trust',
            'Necessary for app stores',
            'SEO ranking factor'
          ]
        })
      }
      
      if (!hasTerms) {
        newSuggestions.push({
          id: 'add-terms',
          category: 'Legal',
          type: 'page',
          title: 'Add Terms of Service',
          description: 'Protect your business with clear terms',
          impact: 'high',
          effort: 'low',
          icon: Shield,
          details: [
            'Legal protection',
            'Sets user expectations',
            'Required for e-commerce',
            'Reduces disputes'
          ]
        })
      }
      
      // Content Suggestions
      if (!hasBlog) {
        newSuggestions.push({
          id: 'add-blog',
          category: 'Content',
          type: 'page',
          title: 'Create Blog Section',
          description: 'Improve SEO and engage visitors with content marketing',
          impact: 'high',
          effort: 'medium',
          icon: FileText,
          details: [
            'Boost organic traffic',
            'Establish thought leadership',
            'Improve SEO rankings',
            'Engage with audience'
          ]
        })
      }
      
      // SEO Suggestions
      const pagesWithoutSEO = nodes.filter(n => 
        n.type === 'page' && (!n.data.metadata?.seoScore || n.data.metadata.seoScore < 70)
      )
      
      if (pagesWithoutSEO.length > 0) {
        newSuggestions.push({
          id: 'improve-seo',
          category: 'SEO',
          type: 'seo',
          title: `Optimize ${pagesWithoutSEO.length} Pages for SEO`,
          description: 'Improve meta descriptions, titles, and keywords',
          impact: 'high',
          effort: 'medium',
          icon: Search,
          details: pagesWithoutSEO.map(p => `${p.data.label}: Score ${p.data.metadata?.seoScore || 0}`)
        })
      }
      
      // Structure Suggestions
      const orphanNodes = nodes.filter(n => {
        const hasParent = edges.some(e => e.target === n.id)
        const isHome = n.data.label?.toLowerCase() === 'home'
        return !hasParent && !isHome && n.type === 'page'
      })
      
      if (orphanNodes.length > 0) {
        newSuggestions.push({
          id: 'fix-orphans',
          category: 'Structure',
          type: 'optimization',
          title: `Connect ${orphanNodes.length} Orphan Pages`,
          description: 'Improve navigation by connecting disconnected pages',
          impact: 'medium',
          effort: 'low',
          icon: Zap,
          details: orphanNodes.map(n => n.data.label || 'Unnamed')
        })
      }
      
      // E-commerce Suggestions
      if (hasProducts && !nodes.some(n => n.data.label?.toLowerCase().includes('cart'))) {
        newSuggestions.push({
          id: 'add-cart',
          category: 'E-commerce',
          type: 'page',
          title: 'Add Shopping Cart',
          description: 'Essential for e-commerce functionality',
          impact: 'high',
          effort: 'medium',
          icon: ShoppingCart,
          details: [
            'Enable purchases',
            'Improve conversion',
            'Track abandoned carts',
            'Upsell opportunities'
          ]
        })
      }
      
      // Trust & Credibility
      if (!nodes.some(n => n.data.label?.toLowerCase().includes('testimonial'))) {
        newSuggestions.push({
          id: 'add-testimonials',
          category: 'Trust',
          type: 'section',
          title: 'Add Testimonials Section',
          description: 'Build trust with social proof',
          impact: 'high',
          effort: 'low',
          icon: MessageSquare,
          details: [
            'Increase conversions',
            'Build credibility',
            'Social proof',
            'User validation'
          ]
        })
      }
      
      // UX Improvements
      if (nodes.length > 15 && !nodes.some(n => n.data.label?.toLowerCase().includes('sitemap'))) {
        newSuggestions.push({
          id: 'add-sitemap-page',
          category: 'UX',
          type: 'page',
          title: 'Add HTML Sitemap',
          description: 'Improve navigation for users and search engines',
          impact: 'medium',
          effort: 'low',
          icon: Globe,
          details: [
            'Better navigation',
            'SEO benefits',
            'Accessibility',
            'User experience'
          ]
        })
      }
      
      // Performance Suggestions
      const complexPages = nodes.filter(n => 
        n.data.sections && n.data.sections.length > 10
      )
      
      if (complexPages.length > 0) {
        newSuggestions.push({
          id: 'split-complex-pages',
          category: 'UX',
          type: 'optimization',
          title: `Simplify ${complexPages.length} Complex Pages`,
          description: 'Split pages with too many sections for better UX',
          impact: 'medium',
          effort: 'high',
          icon: Settings,
          details: complexPages.map(p => `${p.data.label}: ${p.data.sections?.length} sections`)
        })
      }
      
      setSuggestions(newSuggestions)
      setIsAnalyzing(false)
    }
    
    // Simulate analysis delay
    setIsAnalyzing(true)
    setTimeout(generateSuggestions, 1500)
  }, [isOpen, nodes, edges])

  const categories = [
    { id: 'all', label: 'All', icon: Brain },
    { id: 'Legal', label: 'Legal', icon: Shield },
    { id: 'Content', label: 'Content', icon: FileText },
    { id: 'Trust', label: 'Trust', icon: Users },
    { id: 'Structure', label: 'Structure', icon: Package },
    { id: 'SEO', label: 'SEO', icon: Search },
    { id: 'E-commerce', label: 'E-commerce', icon: ShoppingCart },
    { id: 'UX', label: 'UX', icon: Globe }
  ]

  const filteredSuggestions = selectedCategory === 'all' 
    ? suggestions 
    : suggestions.filter(s => s.category === selectedCategory)

  const handleApplySuggestion = (suggestion: Suggestion) => {
    switch (suggestion.id) {
      case 'add-privacy':
        onAddNode({
          id: `privacy-${Date.now()}`,
          type: 'page',
          position: { x: 950, y: 300 },
          data: {
            label: 'Privacy Policy',
            url: '/privacy',
            sections: ['Hero', 'Privacy Policy', 'Footer'],
            metadata: { status: 'draft', pageType: 'Legal', seoScore: 75 }
          }
        })
        break
      case 'add-terms':
        onAddNode({
          id: `terms-${Date.now()}`,
          type: 'page',
          position: { x: 1100, y: 300 },
          data: {
            label: 'Terms of Service',
            url: '/terms',
            sections: ['Hero', 'Terms Content', 'Footer'],
            metadata: { status: 'draft', pageType: 'Legal', seoScore: 75 }
          }
        })
        break
      case 'add-blog':
        onAddNode({
          id: `blog-main-${Date.now()}`,
          type: 'folder',
          position: { x: 1250, y: 180 },
          data: {
            label: 'Blog',
            color: '#10B981'
          }
        })
        break
      case 'add-cart':
        onAddNode({
          id: `cart-${Date.now()}`,
          type: 'page',
          position: { x: 650, y: 450 },
          data: {
            label: 'Shopping Cart',
            url: '/cart',
            sections: ['Cart Items', 'Summary', 'Checkout CTA', 'Footer'],
            metadata: { status: 'draft', pageType: 'E-commerce', seoScore: 60 }
          }
        })
        break
      case 'add-sitemap-page':
        onAddNode({
          id: `sitemap-${Date.now()}`,
          type: 'page',
          position: { x: 1250, y: 300 },
          data: {
            label: 'Sitemap',
            url: '/sitemap',
            sections: ['Hero', 'Sitemap Links', 'Footer'],
            metadata: { status: 'draft', pageType: 'Utility', seoScore: 80 }
          }
        })
        break
      case 'add-testimonials':
        // Add to home or about page
        const targetPage = nodes.find(n => n.data.label?.toLowerCase() === 'home') || nodes[0]
        if (targetPage) {
          onAddSection(targetPage.id, 'Testimonials')
        }
        break
      default:
        onOptimize(suggestion)
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-400 bg-red-500/20'
      case 'medium': return 'text-yellow-400 bg-yellow-500/20'
      case 'low': return 'text-green-400 bg-green-500/20'
      default: return 'text-gray-400 bg-gray-500/20'
    }
  }

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'high': return 'text-purple-400 bg-purple-500/20'
      case 'medium': return 'text-blue-400 bg-blue-500/20'
      case 'low': return 'text-green-400 bg-green-500/20'
      default: return 'text-gray-400 bg-gray-500/20'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-gray-900/95 backdrop-blur-xl border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Brain className="h-5 w-5 text-purple-400" />
            AI-Powered Suggestions
          </DialogTitle>
        </DialogHeader>

        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <Brain className="h-12 w-12 text-purple-400 animate-pulse" />
              <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-purple-400 animate-spin border-t-transparent" />
            </div>
            <p className="mt-4 text-gray-400">Analyzing your sitemap structure...</p>
            <p className="mt-2 text-sm text-gray-500">Identifying opportunities for improvement</p>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {categories.map(cat => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={selectedCategory === cat.id 
                    ? "bg-purple-500 hover:bg-purple-600 border-purple-500"
                    : "bg-white/10 border-white/20 hover:bg-white/20"
                  }
                >
                  <cat.icon className="h-4 w-4 mr-2" />
                  {cat.label}
                  {cat.id !== 'all' && (
                    <Badge className="ml-2 bg-white/20">
                      {suggestions.filter(s => s.category === cat.id).length}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>

            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {filteredSuggestions.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
                    <p className="text-gray-400">No suggestions in this category</p>
                    <p className="text-sm text-gray-500 mt-2">Your sitemap is well-optimized!</p>
                  </div>
                ) : (
                  filteredSuggestions.map(suggestion => (
                    <div
                      key={suggestion.id}
                      className="border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-gray-800 rounded-lg">
                            <suggestion.icon className="h-5 w-5 text-purple-400" />
                          </div>
                          <div>
                            <h3 className="font-medium text-white mb-1">{suggestion.title}</h3>
                            <p className="text-sm text-gray-400">{suggestion.description}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={getImpactColor(suggestion.impact)}>
                            Impact: {suggestion.impact}
                          </Badge>
                          <Badge className={getEffortColor(suggestion.effort)}>
                            Effort: {suggestion.effort}
                          </Badge>
                        </div>
                      </div>

                      {suggestion.details && (
                        <div className="mt-3 pl-11">
                          <p className="text-xs text-gray-500 mb-2">Details:</p>
                          <ul className="text-sm text-gray-400 space-y-1">
                            {suggestion.details.map((detail, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-purple-400 mt-1">•</span>
                                <span>{detail}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-4 pl-11">
                        <Button
                          size="sm"
                          onClick={() => handleApplySuggestion(suggestion)}
                          className="bg-purple-500 hover:bg-purple-600 text-white"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Apply Suggestion
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  Found {suggestions.length} suggestions across {new Set(suggestions.map(s => s.category)).size} categories
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="bg-white/10 border-white/20 hover:bg-white/20"
                >
                  Close
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}