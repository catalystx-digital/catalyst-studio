'use client';

import React, { useState, useEffect } from 'react';
import { useContentTypes } from '@/lib/context/content-type-context';
import { Field } from '@/lib/content-types/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit2, Network, Trash2 } from 'lucide-react';
import { FieldTypeModal } from './field-type-modal-simple';
import { SortableFieldList } from './sortable-field-list';
import { FieldPropertiesPanel } from './field-properties-panel';
import Link from 'next/link';
import { useContentTypeValidation } from '@/lib/hooks/use-content-type-validation';
import { CategorySelectorModal } from './category-selector-modal';

interface ContentTypeBuilderProps {
  contentTypeId?: string;
}

export default function ContentTypeBuilder({ contentTypeId }: ContentTypeBuilderProps) {
  const {
    contentTypes,
    currentContentType,
    setCurrentContentType,
    createContentType,
    updateContentType,
    safeDeleteContentType,
    deleteField,
    updateField,
    reorderFields,
  } = useContentTypes();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  
  const { validateTypeName, errors } = useContentTypeValidation({
    validateOnChange: false
  });

  // Initialize with content type if ID provided
  useEffect(() => {
    if (!isInitialized && contentTypes !== undefined) {
      // Small delay to ensure localStorage has loaded
      const timeoutId = setTimeout(() => {
        if (contentTypeId) {
          const contentType = contentTypes.find(ct => ct.id === contentTypeId);
          if (contentType) {
            setCurrentContentType(contentType);
            setNameInput(contentType.name);
          }
        } else if (!currentContentType && contentTypes.length === 0) {
          // Only create a new content type if none exist at all
          const newContentType = createContentType('NewContentType');
          setNameInput(newContentType.name);
        } else if (contentTypes.length > 0 && !currentContentType) {
          // If content types exist but none selected, select the first one with fields or the last one
          const contentTypeWithFields = contentTypes.find(ct => ct.fields.length > 0);
          const selectedContentType = contentTypeWithFields || contentTypes[contentTypes.length - 1];
          setCurrentContentType(selectedContentType);
          setNameInput(selectedContentType.name);
        } else if (currentContentType) {
          setNameInput(currentContentType.name);
        }
        setIsInitialized(true);
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [contentTypeId, contentTypes, currentContentType, setCurrentContentType, createContentType, isInitialized]);

  const handleNameSave = () => {
    if (currentContentType && nameInput.trim()) {
      // Validate the name first
      const isValid = validateTypeName(nameInput.trim());
      if (isValid) {
        updateContentType(currentContentType.id, {
          name: nameInput.trim(),
          pluralName: `${nameInput.trim()}s`,
        });
        setIsEditingName(false);
      }
      // If not valid, the error will be shown via the errors state
    }
  };

  const handleFieldClick = (field: Field) => {
    setSelectedField(field);
  };

  const handleDeleteField = (fieldId: string) => {
    if (currentContentType) {
      deleteField(currentContentType.id, fieldId);
      if (selectedField?.id === fieldId) {
        setSelectedField(null);
      }
    }
  };

  const handleReorderFields = (fields: Field[]) => {
    if (currentContentType) {
      reorderFields(currentContentType.id, fields);
    }
  };

  const handleUpdateFieldProperties = (updates: Partial<Field>) => {
    if (currentContentType && selectedField) {
      updateField(currentContentType.id, selectedField.id, updates);
      // Update the selected field reference
      setSelectedField(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleOpenProperties = (field: Field) => {
    setSelectedField(field);
    setIsPropertiesPanelOpen(true);
  };

  const handleDeleteContentType = async (contentTypeId: string) => {
    const success = await safeDeleteContentType(contentTypeId, () => {
      // After successful deletion, select another content type or create new one
      const remainingTypes = contentTypes.filter(ct => ct.id !== contentTypeId);
      if (remainingTypes.length > 0) {
        const nextContentType = remainingTypes[remainingTypes.length - 1];
        setCurrentContentType(nextContentType);
        setNameInput(nextContentType.name);
      } else {
        // No content types left, we'll let the component handle this in its render logic
        setCurrentContentType(null);
      }
    });
    
    if (success) {
      // Reset selected field if it belonged to deleted content type
      setSelectedField(null);
      setIsPropertiesPanelOpen(false);
    }
  };

  // Show loading state during initialization to prevent hydration mismatch
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4 text-white">Loading...</h2>
        </div>
      </div>
    );
  }

  if (!currentContentType) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4 text-white">No Content Type Selected</h2>
          <Button className="catalyst-button-primary" onClick={() => {
            setIsCategoryModalOpen(true);
          }}>
            Create New Content Type
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Content Types Selector */}
      <div className="border-b p-4 bg-dark-primary border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-gray-400">Content Types</h2>
            <span className="text-xs text-gray-500">({contentTypes.length})</span>
          </div>
          <Button 
            size="sm" 
            onClick={() => {
              setIsCategoryModalOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add content type
          </Button>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {contentTypes.map((contentType) => (
            <div key={contentType.id} className="relative group">
              <button
                onClick={() => {
                  setCurrentContentType(contentType);
                  setNameInput(contentType.name);
                }}
                className={`px-3 py-2 pr-8 rounded-lg text-sm font-medium transition-colors ${
                  currentContentType?.id === contentType.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="mr-2">{contentType.icon}</span>
                {contentType.name}
                <span className="ml-2 text-xs opacity-70">({contentType.fields.length})</span>
              </button>
              {/* Delete button - only show when there are multiple content types */}
              {contentTypes.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteContentType(contentType.id);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-600/20 text-red-400 hover:text-red-300 transition-all"
                  title={`Delete ${contentType.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Header with Content Type Name */}
      <div className="border-b p-6 bg-dark-secondary border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-3xl">{currentContentType.icon}</span>
            {isEditingName ? (
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onBlur={() => validateTypeName(nameInput)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNameSave();
                    if (e.key === 'Escape') {
                      setNameInput(currentContentType.name);
                      setIsEditingName(false);
                    }
                  }}
                  className={`text-2xl font-bold ${errors.find(e => e.field === 'typeName') ? 'border-red-500' : ''}`}
                  autoFocus
                />
                <Button size="sm" onClick={handleNameSave}>Save</Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNameInput(currentContentType.name);
                    setIsEditingName(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
              {errors.find(e => e.field === 'typeName') && (
                <p className="text-xs text-red-500 mt-1">{errors.find(e => e.field === 'typeName')?.message}</p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <h1 className="text-2xl font-bold text-white">{currentContentType.name}</h1>
              <span className={`px-2 py-1 text-xs rounded-full ${
                currentContentType.category === 'page' 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-purple-500/20 text-purple-400'
              }`}>
                {currentContentType.category === 'page' ? '📄 Page' : '🧩 Component'}
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsEditingName(true)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          </div>
          <Link href="/content-builder/relationships">
            <Button variant="outline" size="sm" className="gap-2 catalyst-button-secondary">
              <Network className="h-4 w-4" />
              Relationships
            </Button>
          </Link>
        </div>
        <p className="text-gray-400 mt-2">
          {currentContentType.fields.length} field{currentContentType.fields.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Fields List */}
      <div className="flex-1 overflow-auto p-6 bg-dark-primary">
        {currentContentType.fields.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="mb-6">
              <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center mb-4 mx-auto">
                <Plus className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No fields yet</h3>
              <p className="text-muted-foreground">
                Start building your content type by adding fields
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => setIsFieldModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add field
            </Button>
          </div>
        ) : (
          // Fields List
          <div className="space-y-3">
            <SortableFieldList
              fields={currentContentType.fields}
              selectedField={selectedField}
              onFieldClick={handleFieldClick}
              onDeleteField={handleDeleteField}
              onReorderFields={handleReorderFields}
              onOpenProperties={handleOpenProperties}
            />

            {/* Add Field Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsFieldModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add field
            </Button>
          </div>
        )}
      </div>

      {/* Field Type Selection Modal */}
      {currentContentType && (
        <FieldTypeModal
          open={isFieldModalOpen}
          onOpenChange={setIsFieldModalOpen}
          contentTypeId={currentContentType.id}
        />
      )}

      {/* Field Properties Panel */}
      {isPropertiesPanelOpen && (
        <FieldPropertiesPanel
          field={selectedField}
          onUpdateField={handleUpdateFieldProperties}
          onClose={() => setIsPropertiesPanelOpen(false)}
        />
      )}
      
      {/* Category Selector Modal */}
      <CategorySelectorModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSelect={(category) => {
          const newName = `${category === 'page' ? 'Page' : 'Component'}_${contentTypes.length + 1}`;
          const newContentType = createContentType(newName, category);
          setNameInput(newContentType.name);
          setIsEditingName(true);
        }}
      />
    </div>
  );
}