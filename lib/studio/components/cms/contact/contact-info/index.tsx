'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import {
  Check,
  Clock,
  Copy,
  Facebook,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Twitter,
  Youtube,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { sanitizeText } from '../../_core/security';
import type { ComponentTheme } from '../../_core/types';
import { validateImageUrl, validateUrl } from '../../_utils/url-validation';
import {
  CmsBadge,
  CmsSection,
  CARD_TONES,
  cmsBody,
  cmsHeading,
  dsSpacing,
  themeClass,
} from '../../_ui';
import type { CmsCardTone } from '../../_ui';
import type { ContactInfoProps, SocialLink } from './contact-info.types';

const SOCIAL_ICON_MAP: Record<SocialLink['platform'], LucideIcon> = {
  facebook: Facebook,
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  github: Github,
  website: Globe,
};

const CARD_STYLE_CLASSNAME: Record<
  NonNullable<ContactInfoProps['content']['cardStyle']>,
  string
> = {
  bordered: 'border-border',
  shadow: 'shadow-lg shadow-background/20',
  none: '',
};

const SECTION_ICON_CLASS = 'mt-0.5 h-5 w-5 text-muted-foreground';
const LINK_CLASSNAME =
  'font-medium text-primary transition-colors hover:text-primary/80 focus-visible:underline';

function resolveSocialIcon(platform: SocialLink['platform']) {
  const Icon = SOCIAL_ICON_MAP[platform] ?? Globe;
  return (
    <Icon
      aria-hidden
      className="h-5 w-5 text-foreground transition-shadow ease-out"
    />
  );
}

