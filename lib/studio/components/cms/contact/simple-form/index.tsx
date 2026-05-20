'use client';

import React, { useCallback, useMemo, useState } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { useForm, type FieldPath } from 'react-hook-form';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { debounce } from '../../_core/security';
import {
  CmsAlert,
  CmsAlertDescription,
  CmsAlertTitle,
  CmsForm,
  CmsFormControl,
  CmsFormField,
  CmsFormItem,
  CmsFormLabel,
  CmsFormMessage,
  CmsFormRoot,
  CmsSection,
  cmsBody,
  cmsHeading,
  dsSpacing,
} from '../../_ui';
import { ComponentTheme } from '../../_core/types';
import {
  FORM_TEMPLATES,
  SimpleFormField,
  SimpleFormProps,
} from './simple-form.types';

type FormValues = {
  [key: string]: string | boolean | undefined;
  consent?: boolean;
  _honeypot?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX =
  /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
const CONSENT_ERROR_MESSAGE = 'You must agree to continue. Please check the consent checkbox above.';
const MAX_FIELDS = 3;

const DEFAULT_SUBMISSION_ERROR_MESSAGE = 'Submission failed. Please try again.';
const DEFAULT_VALIDATION_ERROR_MESSAGE = 'Please fix the highlighted fields and try again.';
const DEFAULT_NETWORK_ERROR_MESSAGE = 'We could not reach the server. Please try again later.';

const DEFAULT_SUCCESS_MESSAGE = 'Submitted successfully!';

function sanitizeText(value?: string): string {
  if (!value) return '';
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

function toFieldLabel(field: SimpleFormField): string {
  return (
    field.label ||
    field.placeholder ||
    field.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function buildValidationRules(field: SimpleFormField) {
  const label = toFieldLabel(field);
  const rules: Record<string, unknown> = {};
  const validators: Record<string, (value: unknown) => true | string> = {};

  if (field.required) {
    rules.required = `${label} is required. Please fill in this field to continue.`;
  }

  if (field.type === 'email') {
    validators.email = (value) => {
      const text = String(value ?? '').trim();
      if (!text) {
        return field.required
          ? 'Please enter a valid email address (e.g., name@example.com).'
          : true;
      }
      return EMAIL_REGEX.test(text) || 'Please enter a valid email address (e.g., name@example.com).';
    };
  }

  if (field.type === 'tel') {
    validators.phone = (value) => {
      const text = String(value ?? '').trim();
      if (!text) {
        return field.required
          ? 'Please enter a valid phone number (e.g., 123-456-7890).'
          : true;
      }
      return PHONE_REGEX.test(text) || 'Please enter a valid phone number (e.g., 123-456-7890).';
    };
  }

  if (Object.keys(validators).length > 0) {
    rules.validate = validators;
  }

  return rules;
}

function buildDefaultValues(
  fields: SimpleFormField[],
  includeHoneypot: boolean,
): FormValues {
  const defaults: FormValues = {};

  fields.forEach((field) => {
    defaults[field.name] = '';
  });

  defaults.consent = false;

  if (includeHoneypot) {
    defaults._honeypot = '';
  }

  return defaults;
}

function buildSubmissionPayload(
  values: FormValues,
  fields: SimpleFormField[],
): Record<string, string | boolean> {
  const payload: Record<string, string | boolean> = {};

  fields.forEach((field) => {
    const value = values[field.name];
    if (typeof value === 'string') {
      payload[field.name] = value;
    }
  });

  payload.consent = Boolean(values.consent);

  return payload;
}

const SimpleForm: React.FC<SimpleFormProps> = ({
  id,
  content,
  className,
  theme = 'auto',
  variant = 'default',
}) => {
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>(
    'idle',
  );
  const [statusMessage, setStatusMessage] = useState('');

  const rawFields = useMemo(
    () => (Array.isArray(content.fields) ? content.fields : []),
    [content.fields],
  );

  const templateConfig = useMemo(() => {
    if (content.template && content.template !== 'custom') {
      return FORM_TEMPLATES[content.template];
    }
    return null;
  }, [content.template]);

  const effectiveContent = useMemo(() => {
    if (templateConfig) {
      const templateFields = Array.isArray(templateConfig.fields)
        ? templateConfig.fields
        : [];

      return {
        ...templateConfig,
        ...content,
        fields:
          rawFields.length > 0
            ? rawFields.slice(0, MAX_FIELDS)
            : templateFields.slice(0, MAX_FIELDS),
      };
    }

    return {
      ...content,
      fields: rawFields.slice(0, MAX_FIELDS),
    };
  }, [content, rawFields, templateConfig]);

  const fields = useMemo<SimpleFormField[]>(
    () => (Array.isArray(effectiveContent.fields) ? effectiveContent.fields : []),
    [effectiveContent.fields],
  );

  const cmsTheme = (typeof theme === 'string'
    ? theme
    : undefined) as ComponentTheme | undefined;

  const resolvedMessages = useMemo(() => {
    const submissionError =
      (typeof effectiveContent.errorMessage === 'string' && effectiveContent.errorMessage.trim()) ||
      DEFAULT_SUBMISSION_ERROR_MESSAGE;

    const trimmedSuccessMessage = typeof effectiveContent.successMessage === 'string' ? effectiveContent.successMessage.trim() : undefined;
    const trimmedNetworkMessage = typeof effectiveContent.networkErrorMessage === 'string' ? effectiveContent.networkErrorMessage.trim() : undefined;
    const trimmedValidationMessage = typeof effectiveContent.validationErrorMessage === 'string' ? effectiveContent.validationErrorMessage.trim() : undefined;
    const trimmedSuccessDescription = typeof effectiveContent.successDescription === 'string' ? effectiveContent.successDescription.trim() : undefined;

    return {
      success: trimmedSuccessMessage || DEFAULT_SUCCESS_MESSAGE,
      submissionError,
      networkError:
        trimmedNetworkMessage || submissionError || DEFAULT_NETWORK_ERROR_MESSAGE,
      validation:
        trimmedValidationMessage || DEFAULT_VALIDATION_ERROR_MESSAGE,
      successDescription: trimmedSuccessDescription || undefined,
      successCta: effectiveContent.successCta,
    };
  }, [
    effectiveContent.errorMessage,
    effectiveContent.networkErrorMessage,
    effectiveContent.successMessage,
    effectiveContent.validationErrorMessage,
    effectiveContent.successDescription,
    effectiveContent.successCta,
  ]);

  const {
    success: resolvedSuccessMessage,
    submissionError: resolvedSubmissionErrorMessage,
    networkError: resolvedNetworkErrorMessage,
    validation: resolvedValidationErrorMessage,
    successDescription,
    successCta,
  } = resolvedMessages;

  const includeConsent = Boolean(effectiveContent.consentText);
  const includeHoneypot = Boolean(effectiveContent.honeypot);

  const defaultValues = useMemo(
    () => buildDefaultValues(fields, includeHoneypot),
    [fields, includeHoneypot],
  );

  const form = useForm<FormValues>({
    defaultValues,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldUnregister: false,
    shouldFocusError: true,
  });

  const {
    control,
    handleSubmit,
    reset,
    setError,
    trigger,
    register,
    formState: { isSubmitting },
  } = form;

  const triggerDebouncedValidation = useMemo(
    () =>
      debounce((name: string) => {
        trigger(name as FieldPath<FormValues>);
      }, 250),
    [trigger],
  );

  const handleValidationChange = useCallback(
    (
      name: string,
      onChange: (value: unknown) => void,
      value: unknown,
    ) => {
      onChange(value);
      triggerDebouncedValidation(name);
    },
    [triggerDebouncedValidation],
  );

  const maxWidth =
    typeof effectiveContent.maxWidth === 'number'
      ? `${effectiveContent.maxWidth}px`
      : effectiveContent.maxWidth || '480px';

  const handleInvalidSubmit = useCallback(() => {
    setSubmitStatus('error');
    setStatusMessage(resolvedValidationErrorMessage);
  }, [resolvedValidationErrorMessage]);

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setSubmitStatus('idle');
      setStatusMessage('');

      if (includeHoneypot && values._honeypot) {
        setSubmitStatus('success');
        setStatusMessage(resolvedSuccessMessage);
        if (effectiveContent.resetOnSuccess) {
          reset(defaultValues);
        }
        return;
      }

      if (includeConsent && !values.consent) {
        setError('consent', { type: 'validate', message: CONSENT_ERROR_MESSAGE });
        setSubmitStatus('error');
        setStatusMessage(CONSENT_ERROR_MESSAGE);
        return;
      }

      const submissionPayload = buildSubmissionPayload(values, fields);

      try {
        if (!effectiveContent.endpoint) {
          if (process.env.NODE_ENV === 'development') {
          console.log('Form submission (mock):', submissionPayload);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          setSubmitStatus('success');
          const trimmedDevSuccess = effectiveContent.successMessage?.trim();
          setStatusMessage(
            trimmedDevSuccess || 'Submitted successfully (development mode)',
          );
          if (effectiveContent.resetOnSuccess) {
            reset(defaultValues);
          }
          return;
        }

        const response = await fetch(effectiveContent.endpoint, {
          method: effectiveContent.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...effectiveContent.headers,
          },
          body: JSON.stringify(submissionPayload),
        });

        if (!response) {
          throw new Error('No response received from the server.');
        }

        const result = await response.json().catch(() => ({}));

        if (response.ok || result.success) {
          setSubmitStatus('success');
          setStatusMessage(result.message || resolvedSuccessMessage);
          if (effectiveContent.resetOnSuccess) {
            reset(defaultValues);
          }
        } else {
          setSubmitStatus('error');
          setStatusMessage(result.message || resolvedSubmissionErrorMessage);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.error('Form submission error:', error);
        }
        setSubmitStatus('error');

        const networkFailure = error instanceof TypeError;
        if (networkFailure) {
          setStatusMessage(resolvedNetworkErrorMessage);
        } else {
          setStatusMessage(resolvedSubmissionErrorMessage);
        }
      }
    },
    [
      defaultValues,
      effectiveContent.endpoint,
      effectiveContent.errorMessage,
      effectiveContent.headers,
      effectiveContent.method,
      effectiveContent.resetOnSuccess,
      effectiveContent.successMessage,
      resolvedNetworkErrorMessage,
      resolvedSubmissionErrorMessage,
      resolvedSuccessMessage,
      fields,
      includeConsent,
      includeHoneypot,
      reset,
      setError,
    ],
  );

  if (fields.length === 0) {
    return (
      <CmsSection
        id={id}
        size="sm"
        theme={cmsTheme}
        variant={variant}
        className={cn('simple-form', className)}
        containerClassName={cn('items-start', dsSpacing.gap('xs'))}
      >
        <div
          className={cn(
            'simple-form-empty w-full rounded-xl border border-dashed border-border/40 bg-muted/30 text-sm text-muted-foreground backdrop-blur-sm',
            dsSpacing.px('md'),
            dsSpacing.py('md'),
          )}
          style={{ maxWidth }}
        >
          No form fields are configured for this form.
        </div>
      </CmsSection>
    );
  }

  const formLayoutClass =
    effectiveContent.layout === 'inline'
      ? cn(
          'simple-form-form md:flex md:flex-wrap md:items-end',
          dsSpacing.gap('sm'),
          `md:${dsSpacing.gap('xs')}`,
        )
      : cn('simple-form-form grid', dsSpacing.gap('sm'));

  return (
    <CmsSection
      id={id}
      size="sm"
      theme={cmsTheme}
      variant={variant}
      className={cn('simple-form', className)}
      containerClassName={cn('items-start', dsSpacing.gap('sm'))}
    >
      <div
        className={cn(
          'simple-form-content flex w-full flex-col',
          dsSpacing.gap('sm'),
        )}
        style={{ maxWidth }}
      >
        {effectiveContent.title && (
          <h3 className={cmsHeading(4, cmsTheme)}>
            {sanitizeText(effectiveContent.title)}
          </h3>
        )}

        {effectiveContent.description && (
          <p className={cmsBody('sm', cmsTheme, 'text-muted-foreground')}>
            {sanitizeText(effectiveContent.description)}
          </p>
        )}

        <CmsForm
          {...form}
          theme={cmsTheme}
          variant={variant}
          className={formLayoutClass}
        >
          <CmsFormRoot
            onSubmit={handleSubmit(onSubmit, handleInvalidSubmit)}
            noValidate
          >
          {fields.map((field) => (
            <CmsFormField
              key={field.name}
              control={control}
              name={field.name as FieldPath<FormValues>}
              rules={buildValidationRules(field)}
              render={({ field: rhfField, fieldState }) => {
                const itemClassName = cn(
                  'simple-form-field w-full',
                  effectiveContent.layout === 'inline' && 'md:flex-1 md:min-w-[200px]',
                );

                const label = field.label ? sanitizeText(field.label) : undefined;
                const placeholder = field.placeholder
                  ? sanitizeText(field.placeholder)
                  : undefined;
                const inputLabel = label || placeholder || toFieldLabel(field);

                const handleTextChange = (
                  event: React.ChangeEvent<HTMLInputElement>,
                ) => {
                  handleValidationChange(field.name, rhfField.onChange, event.target.value);
                };

                const sharedLabel =
                  label && (
                    <CmsFormLabel
                      htmlFor={field.name}
                      className={cn(
                        effectiveContent.layout === 'inline'
                          ? 'sr-only md:not-sr-only md:mb-1'
                          : 'mb-1',
                      )}
                    >
                      {label}
                      {field.required && (
                        <span className={cn(dsSpacing.ml('xxs'), 'text-destructive')}>
                          *
                        </span>
                      )}
                    </CmsFormLabel>
                  );

                const renderFieldControl = () => {
                  switch (field.type) {
                    case 'select':
                      return (
                        <Select
                          value={(rhfField.value as string) ?? ''}
                          onValueChange={(value) =>
                            handleValidationChange(field.name, rhfField.onChange, value)
                          }
                          onOpenChange={() => triggerDebouncedValidation(field.name)}
                        >
                          <SelectTrigger
                            id={field.name}
                            aria-label={inputLabel}
                          >
                            <SelectValue
                              placeholder={
                                placeholder || `Select ${label || field.name}`
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options?.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    case 'time':
                    case 'text':
                    case 'email':
                    case 'tel':
                    default:
                      return (
                        <Input
                          id={field.name}
                          type={field.type === 'time' ? 'time' : field.type}
                          placeholder={placeholder}
                          value={(rhfField.value as string) ?? ''}
                          onChange={handleTextChange}
                          onBlur={rhfField.onBlur}
                          aria-label={inputLabel}
                          className={cn(Boolean(fieldState.error) && 'border-destructive focus-visible:ring-destructive')}
                        />
                      );
                  }
                };

                return (
                  <CmsFormItem className={itemClassName}>
                    {sharedLabel}
                    <CmsFormControl>{renderFieldControl()}</CmsFormControl>
                    <CmsFormMessage variant="destructive">
                      {fieldState.error?.message}
                    </CmsFormMessage>
                  </CmsFormItem>
                );
              }}
            />
          ))}

          {includeConsent && (
            <CmsFormField
              control={control}
              name="consent"
              rules={{
                validate: (value: unknown) =>
                  value === true || CONSENT_ERROR_MESSAGE,
              }}
              render={({ field: rhfField, fieldState }) => (
                <CmsFormItem className="simple-form-consent">
                  <div
                    className={cn(
                      'flex items-start',
                      dsSpacing.gap('xs'),
                    )}
                  >
                    <CmsFormControl>
                      <Checkbox
                        id="consent"
                        checked={Boolean(rhfField.value)}
                        onCheckedChange={(checked) =>
                          handleValidationChange(
                            'consent',
                            rhfField.onChange,
                            Boolean(checked),
                          )
                        }
                        onBlur={rhfField.onBlur}
                      />
                    </CmsFormControl>
                    <div>
                      <CmsFormLabel htmlFor="consent" className="text-sm font-medium leading-snug">
                        {sanitizeText(effectiveContent.consentText)}
                      </CmsFormLabel>
                    </div>
                  </div>
                  <CmsFormMessage variant="destructive">
                    {fieldState.error?.message}
                  </CmsFormMessage>
                </CmsFormItem>
              )}
            />
          )}

          {includeHoneypot && (
            <Input
              aria-hidden="true"
              tabIndex={-1}
              className="sr-only"
              {...register('_honeypot')}
            />
          )}

          {submitStatus !== 'idle' && statusMessage && (
            <CmsAlert
              variant={submitStatus === 'success' ? 'success' : 'destructive'}
              role={submitStatus === 'success' ? 'status' : 'alert'}
              className="simple-form-status"
            >
              <CmsAlertTitle>
                {submitStatus === 'success' ? 'Success' : 'Error'}
              </CmsAlertTitle>
              <CmsAlertDescription
                theme={cmsTheme}
                className={cn('flex flex-col', dsSpacing.gap('xs'))}
              >
                <p>{statusMessage}</p>
                {submitStatus === 'success' && successDescription ? (
                  <p className="text-sm text-muted-foreground">{successDescription}</p>
                ) : null}
                {submitStatus === 'success' && successCta ? (
                  <Button
                    asChild
                    variant="default"
                    size="sm"
                    className={dsSpacing.mt('xs')}
                  >
                    <a
                      href={successCta.href}
                      target={successCta.newTab ? '_blank' : undefined}
                      rel={successCta.newTab ? 'noreferrer' : undefined}
                    >
                      {successCta.label}
                    </a>
                  </Button>
                ) : null}
              </CmsAlertDescription>
            </CmsAlert>
          )}

          <Button
            type="submit"
            variant="default"
            size="lg"
            className={cn(
              'simple-form-submit w-full justify-center font-bold tracking-tight',
              'transition-shadow hover:shadow-md',
              effectiveContent.layout === 'inline' && 'md:w-auto'
            )}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>{effectiveContent.submitButton.loadingText || 'Submitting…'}</span>
              </>
            ) : (
              effectiveContent.submitButton.text
            )}
          </Button>
        </CmsFormRoot>
      </CmsForm>
      </div>
    </CmsSection>
  );
};

export default React.memo(SimpleForm);
