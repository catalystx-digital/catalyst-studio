import type { Meta, StoryObj } from '@storybook/react';
import ContactForm from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Contact/ContactForm',
  component: ContactForm,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof ContactForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: 'contactform-1',
    type: ComponentType.ContactForm,
    category: ComponentCategory.Contact,
    content: {
      title: 'Contact Us',
      description: 'Get in touch with our team',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true }
      ],
      submitButton: {
        text: 'Send Message'
      }
    }
  }
};
