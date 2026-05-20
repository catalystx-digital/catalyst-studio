import type { Meta, StoryObj } from '@storybook/react';
import ContactInfo from './index';
import type { ContactInfoContent } from './contact-info.types';
import { ComponentType, ComponentCategory } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Contact/ContactInfo',
  component: ContactInfo,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof ContactInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

const defaultContent: ContactInfoContent = {
  businessName: 'Example Company',
  logoUrl: 'https://placehold.co/96x96/png',
  address: {
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    country: 'USA'
  },
  phoneNumbers: [
    { label: 'Main', number: '+1 234 567 8900' },
    { label: 'Support', number: '+1 987 654 3210' }
  ],
  emailAddresses: [
    { label: 'General', email: 'contact@example.com' },
    { label: 'Press', email: 'press@example.com' }
  ],
  businessHours: {
    monday: '9:00 AM – 5:00 PM',
    tuesday: '9:00 AM – 5:00 PM',
    wednesday: '9:00 AM – 5:00 PM',
    thursday: '9:00 AM – 5:00 PM',
    friday: '9:00 AM – 4:00 PM'
  },
  socialLinks: [
    { platform: 'facebook', url: 'https://facebook.com/example' },
    { platform: 'linkedin', url: 'https://linkedin.com/company/example' },
    { platform: 'instagram', url: 'https://instagram.com/example' }
  ],
  showCopyButtons: true,
  cardStyle: 'shadow'
};

export const Default: Story = {
  args: {
    id: 'contactinfo-1',
    type: ComponentType.ContactInfo,
    category: ComponentCategory.Contact,
    content: defaultContent
  }
};

export const DarkTheme: Story = {
  args: {
    ...Default.args,
    id: 'contactinfo-dark',
    theme: 'dark',
    content: {
      ...defaultContent,
      cardStyle: 'bordered'
    }
  }
};
