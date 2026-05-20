import { CMSComponentProps, ComponentType, ComponentCategory } from '@/lib/studio/components/cms/_core/types';

export type SimpleFormTemplate = 'newsletter' | 'quick-contact' | 'callback' | 'custom';
export type SimpleFormLayout = 'inline' | 'stacked';

export interface SimpleFormField {
  name: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'time';
  label?: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>; // For select fields
}

export interface SimpleFormContent {
  template?: SimpleFormTemplate;
  title?: string;
  description?: string;
  fields: SimpleFormField[]; // Maximum 3 fields
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
  consentText?: string; // GDPR consent checkbox
  layout?: SimpleFormLayout;
  maxWidth?: string | number; // Default 500px
  endpoint?: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  resetOnSuccess?: boolean;
  honeypot?: boolean;
}

export interface SimpleFormProps extends CMSComponentProps {
  type: ComponentType.SimpleForm;
  category: ComponentCategory;
  content: SimpleFormContent;
}

// Template presets
export const FORM_TEMPLATES = {
  newsletter: {
    title: 'Subscribe to Newsletter',
    description: 'Get the latest updates delivered to your inbox',
    fields: [
      {
        name: 'email',
        type: 'email' as const,
        label: undefined,
        placeholder: 'Enter your email',
        required: true,
      } as SimpleFormField,
    ],
    submitButton: {
      text: 'Subscribe',
      loadingText: 'Subscribing…',
    },
    successMessage: 'Thank you for subscribing!',
    consentText: 'I agree to receive marketing emails',
  },
  'quick-contact': {
    title: 'Quick Contact',
    description: 'Send us a quick message',
    fields: [
      {
        name: 'name',
        type: 'text' as const,
        label: undefined,
        placeholder: 'Your name',
        required: true,
      } as SimpleFormField,
      {
        name: 'email',
        type: 'email' as const,
        label: undefined,
        placeholder: 'Your email',
        required: true,
      } as SimpleFormField,
    ],
    submitButton: {
      text: 'Send Message',
      loadingText: 'Sending…',
    },
    successMessage: 'Message sent successfully!',
  },
  callback: {
    title: 'Request a Callback',
    description: "We'll call you back as soon as possible",
    fields: [
      {
        name: 'name',
        type: 'text' as const,
        label: undefined,
        placeholder: 'Your name',
        required: true,
      } as SimpleFormField,
      {
        name: 'phone',
        type: 'tel' as const,
        label: undefined,
        placeholder: 'Your phone number',
        required: true,
      } as SimpleFormField,
      {
        name: 'preferredTime',
        type: 'select' as const,
        label: 'Preferred time',
        placeholder: undefined,
        required: false,
        options: [
          { value: 'morning', label: 'Morning (9AM-12PM)' },
          { value: 'afternoon', label: 'Afternoon (12PM-5PM)' },
          { value: 'evening', label: 'Evening (5PM-8PM)' },
        ],
      } as SimpleFormField,
    ],
    submitButton: {
      text: 'Request Callback',
      loadingText: 'Requesting…',
    },
    successMessage: 'Callback request received!',
  },
};
