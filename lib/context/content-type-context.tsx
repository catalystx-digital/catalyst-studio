'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import {
  ContentType,
  Field,
  Relationship,
  FieldType,
  generateId,
  createField,
  createContentType as createContentTypeHelper,
} from '@/lib/content-types/types';
import {
  useContentTypes as useContentTypesQuery,
  useCreateContentType,
  useUpdateContentType,
  useDeleteContentType,
} from '@/lib/api/hooks/use-content-types';
import { CreateContentTypeRequest, UpdateContentTypeRequest } from '@/lib/api/validation/content-type';
import { useContentStore } from '@/lib/stores/content-store';
import { useWebsiteContext } from '@/lib/context/website-context';

interface ContentTypeContextValue {
  contentTypes: ContentType[];
  currentContentType: ContentType | null;
  setCurrentContentType: (contentType: ContentType | null) => void;
  createContentType: (name: string, category?: 'page' | 'component') => ContentType;
  updateContentType: (id: string, updates: Partial<ContentType>) => void;
  deleteContentType: (id: string) => void;
  safeDeleteContentType: (id: string, onConfirm?: () => void) => Promise<boolean>;
  
  addField: (contentTypeId: string, fieldType: FieldType) => void;
  updateField: (contentTypeId: string, fieldId: string, updates: Partial<Field>) => void;
  deleteField: (contentTypeId: string, fieldId: string) => void;
  reorderFields: (contentTypeId: string, fields: Field[]) => void;
  
  addRelationship: (contentTypeId: string, relationship: Omit<Relationship, 'id'>) => void;
  updateRelationship: (contentTypeId: string, relationshipId: string, updates: Partial<Relationship>) => void;
  deleteRelationship: (contentTypeId: string, relationshipId: string) => void;
  
  isDirty: boolean;
  setIsDirty: (isDirty: boolean) => void;
  isLoading?: boolean;
  error?: Error | null;
}

const ContentTypeContext = createContext<ContentTypeContextValue | undefined>(undefined);

interface ApiContentType {
  id: string;
  websiteId: string;
  name: string;
  category?: string;
  fields: any;
  settings: any;
  createdAt: string;
  updatedAt: string;
}

function transformApiContentType(apiContentType: ApiContentType): ContentType {
  const fields = apiContentType.fields?.fields || [];
  const relationships = apiContentType.fields?.relationships || [];
  const settings = apiContentType.settings || {};
  
  return {
    id: apiContentType.id,
    name: apiContentType.name, // Always use the database name column as primary source
    pluralName: settings.pluralName || apiContentType.fields?.pluralName || `${apiContentType.name}s`,
    icon: settings.icon || apiContentType.fields?.icon || '📋',
    description: settings.description || apiContentType.fields?.description,
    category: (apiContentType.category as 'page' | 'component') || 'page',
    fields: fields,
    relationships: relationships,
    createdAt: new Date(apiContentType.createdAt),
    updatedAt: new Date(apiContentType.updatedAt),
  };
}

function transformToApiFormat(contentType: Partial<ContentType>, websiteId: string) {
  const { id, createdAt, updatedAt, ...rest } = contentType as ContentType & { id?: string; createdAt?: Date; updatedAt?: Date };
  
  return {
    websiteId: websiteId,
    name: contentType.name,
    pluralName: contentType.pluralName,
    icon: contentType.icon,
    description: contentType.description,
    category: contentType.category || 'page',
    fields: contentType.fields || [],
    relationships: contentType.relationships || [],
  };
}

