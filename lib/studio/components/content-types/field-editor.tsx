'use client';

/**
 * Field Editor Component
 *
 * Allows adding, editing, deleting, and reordering fields for content types.
 * Supports all 15 field types with validation options.
 */

import { useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Pencil,
  Type,
  AlignLeft,
  Hash,
  ToggleLeft,
  Calendar,
  Image,
  Link2,
  List,
  Tags,
  Code,
  FileText,
  Layers,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'date'
  | 'image'
  | 'reference'
  | 'select'
  | 'gallery'
  | 'tags'
  | 'json'
  | 'url'
  | 'array'
  | 'markdown';

export interface FieldOption {
  label: string;
  value: string | number | boolean;
  description?: string;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  precision?: number;
  minDate?: string;
  maxDate?: string;
  format?: string;
  maxSize?: number;
  allowedTypes?: string[];
}

export interface ContentTypeField {
  id: string;
  name: string;
  label?: string;
  type: FieldType;
  required: boolean;
  defaultValue?: unknown;
  validation?: FieldValidation;
  helpText?: string;
  placeholder?: string;
  options?: FieldOption[];
  order: number;
}

interface FieldEditorProps {
  fields: ContentTypeField[];
  onChange: (fields: ContentTypeField[]) => void;
  disabled?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const FIELD_TYPES: { value: FieldType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'text', label: 'Text', icon: <Type className="h-4 w-4" />, description: 'Single line text input' },
  { value: 'textarea', label: 'Text Area', icon: <AlignLeft className="h-4 w-4" />, description: 'Multi-line text input' },
  { value: 'richtext', label: 'Rich Text', icon: <FileText className="h-4 w-4" />, description: 'Formatted text with editor' },
  { value: 'markdown', label: 'Markdown', icon: <Code className="h-4 w-4" />, description: 'Markdown formatted text' },
  { value: 'number', label: 'Number', icon: <Hash className="h-4 w-4" />, description: 'Numeric values' },
  { value: 'boolean', label: 'Boolean', icon: <ToggleLeft className="h-4 w-4" />, description: 'True/false toggle' },
  { value: 'date', label: 'Date', icon: <Calendar className="h-4 w-4" />, description: 'Date picker' },
  { value: 'image', label: 'Image', icon: <Image className="h-4 w-4" />, description: 'Single image upload' },
  { value: 'gallery', label: 'Gallery', icon: <Layers className="h-4 w-4" />, description: 'Multiple images' },
  { value: 'url', label: 'URL', icon: <Link2 className="h-4 w-4" />, description: 'Web address' },
  { value: 'select', label: 'Select', icon: <List className="h-4 w-4" />, description: 'Dropdown options' },
  { value: 'tags', label: 'Tags', icon: <Tags className="h-4 w-4" />, description: 'Multiple tags' },
  { value: 'reference', label: 'Reference', icon: <Link2 className="h-4 w-4" />, description: 'Link to other content' },
  { value: 'array', label: 'Array', icon: <Layers className="h-4 w-4" />, description: 'List of items' },
  { value: 'json', label: 'JSON', icon: <Code className="h-4 w-4" />, description: 'Raw JSON data' },
];

// =============================================================================
// Helper Functions
// =============================================================================

function generateFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateFieldName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, '_$1');
}

function getFieldTypeIcon(type: FieldType): React.ReactNode {
  const fieldType = FIELD_TYPES.find(ft => ft.value === type);
  return fieldType?.icon || <Type className="h-4 w-4" />;
}

// =============================================================================
// Field Form Component
// =============================================================================

interface FieldFormProps {
  field: Partial<ContentTypeField>;
  onChange: (field: Partial<ContentTypeField>) => void;
  isNew?: boolean;
}

