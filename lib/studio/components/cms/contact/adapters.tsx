import React from 'react';
import { CMSComponentProps, ComponentType } from '@/lib/studio/components/cms/_core/types';
import { withPerformanceTracking } from '@/lib/studio/components/cms/_core/monitoring';
import { readRuntimeContent } from '@/lib/studio/components/cms/_core/utils';
import ContactForm from './contact-form';
import ContactInfo from './contact-info';
import LocationMap from './location-map';
import SimpleForm from './simple-form';
import { ContactFormContent, ContactFormProps } from './contact-form/contact-form.types';
import { ContactInfoContent, ContactInfoProps } from './contact-info/contact-info.types';
import { LocationMapContent, LocationMapProps } from './location-map/location-map.types';
import { SimpleFormContent, SimpleFormProps } from './simple-form/simple-form.types';

// Create performance-tracked versions of components
const ContactFormWithPerformance = withPerformanceTracking(ContactForm, ComponentType.ContactForm);
const ContactInfoWithPerformance = withPerformanceTracking(ContactInfo, ComponentType.ContactInfo);
const LocationMapWithPerformance = withPerformanceTracking(LocationMap, ComponentType.LocationMap);
const SimpleFormWithPerformance = withPerformanceTracking(SimpleForm, ComponentType.SimpleForm);

/**
 * Adapter for ContactForm component
 * Converts generic CMSComponentProps to ContactFormProps
 */
export const ContactFormAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<ContactFormContent>(props.content) as ContactFormContent;
  
  const adaptedProps: ContactFormProps = {
    id: props.id,
    type: ComponentType.ContactForm,
    category: props.category,
    content: content,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'eager',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    onLoad: props.onLoad,
    onError: props.onError,
    onInteraction: props.onInteraction,
  };
  
  return <ContactFormWithPerformance {...adaptedProps} />;
};

/**
 * Adapter for ContactInfo component
 * Converts generic CMSComponentProps to ContactInfoProps
 */
export const ContactInfoAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<ContactInfoContent>(props.content) as ContactInfoContent;
  
  const adaptedProps: ContactInfoProps = {
    id: props.id,
    type: ComponentType.ContactInfo,
    category: props.category,
    content: content,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'eager',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    onLoad: props.onLoad,
    onError: props.onError,
    onInteraction: props.onInteraction,
  };
  
  return <ContactInfoWithPerformance {...adaptedProps} />;
};

/**
 * Adapter for LocationMap component
 * Converts generic CMSComponentProps to LocationMapProps
 */
export const LocationMapAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<LocationMapContent>(props.content) as LocationMapContent;
  
  const adaptedProps: LocationMapProps = {
    id: props.id,
    type: ComponentType.LocationMap,
    category: props.category,
    content: content,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'eager',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    onLoad: props.onLoad,
    onError: props.onError,
    onInteraction: props.onInteraction,
  };
  
  return <LocationMapWithPerformance {...adaptedProps} />;
};

/**
 * Adapter for SimpleForm component
 * Converts generic CMSComponentProps to SimpleFormProps
 */
export const SimpleFormAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<SimpleFormContent>(props.content) as SimpleFormContent;
  
  const adaptedProps: SimpleFormProps = {
    id: props.id,
    type: ComponentType.SimpleForm,
    category: props.category,
    content: content,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'eager',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    onLoad: props.onLoad,
    onError: props.onError,
    onInteraction: props.onInteraction,
  };
  
  return <SimpleFormWithPerformance {...adaptedProps} />;
};
