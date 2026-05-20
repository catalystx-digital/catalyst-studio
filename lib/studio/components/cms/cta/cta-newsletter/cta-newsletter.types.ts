import { CMSComponentProps } from '../../_core/types';

export interface CTANewsletterContent {
  heading: string;
  subheading?: string;
  subheadingHtml?: string;
  placeholder?: string;
  buttonText?: string;
  successMessage?: string;
  successDescription?: string;
  successCta?: {
    label: string;
    href: string;
    newTab?: boolean;
  };
  errorMessage?: string;
  validationErrorMessage?: string;
  networkErrorMessage?: string;
  privacyText?: string;
  privacyLink?: string;
  layout?: 'horizontal' | 'vertical' | 'compact';
  backgroundColor?: string;
  formAction?: string;
  emailFieldName?: string;
  honeypot?: boolean;
}

export interface CTANewsletterProps extends CMSComponentProps {
  content: CTANewsletterContent;
}