export function ContentTypeProvider({ children }: { children: React.ReactNode }) {
  const [currentContentType, setCurrentContentType] = useState<ContentType | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [optimisticContentTypes, setOptimisticContentTypes] = useState<ContentType[]>([]);
  
  // Get current website ID from context - will be null if not in website context
  let websiteId: string | null = null;
  try {
    const websiteContext = useWebsiteContext();
    websiteId = websiteContext.websiteId;
  } catch {
  }
  
  const { data: apiContentTypes, isLoading, error } = useContentTypesQuery(websiteId ?? undefined);
  const createMutation = useCreateContentType();
  const updateMutation = useUpdateContentType();
  const deleteMutation = useDeleteContentType();
  
  const contentTypes = useMemo(() => {
    if (!apiContentTypes) return optimisticContentTypes;
    
    const transformed = apiContentTypes.map(transformApiContentType);
    
    const mergedMap = new Map<string, ContentType>();
    transformed.forEach(ct => mergedMap.set(ct.id, ct));
    optimisticContentTypes.forEach(ct => {
      if (!mergedMap.has(ct.id)) {
        mergedMap.set(ct.id, ct);
      }
    });
    
    return Array.from(mergedMap.values());
  }, [apiContentTypes, optimisticContentTypes]);
  
  const createContentTypeHandler = useCallback((name: string, category: 'page' | 'component' = 'page'): ContentType => {
    const newContentType = createContentTypeHelper(name, category);

    if (!websiteId) {
      throw new Error('Website ID is required to create a content type');
    }

    setOptimisticContentTypes(prev => [...prev, newContentType]);
    setCurrentContentType(newContentType);
    setIsDirty(true);

    createMutation.mutate(transformToApiFormat(newContentType, websiteId) as CreateContentTypeRequest, {
      onSuccess: (data) => {
        const transformed = transformApiContentType(data);
        setOptimisticContentTypes(prev =>
          prev.map(ct => ct.id === newContentType.id ? transformed : ct)
        );
        setCurrentContentType(transformed);
      },
      onError: () => {
        setOptimisticContentTypes(prev => prev.filter(ct => ct.id !== newContentType.id));
        setCurrentContentType(null);
      },
    });

    return newContentType;
  }, [createMutation, websiteId]);
  
  const updateContentTypeHandler = useCallback((id: string, updates: Partial<ContentType>) => {
    const contentType = contentTypes.find(ct => ct.id === id);
    if (!contentType) return;

    const updatedContentType = { ...contentType, ...updates, updatedAt: new Date() };

    if (!websiteId) {
      throw new Error('Website ID is required to update a content type');
    }

    setOptimisticContentTypes(prev =>
      prev.some(ct => ct.id === id)
        ? prev.map(ct => ct.id === id ? updatedContentType : ct)
        : [...prev, updatedContentType]
    );

    if (currentContentType?.id === id) {
      setCurrentContentType(updatedContentType);
    }

    updateMutation.mutate(
      { id, data: transformToApiFormat(updatedContentType, websiteId) as UpdateContentTypeRequest },
      {
        onError: () => {
          setOptimisticContentTypes(prev => prev.filter(ct => ct.id !== id));
          if (currentContentType?.id === id) {
            setCurrentContentType(contentType);
          }
        },
      }
    );

    setIsDirty(true);
  }, [contentTypes, currentContentType, updateMutation, websiteId]);
  
  const deleteContentTypeHandler = useCallback((id: string) => {
    const contentType = contentTypes.find(ct => ct.id === id);
    if (!contentType) return;
    
    setOptimisticContentTypes(prev => [...prev.filter(ct => ct.id !== id)]);
    
    if (currentContentType?.id === id) {
      setCurrentContentType(null);
    }
    
    deleteMutation.mutate(id, {
      onError: () => {
        setOptimisticContentTypes(prev => [...prev, contentType]);
        if (currentContentType?.id === id) {
          setCurrentContentType(contentType);
        }
      },
    });
    
    setIsDirty(true);
  }, [contentTypes, currentContentType, deleteMutation]);

  const safeDeleteContentType = useCallback(async (id: string, onConfirm?: () => void): Promise<boolean> => {
    const contentType = contentTypes.find(ct => ct.id === id);
    if (!contentType) return false;

    // Check for existing content items using this content type
    const contentStore = useContentStore.getState();
    const existingContent = contentStore.getContentByType(id);
    
    if (existingContent.length > 0) {
      // Show confirmation dialog for content type with existing items
      const confirmed = confirm(
        `Warning: "${contentType.name}" has ${existingContent.length} content item${existingContent.length > 1 ? 's' : ''}.\n\n` +
        `Deleting this content type will permanently remove:\n` +
        `• The content type definition\n` +
        `• All ${existingContent.length} associated content item${existingContent.length > 1 ? 's' : ''}\n\n` +
        `This action cannot be undone. Are you sure you want to continue?`
      );
      
      if (!confirmed) return false;
      
      // Delete all content items first
      existingContent.forEach(item => {
        contentStore.deleteContent(item.id);
      });
    } else {
      // Simple confirmation for empty content type
      const confirmed = confirm(
        `Are you sure you want to delete the content type "${contentType.name}"?\n\n` +
        `This action cannot be undone.`
      );
      
      if (!confirmed) return false;
    }

    // Proceed with deletion
    deleteContentTypeHandler(id);
    
    // Call optional confirmation callback
    if (onConfirm) onConfirm();
    
    return true;
  }, [contentTypes, deleteContentTypeHandler]);
  
  const addFieldHandler = useCallback((contentTypeId: string, fieldType: FieldType) => {
    const contentType = contentTypes.find(ct => ct.id === contentTypeId);
    if (!contentType) return;
    
    const order = contentType.fields.length;
    const newField = createField(fieldType, order);
    
    const updatedContentType = {
      ...contentType,
      fields: [...contentType.fields, newField],
      updatedAt: new Date(),
    };
    
    updateContentTypeHandler(contentTypeId, updatedContentType);
  }, [contentTypes, updateContentTypeHandler]);
  
  const updateFieldHandler = useCallback((contentTypeId: string, fieldId: string, updates: Partial<Field>) => {
    const contentType = contentTypes.find(ct => ct.id === contentTypeId);
    if (!contentType) return;
    
    const updatedContentType = {
      ...contentType,
      fields: contentType.fields.map(field => 
        field.id === fieldId ? { ...field, ...updates } : field
      ),
      updatedAt: new Date(),
    };
    
    updateContentTypeHandler(contentTypeId, updatedContentType);
  }, [contentTypes, updateContentTypeHandler]);
  
  const deleteFieldHandler = useCallback((contentTypeId: string, fieldId: string) => {
    const contentType = contentTypes.find(ct => ct.id === contentTypeId);
    if (!contentType) return;
    
    const updatedFields = contentType.fields
      .filter(field => field.id !== fieldId)
      .map((field, index) => ({ ...field, order: index }));
    
    const updatedContentType = {
      ...contentType,
      fields: updatedFields,
      updatedAt: new Date(),
    };
    
    updateContentTypeHandler(contentTypeId, updatedContentType);
  }, [contentTypes, updateContentTypeHandler]);
  
  const reorderFieldsHandler = useCallback((contentTypeId: string, fields: Field[]) => {
    const reorderedFields = fields.map((field, index) => ({ ...field, order: index }));
    
    const contentType = contentTypes.find(ct => ct.id === contentTypeId);
    if (!contentType) return;
    
    const updatedContentType = {
      ...contentType,
      fields: reorderedFields,
      updatedAt: new Date(),
    };
    
    updateContentTypeHandler(contentTypeId, updatedContentType);
  }, [contentTypes, updateContentTypeHandler]);
  
  const addRelationshipHandler = useCallback((contentTypeId: string, relationship: Omit<Relationship, 'id'>) => {
    const contentType = contentTypes.find(ct => ct.id === contentTypeId);
    if (!contentType) return;
    
    const newRelationship: Relationship = {
      ...relationship,
      id: generateId(),
    };
    
    const updatedContentType = {
      ...contentType,
      relationships: [...contentType.relationships, newRelationship],
      updatedAt: new Date(),
    };
    
    updateContentTypeHandler(contentTypeId, updatedContentType);
  }, [contentTypes, updateContentTypeHandler]);
  
  const updateRelationshipHandler = useCallback((contentTypeId: string, relationshipId: string, updates: Partial<Relationship>) => {
    const contentType = contentTypes.find(ct => ct.id === contentTypeId);
    if (!contentType) return;
    
    const updatedContentType = {
      ...contentType,
      relationships: contentType.relationships.map(rel => 
        rel.id === relationshipId ? { ...rel, ...updates } : rel
      ),
      updatedAt: new Date(),
    };
    
    updateContentTypeHandler(contentTypeId, updatedContentType);
  }, [contentTypes, updateContentTypeHandler]);
  
  const deleteRelationshipHandler = useCallback((contentTypeId: string, relationshipId: string) => {
    const contentType = contentTypes.find(ct => ct.id === contentTypeId);
    if (!contentType) return;
    
    const updatedContentType = {
      ...contentType,
      relationships: contentType.relationships.filter(rel => rel.id !== relationshipId),
      updatedAt: new Date(),
    };
    
    updateContentTypeHandler(contentTypeId, updatedContentType);
  }, [contentTypes, updateContentTypeHandler]);
  
  const value: ContentTypeContextValue = {
    contentTypes,
    currentContentType,
    setCurrentContentType,
    createContentType: createContentTypeHandler,
    updateContentType: updateContentTypeHandler,
    deleteContentType: deleteContentTypeHandler,
    safeDeleteContentType,
    addField: addFieldHandler,
    updateField: updateFieldHandler,
    deleteField: deleteFieldHandler,
    reorderFields: reorderFieldsHandler,
    addRelationship: addRelationshipHandler,
    updateRelationship: updateRelationshipHandler,
    deleteRelationship: deleteRelationshipHandler,
    isDirty,
    setIsDirty,
    isLoading,
    error,
  };
  
  return (
    <ContentTypeContext.Provider value={value}>
      {children}
    </ContentTypeContext.Provider>
  );
}

export function useContentTypes() {
  const context = useContext(ContentTypeContext);
  if (context === undefined) {
    throw new Error('useContentTypes must be used within a ContentTypeProvider');
  }
  return context;
}
