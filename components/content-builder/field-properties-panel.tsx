'use client';

import React, { useState, useEffect } from 'react';
import { Field, FieldType } from '@/lib/content-types/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { X } from 'lucide-react';
import { getFieldIcon } from '@/lib/content-types/field-utils';
import { useContentTypeValidation } from '@/lib/hooks/use-content-type-validation';
import { useContentTypes } from '@/lib/context/content-type-context';

interface FieldPropertiesPanelProps {
  field: Field | null;
  onUpdateField: (updates: Partial<Field>) => void;
  onClose: () => void;
}

export function FieldPropertiesPanel({
  field,
  onUpdateField,
  onClose,
}: FieldPropertiesPanelProps) {
  const [localField, setLocalField] = useState<Field | null>(null);
  const [fieldNameError, setFieldNameError] = useState<string | null>(null);
  const { currentContentType } = useContentTypes();
  
  // Get existing fields for duplicate checking (exclude current field)
  const existingFields = currentContentType?.fields.filter(f => f.id !== field?.id) || [];
  
  const { 
    validateField, 
    getFieldError, 
    clearFieldError,
    errors 
  } = useContentTypeValidation({
    existingFields
  });

  useEffect(() => {
    setLocalField(field);
    setFieldNameError(null); // Clear local error state
    // Clear any existing errors when switching fields
    if (field?.id) {
      clearFieldError(`field_${field.id}`);
    }
  }, [field, clearFieldError]);

  if (!localField) {
    return null;
  }

  const handleChange = (key: keyof Field, value: unknown) => {
    setLocalField(prev => {
      if (!prev) return null;
      return { ...prev, [key]: value };
    });
  };

  const handleSave = () => {
    if (localField) {
      // Validate field name before saving
      const isValid = validateField(localField.name, `field_${localField.id}`);
      if (!isValid) {
        const error = getFieldError(`field_${localField.id}`);
        setFieldNameError(error || 'Invalid field name');
        return; // Don't save if validation fails
      }

      const updates: Partial<Field> = {
        name: localField.name,
        label: localField.label,
        required: localField.required,
        placeholder: localField.placeholder,
        helpText: localField.helpText,
        defaultValue: localField.defaultValue,
      };

      // Add validation rules if applicable
      if (localField.validation) {
        updates.validation = localField.validation;
      }

      onUpdateField(updates);
      onClose();
    }
  };

  const renderFieldSpecificSettings = () => {
    switch (localField.type) {
      case FieldType.TEXT:
      case FieldType.RICH_TEXT:
        return (
          <>
            <div>
              <Label htmlFor="minLength">Min Length</Label>
              <Input
                id="minLength"
                type="number"
                min="0"
                value={typeof (localField.validation as Record<string, unknown>)?.minLength === 'number' ? (localField.validation as Record<string, unknown>).minLength as number : ''}
                onChange={(e) => {
                  const value = e.target.value ? parseInt(e.target.value) : undefined;
                  handleChange('validation', {
                    ...localField.validation,
                    minLength: value,
                  });
                }}
              />
            </div>
            <div>
              <Label htmlFor="maxLength">Max Length</Label>
              <Input
                id="maxLength"
                type="number"
                min="0"
                value={typeof (localField.validation as Record<string, unknown>)?.maxLength === 'number' ? (localField.validation as Record<string, unknown>).maxLength as number : ''}
                onChange={(e) => {
                  const value = e.target.value ? parseInt(e.target.value) : undefined;
                  handleChange('validation', {
                    ...localField.validation,
                    maxLength: value,
                  });
                }}
              />
            </div>
            <div>
              <Label htmlFor="pattern">Pattern (RegEx)</Label>
              <Input
                id="pattern"
                value={typeof (localField.validation as Record<string, unknown>)?.pattern === 'string' ? (localField.validation as Record<string, unknown>).pattern as string : ''}
                onChange={(e) => {
                  handleChange('validation', {
                    ...localField.validation,
                    pattern: e.target.value || undefined,
                  });
                }}
                placeholder="e.g., ^[A-Z].*"
              />
            </div>
          </>
        );

      case FieldType.NUMBER:
        return (
          <>
            <div>
              <Label htmlFor="min">Min Value</Label>
              <Input
                id="min"
                type="number"
                value={typeof (localField.validation as Record<string, unknown>)?.min === 'number' ? (localField.validation as Record<string, unknown>).min as number : ''}
                onChange={(e) => {
                  const value = e.target.value ? parseFloat(e.target.value) : undefined;
                  handleChange('validation', {
                    ...localField.validation,
                    min: value,
                  });
                }}
              />
            </div>
            <div>
              <Label htmlFor="max">Max Value</Label>
              <Input
                id="max"
                type="number"
                value={typeof (localField.validation as Record<string, unknown>)?.max === 'number' ? (localField.validation as Record<string, unknown>).max as number : ''}
                onChange={(e) => {
                  const value = e.target.value ? parseFloat(e.target.value) : undefined;
                  handleChange('validation', {
                    ...localField.validation,
                    max: value,
                  });
                }}
              />
            </div>
            <div>
              <Label htmlFor="step">Step</Label>
              <Input
                id="step"
                type="number"
                min="0"
                step="0.01"
                value={typeof (localField.validation as Record<string, unknown>)?.step === 'number' ? (localField.validation as Record<string, unknown>).step as number : ''}
                onChange={(e) => {
                  const value = e.target.value ? parseFloat(e.target.value) : undefined;
                  handleChange('validation', {
                    ...localField.validation,
                    step: value,
                  });
                }}
                placeholder="e.g., 0.01"
              />
            </div>
          </>
        );

      case FieldType.DATE:
        return (
          <>
            <div>
              <Label htmlFor="minDate">Min Date</Label>
              <Input
                id="minDate"
                type="date"
                value={typeof (localField.validation as Record<string, unknown>)?.minDate === 'string' ? (localField.validation as Record<string, unknown>).minDate as string : ''}
                onChange={(e) => {
                  handleChange('validation', {
                    ...localField.validation,
                    minDate: e.target.value || undefined,
                  });
                }}
              />
            </div>
            <div>
              <Label htmlFor="maxDate">Max Date</Label>
              <Input
                id="maxDate"
                type="date"
                value={typeof (localField.validation as Record<string, unknown>)?.maxDate === 'string' ? (localField.validation as Record<string, unknown>).maxDate as string : ''}
                onChange={(e) => {
                  handleChange('validation', {
                    ...localField.validation,
                    maxDate: e.target.value || undefined,
                  });
                }}
              />
            </div>
          </>
        );

      case FieldType.IMAGE:
        return (
          <>
            <div>
              <Label htmlFor="maxSize">Max File Size (MB)</Label>
              <Input
                id="maxSize"
                type="number"
                min="0"
                step="0.1"
                value={typeof (localField.validation as Record<string, unknown>)?.maxSize === 'number' ? (localField.validation as Record<string, unknown>).maxSize as number : ''}
                onChange={(e) => {
                  const value = e.target.value ? parseFloat(e.target.value) : undefined;
                  handleChange('validation', {
                    ...localField.validation,
                    maxSize: value,
                  });
                }}
              />
            </div>
            <div>
              <Label htmlFor="allowedTypes">Allowed File Types</Label>
              <Input
                id="allowedTypes"
                value={Array.isArray((localField.validation as Record<string, unknown>)?.allowedTypes) ? ((localField.validation as Record<string, unknown>).allowedTypes as string[]).join(', ') : ''}
                onChange={(e) => {
                  const types = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                  handleChange('validation', {
                    ...localField.validation,
                    allowedTypes: types.length > 0 ? types : undefined,
                  });
                }}
                placeholder="e.g., jpg, png, gif"
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const getDefaultValueInput = () => {
    switch (localField.type) {
      case FieldType.TEXT:
      case FieldType.RICH_TEXT:
        return (
          <Input
            id="defaultValue"
            value={localField.defaultValue || ''}
            onChange={(e) => handleChange('defaultValue', e.target.value || undefined)}
            placeholder="Enter default text"
          />
        );

      case FieldType.NUMBER:
        return (
          <Input
            id="defaultValue"
            type="number"
            value={localField.defaultValue !== undefined ? localField.defaultValue : ''}
            onChange={(e) => {
              const value = e.target.value ? parseFloat(e.target.value) : undefined;
              handleChange('defaultValue', value);
            }}
            placeholder="Enter default number"
          />
        );

      case FieldType.BOOLEAN:
        return (
          <Switch
            id="defaultValue"
            checked={localField.defaultValue || false}
            onCheckedChange={(checked) => handleChange('defaultValue', checked)}
          />
        );

      case FieldType.DATE:
        return (
          <Input
            id="defaultValue"
            type="date"
            value={localField.defaultValue || ''}
            onChange={(e) => handleChange('defaultValue', e.target.value || undefined)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Card className="fixed right-0 top-0 h-full w-96 overflow-auto z-50 shadow-xl rounded-none">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getFieldIcon(localField.type)}</span>
            <div>
              <h2 className="text-xl font-semibold">Field Properties</h2>
              <p className="text-sm text-muted-foreground">{localField.type}</p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Basic Properties */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Field Name (API)</Label>
            <Input
              id="name"
              value={localField.name}
              onChange={(e) => {
                handleChange('name', e.target.value);
                setFieldNameError(null); // Clear error on change
              }}
              onBlur={(e) => {
                const isValid = validateField(e.target.value, `field_${localField.id}`);
                if (!isValid) {
                  const error = getFieldError(`field_${localField.id}`);
                  setFieldNameError(error || 'Invalid field name');
                } else {
                  setFieldNameError(null);
                }
              }}
              placeholder="e.g., firstName"
              className={fieldNameError ? 'border-red-500' : ''}
            />
            {fieldNameError ? (
              <p className="text-xs text-red-500 mt-1">{fieldNameError}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Used in API responses (camelCase recommended)
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="label">Display Label</Label>
            <Input
              id="label"
              value={localField.label}
              onChange={(e) => handleChange('label', e.target.value)}
              placeholder="e.g., First Name"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="required">Required Field</Label>
            <Switch
              id="required"
              checked={localField.required}
              onCheckedChange={(checked) => handleChange('required', checked)}
            />
          </div>

          <div>
            <Label htmlFor="placeholder">Placeholder Text</Label>
            <Input
              id="placeholder"
              value={localField.placeholder || ''}
              onChange={(e) => handleChange('placeholder', e.target.value || undefined)}
              placeholder="e.g., Enter your first name"
            />
          </div>

          <div>
            <Label htmlFor="helpText">Help Text</Label>
            <Textarea
              id="helpText"
              value={localField.helpText || ''}
              onChange={(e) => handleChange('helpText', e.target.value || undefined)}
              placeholder="Provide helpful instructions for this field"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="defaultValue">Default Value</Label>
            {getDefaultValueInput()}
          </div>
        </div>

        {/* Field-Specific Validation */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">
            Validation Rules
          </h3>
          {renderFieldSpecificSettings()}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={!!fieldNameError}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </Card>
  );
}