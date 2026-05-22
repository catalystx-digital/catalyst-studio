'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  CmsFormDescription,
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
import { resolveLinkHref } from '../../navigation/footer/footer-link';
import type {
  ContactFormProps,
  ContactFormField,
  FormData,
  FormSubmissionResponse,
} from './contact-form.types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;

const DEFAULT_SUBMISSION_ERROR_MESSAGE = 'Failed to submit form. Please try again.';
const DEFAULT_VALIDATION_ERROR_MESSAGE = 'Please fix the highlighted fields and try again.';
const DEFAULT_NETWORK_ERROR_MESSAGE = 'We could not reach the server. Please try again later.';

function resolveFieldWidth(field: ContactFormField): 'half' | 'full' {
  const explicit = field.width ?? 'auto';
  if (explicit === 'half') return 'half';
  if (explicit === 'full') return 'full';

  if (field.type === 'textarea' || field.type === 'checkbox') {
    return 'full';
  }

  return 'half';
}

function buildDefaultValues(
  fields: ContactFormField[],
  includeHoneypot: boolean,
  includeConsent: boolean,
): FormData {
  const defaults: FormData = {};

  fields.forEach((field) => {
    defaults[field.name] = field.type === 'checkbox' ? false : '';
  });

  if (includeHoneypot) {
    defaults._honeypot = '';
  }

  if (includeConsent) {
    defaults.consentAccepted = false;
  }

  return defaults;
}

function buildValidationRules(field: ContactFormField) {
  const messages: Record<string, string> = {
    required: `${field.label} is required. Please fill in this field to continue.`,
    email: 'Please enter a valid email address (e.g., name@example.com).',
    phone: 'Please enter a valid phone number (e.g., 123-456-7890).',
    pattern: field.validation?.message || `${field.label} format is invalid. Please check and correct your input.`,
    minLength: `${field.label} must be at least ${field.validation?.minLength} characters. Please add more detail.`,
    maxLength: `${field.label} must not exceed ${field.validation?.maxLength} characters. Please shorten your input.`,
  };

  const rules: Record<string, unknown> = {};
  const validate: Record<string, (value: string | boolean) => true | string> = {};

  if (field.type === 'checkbox') {
    if (field.required) {
      validate.required = (value) =>
        value === true || messages.required;
    }
  } else {
    if (field.required) {
      rules.required = messages.required;
    }

    if (field.type === 'email') {
      validate.email = (value) => {
        if (!value && !field.required) return true;
        return EMAIL_REGEX.test(String(value)) || messages.email;
      };
    }

    if (field.type === 'tel') {
      validate.phone = (value) => {
        if (!value && !field.required) return true;
        return PHONE_REGEX.test(String(value)) || messages.phone;
      };
    }

    if (field.validation?.pattern) {
      validate.pattern = (value) => {
        if (!value) return true;
        return field.validation?.pattern?.test(String(value)) || messages.pattern;
      };
    }

    if (field.validation?.minLength) {
      rules.minLength = {
        value: field.validation.minLength,
        message: messages.minLength,
      };
    }

    if (field.validation?.maxLength) {
      rules.maxLength = {
        value: field.validation.maxLength,
        message: messages.maxLength,
      };
    }
  }

  if (Object.keys(validate).length > 0) {
    rules.validate = validate;
  }

  return rules;
}

function sanitizeSubmission(values: FormData): FormData {
  const entries = Object.entries(values).filter(([key, value]) => {
    if (key === '_honeypot') return false;
    if (typeof value === 'boolean') return true;
    return typeof value === 'string' ? value.trim().length > 0 : false;
  });

  return Object.fromEntries(entries);
}

