'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { SafeHtml } from '../../_core/safe-html';
import { CmsAlert, CmsAlertDescription, CmsAlertTitle, CARD_TONES, themeClass, CmsForm, CmsFormControl, CmsFormField, CmsFormItem, CmsFormLabel, CmsFormMessage, CmsFormRoot, CmsSection, cmsBody, cmsHeading, dsSpacing } from '../../_ui';
import type { CTANewsletterProps, CTANewsletterContent } from './cta-newsletter.types';

export type { CTANewsletterProps, CTANewsletterContent } from './cta-newsletter.types';

type FormValues = { email: string; _honeypot?: string };
type Status = 'idle' | 'success' | 'error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LAYOUT_STYLES = {
  horizontal: { wrapper: 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-center', field: 'w-full sm:flex-1', button: 'w-full sm:w-auto sm:self-stretch' },
  vertical: { wrapper: 'flex flex-col gap-3', field: 'w-full', button: 'w-full' },
  compact: { wrapper: 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center', field: 'w-full sm:flex-1', button: 'w-full sm:w-auto' },
} as const;

const CTANewsletterComponent: React.FC<CTANewsletterProps> = (props) => {
  const { id, type, className, style, theme, onInteraction, content } = props;
  const { heading, subheading, subheadingHtml, placeholder = 'Enter your email', buttonText = 'Subscribe', privacyText, privacyLink, layout = 'horizontal', backgroundColor, formAction, emailFieldName, honeypot, successMessage = 'Thank you for subscribing!', errorMessage = 'Something went wrong. Please try again.', networkErrorMessage, validationErrorMessage = 'Please enter a valid email before submitting.', successDescription, successCta } = content ?? {};

  const [status, setStatus] = useState<Status>('idle');
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const form = useForm<FormValues>({ defaultValues: { email: '', ...(honeypot ? { _honeypot: '' } : {}) }, mode: 'onSubmit' });
  const { control, handleSubmit, reset, register, formState: { errors, isSubmitting } } = form;

  const layoutStyle = LAYOUT_STYLES[layout as keyof typeof LAYOUT_STYLES] ?? LAYOUT_STYLES.horizontal;
  const cardStyle = backgroundColor ? { backgroundColor } : undefined;
  const hasSubheadingHtml = Boolean(subheadingHtml?.trim());

  const onSubmit = useCallback(async (values: FormValues) => {
    setStatus('idle');
    setStatusDetail(null);
    if (honeypot && values._honeypot) { setStatus('success'); reset(); return; }
    onInteraction?.('newsletter-submit', { email: values.email });
    if (!formAction) { setStatus('success'); reset(); return; }
    try {
      const res = await fetch(formAction, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email: values.email, [emailFieldName ?? 'email']: values.email }) });
      if (!res.ok) throw new Error(await res.text().catch(() => '') || `Failed (${res.status})`);
      setStatus('success');
      reset();
    } catch (e) {
      setStatus('error');
      setStatusDetail(e instanceof TypeError ? (networkErrorMessage ?? errorMessage) : (e instanceof Error ? e.message : errorMessage));
    }
  }, [formAction, emailFieldName, honeypot, networkErrorMessage, errorMessage, onInteraction, reset]);

  const handleInvalid = useCallback(() => { setStatus('error'); setStatusDetail(validationErrorMessage); }, [validationErrorMessage]);
  const statusMsg = status === 'success' ? successMessage : status === 'error' ? (statusDetail ?? errorMessage) : null;

  return (
    <CmsSection container={false} size="md" theme={theme} className={cn('cms-cta-with-form w-full', className)} data-component-type={type} data-component-id={id} style={style}>
      <Card className={cn('flex flex-col mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8', CARD_TONES['default'], themeClass(theme), dsSpacing.gap('lg'))} style={cardStyle}>
        <CardHeader className={cn('flex flex-col gap-2 p-[var(--component-padding)]', themeClass(theme), 'text-center', dsSpacing.gap('sm'), dsSpacing.px('lg'), dsSpacing.pt('xl'), 'pb-0')}>
          {heading && <h2 className={cmsHeading(3, theme, 'text-inherit')}>{heading}</h2>}
          {hasSubheadingHtml ? (
            <SafeHtml html={subheadingHtml!} tag="p" className={cmsBody('md', theme, 'text-inherit/80')} />
          ) : subheading ? (
            <p className={cmsBody('md', theme, 'text-inherit/80')}>{subheading}</p>
          ) : null}
        </CardHeader>
        <CardContent className={cn('p-[var(--component-padding)] pt-0', themeClass(theme), 'flex flex-col', dsSpacing.gap('sm'), dsSpacing.px('lg'), dsSpacing.pb('xl'), dsSpacing.pt('xs'))}>
          {status !== 'idle' && statusMsg && (
            <CmsAlert variant={status === 'success' ? 'success' : 'destructive'} role={status === 'success' ? 'status' : 'alert'}>
              <CmsAlertTitle>{status === 'success' ? 'Success' : 'Error'}</CmsAlertTitle>
              <CmsAlertDescription theme={theme} className="space-y-2">
                <p>{statusMsg}</p>
                {status === 'success' && successDescription && <p className="text-sm text-muted-foreground">{successDescription}</p>}
                {status === 'success' && successCta && <Button asChild variant="default" size="sm" className="mt-1"><a href={successCta.href} target={successCta.newTab ? '_blank' : undefined} rel={successCta.newTab ? 'noreferrer' : undefined}>{successCta.label}</a></Button>}
              </CmsAlertDescription>
            </CmsAlert>
          )}
          <CmsForm {...form} theme={theme}>
            <CmsFormRoot onSubmit={handleSubmit(onSubmit, handleInvalid)} className="w-full gap-4">
              <div className={layoutStyle.wrapper}>
                <CmsFormField control={control} name="email" rules={{ required: 'Email is required.', pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address.' } }} render={({ field }) => (
                  <CmsFormItem className={cn('flex flex-col gap-2', layoutStyle.field)}>
                    <CmsFormLabel htmlFor={`${id}-email`} className="sr-only">Email address</CmsFormLabel>
                    <CmsFormControl><Input {...field} id={`${id}-email`} placeholder={placeholder} autoComplete="email" /></CmsFormControl>
                    <CmsFormMessage variant="destructive">{errors.email?.message}</CmsFormMessage>
                  </CmsFormItem>
                )} />
                {honeypot && <Input aria-hidden="true" tabIndex={-1} className="sr-only" {...register('_honeypot')} />}
                <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting} className={cn('font-semibold', layoutStyle.button)}>
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /><span>Submitting…</span></> : buttonText}
                </Button>
              </div>
            </CmsFormRoot>
          </CmsForm>
        </CardContent>
        {privacyText && (
          <CardFooter className={cn('flex items-center gap-3 p-[var(--component-padding)] pt-0', themeClass(theme), 'flex flex-col items-center pt-0', dsSpacing.gap('xs'), dsSpacing.px('lg'), dsSpacing.pb('lg'))}>
            <p className={cmsBody('sm', theme, 'text-center text-muted-foreground')}>{privacyText}{privacyLink && <> <a href={privacyLink} className="font-medium underline decoration-border/60 underline-offset-4 hover:text-foreground">Privacy Policy</a></>}</p>
          </CardFooter>
        )}
      </Card>
    </CmsSection>
  );
};

export const CTANewsletter = withPerformanceTracking(CTANewsletterComponent, ComponentType.CTAWithForm);
export default CTANewsletter;