const ContactInfo: React.FC<ContactInfoProps> = ({
  id,
  content,
  className,
  theme = 'auto',
  onInteraction,
}) => {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const cmsTheme = (typeof theme === 'string' ? theme : undefined) as
    | ComponentTheme
    | undefined;

  const phoneNumbers = useMemo(
    () => (Array.isArray(content.phoneNumbers) ? content.phoneNumbers : []),
    [content.phoneNumbers],
  );
  const emailAddresses = useMemo(
    () => (Array.isArray(content.emailAddresses) ? content.emailAddresses : []),
    [content.emailAddresses],
  );
  const socialLinks = useMemo(
    () => (Array.isArray(content.socialLinks) ? content.socialLinks : []),
    [content.socialLinks],
  );

  const addressText = useMemo(() => {
    if (!content.address) {
      return '';
    }

    const { street, city, state, zipCode, country } = content.address;
    const sanitizedStreet = sanitizeText(street ?? '');
    const sanitizedCity = sanitizeText(city ?? '');
    const sanitizedState = sanitizeText(state ?? '');
    const sanitizedZip = sanitizeText(zipCode ?? '');
    const sanitizedCountry = sanitizeText(country ?? '');

    const stateZip =
      sanitizedState && sanitizedZip
        ? `${sanitizedState} ${sanitizedZip}`
        : sanitizedState || sanitizedZip;

    return [sanitizedStreet, sanitizedCity, stateZip, sanitizedCountry]
      .filter((part) => part && part.length > 0)
      .join(', ');
  }, [content.address]);

  const googleMapsUrl = useMemo(() => {
    if (!addressText) {
      return '';
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`;
  }, [addressText]);

  const businessHoursEntries = useMemo(() => {
    if (!content.businessHours) {
      return [];
    }

    const entries: Array<{ label: string; value: string }> = [];
    const pushEntry = (label: string, value?: string) => {
      const sanitizedValue = sanitizeText(value ?? '');
      if (sanitizedValue.length > 0) {
        entries.push({ label, value: sanitizedValue });
      }
    };

    pushEntry('Monday', content.businessHours.monday);
    pushEntry('Tuesday', content.businessHours.tuesday);
    pushEntry('Wednesday', content.businessHours.wednesday);
    pushEntry('Thursday', content.businessHours.thursday);
    pushEntry('Friday', content.businessHours.friday);
    pushEntry('Saturday', content.businessHours.saturday);
    pushEntry('Sunday', content.businessHours.sunday);
    pushEntry('Holidays', content.businessHours.holidays);

    return entries;
  }, [content.businessHours]);

  const logoUrl = useMemo(
    () => validateImageUrl(content.logoUrl, ''),
    [content.logoUrl],
  );
  const businessName = sanitizeText(content.businessName ?? '');

  const normalizedPhones = useMemo(
    () =>
      phoneNumbers
        .map((phone, index) => {
          const sanitizedNumber = sanitizeText(phone.number);
          if (!sanitizedNumber) {
            return null;
          }

          const sanitizedLabel = sanitizeText(phone.label ?? '');
          const telHref = `tel:${phone.number.replace(/[^+\d]/g, '')}`;

          return {
            id: `phone-${index}`,
            label: sanitizedLabel,
            display: sanitizedNumber,
            href: telHref,
          };
        })
        .filter((value): value is {
          id: string;
          label: string;
          display: string;
          href: string;
        } => Boolean(value)),
    [phoneNumbers],
  );

  const normalizedEmails = useMemo(
    () =>
      emailAddresses
        .map((email, index) => {
          const sanitizedEmail = sanitizeText(email.email);
          if (!sanitizedEmail) {
            return null;
          }

          const sanitizedLabel = sanitizeText(email.label ?? '');

          return {
            id: `email-${index}`,
            label: sanitizedLabel,
            display: sanitizedEmail,
            href: `mailto:${sanitizedEmail}`,
          };
        })
        .filter((value): value is {
          id: string;
          label: string;
          display: string;
          href: string;
        } => Boolean(value)),
    [emailAddresses],
  );

  const primaryPhone = normalizedPhones[0];
  const additionalPhones = normalizedPhones.slice(1);
  const primaryEmail = normalizedEmails[0];
  const additionalEmails = normalizedEmails.slice(1);

  const copyTargets = useMemo(() => {
    if (!content.showCopyButtons) {
      return [];
    }

    const targets: Array<{
      id: string;
      label: string;
      value: string;
      analytics: Record<string, unknown>;
    }> = [];

    if (addressText) {
      targets.push({
        id: 'copy-address',
        label: 'Copy address',
        value: addressText,
        analytics: { source: 'address' },
      });
    }

    if (primaryPhone) {
      targets.push({
        id: `${primaryPhone.id}-primary`,
        label: `Copy ${primaryPhone.label || 'phone'}`,
        value: primaryPhone.display,
        analytics: {
          source: 'phone',
          label: primaryPhone.label || undefined,
        },
      });
    }

    if (primaryEmail) {
      targets.push({
        id: `${primaryEmail.id}-primary`,
        label: `Copy ${primaryEmail.label || 'email'}`,
        value: primaryEmail.display,
        analytics: {
          source: 'email',
          label: primaryEmail.label || undefined,
        },
      });
    }

    return targets;
  }, [addressText, content.showCopyButtons, primaryEmail, primaryPhone]);

  const handleCopy = useCallback(
    async (
      text: string,
      itemId: string,
      analyticsMetadata: Record<string, unknown>,
    ) => {
      if (!text) {
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        setCopiedItem(itemId);
        onInteraction?.('copy_click', analyticsMetadata);

        window.setTimeout(() => {
          setCopiedItem((current) => (current === itemId ? null : current));
        }, 2000);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.error('Failed to copy:', error);
        }
        onInteraction?.('copy_error', { itemId, error });
      }
    },
    [onInteraction],
  );

  const cardStyleClass =
    CARD_STYLE_CLASSNAME[content.cardStyle ?? 'none'] ?? '';

  const tone: CmsCardTone = 'minimal';

  return (
    <CmsSection
      id={id}
      size="sm"
      theme={cmsTheme}
      className={cn('contact-info', className)}
      containerClassName={cn('items-stretch', dsSpacing.gap('sm'))}
    >
      <Card
        className={cn('w-full', CARD_TONES[tone], themeClass(cmsTheme), cardStyleClass)}
      >
      {(businessName || logoUrl) && (
        <CardHeader
          className={cn(
            'flex flex-col gap-2 p-[var(--component-padding)] sm:flex-row sm:items-center sm:justify-between',
            themeClass(cmsTheme),
            dsSpacing.gap('md'),
          )}
        >
          <div
            className={cn('flex items-center', dsSpacing.gap('md'))}
          >
            {logoUrl && (
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-muted/40 shadow-sm transition-shadow  hover:shadow-md">
                <img
                  src={logoUrl}
                  alt={businessName || 'Business logo'}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              </div>
            )}

            {businessName && (
              <CardTitle className="mb-0 text-xl">
                {businessName}
              </CardTitle>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent
        className={cn(
          'grid p-[var(--component-padding)] pt-0',
          themeClass(cmsTheme),
          dsSpacing.gap('lg'),
          'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
        )}
      >
        <div className={cn('flex flex-col', dsSpacing.gap('lg'))}>
          {addressText && (
            <div
              className={cn('group flex items-start rounded-lg p-3 transition-colors duration-200 hover:bg-muted/30', dsSpacing.gap('sm'))}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-shadow">
                <MapPin aria-hidden className="h-5 w-5 text-primary" />
              </div>
              <div
                className={cn('flex-1 flex flex-col', dsSpacing.gap('xs'))}
              >
                <p className={cmsHeading(6, cmsTheme)}>Visit us</p>
                <a
                  href={googleMapsUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLASSNAME}
                  onClick={() =>
                    onInteraction?.('address_click', { href: googleMapsUrl })
                  }
                >
                  {addressText}
                </a>
              </div>
            </div>
          )}

          {(primaryPhone || primaryEmail) && (
            <div className={cn('flex flex-col', dsSpacing.gap('md'))}>
              <p className={cmsHeading(6, cmsTheme)}>Primary contact</p>
              <div className={cn('flex flex-col', dsSpacing.gap('sm'))}>
                {primaryPhone && (
                  <div
                    className={cn('group flex items-start rounded-lg p-3 transition-colors duration-200 hover:bg-muted/30', dsSpacing.gap('sm'))}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-shadow">
                      <Phone aria-hidden className="h-5 w-5 text-primary" />
                    </div>
                    <div
                      className={cn('flex-1 flex flex-col', dsSpacing.gap('xxs'))}
                    >
                      <div className={cn('flex items-center', dsSpacing.gap('xs'))}>
                        {primaryPhone.label && (
                          <CmsBadge
                            variant="outline"
                            theme={cmsTheme}
                            className="uppercase"
                          >
                            {primaryPhone.label}
                          </CmsBadge>
                        )}
                        <span className={cmsBody('sm', cmsTheme, 'text-muted-foreground')}>
                          Phone
                        </span>
                      </div>
                      <a
                        href={primaryPhone.href}
                        className={LINK_CLASSNAME}
                        onClick={() =>
                          onInteraction?.('phone_click', {
                            number: primaryPhone.display,
                          })
                        }
                      >
                        {primaryPhone.display}
                      </a>
                    </div>
                  </div>
                )}

                {primaryEmail && (
                  <div
                    className={cn('group flex items-start rounded-lg p-3 transition-colors duration-200 hover:bg-muted/30', dsSpacing.gap('sm'))}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-shadow">
                      <Mail aria-hidden className="h-5 w-5 text-primary" />
                    </div>
                    <div
                      className={cn('flex-1 flex flex-col', dsSpacing.gap('xxs'))}
                    >
                      <div className={cn('flex items-center', dsSpacing.gap('xs'))}>
                        {primaryEmail.label && (
                          <CmsBadge
                            variant="outline"
                            theme={cmsTheme}
                            className="uppercase"
                          >
                            {primaryEmail.label}
                          </CmsBadge>
                        )}
                        <span className={cmsBody('sm', cmsTheme, 'text-muted-foreground')}>
                          Email
                        </span>
                      </div>
                      <a
                        href={primaryEmail.href}
                        className={LINK_CLASSNAME}
                        onClick={() =>
                          onInteraction?.('email_click', {
                            email: primaryEmail.display,
                          })
                        }
                      >
                        {primaryEmail.display}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={cn('flex flex-col', dsSpacing.gap('lg'))}>
          {businessHoursEntries.length > 0 && (
            <div className={cn('flex flex-col', dsSpacing.gap('sm'))}>
              <div
                className={cn('flex items-center', dsSpacing.gap('sm'))}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Clock aria-hidden className="h-5 w-5 text-primary" />
                </div>
                <p className={cmsHeading(6, cmsTheme)}>Business hours</p>
              </div>
              <div
                className={cn(
                  'flex flex-col rounded-xl border border-border/40 bg-muted/40 shadow-sm transition-shadow duration-200 hover:shadow-md',
                  dsSpacing.gap('xxs'),
                  dsSpacing.padding('md'),
                )}
              >
                {businessHoursEntries.map(({ label, value }) => (
                  <div
                    key={label}
                    className={cn(
                      'flex flex-wrap items-center justify-between',
                      dsSpacing.gap('xs'),
                    )}
                  >
                    <span className={cmsBody('sm', cmsTheme, 'font-medium')}>
                      {label}
                    </span>
                    <span className={cmsBody('sm', cmsTheme, 'text-foreground')}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(additionalPhones.length > 0 || additionalEmails.length > 0) && (
            <Accordion
              type="multiple"
              className="w-full rounded-xl border border-border/40 bg-muted/30"
            >
              {additionalPhones.length > 0 && (
                <AccordionItem value="more-phones">
                  <AccordionTrigger
                    className={cn(
                      'text-left text-sm font-semibold',
                      dsSpacing.px('md'),
                      dsSpacing.py('sm'),
                    )}
                  >
                    Additional phone numbers
                  </AccordionTrigger>
                  <AccordionContent
                    className={cn(
                      'flex flex-col',
                      dsSpacing.gap('xs'),
                      dsSpacing.px('md'),
                      dsSpacing.pb('md'),
                    )}
                  >
                    {additionalPhones.map((phone) => (
                      <div
                        key={phone.id}
                        className={cn(
                          'flex flex-wrap items-center justify-between rounded-lg bg-card/60',
                          dsSpacing.gap('sm'),
                          dsSpacing.px('sm'),
                          dsSpacing.py('xs'),
                        )}
                      >
                        <div className="flex flex-col">
                          {phone.label && (
                            <span className={cmsBody('xs', cmsTheme, 'text-muted-foreground')}>
                              {phone.label}
                            </span>
                          )}
                          <a
                            href={phone.href}
                            className={LINK_CLASSNAME}
                            onClick={() =>
                              onInteraction?.('phone_click', {
                                number: phone.display,
                              })
                            }
                          >
                            {phone.display}
                          </a>
                        </div>
                        {content.showCopyButtons && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className={cn('flex items-center rounded-full text-xs', dsSpacing.gap('xs'), dsSpacing.px('sm'))}
                            onClick={() =>
                              handleCopy(phone.display, phone.id, {
                                source: 'phone',
                                label: phone.label || undefined,
                              })
                            }
                          >
                            {copiedItem === phone.id ? (
                              <Check aria-hidden className="h-4 w-4" />
                            ) : (
                              <Copy aria-hidden className="h-4 w-4" />
                            )}
                            <span>{copiedItem === phone.id ? 'Copied' : 'Copy'}</span>
                          </Button>
                        )}
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}

              {additionalEmails.length > 0 && (
                <AccordionItem value="more-emails">
                  <AccordionTrigger
                    className={cn(
                      'text-left text-sm font-semibold',
                      dsSpacing.px('md'),
                      dsSpacing.py('sm'),
                    )}
                  >
                    Additional email addresses
                  </AccordionTrigger>
                  <AccordionContent
                    className={cn(
                      'flex flex-col',
                      dsSpacing.gap('xs'),
                      dsSpacing.px('md'),
                      dsSpacing.pb('md'),
                    )}
                  >
                    {additionalEmails.map((email) => (
                      <div
                        key={email.id}
                        className={cn(
                          'flex flex-wrap items-center justify-between rounded-lg bg-card/60',
                          dsSpacing.gap('sm'),
                          dsSpacing.px('sm'),
                          dsSpacing.py('xs'),
                        )}
                      >
                        <div className="flex flex-col">
                          {email.label && (
                            <span className={cmsBody('xs', cmsTheme, 'text-muted-foreground')}>
                              {email.label}
                            </span>
                          )}
                          <a
                            href={email.href}
                            className={LINK_CLASSNAME}
                            onClick={() =>
                              onInteraction?.('email_click', {
                                email: email.display,
                              })
                            }
                          >
                            {email.display}
                          </a>
                        </div>
                        {content.showCopyButtons && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className={cn('flex items-center rounded-full text-xs', dsSpacing.gap('xs'), dsSpacing.px('sm'))}
                            onClick={() =>
                              handleCopy(email.display, email.id, {
                                source: 'email',
                                label: email.label || undefined,
                              })
                            }
                          >
                            {copiedItem === email.id ? (
                              <Check aria-hidden className="h-4 w-4" />
                            ) : (
                              <Copy aria-hidden className="h-4 w-4" />
                            )}
                            <span>{copiedItem === email.id ? 'Copied' : 'Copy'}</span>
                          </Button>
                        )}
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          )}

          {copyTargets.length > 0 && (
            <Accordion
              type="single"
              collapsible
              className="w-full rounded-xl border border-border/40 bg-muted/30"
            >
              <AccordionItem value="quick-actions">
                <AccordionTrigger className={cn('text-left text-sm font-semibold', dsSpacing.px('md'), dsSpacing.py('sm'))}>
                  Quick copy actions
                </AccordionTrigger>
                <AccordionContent className={cn('flex flex-wrap', dsSpacing.gap('xs'), dsSpacing.px('md'), dsSpacing.pb('md'))}>
                  {copyTargets.map((target) => (
                    <Button
                      key={target.id}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className={cn('flex items-center rounded-full text-xs', dsSpacing.gap('xs'), dsSpacing.px('sm'))}
                      onClick={() =>
                        handleCopy(target.value, target.id, target.analytics)
                      }
                    >
                      {copiedItem === target.id ? (
                        <Check aria-hidden className="h-4 w-4" />
                      ) : (
                        <Copy aria-hidden className="h-4 w-4" />
                      )}
                      <span>
                        {copiedItem === target.id ? 'Copied!' : target.label}
                      </span>
                    </Button>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      </CardContent>

      {socialLinks.length > 0 && (
        <CardFooter
          className={cn(
            'flex items-center gap-3 p-[var(--component-padding)] pt-0 flex-col',
            themeClass(cmsTheme),
            dsSpacing.gap('sm'),
            'border-t border-border/50',
            dsSpacing.pt('lg'),
          )}
        >
          <p className={cmsHeading(6, cmsTheme)}>Connect with us</p>
          <div
            className={cn('flex flex-wrap', dsSpacing.gap('sm'))}
          >
            {socialLinks.map((link, index) => {
              const sanitizedUrl = validateUrl(link.url, { fallback: '#' });
              const sanitizedLabel = sanitizeText(link.label ?? '');
              const platformLabel = sanitizedLabel || link.platform;
              const buttonId = `${link.platform}-${index}`;

              return (
                <Button
                  key={buttonId}
                  variant="secondary"
                  size="lg"
                  asChild
                  className={cn('group min-h-[var(--ds-social-chip-height,3rem)] rounded-full transition-shadow hover:shadow-md ', dsSpacing.px('lg'))}
                >
                  <a
                    href={sanitizedUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('group flex items-center text-sm font-medium text-foreground', dsSpacing.gap('xs'))}
                    onClick={() =>
                      onInteraction?.('social_click', {
                        platform: link.platform,
                        href: sanitizedUrl,
                      })
                    }
                    aria-label={`Visit our ${platformLabel}`}
                  >
                    {resolveSocialIcon(link.platform)}
                    <span>{platformLabel}</span>
                  </a>
                </Button>
              );
            })}
          </div>
        </CardFooter>
      )}
    </Card>
  </CmsSection>
);
};

export default React.memo(ContactInfo);
