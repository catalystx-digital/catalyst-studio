'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { Facebook, Twitter, Linkedin, Instagram, Youtube, Github, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CmsForm,
  CmsFormControl,
  CmsFormField,
  CmsFormItem,
  CmsFormLabel,
  CmsFormMessage,
  CmsFormRoot,
  cmsBody,
  cmsHeading,
  dsSpacing,
} from '../../_ui';
import type { ComponentTheme } from '../../_core/types';
import type { FooterProps, FooterSocialLink } from './footer.types';

const SOCIAL_ICONS: Record<FooterSocialLink['platform'], React.ComponentType<{ className?: string }>> = {
  facebook: Facebook,
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  github: Github,
  website: Globe,
};

type FooterClientProps = Pick<FooterProps, 'content' | 'onInteraction' | 'theme'>;
type NewsletterFormValues = { email: string };

export function FooterClient({ content, onInteraction, theme }: FooterClientProps) {
  const columnSocialUrls = new Set(
    (Array.isArray(content.columns) ? content.columns : [])
      .flatMap(column => (Array.isArray(column.links) ? column.links : []))
      .map(link => {
        const href = link?.href;
        if (typeof href === 'string') return href;
        if (href && typeof href === 'object') {
          const record = href as Record<string, unknown>;
          return typeof record.url === 'string' ? record.url : typeof record.href === 'string' ? record.href : undefined;
        }
        return undefined;
      })
      .filter((href): href is string => Boolean(href)),
  );
  const socialLinks = Array.isArray(content.socialLinks)
    ? content.socialLinks.filter(social => !columnSocialUrls.has(social.url))
    : [];
  const newsletter = content.newsletter;
  const cmsTheme = (typeof theme === 'string' ? theme : undefined) as ComponentTheme | undefined;

  const form = useForm<NewsletterFormValues>({
    defaultValues: { email: '' },
    mode: 'onSubmit',
  });

  const handleNewsletterSubmit = React.useCallback(
    (values: NewsletterFormValues) => {
      if (!values.email) return;
      onInteraction?.('newsletter-submit', { email: values.email });
      form.reset();
    },
    [onInteraction, form],
  );

  if (socialLinks.length === 0 && !newsletter) return null;

  return (
    <div className={cn('flex flex-col', dsSpacing.gap('xl'))}>
      {/* Social Links */}
      {socialLinks.length > 0 && (
        <div className={cn('flex flex-wrap justify-center', dsSpacing.gap('md'))}>
          {socialLinks.map((social, i) => {
            const Icon = SOCIAL_ICONS[social.platform];
            if (!Icon) return null;

            return (
              <Button
                key={`${social.platform}-${i}`}
                asChild
                size="icon"
                variant="secondary"
                className="cms-button h-12 w-12 rounded-full transition-transform"
              >
                <a
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label || `Visit our ${social.platform}`}
                >
                  <Icon className="h-6 w-6" />
                </a>
              </Button>
            );
          })}
        </div>
      )}

      {/* Newsletter */}
      {newsletter && (
        <div className={cn('mx-auto flex w-full max-w-xl flex-col text-center', dsSpacing.gap('md'))}>
          <div className={dsSpacing.spaceY('sm')}>
            <h3 className={cmsHeading(5, cmsTheme, 'text-center')}>{newsletter.heading}</h3>
            {newsletter.description && (
              <p className={cmsBody('sm', cmsTheme, 'text-center')}>{newsletter.description}</p>
            )}
          </div>

          <CmsForm {...form}>
            <CmsFormRoot
              onSubmit={form.handleSubmit(handleNewsletterSubmit)}
              className={cn('flex flex-col sm:flex-row sm:items-start', dsSpacing.gap('sm'))}
            >
              <CmsFormField
                control={form.control}
                name="email"
                rules={{
                  required: 'Email is required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
                }}
                render={({ field, fieldState }) => (
                  <CmsFormItem className={cn('flex w-full flex-col sm:flex-1', dsSpacing.gap('xxs'))}>
                    <CmsFormLabel className="sr-only">Email address</CmsFormLabel>
                    <CmsFormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder={newsletter.placeholder || 'Enter your email'}
                      />
                    </CmsFormControl>
                    <CmsFormMessage className="text-left">{fieldState.error?.message}</CmsFormMessage>
                  </CmsFormItem>
                )}
              />
              <Button type="submit" variant="default" className="h-11 w-full sm:w-auto">
                {newsletter.buttonText || 'Subscribe'}
              </Button>
            </CmsFormRoot>
          </CmsForm>
        </div>
      )}
    </div>
  );
}
