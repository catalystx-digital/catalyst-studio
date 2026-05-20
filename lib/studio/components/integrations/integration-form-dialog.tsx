'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

import {
  INTEGRATION_PROVIDER_METADATA,
  IntegrationFieldDefinition,
  IntegrationProviderSlug,
  getProviderMetadata,
} from '@/lib/studio/integrations/provider-config';
import type { AccountIntegrationRecord } from '@/lib/studio/types/integration';

import {
  buildConfigPayload,
  createInitialFieldValues,
  ENABLED_PROVIDER_SLUGS,
  FALLBACK_PROVIDER,
  FormFieldState,
  validateForm,
} from '@/lib/studio/components/integrations/integration-form-helpers';

export type IntegrationFormDialogState =
  | { mode: 'create'; provider: IntegrationProviderSlug; formKey: number }
  | { mode: 'edit'; integration: AccountIntegrationRecord; formKey: number }
  | null;

export interface IntegrationFormDialogProps {
  modal: IntegrationFormDialogState;
  onClose: () => void;
  onCreate: (input: {
    provider: IntegrationProviderSlug;
    displayName: string;
    config: Record<string, unknown>;
  }) => void;
  onUpdate?: (input: { id: string; displayName: string; config: Record<string, unknown> }) => void;
  isSubmitting: boolean;
  submitError?: string;
}

