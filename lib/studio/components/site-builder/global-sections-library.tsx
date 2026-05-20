import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Package, Search, Plus, Copy, Trash2, Edit2, 
  Home, Grid, MessageSquare, Target, Layers, Image,
  Video, Mail, Globe, TrendingUp, Shield, Zap,
  Star, Lock, Unlock, FolderOpen, Save, AlertCircle
} from 'lucide-react'

export interface GlobalSection {
  id: string
  name: string
  category: string
  description: string
  icon: any
  isGlobal: boolean
  isLocked: boolean
  usageCount: number
  fields?: string[]
  preview?: string
  config?: any // Component configuration from database
}

interface GlobalSectionsLibraryProps {
  isOpen: boolean
  onClose: () => void
  onAddSection: (section: GlobalSection) => void
  currentSections?: string[]
  websiteId?: string // Added for API calls
}

const defaultGlobalSections: GlobalSection[] = [
  {
    id: 'global-header',
    name: 'Global Header',
    category: 'Navigation',
    description: 'Consistent header with logo, navigation, and CTA',
    icon: Home,
    isGlobal: true,
    isLocked: true,
    usageCount: 0,
    fields: ['Logo', 'Navigation Menu', 'CTA Button'],
    preview: 'Standard header used across all pages'
  },
  {
    id: 'global-footer',
    name: 'Global Footer',
    category: 'Navigation',
    description: 'Footer with links, social media, and copyright',
    icon: Layers,
    isGlobal: true,
    isLocked: true,
    usageCount: 0,
    fields: ['Links', 'Social Media', 'Copyright', 'Newsletter'],
    preview: 'Standard footer used across all pages'
  },
  {
    id: 'hero-section',
    name: 'Hero Section',
    category: 'Content',
    description: 'Eye-catching hero with headline and CTA',
    icon: Zap,
    isGlobal: false,
    isLocked: false,
    usageCount: 0,
    fields: ['Headline', 'Subheadline', 'CTA', 'Background Image']
  },
  {
    id: 'features-grid',
    name: 'Features Grid',
    category: 'Content',
    description: '3-column feature showcase',
    icon: Grid,
    isGlobal: false,
    isLocked: false,
    usageCount: 0,
    fields: ['Feature 1', 'Feature 2', 'Feature 3']
  },
  {
    id: 'testimonials',
    name: 'Testimonials',
    category: 'Trust',
    description: 'Customer testimonials carousel',
    icon: MessageSquare,
    isGlobal: false,
    isLocked: false,
    usageCount: 0,
    fields: ['Testimonial 1', 'Testimonial 2', 'Testimonial 3']
  },
  {
    id: 'cta-section',
    name: 'CTA Section',
    category: 'Conversion',
    description: 'Call-to-action with button',
    icon: Target,
    isGlobal: false,
    isLocked: false,
    usageCount: 0,
    fields: ['Headline', 'Description', 'Button Text', 'Button Link']
  },
  {
    id: 'newsletter',
    name: 'Newsletter Signup',
    category: 'Conversion',
    description: 'Email subscription form',
    icon: Mail,
    isGlobal: false,
    isLocked: false,
    usageCount: 0,
    fields: ['Headline', 'Description', 'Email Input', 'Submit Button']
  },
  {
    id: 'stats-counter',
    name: 'Stats Counter',
    category: 'Trust',
    description: 'Animated statistics display',
    icon: TrendingUp,
    isGlobal: false,
    isLocked: false,
    usageCount: 0,
    fields: ['Stat 1', 'Stat 2', 'Stat 3', 'Stat 4']
  },
  {
    id: 'gallery',
    name: 'Image Gallery',
    category: 'Media',
    description: 'Responsive image grid',
    icon: Image,
    isGlobal: false,
    isLocked: false,
    usageCount: 0,
    fields: ['Images', 'Captions', 'Lightbox']
  },
  {
    id: 'video-section',
    name: 'Video Section',
    category: 'Media',
    description: 'Embedded video player',
    icon: Video,
    isGlobal: false,
    isLocked: false,
    usageCount: 0,
    fields: ['Video URL', 'Thumbnail', 'Play Button']
  }
]

