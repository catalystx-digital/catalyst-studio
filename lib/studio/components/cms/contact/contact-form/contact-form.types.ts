import { CMSComponentProps, ComponentType, ComponentCategory } from '@/lib/studio/components/cms/_core/types';

export type ContactFormFieldWidth = 'auto' | 'half' | 'full';

export interface ContactFormField {
  name: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox';
  label: string;
  placeholder?: string;
  required?: boolean;
  validation?: {
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    message?: string;
  };
  options?: Array<{ value: string; label: string }>; // For select fields
  /**
   * Optional layout hint used to group fields within responsive grids.
   * Defaults to `auto`, which infers a sensible width based on the field type.
   */
  width?: ContactFormFieldWidth;
}

export interface ContactFormConsentConfig {
  /**
   * Main label rendered next to the consent checkbox.
   */
  label: string;
  /**
   * Link details displayed alongside the consent text.
   */
  link?: {
    label: string;
    href: string;
  };
  /**
   * Optional helper copy shown beneath the consent label.
   */
  helperText?: string;
  /**
   * Optional custom validation message when consent is required but unchecked.
   */
  errorMessage?: string;
  /**
   * Allows overriding whether consent is required. Defaults to true.
   */
  required?: boolean;
}

export interface ContactFormContent {
  title?: string;
  description?: string;
  fields: ContactFormField[];
  submitButton: {
    text: string;
    loadingText?: string;
  };
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
  endpoint?: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  honeypot?: boolean; // Enable spam prevention
  resetOnSuccess?: boolean;
  consent?: ContactFormConsentConfig;
}

export interface ContactFormProps extends CMSComponentProps {
  type: ComponentType.ContactForm;
  category: ComponentCategory;
  content: ContactFormContent;
}

export interface FormData {
  [key: string]: string | boolean | undefined;
  _honeypot?: string;
  consentAccepted?: boolean;
}

export interface FormErrors {
  [key: string]: string;
}

export interface FormSubmissionResponse {
  success: boolean;
  message?: string;
  errors?: FormErrors;
}
