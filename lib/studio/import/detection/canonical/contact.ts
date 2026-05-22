import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { registerCanonicalComponent } from './registry'
import type { CanonicalComponentDefinition } from './registry'

let registered = false

export const contactCanonicalDefinitions: CanonicalComponentDefinition[] = [
  {
    canonicalType: ComponentType.ContactForm,
    componentType: ComponentType.ContactForm,
    summary: 'Contact form for inquiries, lead capture, or support requests.',
    fragments: ['form', 'form-field', 'submit-button'],
    cues: ['contact form', 'lead form', 'inquiry form'],
    sampleContent: {
      title: 'Contact our team',
      description: 'Tell us about your upcoming project and we will reach out within one business day.',
      fields: [
        { name: 'name', type: 'text', label: 'Name', required: true },
        { name: 'email', type: 'email', label: 'Work email', required: true },
        { name: 'message', type: 'textarea', label: 'How can we help?', required: true }
      ],
      submitButton: { text: 'Submit inquiry' },
      successMessage: 'Thanks! We’ll be in touch shortly.'
    }
  },
  {
    canonicalType: ComponentType.ContactInfo,
    componentType: ComponentType.ContactInfo,
    summary: 'Contact information block with addresses, phone numbers, email, and support hours.',
    fragments: ['address', 'phone', 'email'],
    cues: ['contact info', 'office details', 'support contacts'],
    sampleContent: {
      heading: 'Connect with us',
      description: 'Offices in San Francisco and Sydney serving customers worldwide.',
      locations: [
        {
          name: 'San Francisco HQ',
          address: '548 Market St, San Francisco, CA',
          phone: '+1 (415) 555-1024',
          email: 'hello@catalyststudio.com'
        }
      ],
      supportHours: 'Mon-Fri 9am-6pm PT'
    }
  },
  {
    canonicalType: ComponentType.LocationMap,
    componentType: ComponentType.LocationMap,
    summary: 'Location map section for offices, venues, stores, or service locations.',
    fragments: ['map', 'location-pin', 'location-details'],
    cues: ['map embed', 'location map', 'store locator'],
    sampleContent: {
      heading: 'Find our offices',
      locations: [
        {
          name: 'Sydney',
          latitude: -33.8688,
          longitude: 151.2093,
          address: 'Level 19, 2 Chifley Square, Sydney NSW'
        }
      ],
      mapStyle: 'standard',
      zoom: 12
    }
  },
  {
    canonicalType: ComponentType.SimpleForm,
    componentType: ComponentType.SimpleForm,
    summary: 'Simple form for newsletter signup, access requests, or compact lead capture.',
    fragments: ['form', 'input-field', 'submit-button'],
    cues: ['simple form', 'lead capture form', 'newsletter form'],
    sampleContent: {
      heading: 'Request access',
      description: 'We’ll notify you when early access slots open up.',
      fields: [
        { name: 'email', type: 'email', label: 'Work email', required: true },
        { name: 'company', type: 'text', label: 'Company', required: false }
      ],
      submitButton: { text: 'Request invite' }
    }
  }
]

export function registerContactCanonicalComponents(): void {
  if (registered) {
    return
  }

  for (const definition of contactCanonicalDefinitions) {
    registerCanonicalComponent(definition)
  }

  registered = true
}