export function GlobalSectionsLibrary({ 
  isOpen, 
  onClose, 
  onAddSection,
  currentSections = [],
  websiteId
}: GlobalSectionsLibraryProps) {
  const [sections, setSections] = useState<GlobalSection[]>(defaultGlobalSections)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [editingSection, setEditingSection] = useState<GlobalSection | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load global components from API
  const loadGlobalComponents = useCallback(async () => {
    if (!websiteId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/studio/site-builder/global-components?websiteId=${websiteId}`)
      
      if (!response.ok) {
        throw new Error('Failed to load global components')
      }
      
      const data = await response.json()
      
      if (data.success) {
        // Convert database components to GlobalSection format
        const items: any[] = Array.isArray(data.data) ? data.data : (Array.isArray(data.components) ? data.components : [])
        const globalSections = items.map((component: any) => {
          const type = component.type || 'shared'
          const properties = component.properties || {}
          return {
            id: component.id,
            name: component.name,
            category: getCategoryFromConfig({ type }) || 'shared',
            description: 'Global component',
            icon: getIconFromType(type) || Package,
            isGlobal: true,
            isLocked: false,
            usageCount: component.usageCount || 0,
            // Provide a config-like shape for compatibility
            config: { props: properties, type },
            fields: Object.keys(properties).slice(0, 4)
          } as GlobalSection
        })
        
        // Combine with default sections (only non-global ones for demo)
        const demoSections = defaultGlobalSections.filter(s => !s.isGlobal)
        setSections([...globalSections, ...demoSections])
      } else {
        throw new Error(data.error || 'Failed to load global components')
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error loading global components:', error)
      }
      setError(error instanceof Error ? error.message : 'Failed to load global components')
      // Fallback to default sections only
      setSections(defaultGlobalSections)
    } finally {
      setIsLoading(false)
    }
  }, [websiteId])

  useEffect(() => {
    if (isOpen && websiteId) {
      loadGlobalComponents()
    }
  }, [isOpen, websiteId, loadGlobalComponents])

  // Helper functions to extract info from component config
  const getCategoryFromConfig = (config: any): string => {
    if (!config) return 'shared'
    if (config.type?.toLowerCase().includes('header')) return 'Navigation'
    if (config.type?.toLowerCase().includes('footer')) return 'Navigation'
    if (config.type?.toLowerCase().includes('nav')) return 'Navigation'
    if (config.type?.toLowerCase().includes('hero')) return 'Content'
    if (config.type?.toLowerCase().includes('cta')) return 'Conversion'
    return 'shared'
  }

  const getDescriptionFromConfig = (config: any): string => {
    return config?.metadata?.description || config?.description || 'Reusable global component'
  }

  const getIconFromType = (type: string): any => {
    if (!type) return Package
    const lowerType = type.toLowerCase()
    if (lowerType.includes('header') || lowerType.includes('hero')) return Home
    if (lowerType.includes('footer')) return Layers
    if (lowerType.includes('nav')) return Globe
    if (lowerType.includes('cta')) return Target
    if (lowerType.includes('feature')) return Grid
    if (lowerType.includes('testimonial')) return MessageSquare
    return Package
  }

  const extractFieldsFromConfig = (config: any): string[] => {
    if (!config?.props) return []
    return Object.keys(config.props).slice(0, 4) // Show up to 4 fields
  }

  // Save custom sections to localStorage
  const saveSections = (updatedSections: GlobalSection[]) => {
    const customSections = updatedSections.filter(s => !defaultGlobalSections.some(d => d.id === s.id))
    localStorage.setItem('globalSections', JSON.stringify(customSections))
    setSections(updatedSections)
  }

  const categories = [
    { id: 'all', label: 'All Sections' },
    { id: 'Navigation', label: 'Navigation' },
    { id: 'Content', label: 'Content' },
    { id: 'Trust', label: 'Trust' },
    { id: 'Conversion', label: 'Conversion' },
    { id: 'Media', label: 'Media' },
    { id: 'Custom', label: 'Custom' }
  ]

  const filteredSections = sections.filter(section => {
    const matchesSearch = section.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          section.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || section.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleCreateSection = () => {
    const newSection: GlobalSection = {
      id: `custom-${Date.now()}`,
      name: 'New Custom Section',
      category: 'Custom',
      description: 'Custom section description',
      icon: Package,
      isGlobal: false,
      isLocked: false,
      usageCount: 0,
      fields: []
    }
    setEditingSection(newSection)
    setCreatingNew(true)
  }

  const handleSaveSection = (section: GlobalSection) => {
    if (creatingNew) {
      saveSections([...sections, section])
    } else {
      saveSections(sections.map(s => s.id === section.id ? section : s))
    }
    setEditingSection(null)
    setCreatingNew(false)
  }

  const handleDeleteSection = (sectionId: string) => {
    saveSections(sections.filter(s => s.id !== sectionId))
  }

  const handleToggleGlobal = (sectionId: string) => {
    saveSections(sections.map(s => 
      s.id === sectionId ? { ...s, isGlobal: !s.isGlobal } : s
    ))
  }

  const handleAddToPage = (section: GlobalSection) => {
    // Update usage count
    saveSections(sections.map(s => 
      s.id === section.id ? { ...s, usageCount: s.usageCount + 1 } : s
    ))
    onAddSection(section)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-gray-900/95 backdrop-blur-xl border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-[#FF5500]" />
            Shared Components Library
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Reusable components shared across multiple pages
          </DialogDescription>
        </DialogHeader>

        {/* Search and Actions */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sections..."
              className="pl-10 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <Button
            onClick={handleCreateSection}
            className="bg-gradient-to-r from-[#FF5500] to-[#FF6600] hover:from-[#FF6600] hover:to-[#FF7700]"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Custom
          </Button>
        </div>

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
          <TabsList className="grid grid-cols-7 bg-gray-800">
            {categories.map(cat => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="data-[state=active]:bg-gray-700 text-xs"
              >
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory} className="space-y-3 mt-4 max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="text-center text-gray-500 py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5500] mx-auto mb-2"></div>
                Loading global components...
              </div>
            ) : error ? (
              <div className="text-center text-red-400 py-8">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p className="mb-2">{error}</p>
                <Button 
                  onClick={loadGlobalComponents}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 hover:bg-white/20"
                >
                  Retry
                </Button>
              </div>
            ) : filteredSections.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No sections found. Try adjusting your search or create a new one.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredSections.map(section => {
                  const Icon = section.icon
                  const isUsed = currentSections.includes(section.name)
                  
                  return (
                    <div
                      key={section.id}
                      className={`p-4 rounded-lg border transition-all ${
                        isUsed 
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded bg-white/10">
                            <Icon className="h-4 w-4 text-[#FF5500]" />
                          </div>
                          <div>
                            <h4 className="font-medium text-sm flex items-center gap-2">
                              {section.name}
                              {section.isGlobal && (
                                <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                                  Global
                                </span>
                              )}
                              {section.isLocked && (
                                <Lock className="h-3 w-3 text-gray-400" />
                              )}
                            </h4>
                            <p className="text-xs text-gray-500">{section.category}</p>
                          </div>
                        </div>
                        
                        {!section.isLocked && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingSection(section)}
                              className="p-1 hover:bg-gray-700 rounded"
                              title="Edit"
                            >
                              <Edit2 className="h-3 w-3 text-gray-400" />
                            </button>
                            <button
                              onClick={() => handleDeleteSection(section.id)}
                              className="p-1 hover:bg-gray-700 rounded"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3 text-gray-400" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-400 mb-3">
                        {section.description}
                      </p>
                      
                      {section.fields && section.fields.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {section.fields.slice(0, 3).map((field, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-gray-700 rounded">
                              {field}
                            </span>
                          ))}
                          {section.fields.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{section.fields.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Used {section.usageCount} times
                        </span>
                        
                        <div className="flex gap-2">
                          {!section.isLocked && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleGlobal(section.id)}
                              className="bg-white/10 border-white/20 hover:bg-white/20 h-7 text-xs"
                            >
                              {section.isGlobal ? (
                                <>
                                  <Unlock className="h-3 w-3 mr-1" />
                                  Make Local
                                </>
                              ) : (
                                <>
                                  <Globe className="h-3 w-3 mr-1" />
                                  Make Global
                                </>
                              )}
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            onClick={() => handleAddToPage(section)}
                            disabled={isUsed}
                            className={`h-7 text-xs ${
                              isUsed 
                                ? 'bg-gray-600 cursor-not-allowed'
                                : 'bg-[#FF5500] hover:bg-[#FF6600]'
                            }`}
                          >
                            {isUsed ? (
                              <>
                                <Star className="h-3 w-3 mr-1" />
                                In Use
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Section Dialog */}
        {editingSection && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">
                {creatingNew ? 'Create Section' : 'Edit Section'}
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-400">Name</label>
                  <Input
                    value={editingSection.name}
                    onChange={(e) => setEditingSection({
                      ...editingSection,
                      name: e.target.value
                    })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-gray-400">Description</label>
                  <Input
                    value={editingSection.description}
                    onChange={(e) => setEditingSection({
                      ...editingSection,
                      description: e.target.value
                    })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-gray-400">Category</label>
                  <select
                    value={editingSection.category}
                    onChange={(e) => setEditingSection({
                      ...editingSection,
                      category: e.target.value
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  >
                    {categories.slice(1).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <Button
                  onClick={() => handleSaveSection(editingSection)}
                  className="flex-1 bg-[#FF5500] hover:bg-[#FF6600]"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button
                  onClick={() => {
                    setEditingSection(null)
                    setCreatingNew(false)
                  }}
                  variant="outline"
                  className="flex-1 bg-white/10 border-white/20 hover:bg-white/20"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
