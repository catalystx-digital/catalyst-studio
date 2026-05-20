'use client';

import React, { useState } from 'react';
import { Field } from '@/lib/content-types/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical, Settings, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { getFieldIcon } from '@/lib/content-types/field-utils';

interface SortableFieldListProps {
  fields: Field[];
  selectedField: Field | null;
  onFieldClick: (field: Field) => void;
  onDeleteField: (fieldId: string) => void;
  onReorderFields: (fields: Field[]) => void;
  onOpenProperties?: (field: Field) => void;
}

export function SortableFieldList({
  fields,
  selectedField,
  onFieldClick,
  onDeleteField,
  onReorderFields,
  onOpenProperties,
}: SortableFieldListProps) {
  const [draggedField, setDraggedField] = useState<Field | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, field: Field) => {
    setDraggedField(field);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedField(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (!draggedField) return;
    
    const dragIndex = fields.findIndex(f => f.id === draggedField.id);
    if (dragIndex === dropIndex) return;
    
    const newFields = [...fields];
    const [removed] = newFields.splice(dragIndex, 1);
    newFields.splice(dropIndex, 0, removed);
    
    // Update order property
    const reorderedFields = newFields.map((field, index) => ({
      ...field,
      order: index,
    }));
    
    onReorderFields(reorderedFields);
    setDraggedField(null);
    setDragOverIndex(null);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    
    const newFields = [...fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    
    // Update order property
    const reorderedFields = newFields.map((field, index) => ({
      ...field,
      order: index,
    }));
    
    onReorderFields(reorderedFields);
  };

  return (
    <div className="space-y-3">
      {fields
        .sort((a, b) => a.order - b.order)
        .map((field, index) => (
          <Card
            key={field.id}
            className={`p-4 cursor-pointer transition-all hover:bg-accent ${
              selectedField?.id === field.id ? 'ring-2 ring-primary' : ''
            } ${
              dragOverIndex === index ? 'border-primary border-2' : ''
            } ${
              draggedField?.id === field.id ? 'opacity-50' : ''
            }`}
            onClick={() => onFieldClick(field)}
            draggable
            onDragStart={(e) => handleDragStart(e, field)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDrop(e, index)}
          >
            <div className="flex items-center gap-3">
              {/* Drag Handle */}
              <div className="cursor-move">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* Field Icon */}
              <div className="text-2xl">{getFieldIcon(field.type)}</div>

              {/* Field Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{field.label}</h3>
                  {field.required && (
                    <span className="text-xs text-red-500">Required</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {field.name} · {field.type}
                </p>
                {field.helpText && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {field.helpText}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveField(index, 'up');
                  }}
                  disabled={index === 0}
                  title="Move up"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveField(index, 'down');
                  }}
                  disabled={index === fields.length - 1}
                  title="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenProperties) {
                      onOpenProperties(field);
                    }
                  }}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteField(field.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
    </div>
  );
}