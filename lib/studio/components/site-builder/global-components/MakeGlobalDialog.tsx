'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Globe, AlertTriangle } from 'lucide-react';
import { ComponentInstance, resolveSharedComponentReference } from '@/lib/studio/types/site-builder/component-instance';
import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store';

interface MakeGlobalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  component: ComponentInstance | null;
  websiteId: string;
  onSuccess?: (sharedComponentId: string) => void;
}

const COMPONENT_CATEGORIES = [
  { value: 'header', label: 'Header', description: 'Page headers containing title, hero sections, page banners' },
  { value: 'footer', label: 'Footer', description: 'Page footers with copyright, contact info, social links, site maps' },
  { value: 'navigation', label: 'Navigation', description: 'Menu bars, breadcrumbs, sidebars, tab navigations' },
  { value: 'shared', label: 'Shared', description: 'Reusable content blocks like CTAs, testimonials, feature cards, pricing tables' }
];

export function MakeGlobalDialog({ 
  isOpen, 
  onClose, 
  component, 
  websiteId, 
  onSuccess 
}: MakeGlobalDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const loadGlobalComponents = useSiteBuilderStore((state) => state.loadGlobalComponents);

  // Reset form when component changes
  React.useEffect(() => {
    if (component && isOpen) {
      setName(component.type || 'Unnamed Component');
      setCategory(inferCategory(component.type));
    }
  }, [component, isOpen]);
  
  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Reset state on unmount to prevent memory leaks
      setName('');
      setCategory('');
      setIsLoading(false);
    };
  }, []);

  // Infer category from component type
  const inferCategory = (type: string): string => {
    if (!type) return 'shared';
    const lowerType = type.toLowerCase();
    if (lowerType.includes('header') || lowerType.includes('hero')) return 'header';
    if (lowerType.includes('footer')) return 'footer';
    if (lowerType.includes('nav') || lowerType.includes('menu')) return 'navigation';
    return 'shared';
  };

  // Check for circular dependencies
  const hasCircularDependency = (component: ComponentInstance): boolean => {
    // Check if this component contains or references any global components
    // that might create a circular dependency
    const isComponentLike = (value: unknown): value is ComponentInstance => {
      return (
        !!value &&
        typeof value === 'object' &&
        typeof (value as { id?: unknown }).id === 'string' &&
        typeof (value as { type?: unknown }).type === 'string'
      );
    };

    const checkForGlobalReferences = (comp: ComponentInstance, visited = new Set<string>()): boolean => {
      // Prevent infinite loops in already circular structures
      if (visited.has(comp.id)) {
        return true; // Found a cycle
      }
      visited.add(comp.id);
      
      // Check if this component itself is already global
      if (comp.metadata?.isGlobal || resolveSharedComponentReference(comp)) {
        return true; // Would create nested global components
      }
      
      // Check props for nested components
      if (comp.props && typeof comp.props === 'object') {
        // Check for children or nested component references
        const propsToCheck = ['children', 'components', 'slots', 'content'];
        for (const prop of propsToCheck) {
          if (comp.props[prop]) {
            if (Array.isArray(comp.props[prop])) {
              for (const child of comp.props[prop]) {
                if (isComponentLike(child)) {
                  if (checkForGlobalReferences(child, new Set(visited))) {
                    return true;
                  }
                }
              }
            } else if (isComponentLike(comp.props[prop])) {
              if (checkForGlobalReferences(comp.props[prop], new Set(visited))) {
                return true;
              }
            }
          }
        }
      }
      
      return false;
    };
    
    return checkForGlobalReferences(component);
  };

  const handleSubmit = async () => {
    if (!component || !websiteId) return;

    if (!name.trim()) {
      toast.error('Component name is required');
      return;
    }

    if (!category) {
      toast.error('Category is required');
      return;
    }

    // Check for circular dependencies
    if (hasCircularDependency(component)) {
      toast.error('Cannot make global: This component contains or references other global components');
      return;
    }

    // Check component size (simplified)
    const configString = JSON.stringify(component);
    if (configString.length > 1048576) { // 1MB limit
      toast.error('Component is too large to make global (max 1MB)');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/studio/site-builder/global-components', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          type: component.type,
          config: component, // Full ComponentInstance object
          category: category as 'header' | 'footer' | 'navigation' | 'shared',
          websiteId: websiteId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create global component');
      }

      if (data.success) {
        toast.success(`Component "${name}" is now global and can be reused across pages.`);
        
        // Refresh the global components list in the store
        await loadGlobalComponents(websiteId);
        
        onSuccess?.(data.id);
        onClose();
        
        // Reset form
        setName('');
        setCategory('');
      } else {
        throw new Error(data.error || 'Failed to create global component');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error making component global:', error);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to make component global');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCategory = COMPONENT_CATEGORIES.find(cat => cat.value === category);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            Make Component Global
          </DialogTitle>
          <DialogDescription>
            Convert this component into a reusable global component that can be shared across multiple pages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Component Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter component name"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select component category" />
              </SelectTrigger>
              <SelectContent>
                {COMPONENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div>
                      <div className="font-medium">{cat.label}</div>
                      <div className="text-sm text-muted-foreground">{cat.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCategory && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>{selectedCategory.label}:</strong> {selectedCategory.description}
              </p>
            </div>
          )}

          <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-md">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <p className="font-medium">Important:</p>
                <p>Once made global, changes to this component will automatically apply to all pages using it.</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !name.trim() || !category}>
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 mr-2" />
                Make Global
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