function FieldForm({ field, onChange, isNew }: FieldFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateField = (updates: Partial<ContentTypeField>) => {
    onChange({ ...field, ...updates });
  };

  const needsOptions = field.type === 'select';

  return (
    <div className="space-y-4">
      {/* Basic Settings */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="field-label">Label *</Label>
          <Input
            id="field-label"
            value={field.label || ''}
            onChange={(e) => {
              const label = e.target.value;
              const updates: Partial<ContentTypeField> = { label };
              // Auto-generate name from label if it's a new field
              if (isNew || !field.name) {
                updates.name = generateFieldName(label);
              }
              updateField(updates);
            }}
            placeholder="e.g., Title, Description"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="field-name">Name (API key) *</Label>
          <Input
            id="field-name"
            value={field.name || ''}
            onChange={(e) => updateField({ name: e.target.value })}
            placeholder="e.g., title, description"
            pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
          />
          <p className="text-xs text-muted-foreground">
            Must start with letter, alphanumeric and underscores only
          </p>
        </div>
      </div>

      {/* Type Selection */}
      <div className="space-y-2">
        <Label>Field Type *</Label>
        <Select
          value={field.type}
          onValueChange={(value) => updateField({ type: value as FieldType })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select field type" />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((ft) => (
              <SelectItem key={ft.value} value={ft.value}>
                <div className="flex items-center gap-2">
                  {ft.icon}
                  <span>{ft.label}</span>
                  <span className="text-xs text-muted-foreground">- {ft.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Required Toggle */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="field-required">Required</Label>
          <p className="text-xs text-muted-foreground">
            Field must be filled before saving
          </p>
        </div>
        <Switch
          id="field-required"
          checked={field.required ?? false}
          onCheckedChange={(checked) => updateField({ required: checked })}
        />
      </div>

      {/* Options for Select type */}
      {needsOptions && (
        <div className="space-y-2">
          <Label>Options</Label>
          <OptionsEditor
            options={field.options || []}
            onChange={(options) => updateField({ options })}
          />
        </div>
      )}

      {/* Advanced Settings Toggle */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full justify-start text-muted-foreground"
      >
        {showAdvanced ? 'Hide' : 'Show'} advanced settings
      </Button>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <Label htmlFor="field-help">Help Text</Label>
            <Input
              id="field-help"
              value={field.helpText || ''}
              onChange={(e) => updateField({ helpText: e.target.value })}
              placeholder="Instructions for content editors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-placeholder">Placeholder</Label>
            <Input
              id="field-placeholder"
              value={field.placeholder || ''}
              onChange={(e) => updateField({ placeholder: e.target.value })}
              placeholder="Placeholder text"
            />
          </div>

          {/* Type-specific validation */}
          {(field.type === 'text' || field.type === 'textarea') && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="field-minlength">Min Length</Label>
                <Input
                  id="field-minlength"
                  type="number"
                  min={0}
                  value={field.validation?.minLength ?? ''}
                  onChange={(e) =>
                    updateField({
                      validation: {
                        ...field.validation,
                        minLength: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-maxlength">Max Length</Label>
                <Input
                  id="field-maxlength"
                  type="number"
                  min={0}
                  value={field.validation?.maxLength ?? ''}
                  onChange={(e) =>
                    updateField({
                      validation: {
                        ...field.validation,
                        maxLength: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
            </div>
          )}

          {field.type === 'number' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="field-min">Min Value</Label>
                <Input
                  id="field-min"
                  type="number"
                  value={field.validation?.min ?? ''}
                  onChange={(e) =>
                    updateField({
                      validation: {
                        ...field.validation,
                        min: e.target.value ? parseFloat(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-max">Max Value</Label>
                <Input
                  id="field-max"
                  type="number"
                  value={field.validation?.max ?? ''}
                  onChange={(e) =>
                    updateField({
                      validation: {
                        ...field.validation,
                        max: e.target.value ? parseFloat(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Options Editor Component (for Select fields)
// =============================================================================

interface OptionsEditorProps {
  options: FieldOption[];
  onChange: (options: FieldOption[]) => void;
}

function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const addOption = () => {
    onChange([...options, { label: '', value: '' }]);
  };

  const updateOption = (index: number, updates: Partial<FieldOption>) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], ...updates };
    // Auto-generate value from label if empty
    if (updates.label && !newOptions[index].value) {
      newOptions[index].value = updates.label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    }
    onChange(newOptions);
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={option.label}
            onChange={(e) => updateOption(index, { label: e.target.value })}
            placeholder="Label"
            className="flex-1"
          />
          <Input
            value={String(option.value)}
            onChange={(e) => updateOption(index, { value: e.target.value })}
            placeholder="Value"
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeOption(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addOption}>
        <Plus className="mr-2 h-4 w-4" />
        Add Option
      </Button>
    </div>
  );
}

// =============================================================================
// Field Editor Component
// =============================================================================

export function FieldEditor({ fields, onChange, disabled }: FieldEditorProps) {
  const [editingField, setEditingField] = useState<ContentTypeField | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNewField, setIsNewField] = useState(false);
  const [formState, setFormState] = useState<Partial<ContentTypeField>>({});

  // Add new field
  const handleAddField = useCallback(() => {
    setFormState({
      id: generateFieldId(),
      name: '',
      label: '',
      type: 'text',
      required: false,
      order: fields.length,
    });
    setEditingField(null);
    setIsNewField(true);
    setIsDialogOpen(true);
  }, [fields.length]);

  // Edit existing field
  const handleEditField = useCallback((field: ContentTypeField) => {
    setFormState({ ...field });
    setEditingField(field);
    setIsNewField(false);
    setIsDialogOpen(true);
  }, []);

  // Save field (add or update)
  const handleSaveField = useCallback(() => {
    if (!formState.name || !formState.type) return;

    const newField: ContentTypeField = {
      id: formState.id || generateFieldId(),
      name: formState.name,
      label: formState.label || formState.name,
      type: formState.type,
      required: formState.required ?? false,
      defaultValue: formState.defaultValue,
      validation: formState.validation,
      helpText: formState.helpText,
      placeholder: formState.placeholder,
      options: formState.options,
      order: formState.order ?? fields.length,
    };

    if (isNewField) {
      onChange([...fields, newField]);
    } else {
      onChange(fields.map((f) => (f.id === newField.id ? newField : f)));
    }

    setIsDialogOpen(false);
    setFormState({});
    setEditingField(null);
  }, [formState, fields, isNewField, onChange]);

  // Delete field
  const handleDeleteField = useCallback(
    (fieldId: string) => {
      onChange(
        fields
          .filter((f) => f.id !== fieldId)
          .map((f, index) => ({ ...f, order: index }))
      );
    },
    [fields, onChange]
  );

  // Move field up
  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const newFields = [...fields];
      [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
      onChange(newFields.map((f, i) => ({ ...f, order: i })));
    },
    [fields, onChange]
  );

  // Move field down
  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= fields.length - 1) return;
      const newFields = [...fields];
      [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
      onChange(newFields.map((f, i) => ({ ...f, order: i })));
    },
    [fields, onChange]
  );

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      {/* Field List */}
      {sortedFields.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No fields defined yet. Add your first field to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedFields.map((field, index) => (
            <Card key={field.id} className="group">
              <CardContent className="flex items-center gap-3 p-3">
                {/* Drag Handle / Reorder */}
                <div className="flex flex-col gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => handleMoveUp(index)}
                    disabled={disabled || index === 0}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => handleMoveDown(index)}
                    disabled={disabled || index === sortedFields.length - 1}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>

                {/* Field Icon */}
                <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                  {getFieldTypeIcon(field.type)}
                </div>

                {/* Field Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {field.label || field.name}
                    </span>
                    {field.required && (
                      <span className="text-xs text-destructive">*</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{field.name}</span>
                    <span>•</span>
                    <span className="capitalize">{field.type}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEditField(field)}
                    disabled={disabled}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteField(field.id)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Field Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleAddField}
        disabled={disabled}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Field
      </Button>

      {/* Edit/Add Field Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isNewField ? 'Add Field' : 'Edit Field'}
            </DialogTitle>
            <DialogDescription>
              {isNewField
                ? 'Define a new field for this content type.'
                : 'Update the field configuration.'}
            </DialogDescription>
          </DialogHeader>

          <FieldForm
            field={formState}
            onChange={setFormState}
            isNew={isNewField}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveField}
              disabled={!formState.name || !formState.type}
            >
              {isNewField ? 'Add Field' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FieldEditor;