export function IntegrationFormDialog({
  modal,
  onClose,
  onCreate,
  onUpdate,
  isSubmitting,
  submitError,
}: IntegrationFormDialogProps) {
  const isOpen = Boolean(modal);
  const integration = modal?.mode === 'edit' ? modal.integration : undefined;
  const initialProvider: IntegrationProviderSlug =
    modal?.mode === 'edit'
      ? (modal.integration.provider as IntegrationProviderSlug)
      : modal?.provider ?? FALLBACK_PROVIDER;

  const [provider, setProvider] = useState<IntegrationProviderSlug>(initialProvider);
  const [displayName, setDisplayName] = useState<string>(integration?.displayName ?? '');
  const [fieldValues, setFieldValues] = useState<FormFieldState>(() =>
    createInitialFieldValues(initialProvider, integration),
  );
  const [errors, setErrors] = useState<string[]>([]);

  const metadata = useMemo(() => getProviderMetadata(provider), [provider]);
  const secretPresence = integration?.secretFields ?? {};
  const mode: 'create' | 'edit' = modal?.mode === 'edit' ? 'edit' : 'create';

  const handleProviderChange = useCallback((nextProvider: IntegrationProviderSlug) => {
    setProvider(nextProvider);
    setFieldValues(createInitialFieldValues(nextProvider));
    setErrors([]);
  }, []);

  const handleFieldChange = useCallback((field: IntegrationFieldDefinition, value: string | boolean) => {
    setFieldValues(prev => ({ ...prev, [field.name]: value }));
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!modal) {
        return;
      }

      const validationErrors = validateForm(provider, fieldValues, mode, displayName, integration);
      setErrors(validationErrors);

      if (validationErrors.length > 0) {
        return;
      }

      const config = buildConfigPayload(provider, fieldValues, mode);
      const trimmedName = displayName.trim();

      if (modal.mode === 'create') {
        onCreate({ provider, displayName: trimmedName, config });
      } else if (onUpdate) {
        onUpdate({ id: modal.integration.id, displayName: trimmedName, config });
      }
    },
    [displayName, fieldValues, integration, mode, modal, onCreate, onUpdate, provider],
  );

  if (!modal) {
    return null;
  }

  const submitLabel = mode === 'create' ? 'Create integration' : 'Save changes';

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl border-gray-700 bg-gray-900">
        <DialogHeader>
          <DialogTitle className="text-white">
            {mode === 'create' ? 'Connect a provider' : `Edit ${integration?.displayName}`}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {metadata.description}{' '}
            {metadata.documentationUrl ? (
              <Link
                href={metadata.documentationUrl}
                target="_blank"
                rel="noreferrer"
                className="text-orange-400 hover:underline"
              >
                View setup guide
              </Link>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 text-sm text-gray-200">
          <div className="grid gap-4">
            {mode === 'create' ? (
              <div className="space-y-2">
                <Label htmlFor="integration-provider">Provider</Label>
                <Select
                  value={provider}
                  onValueChange={value => handleProviderChange(value as IntegrationProviderSlug)}
                >
                  <SelectTrigger
                    id="integration-provider"
                    className="border-gray-700 bg-gray-800 text-white"
                  >
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent className="border-gray-700 bg-gray-900 text-white">
                    {ENABLED_PROVIDER_SLUGS.length === 0 ? (
                      <SelectItem value={FALLBACK_PROVIDER} disabled className="capitalize">
                        No providers enabled
                      </SelectItem>
                    ) : null}
                    {ENABLED_PROVIDER_SLUGS.map(slug => (
                      <SelectItem key={slug} value={slug} className="capitalize">
                        {INTEGRATION_PROVIDER_METADATA[slug].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Provider</Label>
                <div className="text-gray-300">
                  {INTEGRATION_PROVIDER_METADATA[provider].label}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="integration-display-name">Display name</Label>
              <Input
                id="integration-display-name"
                value={displayName}
                onChange={event => setDisplayName(event.target.value)}
                placeholder="Optimizely Production"
                className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500"
                required
              />
            </div>

            <div className="grid gap-4">
              {metadata.fields.map(field => {
                const fieldId = `integration-${field.name}`;
                const isSecretStored =
                  mode === 'edit' && field.secret ? Boolean(secretPresence[field.name]) : false;

                return (
                  <div key={field.name} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor={fieldId}>{field.label}</Label>
                      {field.secret ? (
                        <Badge
                          variant="outline"
                          className={
                            isSecretStored
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                              : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                          }
                        >
                          {isSecretStored ? (
                            <Check className="mr-1 h-3 w-3" aria-hidden="true" />
                          ) : (
                            <AlertCircle className="mr-1 h-3 w-3" aria-hidden="true" />
                          )}
                          {isSecretStored ? 'Secret stored' : 'Secret required'}
                        </Badge>
                      ) : null}
                    </div>

                    {renderFieldInput({
                      field,
                      fieldId,
                      value: fieldValues[field.name],
                      onChange: handleFieldChange,
                      mode,
                      isSecretStored,
                    })}

                    {field.description ? (
                      <p className="text-xs text-gray-400">{field.description}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {errors.length > 0 ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-5 text-xs">
                  {errors.map(errorMessage => (
                    <li key={errorMessage}>{errorMessage}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          {submitError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-700 text-gray-300 hover:text-white"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FieldInputProps {
  field: IntegrationFieldDefinition;
  fieldId: string;
  value: string | boolean | undefined;
  mode: 'create' | 'edit';
  isSecretStored: boolean;
  onChange: (field: IntegrationFieldDefinition, value: string | boolean) => void;
}

function renderFieldInput({ field, fieldId, value, onChange, mode, isSecretStored }: FieldInputProps) {
  if (field.inputType === 'checkbox') {
    return (
      <div className="flex items-center space-x-2">
        <Checkbox
          id={fieldId}
          checked={Boolean(value)}
          onCheckedChange={checked => onChange(field, Boolean(checked))}
          className="border-gray-700"
        />
        <Label htmlFor={fieldId} className="text-sm font-normal text-gray-300">
          {field.label}
        </Label>
      </div>
    );
  }

  if (field.inputType === 'textarea') {
    return (
      <Textarea
        id={fieldId}
        value={typeof value === 'string' ? value : ''}
        onChange={event => onChange(field, event.target.value)}
        rows={3}
        className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500"
        placeholder={field.placeholder}
      />
    );
  }

  const inputType =
    field.inputType === 'password'
      ? 'password'
      : field.inputType === 'email'
      ? 'email'
      : field.inputType === 'url'
      ? 'url'
      : field.inputType === 'number'
      ? 'number'
      : 'text';

  const inputProps: Record<string, unknown> = {};

  if (field.inputType === 'number') {
    inputProps.step = field.step ?? (field.integer ? 1 : 'any');
    if (typeof field.min === 'number') {
      inputProps.min = field.min;
    }
    if (typeof field.max === 'number') {
      inputProps.max = field.max;
    }
  }

  return (
    <Input
      id={fieldId}
      type={inputType}
      value={typeof value === 'string' ? value : ''}
      onChange={event => onChange(field, event.target.value)}
      className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500"
      placeholder={
        field.placeholder ?? (field.secret && isSecretStored ? 'Secret stored — enter to replace' : undefined)
      }
      autoComplete={field.inputType === 'password' ? 'new-password' : 'off'}
      required={field.required && !(field.secret && mode === 'edit')}
      {...inputProps}
    />
  );
}
