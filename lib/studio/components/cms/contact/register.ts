import { CMSComponentFactory } from '@/lib/studio/components/cms/_factory/factory';
import { ComponentType, ComponentCategory } from '@/lib/studio/components/cms/_core/types';
import { detectionToAIMetadata } from '@/lib/studio/components/cms/_core/component-definition';
import {
  ContactFormAdapter,
  ContactInfoAdapter,
  LocationMapAdapter,
  SimpleFormAdapter
} from './adapters';
import { ContactFormDef } from './contact-form/contact-form.def';
import { ContactInfoDef } from './contact-info/contact-info.def';
import { LocationMapDef } from './location-map/location-map.def';
import { SimpleFormDef } from './simple-form/simple-form.def';

/**
 * Register all contact components with the CMS factory
 * Story 10.10: Contact & Forms Components
 */
export function registerContactComponents(): void {
  const factory = CMSComponentFactory.getInstance();

  // Register ContactForm
  factory.register({
    type: ComponentType.ContactForm,
    category: ComponentCategory.Contact,
    component: ContactFormAdapter,
    metadata: {
      name: 'Contact Form',
      description: ContactFormDef.description || 'Contact form component',
      version: '1.0.0',
      author: 'Catalyst Studio',
      tags: ['contact', 'form', 'email', 'message'],
      aiMetadata: detectionToAIMetadata(ContactFormDef.detection!, ComponentType.ContactForm),
    },
    schema: ContactFormDef.schema,
  });

  // Register ContactInfo
  factory.register({
    type: ComponentType.ContactInfo,
    category: ComponentCategory.Contact,
    component: ContactInfoAdapter,
    metadata: {
      name: 'Contact Info',
      description: ContactInfoDef.description || 'Contact information component',
      version: '1.0.0',
      author: 'Catalyst Studio',
      tags: ['contact', 'info', 'address', 'phone', 'email'],
      aiMetadata: detectionToAIMetadata(ContactInfoDef.detection!, ComponentType.ContactInfo),
    },
    schema: ContactInfoDef.schema,
  });

  // Register LocationMap
  factory.register({
    type: ComponentType.LocationMap,
    category: ComponentCategory.Contact,
    component: LocationMapAdapter,
    metadata: {
      name: 'Location Map',
      description: LocationMapDef.description || 'Location map component',
      version: '1.0.0',
      author: 'Catalyst Studio',
      tags: ['map', 'location', 'directions', 'google maps'],
      aiMetadata: detectionToAIMetadata(LocationMapDef.detection!, ComponentType.LocationMap),
    },
    schema: LocationMapDef.schema,
  });

  // Register SimpleForm
  factory.register({
    type: ComponentType.SimpleForm,
    category: ComponentCategory.Contact,
    component: SimpleFormAdapter,
    metadata: {
      name: 'Simple Form',
      description: SimpleFormDef.description || 'Simple form component',
      version: '1.0.0',
      author: 'Catalyst Studio',
      tags: ['newsletter', 'signup', 'subscribe', 'quick contact'],
      aiMetadata: detectionToAIMetadata(SimpleFormDef.detection!, ComponentType.SimpleForm),
    },
    schema: SimpleFormDef.schema,
  });
}

// Auto-register on import
registerContactComponents();