const ContactForm: React.FC<ContactFormProps> = ({
  id,
  content,
  className,
  theme = 'auto',
  variant = 'default',
}) => {
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const fields = useMemo(() => Array.isArray(content.fields) ? content.fields : [], [content.fields]);
  const defaultValues = useMemo(
    () => buildDefaultValues(fields, Boolean(content.honeypot), Boolean(content.consent)),
    [fields, content.honeypot, content.consent],
  );

  const form = useForm<FormData>({
    defaultValues,
    mode: 'onChange',
    reValidateMode: 'onChange',
    shouldUnregister: false,
    shouldFocusError: true,
  });

  const { control, handleSubmit, reset, setError, trigger, formState, register } = form;
  const { isSubmitting } = formState;

  const consentConfig = content.consent;
  const consentFieldName = 'consentAccepted' as FieldPath<FormData>;
  const consentRequired = Boolean(consentConfig && consentConfig.required !== false);
  const consentErrorMessage =
    consentConfig?.errorMessage || 'Please accept the consent terms to continue. Check the checkbox above to proceed.';
  const consentFieldId = `${id ?? 'contact-form'}-consent`;
  const consentAccepted = form.watch(consentFieldName);
  const isSubmitDisabled = isSubmitting || (consentRequired && !consentAccepted);
  const consentLinkHref = resolveLinkHref(consentConfig?.link?.href);

  const triggerDebouncedValidation = useMemo(
    () =>
      debounce((name: string) => {
        trigger(name as FieldPath<FormData>);
      }, 300),
    [trigger],
  );

  const cmsTheme = (typeof theme === 'string' ? theme : undefined) as ComponentTheme | undefined;

  const resolvedMessages = useMemo(() => {
    const submissionError =
      (typeof content.errorMessage === 'string' && content.errorMessage.trim()) ||
      DEFAULT_SUBMISSION_ERROR_MESSAGE;

    const trimmedSuccessMessage = typeof content.successMessage === 'string' ? content.successMessage.trim() : undefined;
    const trimmedNetworkMessage = typeof content.networkErrorMessage === 'string' ? content.networkErrorMessage.trim() : undefined;
    const trimmedValidationMessage = typeof content.validationErrorMessage === 'string' ? content.validationErrorMessage.trim() : undefined;
    const trimmedSuccessDescription = typeof content.successDescription === 'string' ? content.successDescription.trim() : undefined;

    return {
      success: trimmedSuccessMessage || 'Form submitted successfully!',
      submissionError,
      networkError:
        trimmedNetworkMessage || submissionError || DEFAULT_NETWORK_ERROR_MESSAGE,
      validation:
        trimmedValidationMessage || DEFAULT_VALIDATION_ERROR_MESSAGE,
      successDescription: trimmedSuccessDescription || undefined,
      successCta: content.successCta,
    };
  }, [
    content.errorMessage,
    content.networkErrorMessage,
    content.successMessage,
    content.validationErrorMessage,
    content.successDescription,
    content.successCta,
  ]);

  const {
    success: resolvedSuccessMessage,
    submissionError: resolvedSubmissionErrorMessage,
    networkError: resolvedNetworkErrorMessage,
    validation: resolvedValidationErrorMessage,
    successDescription,
    successCta,
  } = resolvedMessages;
  const successCtaHref = resolveLinkHref(successCta?.href);

  const handleValidationChange = useCallback(
    (name: string, onChange: (value: unknown) => void, value: unknown) => {
      onChange(value);
      triggerDebouncedValidation(name);
    },
    [triggerDebouncedValidation],
  );

  const handleInvalidSubmit = useCallback(() => {
    setSubmitStatus('error');
    setStatusMessage(resolvedValidationErrorMessage);
  }, [resolvedValidationErrorMessage]);

  const onSubmit = useCallback(
    async (values: FormData) => {
      setSubmitStatus('idle');
      setStatusMessage('');

      if (content.honeypot && values._honeypot) {
        setSubmitStatus('success');
        setStatusMessage(resolvedSuccessMessage);
        if (content.resetOnSuccess) {
          reset(defaultValues);
        }
        return;
      }

      const submissionPayload = sanitizeSubmission(values);

      try {
        if (!content.endpoint) {
          if (process.env.NODE_ENV === 'development') {
          console.log('Form submission (mock):', submissionPayload);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          setSubmitStatus('success');
          const trimmedDevSuccess = content.successMessage?.trim();
          setStatusMessage(
            trimmedDevSuccess || 'Form submitted successfully (development mode)',
          );
          if (content.resetOnSuccess) {
            reset(defaultValues);
          }
          return;
        }

        const response = await fetch(content.endpoint, {
          method: content.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...content.headers,
          },
          body: JSON.stringify(submissionPayload),
        });

        if (!response) {
          throw new Error('No response received from the server.');
        }

        const result: FormSubmissionResponse = await response.json();

        if (result.success) {
          setSubmitStatus('success');
          setStatusMessage(result.message || resolvedSuccessMessage);
          if (content.resetOnSuccess) {
            reset(defaultValues);
          }
        } else {
          setSubmitStatus('error');
          setStatusMessage(result.message || resolvedSubmissionErrorMessage);

          if (result.errors) {
            Object.entries(result.errors).forEach(([fieldName, message]) => {
              setError(fieldName as FieldPath<FormData>, {
                type: 'server',
                message,
              });
            });
          }
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
      content,
      defaultValues,
      reset,
      setError,
      resolvedNetworkErrorMessage,
      resolvedSubmissionErrorMessage,
      resolvedSuccessMessage,
    ],
  );

  const renderField = useCallback(
    (field: ContactFormField) => (
      <CmsFormField
        key={field.name}
        control={control}
        name={field.name as FieldPath<FormData>}
        rules={buildValidationRules(field)}
        render={({ field: rhfField, fieldState }) => {
          const fieldError = fieldState.error?.message;
          const isCheckbox = field.type === 'checkbox';
          const inferredWidth = resolveFieldWidth(field);
          const colSpanClass =
            inferredWidth === 'half' && !isCheckbox ? 'md:col-span-1' : 'md:col-span-2';

          const sharedLabel = (
            <CmsFormLabel
              htmlFor={field.name}
              className={cn('inline-flex items-center font-semibold text-foreground', dsSpacing.gap('xxs'))}
            >
              {field.label}
              {field.required && <span aria-hidden="true" className="text-destructive">*</span>}
            </CmsFormLabel>
          );

          const handleTextChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            handleValidationChange(field.name, rhfField.onChange, event.target.value);
          };

          const renderInput = () => {
            switch (field.type) {
              case 'textarea': {
                const rawValue = (rhfField.value as string) ?? '';
                const maxLength = field.validation?.maxLength;
                const charCountId = maxLength ? `${field.name}-character-count` : undefined;

                return (
                  <div className={cn('flex flex-col', dsSpacing.gap('xxs'))}>
                    <Textarea
                      id={field.name}
                      placeholder={field.placeholder}
                      value={rawValue}
                      onChange={handleTextChange}
                      onBlur={rhfField.onBlur}
                      maxLength={maxLength}
                      aria-describedby={charCountId}
                      className={cn(Boolean(fieldError) && 'border-destructive focus-visible:ring-destructive')}
                    />
                    {typeof maxLength === 'number' ? (
                      <div
                        id={charCountId}
                        aria-live="polite"
                        className={cn(
                          'flex justify-end',
                          cmsBody('xs', cmsTheme, 'text-muted-foreground font-medium'),
                        )}
                      >
                        {rawValue.length} / {maxLength}
                      </div>
                    ) : null}
                  </div>
                );
              }
              case 'select':
                return (
                  <Select
                    value={(rhfField.value as string) ?? ''}
                    onValueChange={(value) => handleValidationChange(field.name, rhfField.onChange, value)}
                    onOpenChange={() => triggerDebouncedValidation(field.name)}
                  >
                    <SelectTrigger id={field.name}>
                      <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options
                        ?.filter((option) => option && typeof option.value === 'string' && option.value.length > 0)
                        .map((option, index) => (
                          <SelectItem key={`${option.value}-${index}`} value={option.value}>
                            {option.label || option.value}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                );
              case 'checkbox':
                return (
                  <div className={cn('flex items-start', dsSpacing.gap('sm'))}>
                    <CmsFormControl>
                      <Checkbox
                        id={field.name}
                        checked={Boolean(rhfField.value)}
                        onCheckedChange={(checked) =>
                          handleValidationChange(field.name, rhfField.onChange, Boolean(checked))
                        }
                        onBlur={rhfField.onBlur}
                      />
                    </CmsFormControl>
                    <div className={cn('flex flex-col', dsSpacing.gap('xs'))}>
                      <CmsFormLabel htmlFor={field.name} className="text-sm font-medium">
                        {field.label}
                      </CmsFormLabel>
                      {field.placeholder && (
                        <CmsFormDescription theme={cmsTheme}>
                          {field.placeholder}
                        </CmsFormDescription>
                      )}
                    </div>
                  </div>
                );
              default:
                return (
                  <Input
                    id={field.name}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={(rhfField.value as string) ?? ''}
                    onChange={handleTextChange}
                    onBlur={rhfField.onBlur}
                    className={cn(Boolean(fieldError) && 'border-destructive focus-visible:ring-destructive')}
                  />
                );
            }
          };

          return (
            <CmsFormItem className={cn('col-span-2', colSpanClass)}>
              {field.type !== 'checkbox' ? sharedLabel : null}
              <CmsFormControl>{renderInput()}</CmsFormControl>
              <CmsFormMessage variant="destructive">
                {fieldError}
              </CmsFormMessage>
            </CmsFormItem>
          );
        }}
      />
    ),
    [control, cmsTheme, variant, handleValidationChange, triggerDebouncedValidation],
  );

  if (fields.length === 0) {
    return (
      <CmsSection
        id={id}
        size="sm"
        theme={theme}
        variant={variant}
        className={cn('contact-form', className)}
        containerClassName={cn(
          'w-full',
          dsSpacing.gap('md'),
        )}
      >
        <div
          className={cn(
            'contact-form-container rounded-xl border border-dashed border-border/40 bg-muted/30 text-sm text-muted-foreground backdrop-blur-sm',
            dsSpacing.padding('lg'),
          )}
        >
          No form fields are configured for this form.
        </div>
      </CmsSection>
    );
  }

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      className={cn('contact-form', className)}
      data-theme={cmsTheme}
      data-variant={variant}
      containerClassName={cn('max-w-4xl', dsSpacing.gap('lg'))}
    >
      <div
        className={cn(
          'flex w-full flex-col rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 shadow-lg backdrop-blur-sm',
          dsSpacing.gap('lg'),
          dsSpacing.padding('2xl'),
        )}
      >
          {content.title && (
            <h2 className={cmsHeading(3, cmsTheme)}>{content.title}</h2>
          )}
          {content.description && (
            <p className={cmsBody('md', cmsTheme, 'text-muted-foreground')}>
              {content.description}
            </p>
          )}

          <CmsForm {...form} theme={cmsTheme} variant={variant}>
            <CmsFormRoot
              onSubmit={handleSubmit(onSubmit, handleInvalidSubmit)}
              noValidate
              className={cn(
                'grid auto-rows-max md:grid-cols-2 md:ds-gap-lg',
                dsSpacing.gap('lg'),
              )}
            >
              {fields.map((field) => renderField(field))}

              {consentConfig ? (
                <CmsFormField
                  control={control}
                  name={consentFieldName}
                  rules={
                    consentRequired
                      ? {
                          validate: (
                            value: string | boolean | undefined,
                          ) =>
                            value === true ||
                            value === 'true' ||
                            consentErrorMessage,
                        }
                      : undefined
                  }
                  render={({ field: consentField, fieldState }) => (
                    <CmsFormItem className="col-span-2">
                      <div className={cn('flex items-start', dsSpacing.gap('sm'))}>
                        <CmsFormControl>
                          <Checkbox
                            id={consentFieldId}
                            checked={Boolean(consentField.value)}
                            onCheckedChange={(checked) =>
                              handleValidationChange(
                                consentFieldName,
                                consentField.onChange,
                                Boolean(checked),
                              )
                            }
                            onBlur={consentField.onBlur}
                            aria-describedby={
                              consentConfig?.helperText ? `${consentFieldId}-helper` : undefined
                            }
                            aria-invalid={fieldState.invalid}
                          />
                        </CmsFormControl>
                        <div className={cn('flex flex-col', dsSpacing.gap('xxs'))}>
                          <CmsFormLabel
                            htmlFor={consentFieldId}
                            className="font-medium text-foreground"
                          >
                            <span>{consentConfig.label}</span>
                            {consentRequired ? (
                              <span aria-hidden="true" className="ml-1 text-destructive">
                                *
                              </span>
                            ) : null}
                          </CmsFormLabel>
                          {consentConfig.link && consentLinkHref ? (
                            <a
                              href={consentLinkHref}
                              className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {consentConfig.link.label}
                            </a>
                          ) : null}
                          {consentConfig.helperText ? (
                            <CmsFormDescription
                              id={`${consentFieldId}-helper`}
                              className="text-xs text-muted-foreground"
                            >
                              {consentConfig.helperText}
                            </CmsFormDescription>
                          ) : null}
                          <CmsFormMessage variant="destructive">
                            {fieldState.error?.message}
                          </CmsFormMessage>
                        </div>
                      </div>
                    </CmsFormItem>
                  )}
                />
              ) : null}

              {content.honeypot && (
                <Input
                  aria-hidden="true"
                  tabIndex={-1}
                  className="sr-only"
                  {...register('_honeypot')}
                />
              )}

              {submitStatus !== 'idle' && statusMessage && (
                <div className="col-span-2">
                  <CmsAlert
                    variant={submitStatus === 'success' ? 'success' : 'destructive'}
                    role={submitStatus === 'success' ? 'status' : 'alert'}
                  >
                    <CmsAlertTitle>
                      {submitStatus === 'success' ? 'Success' : 'Error'}
                    </CmsAlertTitle>
                    <CmsAlertDescription
                      theme={cmsTheme}
                      className={dsSpacing.spaceY('sm')}
                    >
                      <p>{statusMessage}</p>
                      {submitStatus === 'success' && successDescription ? (
                        <p className="text-sm text-muted-foreground">{successDescription}</p>
                      ) : null}
                      {submitStatus === 'success' && successCta && successCtaHref ? (
                        <Button
                          asChild
                          variant="default"
                          size="sm"
                          className={dsSpacing.mt('xs')}
                        >
                          <a
                            href={successCtaHref}
                            target={successCta.newTab ? '_blank' : undefined}
                            rel={successCta.newTab ? 'noreferrer' : undefined}
                          >
                            {successCta.label}
                          </a>
                        </Button>
                      ) : null}
                    </CmsAlertDescription>
                  </CmsAlert>
                </div>
              )}

              <div
                className={cn(
                  'col-span-2 flex flex-col md:flex-row md:justify-end',
                  dsSpacing.gap('sm'),
                )}
              >
                <Button
                  type="submit"
                  variant="default"
                  size="lg"
                  className="w-full justify-center md:w-auto"
                  disabled={isSubmitDisabled}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>{content.submitButton.loadingText || 'Submitting…'}</span>
                    </>
                  ) : (
                    content.submitButton.text
                  )}
                </Button>
              </div>
            </CmsFormRoot>
          </CmsForm>
      </div>
    </CmsSection>
  );
};

export default React.memo(ContactForm);
