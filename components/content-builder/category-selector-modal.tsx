'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FileText, Puzzle } from 'lucide-react';

interface CategorySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (category: 'page' | 'component') => void;
}

export function CategorySelectorModal({ isOpen, onClose, onSelect }: CategorySelectorModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<'page' | 'component'>('page');

  const handleCreate = () => {
    onSelect(selectedCategory);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Select Content Type Category</DialogTitle>
          <DialogDescription>
            Choose whether this content type will be a page or a component.
          </DialogDescription>
        </DialogHeader>
        
        <RadioGroup value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as 'page' | 'component')}>
          <div className="space-y-4 py-4">
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
              <RadioGroupItem value="page" id="page" className="mt-1" />
              <Label htmlFor="page" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5" />
                  <span className="font-semibold">Page</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Routable content with its own URL. Examples: Blog posts, product pages, landing pages.
                  Pages can have SEO fields and slugs for navigation.
                </p>
              </Label>
            </div>
            
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
              <RadioGroupItem value="component" id="component" className="mt-1" />
              <Label htmlFor="component" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <Puzzle className="h-5 w-5" />
                  <span className="font-semibold">Component</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Reusable content blocks that can be embedded in pages. Examples: Hero sections, CTAs, testimonials.
                  Components are focused and do not have their own URLs.
                </p>
              </Label>
            </div>
          </div>
        </RadioGroup>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>
            Create {selectedCategory === 'page' ? 'Page' : 'Component'} Type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
